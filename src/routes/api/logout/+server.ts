import type { RequestHandler } from "@sveltejs/kit";
import { AUTH_COOKIE, decodeSession } from "$lib/auth";
import { deleteSession } from "$lib/session";
import { json } from "$lib/http";
import { logUserActivity } from "$lib/server/access-log";

export const POST: RequestHandler = async ({ cookies, request }) => {
  const token = (cookies.get(AUTH_COOKIE) ?? undefined);
  const user = decodeSession(token ?? null);
  if (user?.UserName) {
    await deleteSession(String(user.UserName)).catch(() => {});
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
    const ua = request.headers.get("user-agent");
    logUserActivity({
      userName: String(user.UserName),
      action: "LOGOUT",
      menuName: "Autentikasi",
      path: "/api/logout",
      method: "POST",
      ip,
      userAgent: ua,
      details: "Pengguna keluar sistem"
    }).catch(() => {});
  }
  cookies.delete(AUTH_COOKIE, { path: "/" });
  return json({ message: "Logout berhasil" }, 200);
};

export const GET: RequestHandler = async ({ cookies, request }) => {
  const token = (cookies.get(AUTH_COOKIE) ?? undefined);
  const user = decodeSession(token ?? null);
  if (user?.UserName) {
    await deleteSession(String(user.UserName)).catch(() => {});
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
    const ua = request.headers.get("user-agent");
    logUserActivity({
      userName: String(user.UserName),
      action: "LOGOUT",
      menuName: "Autentikasi",
      path: "/api/logout",
      method: "GET",
      ip,
      userAgent: ua,
      details: "Pengguna keluar sistem via link"
    }).catch(() => {});
  }
  cookies.delete(AUTH_COOKIE, { path: "/" });
  return new Response(null, {
    status: 302,
    headers: { Location: "/login" },
  });
};


