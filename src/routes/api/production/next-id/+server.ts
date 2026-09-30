import type { RequestHandler } from "@sveltejs/kit";
import { json } from "$lib/http";
import { getNextProductionId } from "$lib/server/input-produksi";

export const GET: RequestHandler = async ({ url }) => {
  const dept = url.searchParams.get("dept") ?? "AS";
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  try {
    const nextProdId = await getNextProductionId(dept, date);
    return json({ prodId: nextProdId });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mendapatkan Next ProdID" }, 500);
  }
};
