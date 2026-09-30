import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getNextLbmId } from "$lib/server/input-lbm";

export const GET: RequestHandler = async ({ url }) => {
  const moveType = (url.searchParams.get("moveType") || "A").toUpperCase() as "A" | "P" | "O";
  const date = url.searchParams.get("date") || undefined;

  try {
    const nextMoveId = await getNextLbmId(moveType, date);
    return json({ nextMoveId });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mendapatkan nomor LBM berikutnya" }, 500);
  }
};
