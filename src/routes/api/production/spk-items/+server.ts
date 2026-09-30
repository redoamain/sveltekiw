import type { RequestHandler } from "@sveltejs/kit";
import { json } from "$lib/http";
import { getSpkDetails } from "$lib/server/input-produksi";

export const GET: RequestHandler = async ({ url }) => {
  const orderId = url.searchParams.get("orderId") ?? "";
  const orderType = url.searchParams.get("orderType") ?? "OI";

  if (!orderId) {
    return json({ error: "Parameter orderId wajib diisi" }, 400);
  }

  try {
    const items = await getSpkDetails(orderId, orderType);
    return json({ items });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mengambil detail SPK" }, 500);
  }
};
