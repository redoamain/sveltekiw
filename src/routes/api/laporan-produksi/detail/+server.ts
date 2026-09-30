import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getDetailProduksiSPK } from "@/lib/server/laporan-produksi";

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const orderId = url.searchParams.get("orderId");
  if (!orderId || !orderId.trim()) {
    throw error(400, "Parameter 'orderId' wajib diisi.");
  }

  try {
    const detail = await getDetailProduksiSPK(orderId.trim());
    if (!detail) {
      throw error(404, `SPK '${orderId}' tidak ditemukan atau belum memiliki transaksi produksi.`);
    }

    return json({
      success: true,
      data: detail,
    });
  } catch (err: any) {
    if (err?.status) throw err;
    throw error(500, err?.message || "Gagal mengambil rincian detail SPK.");
  }
};
