import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getLbmTransaction } from "$lib/server/input-lbm";

export const GET: RequestHandler = async ({ url }) => {
  const moveId = url.searchParams.get("moveId");
  const moveType = url.searchParams.get("moveType") || "A";

  if (!moveId) {
    return json({ error: "Parameter 'moveId' wajib disertakan." }, 400);
  }

  try {
    const data = await getLbmTransaction(moveId, moveType);
    return json(data);
  } catch (error: any) {
    return json({ error: error?.message || "Gagal memuat transaksi LBM." }, 404);
  }
};
