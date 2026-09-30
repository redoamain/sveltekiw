import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getNextLbkId } from "$lib/server/input-lbk";

export const GET: RequestHandler = async ({ url }) => {
  const moveType = (url.searchParams.get("moveType") || "A").toUpperCase() as "A" | "P" | "O";
  const date = url.searchParams.get("date") || undefined;

  try {
    const nextMoveId = await getNextLbkId(moveType, date);
    return json({ nextMoveId });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mendapatkan nomor LBK berikutnya" }, 500);
  }
};
