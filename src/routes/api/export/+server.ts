import type { RequestHandler } from "@sveltejs/kit";
import { log } from "$lib/db";
import { computePlan, getCommitted, getActiveOrders, getStoredPlan } from "$lib/server/planning";
import { exportPlanToExcel } from "$lib/export";
import { errorMessage } from "$lib/http";
import type { BomItem } from "$lib/types";

export interface TreeAdjustments {
  excludedItemIds?: string[];
  customQuantities?: Record<string, number>;
  substitutions?: Record<string, { itemId: string; itemName: string }>;
}

function parseExportMode(val?: string | null): "full" | "simple" | "no-tree" | "erp-china" {
  const clean = (val ?? "").trim().toLowerCase();
  if (clean === "simple") return "simple";
  if (clean === "no-tree" || clean === "flat" || clean === "tanpa-tree" || clean === "tanpa_tree") return "no-tree";
  if (clean === "erp-china" || clean === "china" || clean === "erp_china") return "erp-china";
  return "full";
}

async function doExportPlan(params: {
  planId?: string;
  tgl1?: string;
  tgl2?: string;
  q?: string;
  spks?: string[];
  source?: "spk" | "so";
  mode?: "full" | "simple" | "no-tree" | "erp-china";
  adjustments?: TreeAdjustments;
}) {
  const { planId, tgl1, tgl2, q, spks, source = "spk", mode = "full", adjustments } = params;

  let stored = planId ? getStoredPlan(planId) : undefined;
  if (!stored) {
    if (spks && spks.length > 0) {
      const allOrders = await getActiveOrders(tgl1, tgl2, q || undefined, source);
      stored = await computePlan(allOrders, spks, source);
    } else {
      const allOrders = await getActiveOrders(tgl1, tgl2, q || undefined, source);
      const allSpks = [...new Set(allOrders.map((o) => o.No_SPK))];
      if (allSpks.length === 0) {
        return new Response(JSON.stringify({ error: `Tidak ada ${source === 'so' ? 'Sales Order' : 'SPK'} untuk diekspor pada filter ini` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      stored = await computePlan(allOrders, allSpks, source);
    }
  }

  if (!stored || stored.groups.length === 0) {
    return new Response(JSON.stringify({ error: "Tidak ada data untuk diekspor" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Terapkan penyesuaian dari Tree jika ada
  let effectiveBom = stored.bomByKodeBarang;
  if (adjustments) {
    const { excludedItemIds = [], customQuantities = {}, substitutions = {} } = adjustments;
    const excludedSet = new Set(excludedItemIds.map((id) => (id || "").trim().toUpperCase()));

    effectiveBom = new Map();
    for (const [kodeBarang, items] of stored.bomByKodeBarang) {
      const adjustedItems: BomItem[] = [];

      for (const item of items) {
        const idUpper = (item.ItemID || "").trim().toUpperCase();
        // 1. Filter item yang di-uncheck
        if (excludedSet.has(idUpper)) {
          continue;
        }

        const clone: BomItem = { ...item };

        // 2. Substitusi bahan
        if (substitutions[idUpper] || substitutions[item.ItemID]) {
          const s = substitutions[idUpper] || substitutions[item.ItemID];
          clone.ItemID = s.itemId;
          clone.ItemName = s.itemName;
        }

        // 3. Custom Quantity
        if (customQuantities[idUpper] !== undefined || customQuantities[item.ItemID] !== undefined) {
          const customVal = customQuantities[idUpper] ?? customQuantities[item.ItemID];
          if (customVal >= 0) {
            clone.Qty = customVal;
          }
        }

        adjustedItems.push(clone);
      }

      effectiveBom.set(kodeBarang, adjustedItems);
    }
  }

  const { reservations } = await getCommitted();
  const { buffer, fileName } = await exportPlanToExcel({
    groups: stored.groups,
    bomByKodeBarang: effectiveBom,
    stockRows: stored.stockRows,
    reservations,
    mode,
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
  const source = (url.searchParams.get("source")?.trim().toLowerCase() === "so" ? "so" : "spk") as "spk" | "so";
  const mode = parseExportMode(url.searchParams.get("mode"));
  const spkParam = url.searchParams.get("spk")?.trim() || "";
  const spks = spkParam ? spkParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  try {
    return await doExportPlan({ planId, tgl1, tgl2, q, spks, source, mode });
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
    let planId: string | undefined;
    let tgl1: string | undefined;
    let tgl2: string | undefined;
    let q: string | undefined;
    let source: "spk" | "so" = "spk";
    let mode: "full" | "simple" | "no-tree" | "erp-china" = "full";
    let spks: string[] = [];
    let adjustments: TreeAdjustments | undefined;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      planId = body.planId || undefined;
      tgl1 = body.tgl1 || undefined;
      tgl2 = body.tgl2 || undefined;
      q = body.q || undefined;
      source = body.source === "so" ? "so" : "spk";
      mode = parseExportMode(body.mode);
      spks = Array.isArray(body.spks) ? body.spks : [];
      adjustments = body.adjustments;
    } else {
      const fd = await request.formData();
      planId = String(fd.get("planId") ?? url.searchParams.get("planId") ?? "").trim() || undefined;
      tgl1 = String(fd.get("tgl1") ?? url.searchParams.get("tgl1") ?? "").trim() || undefined;
      tgl2 = String(fd.get("tgl2") ?? url.searchParams.get("tgl2") ?? "").trim() || undefined;
      q = String(fd.get("q") ?? url.searchParams.get("q") ?? "").trim() || undefined;
      source = (String(fd.get("source") ?? url.searchParams.get("source") ?? "spk").trim().toLowerCase() === "so" ? "so" : "spk") as "spk" | "so";
      mode = parseExportMode(String(fd.get("mode") ?? url.searchParams.get("mode") ?? "full"));

      spks = fd.getAll("spk").map(String).filter(Boolean);
      if (spks.length === 0) {
        const spkParam = url.searchParams.get("spk")?.trim() || "";
        if (spkParam) spks = spkParam.split(",").map((s) => s.trim()).filter(Boolean);
      }

      const adjRaw = fd.get("adjustments");
      if (adjRaw && typeof adjRaw === "string") {
        try {
          adjustments = JSON.parse(adjRaw);
        } catch {}
      }
    }

    return await doExportPlan({
      planId,
      tgl1,
      tgl2,
      q,
      spks: spks.length > 0 ? spks : undefined,
      source,
      mode,
      adjustments
    });
  } catch (error) {
    log.error({ err: error }, "Gagal export Excel PPIC POST");
    return new Response(JSON.stringify({ error: errorMessage(error, "Gagal export Excel") }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
