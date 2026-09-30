import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { searchGoods } from "$lib/server/kartu-stock";

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get("q")?.trim() ?? "";
  try {
    const items = await searchGoods(q, 30);
    return json({ items });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mencari barang." }, { status: 500 });
  }
};
