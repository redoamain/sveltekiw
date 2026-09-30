import type { RequestHandler } from "./$types";
import { getKartuStockReport, exportKartuStockToExcel, getWarehouses } from "$lib/server/kartu-stock";
import { log } from "@/lib/db";

export const GET: RequestHandler = async ({ url }) => {
  const itemid = (url.searchParams.get("itemid") ?? "").trim();
  const loc = (url.searchParams.get("loc") ?? "").trim();
  const tgl1 = (url.searchParams.get("tgl1") ?? "").trim();
  const tgl2 = (url.searchParams.get("tgl2") ?? "").trim();

  if (!itemid || !tgl1 || !tgl2) {
    return new Response(JSON.stringify({ error: "Parameter itemid, tgl1, dan tgl2 wajib diisi." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const report = await getKartuStockReport({
      itemid,
      loc: loc || undefined,
      tgl1,
      tgl2,
    });

    let locName = "Semua Gudang";
    if (loc) {
      const warehouses = await getWarehouses();
      const match = warehouses.find((w) => w.locId === loc);
      if (match) locName = `${match.locName} (${match.locId})`;
    }

    const { buffer, fileName } = exportKartuStockToExcel(report, {
      tgl1,
      tgl2,
      locName,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    log.error({ error, itemid, loc, tgl1, tgl2 }, "Gagal export kartu stock ke Excel");
    return new Response(JSON.stringify({ error: error?.message || "Gagal mengekspor laporan kartu stock." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
