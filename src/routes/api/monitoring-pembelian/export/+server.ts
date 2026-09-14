import type { RequestHandler } from "@sveltejs/kit";
import {
  getMonitoringPembelian,
  exportMonitoringPembelianToExcel,
} from "$lib/server/monitoring-pembelian";
import { log } from "$lib/db";

async function doExport(opts: {
  tgl1: string;
  tgl2: string;
  q?: string;
  status?: string;
  currency?: string;
}) {
  const { tgl1, tgl2, q, status, currency } = opts;
  const data = await getMonitoringPembelian({ tgl1, tgl2, q, status, currency });

  if (data.groups.length === 0) {
    return new Response(
      JSON.stringify({ error: "Tidak ada data PO untuk diekspor pada periode ini" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { buffer, fileName } = await exportMonitoringPembelianToExcel(data.groups, {
    tgl1,
    tgl2,
    q,
    status,
    currency,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET: RequestHandler = async ({ url }) => {
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultEnd = now.toISOString().slice(0, 10);

  const tgl1 = url.searchParams.get("tgl1")?.trim() || defaultStart;
  const tgl2 = url.searchParams.get("tgl2")?.trim() || defaultEnd;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || undefined;
  const currency = url.searchParams.get("currency")?.trim() || undefined;

  try {
    return await doExport({ tgl1, tgl2, q, status, currency });
  } catch (err) {
    log.error({ err, tgl1, tgl2 }, "Gagal export monitoring pembelian");
    return new Response(
      JSON.stringify({ error: "Gagal mengekspor data monitoring pembelian" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const fd = await request.formData();
    const now = new Date();
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const defaultEnd = now.toISOString().slice(0, 10);

    const tgl1 = String(fd.get("tgl1") ?? url.searchParams.get("tgl1") ?? "").trim() || defaultStart;
    const tgl2 = String(fd.get("tgl2") ?? url.searchParams.get("tgl2") ?? "").trim() || defaultEnd;
    const q = String(fd.get("q") ?? url.searchParams.get("q") ?? "").trim() || undefined;
    const status = String(fd.get("status") ?? url.searchParams.get("status") ?? "").trim() || undefined;
    const currency = String(fd.get("currency") ?? url.searchParams.get("currency") ?? "").trim() || undefined;

    return await doExport({ tgl1, tgl2, q, status, currency });
  } catch (err) {
    log.error({ err }, "Gagal export monitoring pembelian POST");
    return new Response(
      JSON.stringify({ error: "Gagal mengekspor data monitoring pembelian" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
