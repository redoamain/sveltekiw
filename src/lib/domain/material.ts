// =====================================================================
// DOMAIN — logika murni (tanpa React, tanpa fetch).
// Semua perhitungan production planning tinggal di sini, mudah di-test.
// =====================================================================
import type { BomItem, CommitMaterial, ProductionOrder, StockRow } from "@/lib/types";

export const normalizeItemId = (id: string): string =>
  (id ?? "").trim().toUpperCase();

// =====================================================================
// Bahan baku = item ber-Level > 0. (Utilitas lama dihapus — logika rencana
// kini lewat aggregateMaterialPlan yang mengikuti kiw: akumulasi multi-level,
// kecuali departemen INJECTION, stok SaldoAkhirFisik + reservasi PO lain.)
// =====================================================================

// =====================================================================
// Utilitas bersama (dipakai plan layar, commit, dan export) — logika sama
// dengan project kiw: komponen departemen INJECTION tidak dihitung, dan
// kebutuhan BOM multi-level diakumulasi (qty per induk × qty sub-nya).
// =====================================================================
export const isINJECTIONDepartment = (departemen?: string): boolean => {
  if (!departemen) return false;
  const d = String(departemen).trim().toUpperCase();
  return (
    d.includes("INJEKSI-BB") ||
    d === "INJEKSI-BB" ||
    d.includes("INJEKSI BB") ||
    d.includes("INJEKSI_BB") ||
    d === "INJEKSIBB"
  );
};

// Komponen yang dihitung: Level > 0 dan bukan departemen INJECTION (kiw).
export const filterPlanComponents = (bomFlat: BomItem[]): BomItem[] =>
  bomFlat.filter((b) => Number(b.Level) > 0 && !isINJECTIONDepartment(b.Departemen));

// Akumulasi qty per (ItemID, Level) — key `ItemID_Llevel`.
export const calculateAccumulatedQty = (flatBom: BomItem[]): Map<string, number> => {
  const cache = new Map<string, number>();
  const itemMap = new Map<string, BomItem>();

  for (const item of flatBom) {
    const key = `${normalizeItemId(item.ItemID)}_L${item.Level}`;
    itemMap.set(key, item);
  }

  for (const item of flatBom) {
    const itemId = normalizeItemId(item.ItemID);
    const level = Number(item.Level);
    const key = `${itemId}_L${level}`;

    if (level === 1) {
      cache.set(key, item.Qty);
      continue;
    }

    let parent: BomItem | undefined;
    if (item.ParentItemID) {
      parent = itemMap.get(`${normalizeItemId(item.ParentItemID)}_L${level - 1}`);
    }
    if (!parent) parent = flatBom.find((p) => Number(p.Level) === level - 1);

    if (parent) {
      const parentAcc = cache.get(`${normalizeItemId(parent.ItemID)}_L${level - 1}`);
      cache.set(key, parentAcc !== undefined ? item.Qty * parentAcc : item.Qty);
    } else {
      cache.set(key, item.Qty);
    }
  }
  return cache;
};

// =====================================================================
// Agregasi kebutuhan material (mirip export/kiw):
//   - komponen diakumulasi antar-level,
//   - material yang sama digabung, detail per level tetap disimpan.
// =====================================================================
export interface MaterialPlanAgg {
  kode: string;
  nama: string;
  nama2: string;
  departemen: string;
  totalNeeded: number;
  levelDetails: { level: number; needed: number }[];
}

export const aggregateMaterialPlan = (
  orders: { Kode_Barang: string; QTY: number }[],
  bomByKodeBarang: Map<string, BomItem[]>,
): Map<string, MaterialPlanAgg> => {
  const byLevel = new Map<
    string,
    { kode: string; level: number; nama: string; nama2: string; departemen: string; totalNeeded: number }
  >();

  for (const o of orders) {
    const bomFlat = bomByKodeBarang.get(o.Kode_Barang) ?? [];
    const components = filterPlanComponents(bomFlat);
    if (components.length === 0) continue;

    const accumulated = calculateAccumulatedQty(bomFlat);
    for (const component of components) {
      const kode = normalizeItemId(component.ItemID);
      const level = Number(component.Level);
      const key = `${kode}_L${level}`;
      const needed = (accumulated.get(key) ?? component.Qty) * (Number(o.QTY) || 0);

      const existing = byLevel.get(key);
      if (existing) {
        existing.totalNeeded += needed;
      } else {
        byLevel.set(key, {
          kode,
          level,
          nama: component.ItemName || kode,
          nama2: component.ItemName2 || "-",
          departemen: component.Departemen || "UNKNOWN",
          totalNeeded: needed,
        });
      }
    }
  }

  const merged = new Map<string, MaterialPlanAgg>();
  for (const d of byLevel.values()) {
    let m = merged.get(d.kode);
    if (m) {
      m.totalNeeded += d.totalNeeded;
      m.levelDetails.push({ level: d.level, needed: d.totalNeeded });
    } else {
      merged.set(d.kode, {
        kode: d.kode,
        nama: d.nama,
        nama2: d.nama2,
        departemen: d.departemen,
        totalNeeded: d.totalNeeded,
        levelDetails: [{ level: d.level, needed: d.totalNeeded }],
      });
    }
  }
  return merged;
};

