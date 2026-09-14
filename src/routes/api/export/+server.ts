import type { RequestHandler } from "@sveltejs/kit";
import { log } from "$lib/db";
import { computePlan, getCommitted, getActiveOrders, getStoredPlan } from "$lib/server/planning";
import { exportPlanToExcel } from "$lib/export";
import { errorMessage } from "$lib/http";

async function doExportPlan(params: {
  planId?: string;
  tgl1?: string;
  tgl2?: string;
  q?: string;
  spks?: string[];
}) {
  const { planId, tgl1, tgl2, q, spks } = params;

  let stored = planId ? getStoredPlan(planId) : undefined;
  if (!stored) {
    if (spks && spks.length > 0) {
      const allOrders = await getActiveOrders(tgl1, tgl2, q || undefined);
      stored = await computePlan(allOrders, spks);
    } else {
      const allOrders = await getActiveOrders(tgl1, tgl2, q || undefined);
      const allSpks = [...new Set(allOrders.map((o) => o.No_SPK))];
      if (allSpks.length === 0) {
        return new Response(JSON.stringify({ error: "Tidak ada SPK untuk diekspor pada filter ini" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      stored = await computePlan(allOrders, allSpks);
    }
  }

  if (!stored || stored.groups.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada data untuk diekspor" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { reservations } = await getCommitted();
  const { buffer, fileName } = await exportPlanToExcel({
    groups: stored.groups,
    bomByKodeBarang: stored.bomByKodeBarang,
    stockRows: stored.stockRows,
    reservations,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET: RequestHandler = async ({ url }) => {
  const planId = url.searchParams.get("planId")?.trim() || undefined;
  const tgl1 = url.searchParams.get("tgl1")?.trim() || undefined;
  const tgl2 = url.searchParams.get("tgl2")?.trim() || undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const spkParam = url.searchParams.get("spk")?.trim() || "";
  const spks = spkParam ? spkParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  try {
    return await doExportPlan({ planId, tgl1, tgl2, q, spks });
  } catch (error) {
    log.error({ err: error }, "Gagal export Excel PPIC");
    return new Response(JSON.stringify({ error: errorMessage(error, "Gagal export Excel") }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const fd = await request.formData();
    const planId = String(fd.get("planId") ?? url.searchParams.get("planId") ?? "").trim() || undefined;
    const tgl1 = String(fd.get("tgl1") ?? url.searchParams.get("tgl1") ?? "").trim() || undefined;
    const tgl2 = String(fd.get("tgl2") ?? url.searchParams.get("tgl2") ?? "").trim() || undefined;
    const q = String(fd.get("q") ?? url.searchParams.get("q") ?? "").trim() || undefined;

    let spks = fd.getAll("spk").map(String).filter(Boolean);
    if (spks.length === 0) {
      const spkParam = url.searchParams.get("spk")?.trim() || "";
      if (spkParam) spks = spkParam.split(",").map((s) => s.trim()).filter(Boolean);
    }

    return await doExportPlan({ planId, tgl1, tgl2, q, spks: spks.length > 0 ? spks : undefined });
  } catch (error) {
    log.error({ err: error }, "Gagal export Excel PPIC POST");
    return new Response(JSON.stringify({ error: errorMessage(error, "Gagal export Excel") }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};


