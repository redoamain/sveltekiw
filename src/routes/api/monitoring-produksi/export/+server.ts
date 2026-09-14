import type { RequestHandler } from "@sveltejs/kit";
import { getMonitoringProduksiForExport } from "$lib/server/monitoring-produksi";
import { exportMonitoringProduksiToExcel } from "$lib/export";
import { log } from "$lib/db";

async function doExport(params: {
  dept?: string;
  tipe?: string;
  q?: string;
  tgl1?: string;
  tgl2?: string;
  ids?: string[];
}) {
  const { dept, tipe, q, tgl1, tgl2, ids } = params;
  const rows = await getMonitoringProduksiForExport({
    dept: dept || undefined,
    tipe: tipe || undefined,
    q: q || undefined,
    tgl1: tgl1 || undefined,
    tgl2: tgl2 || undefined,
    ids,
  });
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada data untuk diekspor" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const xlsx = await exportMonitoringProduksiToExcel(rows, {
    dept,
    tipe,
    q,
    tgl1,
    tgl2,
    selectedCount: ids?.length,
  });
  return new Response(new Uint8Array(xlsx.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${xlsx.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET: RequestHandler = async ({ url }) => {
  const dept = url.searchParams.get("dept")?.trim().toUpperCase() ?? "";
  const tipe = url.searchParams.get("tipe")?.trim().toUpperCase() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const tgl1 = url.searchParams.get("tgl1")?.trim() ?? "";
  const tgl2 = url.searchParams.get("tgl2")?.trim() ?? "";
  const idsParam = url.searchParams.get("ids")?.trim() ?? "";
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  try {
    return await doExport({ dept, tipe, q, tgl1, tgl2, ids });
  } catch (err) {
    log.error({ err, dept, tipe, q }, "Gagal export monitoring produksi");
    return new Response(JSON.stringify({ error: "Gagal mengekspor monitoring produksi" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const fd = await request.formData();
    const dept = String(fd.get("dept") ?? url.searchParams.get("dept") ?? "").trim().toUpperCase();
    const tipe = String(fd.get("tipe") ?? url.searchParams.get("tipe") ?? "").trim().toUpperCase();
    const q = String(fd.get("q") ?? url.searchParams.get("q") ?? "").trim();
    const tgl1 = String(fd.get("tgl1") ?? url.searchParams.get("tgl1") ?? "").trim();
    const tgl2 = String(fd.get("tgl2") ?? url.searchParams.get("tgl2") ?? "").trim();
    const selected = fd.getAll("selected").map(String).filter(Boolean);
    const idsParam = String(fd.get("ids") ?? url.searchParams.get("ids") ?? "").trim();
    const ids = selected.length > 0 ? selected : (idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

    return await doExport({ dept, tipe, q, tgl1, tgl2, ids });
  } catch (err) {
    log.error({ err }, "Gagal export monitoring produksi POST");
    return new Response(JSON.stringify({ error: "Gagal mengekspor monitoring produksi" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
