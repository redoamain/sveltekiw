import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProductionTransaction } from "$lib/server/input-produksi";

export const GET: RequestHandler = async ({ url }) => {
  const prodId = url.searchParams.get("prodId") ?? "";
  if (!prodId.trim()) {
    return json({ error: "Parameter prodId wajib disertakan." }, { status: 400 });
  }

  try {
    const data = await getProductionTransaction(prodId);
    if (!data) {
      return json({ error: `Transaksi produksi '${prodId}' tidak ditemukan.` }, { status: 404 });
    }
    return json({ success: true, ...data });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mengambil data transaksi produksi." }, { status: 500 });
  }
};
