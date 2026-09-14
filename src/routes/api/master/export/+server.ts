import type { RequestHandler } from "@sveltejs/kit";
import { getMasterGoodsPaged } from "$lib/server/master";
import { exportMasterGoodsToExcel } from "$lib/export";
import { log } from "$lib/db";

async function doExport(q?: string) {
  const all = await getMasterGoodsPaged(q || undefined, 1, 10000);
  if (all.rows.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada data untuk diekspor" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const xlsx = await exportMasterGoodsToExcel(all.rows, { q });
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

  try {
    return await doExport(q);
  } catch (err) {
    log.error({ err, q }, "Gagal export master barang");
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
    return await doExport(q);
  } catch (err) {
    log.error({ err }, "Gagal export master barang POST");
    return new Response(JSON.stringify({ error: "Gagal mengekspor master barang" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
