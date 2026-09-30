import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getLbkTransaction } from "$lib/server/input-lbk";

export const GET: RequestHandler = async ({ url }) => {
  const moveId = url.searchParams.get("moveId");
  const moveType = url.searchParams.get("moveType") || "A";

  if (!moveId) {
    return json({ error: "Parameter 'moveId' wajib disertakan." }, 400);
  }

  try {
    const data = await getLbkTransaction(moveId, moveType);
    return json(data);
  } catch (error: any) {
    return json({ error: error?.message || "Gagal memuat transaksi LBK." }, 404);
  }
};
