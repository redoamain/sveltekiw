import type { RequestHandler } from "@sveltejs/kit";
import { getSPKForExport } from "$lib/server/spk";
import { exportSPKToExcel } from "$lib/export";
import { log } from "$lib/db";

async function doExport(q?: string, status?: string, ids?: string[]) {
  const rows = await getSPKForExport({ q: q || undefined, status: status || undefined, ids });
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada data untuk diekspor" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const xlsx = await exportSPKToExcel(rows, { q, status, selectedCount: ids?.length });
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
  const status = url.searchParams.get("status")?.trim() ?? "";
  const idsParam = url.searchParams.get("ids")?.trim() ?? "";
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  try {
    return await doExport(q, status, ids);
  } catch (err) {
    log.error({ err, q, status }, "Gagal export SPK");
    return new Response(JSON.stringify({ error: "Gagal mengekspor SPK" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const fd = await request.formData();
    const q = String(fd.get("q") ?? url.searchParams.get("q") ?? "").trim();
    const status = String(fd.get("status") ?? url.searchParams.get("status") ?? "").trim();
    const selected = fd.getAll("selected").map(String).filter(Boolean);
    const idsParam = String(fd.get("ids") ?? url.searchParams.get("ids") ?? "").trim();
    const ids = selected.length > 0 ? selected : (idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

    return await doExport(q, status, ids);
  } catch (err) {
    log.error({ err }, "Gagal export SPK POST");
    return new Response(JSON.stringify({ error: "Gagal mengekspor SPK" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};


