import type { RequestHandler } from "@sveltejs/kit";
import { json } from "$lib/http";
import { getNextMutasiId } from "$lib/server/input-mutasi";

export const GET: RequestHandler = async ({ url }) => {
  const moveType = (url.searchParams.get("moveType") || "R").toUpperCase() as "R" | "M";
  const date = url.searchParams.get("date") || undefined;

  try {
    const nextMoveId = await getNextMutasiId(moveType, date);
    return json({ nextMoveId });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mendapatkan nomor mutasi berikutnya" }, 500);
  }
};
