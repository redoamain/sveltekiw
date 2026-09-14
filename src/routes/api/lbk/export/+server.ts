import type { RequestHandler } from "@sveltejs/kit";
import { getLBKForExport } from "$lib/server/lbk";
import { exportLBKToExcel } from "$lib/export";
import { log } from "$lib/db";

async function doExport(q?: string, tgl1?: string, tgl2?: string, ids?: string[]) {
  const rows = await getLBKForExport({ q: q || undefined, tgl1: tgl1 || undefined, tgl2: tgl2 || undefined, ids });
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada data untuk diekspor" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const xlsx = await exportLBKToExcel(rows, { q, tgl1, tgl2, selectedCount: ids?.length });
  return new Response(new Uint8Array(xlsx.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${xlsx.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get("q")?.trim() ?? "";
  const tgl1 = url.searchParams.get("tgl1")?.trim() ?? "";
  const tgl2 = url.searchParams.get("tgl2")?.trim() ?? "";
  const idsParam = url.searchParams.get("ids")?.trim() ?? "";
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  try {
    return await doExport(q, tgl1, tgl2, ids);
  } catch (err) {
    log.error({ err, q, tgl1, tgl2 }, "Gagal export LBK");
    return new Response(JSON.stringify({ error: "Gagal mengekspor LBK" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const fd = await request.formData();
    const q = String(fd.get("q") ?? url.searchParams.get("q") ?? "").trim();
    const tgl1 = String(fd.get("tgl1") ?? url.searchParams.get("tgl1") ?? "").trim();
    const tgl2 = String(fd.get("tgl2") ?? url.searchParams.get("tgl2") ?? "").trim();
    const selected = fd.getAll("selected").map(String).filter(Boolean);
    const idsParam = String(fd.get("ids") ?? url.searchParams.get("ids") ?? "").trim();
    const ids = selected.length > 0 ? selected : (idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

    return await doExport(q, tgl1, tgl2, ids);
  } catch (err) {
    log.error({ err }, "Gagal export LBK POST");
    return new Response(JSON.stringify({ error: "Gagal mengekspor LBK" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
