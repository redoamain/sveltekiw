import type { RequestHandler } from "@sveltejs/kit";
import { json } from "$lib/http";
import { searchGoods } from "$lib/server/input-produksi";

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get("q") ?? "";

  try {
    const items = await searchGoods(q, 30);
    return json({ items });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mencari barang" }, 500);
  }
};
