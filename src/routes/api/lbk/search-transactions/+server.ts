import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { searchLbkTransactions } from "$lib/server/input-lbk";

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get("q") || "";
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  try {
    const results = await searchLbkTransactions(q, limit);
    return json({ results });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mencari transaksi LBK." }, 500);
  }
};
