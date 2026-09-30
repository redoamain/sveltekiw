import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getLatestHppPrice } from "$lib/server/input-lbm";

export const GET: RequestHandler = async ({ url }) => {
  const itemId = url.searchParams.get("itemId") ?? "";

  try {
    const hppPrice = await getLatestHppPrice(itemId);
    return json({ itemId, hppPrice });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mengambil data HPP barang" }, 500);
  }
};
