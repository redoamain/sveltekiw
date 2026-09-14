// Auth helper — port dari kiw/src/app/api/login/route.ts
// Tabel: [MenuCP].[dbo].[taUser]  (UserName, Password plain — sesuai kiw)
// Session disimpan sebagai cookie HttpOnly `pp_session` (base64 JSON, tanpa password).
// Dengan begini SSR (Astro) bisa proteksi route di middleware.

import sql from "mssql";
import { getPoolLogin, getPoolBackupLogin } from "@/lib/db";
import { log } from "@/lib/db";

export const AUTH_COOKIE = "pp_session";
export const DB_SOURCE_COOKIE = "pp_db_source";
export const AUTH_MAX_AGE = 60 * 60 * 8; // 8 jam

export interface AuthUser {
  UserName: string;
  Nama?: string;
  Dept?: string;
  // field lain dari taUser disimpan apa adanya (tanpa Password)
  [k: string]: unknown;
}

// Verifikasi kredensial — return user tanpa Password jika ok, null jika salah
export async function verifyCredentials(
  username: string,
  password: string,
  useBackup = false,
): Promise<AuthUser | null> {
  const u = (username ?? "").trim();
  const p = (password ?? "").trim();
  if (!u || !p) return null;

  const pool = useBackup ? await getPoolBackupLogin() : await getPoolLogin();
  const result = await pool
    .request()
    .input("UserName", sql.VarChar, u)
    .query("SELECT * FROM [MenuCP].[dbo].[taUser] WHERE UserName = @UserName");

  const row = result.recordset[0] as (AuthUser & { Password?: string }) | undefined;
  if (!row) return null;
  if (row.Password !== p) return null;

  const { Password: _pw, ...safe } = row;
  return safe as AuthUser;
}

// Encode/decode cookie — base64url JSON (tanpa signature, internal LAN)
// _sid ditambahkan untuk single-session enforcement
export function encodeSession(user: AuthUser, sessionId?: string): string {
  const payload = { ...user, _t: Date.now(), ...(sessionId ? { _sid: sessionId } : {}) };
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

export function decodeSession(value: string | undefined | null): AuthUser | null {
  if (!value) return null;
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const obj = JSON.parse(json) as AuthUser & { _t?: number; _sid?: string };
    if (!obj?.UserName) return null;
    if (obj._t && Date.now() - obj._t > AUTH_MAX_AGE * 1000) return null;
    const { _t: _ignored, _sid: _sidIgnored, ...user } = obj as AuthUser & { _t?: number; _sid?: string };
    return user as AuthUser;
  } catch {
    return null;
  }
}

export function getSessionIdFromCookie(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const obj = JSON.parse(json) as { _sid?: string };
    return obj?._sid ?? null;
  } catch {
    return null;
  }
}

// Dipakai di Astro page: Astro.cookies.get(AUTH_COOKIE)?.value
export function getUserFromCookie(cookieValue: string | undefined): AuthUser | null {
  return decodeSession(cookieValue);
}

// Type helper untuk Astro middleware / API
export function authCookieOptions(maxAge = AUTH_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
