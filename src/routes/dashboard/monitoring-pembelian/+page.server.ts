import type { PageServerLoad } from "./$types";
import { getMonitoringPembelian } from "$lib/server/monitoring-pembelian";

export const load: PageServerLoad = async ({ url }) => {
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultEnd = now.toISOString().slice(0, 10);

  const tgl1 = url.searchParams.get("tgl1")?.trim() || defaultStart;
  const tgl2 = url.searchParams.get("tgl2")?.trim() || defaultEnd;
  const q = url.searchParams.get("q")?.trim() || "";
  const status = url.searchParams.get("status")?.trim().toLowerCase() || "all";
  const currency = url.searchParams.get("currency")?.trim().toUpperCase() || "ALL";

  const pageRaw = parseInt(url.searchParams.get("page") ?? "1", 10);
  const psRaw = parseInt(url.searchParams.get("pageSize") ?? "25", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = [10, 25, 50, 100].includes(psRaw) ? psRaw : 25;

  let allGroups: any[] = [];
  let totalPOs = 0;
  let totalLocal = 0;
  let totalImport = 0;
  let totalCompleted = 0;
  let totalPartial = 0;
  let totalPending = 0;
  let error = "";

  try {
    const res = await getMonitoringPembelian({
      tgl1,
      tgl2,
      q: q || undefined,
      status: status || undefined,
      currency: currency || undefined,
    });
    allGroups = res.groups;
    totalPOs = res.totalPOs;
    totalLocal = res.totalLocal;
    totalImport = res.totalImport;
    totalCompleted = res.totalCompleted;
    totalPartial = res.totalPartial;
    totalPending = res.totalPending;
  } catch (err: any) {
    error = err?.message || "Gagal memuat data monitoring pembelian";
  }

  // Pagination di layer server untuk responsivitas render DOM
  const totalItems = allGroups.length;
  const offset = (page - 1) * pageSize;
  const pagedGroups = allGroups.slice(offset, offset + pageSize);

  return {
    tgl1,
    tgl2,
    q,
    status,
    currency,
    page,
    pageSize,
    total: totalItems,
    groups: pagedGroups,
    stats: {
      totalPOs,
      totalLocal,
      totalImport,
      totalCompleted,
      totalPartial,
      totalPending,
    },
    error,
  };
};
