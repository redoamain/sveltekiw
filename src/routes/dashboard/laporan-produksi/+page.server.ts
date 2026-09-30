import type { PageServerLoad } from "./$types";
import { getLaporanProduksiSPK } from "@/lib/server/laporan-produksi";

export const load: PageServerLoad = async ({ url, locals }) => {
  const dept = url.searchParams.get("dept")?.trim() || "";
  const q = url.searchParams.get("q")?.trim() || "";
  const tgl1 = url.searchParams.get("tgl1")?.trim() || "";
  const tgl2 = url.searchParams.get("tgl2")?.trim() || "";
  const statusParam = url.searchParams.get("status")?.trim();
  const status = statusParam === "completed" || statusParam === "ongoing" ? statusParam : "all";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(10, Math.min(500, Number(url.searchParams.get("pageSize")) || 25));

  try {
    const reportData = await getLaporanProduksiSPK({
      dept,
      q,
      tgl1,
      tgl2,
      status,
      page,
      pageSize,
    });

    return {
      ...reportData,
      filters: {
        dept,
        q,
        tgl1,
        tgl2,
        status,
        page,
        pageSize,
      },
    };
  } catch (err: any) {
    return {
      metrics: {
        totalSpk: 0,
        totalTargetQty: 0,
        totalHasilKgs: 0,
        totalHasilBags: 0,
        totalBahanKgs: 0,
        totalBahanBags: 0,
        avgCompletionPct: 0,
      },
      rows: [],
      total: 0,
      page: 1,
      pageSize: 25,
      departemenOptions: [
        { value: "", label: "Semua Departemen" },
        { value: "AS", label: "AS — ASSEMBLY" },
        { value: "IN", label: "IN — INJEKSI" },
        { value: "PL", label: "PL — PLATING" },
        { value: "SP", label: "SP — SPRAY" },
        { value: "MO", label: "MO — MOULDING" },
      ],
      filters: {
        dept,
        q,
        tgl1,
        tgl2,
        status,
        page,
        pageSize,
      },
      error: err?.message || "Gagal memuat laporan produksi SPK",
    };
  }
};
