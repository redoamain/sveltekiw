import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getMutasiTransaction } from "$lib/server/input-mutasi";

export const GET: RequestHandler = async ({ url }) => {
  const moveId = url.searchParams.get("id") ?? "";
  const moveType = url.searchParams.get("type") ?? "R";

  if (!moveId.trim()) {
    return json({ error: "Parameter ID (MoveID) wajib diisi." }, 400);
  }

  try {
    const data = await getMutasiTransaction(moveId, moveType);
    if (!data) {
      return json({ error: `Transaksi Mutasi #${moveId} tidak ditemukan.` }, 404);
    }
    return json({ data });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal memuat data transaksi mutasi" }, 500);
  }
};