// Bangun struktur tree dari BOM flat (satu root per item tanpa parent valid)
export const buildTreeStructure = (flatBom: BomItem[]): BomItem[] => {
  if (!flatBom || flatBom.length === 0) return [];

  const itemMap = new Map<string, BomItem>();
  const rootItems: BomItem[] = [];

  flatBom.forEach((item) => {
    itemMap.set(normalizeItemId(item.ItemID), { ...item, children: [] });
  });

  flatBom.forEach((item) => {
    const normalizedId = normalizeItemId(item.ItemID);
    const treeItem = itemMap.get(normalizedId);
    if (!treeItem) return;
    const parentId = item.ParentItemID
      ? normalizeItemId(item.ParentItemID)
      : null;

    if (!parentId || parentId === normalizedId || !itemMap.has(parentId)) {
      rootItems.push(treeItem);
    } else {
      itemMap.get(parentId)?.children?.push(treeItem);
    }
  });

  return rootItems;
};

// =====================================================================
// Pengelompokan SPK & agregasi item — murni, mudah di-test.
// =====================================================================
export interface SpkLine {
  Kode_Barang: string;
  QTY: number;
  Tanggal_Order?: string;
}

export interface SpkGroup {
  No_SPK: string;
  Nama_PO: string;
  lines: SpkLine[];
  totalQty: number;
}

// Kelompokkan baris produksi yang No_SPK-nya sama menjadi satu grup.
export const groupOrdersBySpk = (orders: ProductionOrder[]): SpkGroup[] => {
  const map = new Map<string, SpkGroup>();

  for (const o of orders) {
    const no = o.No_SPK ?? "";
    const line: SpkLine = {
      Kode_Barang: String(o.Kode_Barang ?? ""),
      QTY: Number(o.QTY) || 0,
      Tanggal_Order: o.Tanggal_Order,
    };
    const existing = map.get(no);
    if (existing) {
      existing.lines.push(line);
      existing.totalQty += line.QTY;
      if (o.Nama_PO && existing.Nama_PO !== o.Nama_PO) {
        existing.Nama_PO = o.Nama_PO;
      }
    } else {
      map.set(no, {
        No_SPK: no,
        Nama_PO: o.Nama_PO ?? "",
        lines: [line],
        totalQty: line.QTY,
      });
    }
  }

  return Array.from(map.values());
};

// Agregasi kebutuhan produksi per Kode_Barang (jumlahkan QTY).
export const aggregateByKodeBarang = (
  lines: SpkLine[],
): { Kode_Barang: string; QTY: number }[] => {
  const map = new Map<string, number>();
  for (const l of lines) {
    const k = String(l.Kode_Barang ?? "").trim();
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + (l.QTY || 0));
  }
  return Array.from(map, ([Kode_Barang, QTY]) => ({ Kode_Barang, QTY }));
};

// Bangun daftar material yang akan di-reserve (commit) untuk satu SPK.
// qtyUsed = min(TotalDibutuhkan, StockWincp) → hanya yang tersedia di-reserve.
// Basis stok mengikuti kiw/export (SaldoAkhirFisik) dan kebutuhan terakumulasi.
export const buildCommitUsage = (
  lines: SpkLine[],
  bomByKodeBarang: Map<string, BomItem[]>,
  stockRows: Map<string, StockRow>,
  reservationsByItem?: Map<string, number>,
): CommitMaterial[] => {
  const aggregated = aggregateByKodeBarang(lines);
  const totalProdQty = aggregated.reduce((s, a) => s + a.QTY, 0) || 1;
  const merged = aggregateMaterialPlan(aggregated, bomByKodeBarang);

  return Array.from(merged.values()).map((m) => {
    const stock = stockRows.get(m.kode);
    const stockWincp = Number(stock?.SaldoAkhirFisik) || 0;
    const qtyReserved = reservationsByItem?.get(m.kode) || 0;
    const totalDibutuhkan = m.totalNeeded + qtyReserved;
    const qtyUsed = Math.max(0, Math.min(totalDibutuhkan, stockWincp));

    return {
      itemId: m.kode,
      itemName: m.nama,
      qtyPerUnit: m.totalNeeded > 0 ? m.totalNeeded / totalProdQty : 0,
      totalNeeded: m.totalNeeded,
      stockBefore: stockWincp,
      stockAfter: stockWincp - qtyUsed,
      qtyUsed,
      departemen: m.departemen,
      level: m.levelDetails[0]?.level ?? 0,
    };
  });
};

