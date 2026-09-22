import type { RequestHandler } from "@sveltejs/kit";
import { getMasterGoodsPaged, getMasterItems } from "$lib/server/master";
import { exportMasterGoodsToExcel } from "$lib/export";
import { log } from "$lib/db";

async function doExport(q?: string, ids?: string[]) {
  let rows: any[];
  if (ids && ids.length > 0) {
    rows = await getMasterItems(ids);
  } else {
    const all = await getMasterGoodsPaged(q || undefined, 1, 10000);
    rows = all.rows;
  }

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada data untuk diekspor" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const xlsx = await exportMasterGoodsToExcel(rows, { q, selectedCount: ids?.length });
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
  const idsParam = url.searchParams.get("ids")?.trim() ?? "";
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  try {
    return await doExport(q, ids);
  } catch (err) {
    log.error({ err, q, ids }, "Gagal export master barang");
    return new Response(JSON.stringify({ error: "Gagal mengekspor master barang" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const fd = await request.formData();
    const q = String(fd.get("q") ?? url.searchParams.get("q") ?? "").trim();
    const selected = fd.getAll("selected").map(String).filter(Boolean);
    const idsParam = String(fd.get("ids") ?? url.searchParams.get("ids") ?? "").trim();
    const ids = selected.length > 0 ? selected : (idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

    return await doExport(q, ids);
  } catch (err) {
    log.error({ err }, "Gagal export master barang POST");
    return new Response(JSON.stringify({ error: "Gagal mengekspor master barang" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

