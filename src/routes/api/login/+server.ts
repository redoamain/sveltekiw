import type { RequestHandler } from "@sveltejs/kit";
import { verifyCredentials, encodeSession, AUTH_COOKIE, DB_SOURCE_COOKIE, authCookieOptions } from "$lib/auth";
import { getActiveSession, createSession, deleteSession } from "$lib/session";
import { log } from "$lib/db";
import { json } from "$lib/http";
import { randomUUID } from "node:crypto";
import { logUserActivity } from "$lib/server/access-log";

// POST /api/login — dipakai oleh form login Astro & kompatibel dengan kiw (fetch JSON)
export const POST: RequestHandler = async ({ request, cookies, url }) => {
  let username = "";
  let password = "";
  let dbSource: "live" | "backup" = "live";

  const ct = request.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const body = await request.json().catch(() => null);
      username = String(body?.username ?? body?.UserName ?? "");
      password = String(body?.password ?? body?.Password ?? "");
      const src = String(body?.db_source ?? body?.dbSource ?? "live");
      dbSource = src === "backup" ? "backup" : "live";
    } else {
      // fallback: form-encoded (kompatibilitas)
      const fd = await request.clone().formData().catch(() => null);
      if (fd) {
        username = String(fd.get("username") ?? "");
        password = String(fd.get("password") ?? "");
        const src = String(fd.get("db_source") ?? "live");
        dbSource = src === "backup" ? "backup" : "live";
      } else {
        const body = await request.json().catch(() => null);
        username = String(body?.username ?? "");
        password = String(body?.password ?? "");
      }
    }
  } catch {
    // ignore
  }

  if (!username || !password) {
    return json({ error: "Username dan password wajib diisi" }, 400);
  }

  try {
    const useBackup = dbSource === "backup";
    const user = await verifyCredentials(username, password, useBackup);
    if (!user) {
      return json({ error: "Username atau password salah" }, 401);
    }

    // Single-session: hapus session lama jika ada (izinkan login baru)
    const existing = await getActiveSession(String(user.UserName));
    if (existing) {
      await deleteSession(String(user.UserName));
    }

    const sid = randomUUID();
    const token = encodeSession(user, sid);

    const isHttps =
      url.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https";
    const secure =
      process.env.COOKIE_SECURE !== undefined
        ? process.env.COOKIE_SECURE === "true"
        : isHttps;

    cookies.set(AUTH_COOKIE, token, authCookieOptions(secure));
    cookies.set(DB_SOURCE_COOKIE, dbSource, {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    // Simpan sesi aktif
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
    const ua = request.headers.get("user-agent");
    await createSession(String(user.UserName), sid, { ip, ua });

    // Log aktivitas login secara non-blocking
    logUserActivity({
      userName: String(user.UserName),
      action: "LOGIN",
      menuName: "Autentikasi",
      path: "/api/login",
      method: "POST",
      ip,
      userAgent: ua,
      details: `Login berhasil (Database: ${dbSource})`
    }).catch(() => {});

    // tetap set localStorage via response JSON agar kompatibel dengan alur kiw (opsional)
    return json({ message: "Login berhasil", user, db_source: dbSource }, 200);
  } catch (err) {
    log.error({ err, username }, "Login gagal");
    return json({ error: "Gagal terhubung ke database login" }, 500);
  }
};


