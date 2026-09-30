import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { searchMutasiTransactions } from "$lib/server/input-mutasi";

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get("q") ?? "";

  try {
    const transactions = await searchMutasiTransactions(q, 30);
    return json({ transactions });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mencari transaksi mutasi" }, 500);
  }
};
