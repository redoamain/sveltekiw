import type { RequestHandler } from "@sveltejs/kit";
import { AUTH_COOKIE, decodeSession, getSessionIdFromCookie } from "$lib/auth";
import { isSessionValid } from "$lib/session";
import { json } from "$lib/http";

export const GET: RequestHandler = async ({ cookies }) => {
  const token = (cookies.get(AUTH_COOKIE) ?? undefined);
  const user = decodeSession(token ?? null);
  if (!user) {
    return json({ valid: false, code: "NO_SESSION", error: "Belum login" }, 401);
  }
  const sid = getSessionIdFromCookie(token ?? null);
  if (!sid) {
    // sesi lama tanpa _sid — anggap valid (backward compat) tapi tidak enforce single-session
    return json({ valid: true, user }, 200);
  }
  const valid = await isSessionValid(String(user.UserName), sid);
  if (!valid) {
    return json({ valid: false, code: "SESSION_TAKEN", error: "Sesi telah diambil alih login di perangkat lain" }, 401);
  }
  return json({ valid: true, user }, 200);
};