// =====================================================================
// Hasil akhir per rencana produksi (dipakai untuk tampilan, commit, export)
// -- struktur mengikuti project kiw / export:
//   StockWincp = SaldoAkhirFisik (stok "real"),
//   QtyReserved = reservasi dari PO/SPK LAIN (di luar yang sedang direncanakan),
//   TotalDibutuhkan = TotalNeeded + QtyReserved,
//   Available = StockWincp - TotalDibutuhkan, Shortage = max(0, -Available).
// =====================================================================
export interface PlanMaterialRow {
  ItemID: string;
  ItemName: string;
  ItemName2: string;
  Departemen: string;
  Level: number;
  TotalNeeded: number;
  StockWincp: number;
  StockAkhir: number;
  QtyReserved: number;
  TotalDibutuhkan: number;
  Available: number;
  Shortage: number;
  Status: "AMAN" | "KURANG" | "HABIS";
  LevelDetails?: { level: number; needed: number }[];
}

export interface PlanSummary {
  totalMaterials: number;
  totalNeeded: number;
  totalShortage: number;
  aman: number;
  kurang: number;
  habis: number;
}

// Bangun daftar material dari beberapa SPK terpilih (logika kiw/export).
// `stockRows` = Map kode->StockRow, `reservationsByItem` = Map kode->qty
// yang sudah di-reserve oleh PO/SPK lain (tidak termasuk SPK sedang direncanakan).
export const buildPlan = (
  orders: { Kode_Barang: string; QTY: number }[],
  bomByKodeBarang: Map<string, BomItem[]>,
  stockRows: Map<string, StockRow>,
  reservationsByItem?: Map<string, number>,
): { rows: PlanMaterialRow[]; summary: PlanSummary } => {
  const merged = aggregateMaterialPlan(orders, bomByKodeBarang);

  const rows: PlanMaterialRow[] = Array.from(merged.values()).map((agg) => {
    const stock = stockRows.get(agg.kode);
    const stockWincp = Number(stock?.SaldoAkhirFisik) || 0;
    const stockAkhir = Number(stock?.SaldoAkhir) || 0;
    const qtyReserved = reservationsByItem?.get(agg.kode) || 0;
    const totalDibutuhkan = agg.totalNeeded + qtyReserved;
    const available = stockWincp - totalDibutuhkan;
    const shortage = Math.max(0, -available);
    let status: PlanMaterialRow["Status"];
    if (stockWincp >= totalDibutuhkan) status = "AMAN";
    else if (stockWincp > 0) status = "KURANG";
    else status = "HABIS";

    return {
      ItemID: agg.kode,
      ItemName: agg.nama,
      ItemName2: agg.nama2,
      Departemen: agg.departemen,
      Level: agg.levelDetails[0]?.level ?? 0,
      TotalNeeded: agg.totalNeeded,
      StockWincp: stockWincp,
      StockAkhir: stockAkhir,
      QtyReserved: qtyReserved,
      TotalDibutuhkan: totalDibutuhkan,
      Available: available,
      Shortage: shortage,
      Status: status,
      LevelDetails: agg.levelDetails,
    };
  }).sort((a, b) => a.ItemID.localeCompare(b.ItemID));

  const summary: PlanSummary = {
    totalMaterials: rows.length,
    totalNeeded: rows.reduce((s, r) => s + r.TotalNeeded, 0),
    totalShortage: rows.reduce((s, r) => s + r.Shortage, 0),
    aman: rows.filter((r) => r.Status === "AMAN").length,
    kurang: rows.filter((r) => r.Status === "KURANG").length,
    habis: rows.filter((r) => r.Status === "HABIS").length,
  };

  return { rows, summary };
};