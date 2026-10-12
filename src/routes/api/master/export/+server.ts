import type { RequestHandler } from "@sveltejs/kit";
import { getAllMasterGoods, getMasterItems } from "$lib/server/master";
import { exportMasterGoodsToExcel } from "$lib/export";
import { log } from "$lib/db";

async function doExport(options: { q?: string; ids?: string[]; exportAll?: boolean }) {
  const { q, ids, exportAll } = options;
  let rows: any[];

  if (exportAll) {
    // Export seluruh katalog master barang tanpa filter atau batas pagination
    rows = await getAllMasterGoods();
  } else if (ids && ids.length > 0) {
    // Export item-item terpilih saja
    rows = await getMasterItems(ids);
  } else if (q) {
    // Export hasil pencarian
    rows = await getAllMasterGoods(q);
  } else {
    // Default export semua data
    rows = await getAllMasterGoods();
  }

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada data untuk diekspor" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const xlsx = await exportMasterGoodsToExcel(rows, {
    q: exportAll ? undefined : (q || undefined),
    selectedCount: exportAll ? undefined : ids?.length
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
  const exportAllParam = url.searchParams.get("all") || url.searchParams.get("exportAll");
  const exportAll = exportAllParam === "true" || exportAllParam === "1";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const idsParam = url.searchParams.get("ids")?.trim() ?? "";
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  try {
    return await doExport({ q, ids, exportAll });
  } catch (err) {
    log.error({ err, q, ids, exportAll }, "Gagal export master barang GET");
    return new Response(JSON.stringify({ error: "Gagal mengekspor master barang" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    let q = "";
    let ids: string[] | undefined = undefined;
    let exportAll = false;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const fd = await request.formData();
      exportAll = fd.get("exportAll") === "true" || fd.get("exportAll") === "1" || fd.get("all") === "true";
      q = String(fd.get("q") ?? url.searchParams.get("q") ?? "").trim();
      const selected = fd.getAll("selected").map(String).filter(Boolean);
      const idsParam = String(fd.get("ids") ?? url.searchParams.get("ids") ?? "").trim();
      ids = selected.length > 0 ? selected : (idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined);
    } else if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      exportAll = Boolean(body.exportAll || body.all);
      q = String(body.q ?? "").trim();
      if (Array.isArray(body.ids)) {
        ids = body.ids.map(String).filter(Boolean);
      } else if (Array.isArray(body.selected)) {
        ids = body.selected.map(String).filter(Boolean);
      }
    } else {
      const exportAllParam = url.searchParams.get("all") || url.searchParams.get("exportAll");
      exportAll = exportAllParam === "true" || exportAllParam === "1";
      q = url.searchParams.get("q")?.trim() ?? "";
    }

    return await doExport({ q, ids, exportAll });
  } catch (err) {
    log.error({ err }, "Gagal export master barang POST");
    return new Response(JSON.stringify({ error: "Gagal mengekspor master barang" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

