import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { searchPurchasedGoods } from "$lib/server/kartu-stock";

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get("q")?.trim() ?? "";
  try {
    const items = await searchPurchasedGoods(q, 30);
    return json({ items });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mencari barang pembelian." }, { status: 500 });
  }
};
