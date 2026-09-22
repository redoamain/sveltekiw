// Export hasil rencana produksi ke Excel — struktur mengikuti project kiw (persis).
// Berjalan penuh di server (Astro SSR): master item diambil langsung dari DB,
// workbook dikembalikan sebagai Buffer untuk dikirim sebagai response download.
import * as XLSX from "xlsx";
import type { BomItem, StockReservation, StockRow } from "@/lib/types";
import type { SpkGroup } from "@/lib/domain/material";
import { normalizeItemId, isINJECTIONDepartment, calculateAccumulatedQty } from "@/lib/domain/material";
import { getVariantInfo } from "@/lib/itemsWithVariants";
import { getMasterItems } from "@/lib/server/master";
import type { MasterItem } from "@/lib/server/master";
import type { MonitoringProduksiRow } from "@/lib/server/monitoring-produksi";
import type { SPKRow } from "@/lib/server/spk";
import type { LBMRow } from "@/lib/server/lbm";
import type { LBKRow } from "@/lib/server/lbk";
import type { ReturRow } from "@/lib/server/retur";
import type { MutasiRow } from "@/lib/server/mutasi";
import type { PemasukanRow } from "@/lib/server/pemasukan";
import type { TaLogRow } from "@/lib/server/ta-log";

// Baris material (hanya string/number) untuk keperluan sheet per-departemen
type MatRow = Record<string, string | number>;

export interface ExportPlanPayload {
  groups: SpkGroup[];
  bomByKodeBarang: Map<string, BomItem[]>;
  stockRows: Map<string, StockRow>;
  reservations: StockReservation[];
}

const sanitizeSheetName = (name: string): string => {
  let clean = name.replace(/[\\/*?:\[\]]/g, "");
  clean = clean.replace(/\|/g, "");
  if (clean.length > 31) clean = clean.substring(0, 31);
  if (clean.trim() === "") clean = "DEPARTEMEN";
  return clean;
};

const getUniqueSheetName = (wb: XLSX.WorkBook, baseName: string): string => {
  const sheetName = sanitizeSheetName(baseName);
  let counter = 1;
  let uniqueName = sheetName;
  while (wb.SheetNames.includes(uniqueName)) {
    uniqueName = `${sheetName}_${counter}`;
    counter++;
  }
  return uniqueName;
};

// Build tree dengan duplikat (key unik per kemunculan)
const buildTreeWithDuplicates = (flatBom: BomItem[]): BomItem[] => {
  if (!flatBom || flatBom.length === 0) return [];
  const nodeMap = new Map<string, BomItem>();
  const rootItems: BomItem[] = [];

  flatBom.forEach((item, idx) => {
    const uniqueKey = `${normalizeItemId(item.ItemID)}_L${item.Level}_${idx}`;
    nodeMap.set(uniqueKey, { ...item, children: [] });
  });

  flatBom.forEach((item, idx) => {
    const uniqueKey = `${normalizeItemId(item.ItemID)}_L${item.Level}_${idx}`;
    const node = nodeMap.get(uniqueKey);
    if (!node) return;
    const level = Number(item.Level);

    if (level === 1) {
      rootItems.push(node);
    } else {
      let parentFound = false;
      if (item.ParentItemID) {
        const parentNormalizedId = normalizeItemId(item.ParentItemID);
        const parentKey = Array.from(nodeMap.keys()).find(
          (key) =>
            key.startsWith(parentNormalizedId) && key.includes(`_L${level - 1}_`),
        );
        if (parentKey) {
          const parent = nodeMap.get(parentKey);
          if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(node);
            parentFound = true;
          }
        }
      }
      if (!parentFound) {
        const parentItem = flatBom.find((p) => Number(p.Level) === level - 1);
        if (parentItem) {
          const parentKey = `${normalizeItemId(parentItem.ItemID)}_L${parentItem.Level}_${flatBom.indexOf(parentItem)}`;
          const parent = nodeMap.get(parentKey);
          if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(node);
            parentFound = true;
          }
        }
      }
      if (!parentFound) rootItems.push(node);
    }
  });

  const sortChildren = (nodes: BomItem[]) => {
    nodes.sort((a, b) => {
      if (Number(a.Level) !== Number(b.Level)) return Number(a.Level) - Number(b.Level);
      return (a.ItemID || "").localeCompare(b.ItemID || "");
    });
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) sortChildren(node.children);
    });
  };
  sortChildren(rootItems);
  return rootItems;
};

const formatIndentedName = (
  itemName: string,
  level: number,
  isDuplicate = false,
): string => {
  if (!itemName) return "";
  if (level === 1) return `📦 ${itemName}`;
  const indent = "  ".repeat(level - 1);
  const prefix = isDuplicate ? "↳ " : "└─ ";
  return `${indent}${prefix}${itemName}`;
};

interface MaterialAgg {
  kode: string;
  nama: string;
  nama_china: string;
  spec: string;
  warna: string;
  bahan: string;
  departemen: string;
  totalNeeded: number;
  stockWincp: number;
  stockAkhir: number;
  qtyReserved: number;
  barangJadiSet: Map<string, { qty: number; nama: string; kode: string }>;
}

export async function exportPlanToExcel(
  payload: ExportPlanPayload,
): Promise<{ buffer: Buffer; fileName: string }> {
  const { groups, bomByKodeBarang, stockRows, reservations } = payload;
  const today = new Date().toISOString().split("T")[0];

  if (groups.length === 0) {
    throw new Error("Tidak ada SPK yang dipilih untuk di-export!");
  }

  // ============ NAMA FILE ============
  const cleanName = (n: string, len: number) =>
    (n || "").replace(/[\\/*?:"<>|]/g, "").replace(/\s+/g, "_").substring(0, len);
  let fileName: string;
  if (groups.length === 1) {
    const g = groups[0];
    fileName = `${cleanName(g.Nama_PO || g.No_SPK, 50)}_${today}.xlsx`;
  } else {
    const first = groups[0];
    fileName = `${cleanName(first.Nama_PO || first.No_SPK, 40)}_dan_${groups.length - 1}_lainnya_${today}.xlsx`;
  }

  // ============ MASTER DATA (batch) ============
  const allMaterialIds = Array.from(
    new Set(
      Array.from(bomByKodeBarang.values())
        .flat()
        .filter((b) => Number(b.Level) > 0)
        .map((b) => normalizeItemId(b.ItemID)),
    ),
  ).filter(Boolean);

  const masterDataMap = new Map<string, { spec: string; warna: string; bahan: string }>();
  if (allMaterialIds.length > 0) {
    try {
      const items = await getMasterItems(allMaterialIds);
      items.forEach((m) => {
        masterDataMap.set(normalizeItemId(String(m.ItemID)), {
          spec: String(m.Spec ?? "-"),
          warna: String(m.warna ?? "-"),
          bahan: String(m.bahan ?? "-"),
        });
      });
    } catch {
      // abaikan, default "-"
    }
  }
  const masterOf = (id: string) => masterDataMap.get(id) ?? { spec: "-", warna: "-", bahan: "-" };

  // ============ RESERVASI item (kecuali SPK yang di-export) ============
  const selectedSPKSet = new Set(groups.map((g) => g.No_SPK));
  const reservationsByItem = new Map<
    string,
    { totalQty: number; spkList: Set<{ namaPO: string; qtyReserved: number }> }
  >();
  for (const r of reservations) {
    if (r.status !== "RESERVED" || r.reservedQty <= 0 || !r.noSPK) continue;
    if (selectedSPKSet.has(r.noSPK)) continue;
    const id = normalizeItemId(r.itemID);
    if (!reservationsByItem.has(id)) {
      reservationsByItem.set(id, { totalQty: 0, spkList: new Set() });
    }
    const data = reservationsByItem.get(id)!;
    data.totalQty += r.reservedQty;
    const namaPO = r.namaPO || r.noSPK;
    let existing: { namaPO: string; qtyReserved: number } | undefined;
    for (const s of data.spkList) {
      if (s.namaPO === namaPO) { existing = s; break; }
    }
    if (existing) existing.qtyReserved += r.reservedQty;
    else data.spkList.add({ namaPO, qtyReserved: r.reservedQty });
  }

  // Per SPK → barang jadi items (sets)
  const linesOf = (g: SpkGroup) =>
    g.lines.map((l) => ({ Kode_Barang: l.Kode_Barang, QTY: l.QTY, Nama_PO: g.Nama_PO }));

  // ============ MATERIAL DATA (agregasi) ============
  const materialAggMap = new Map<string, MaterialAgg>();

  for (const group of groups) {
    for (const barangJadi of linesOf(group)) {
      const bomFlat = bomByKodeBarang.get(barangJadi.Kode_Barang) ?? [];
      if (bomFlat.length === 0) continue;
      const allComponents = bomFlat.filter(
        (b) => Number(b.Level) > 0 && !isINJECTIONDepartment(b.Departemen),
      );
      if (allComponents.length === 0) continue;
      const accumulatedMap = calculateAccumulatedQty(bomFlat);

      for (const component of allComponents) {
        const materialId = normalizeItemId(component.ItemID);
        const level = Number(component.Level);
        const uniqueKey = `${materialId}_L${level}`;
        const accumulatedQty = accumulatedMap.get(uniqueKey) || component.Qty;
        const needed = accumulatedQty * barangJadi.QTY;

        if (!materialAggMap.has(uniqueKey)) {
          const master = masterOf(materialId);
          const stockRow = stockRows.get(materialId);
          materialAggMap.set(uniqueKey, {
            kode: materialId,
            nama: component.ItemName || materialId,
            nama_china: component.ItemName2 || "-",
            spec: master.spec,
            warna: master.warna,
            bahan: master.bahan,
            departemen: component.Departemen || "UNKNOWN",
            totalNeeded: 0,
            stockWincp: stockRow?.SaldoAkhirFisik || 0,
            stockAkhir: stockRow?.SaldoAkhir || 0,
            qtyReserved: reservationsByItem.get(materialId)?.totalQty || 0,
            barangJadiSet: new Map(),
          });
        }
        const agg = materialAggMap.get(uniqueKey)!;
        agg.totalNeeded += needed;
        if (!agg.barangJadiSet.has(barangJadi.Kode_Barang)) {
          agg.barangJadiSet.set(barangJadi.Kode_Barang, {
            qty: barangJadi.QTY,
            nama: barangJadi.Nama_PO,
            kode: barangJadi.Kode_Barang,
          });
        }
      }
    }
  }

  // Gabung material dengan kode sama
  type MergedMaterial = MaterialAgg & { levelDetails: { level: number; needed: number }[] };
  const merged = new Map<string, MergedMaterial>();
  for (const data of materialAggMap.values()) {
    const existing = merged.get(data.kode);
    if (existing) {
      existing.totalNeeded += data.totalNeeded;
      data.barangJadiSet.forEach((info, kode) => {
        if (!existing.barangJadiSet.has(kode)) existing.barangJadiSet.set(kode, info);
      });
      existing.levelDetails.push({
        level: Number(data.kode.match(/_L(\d+)$/)?.[1] ?? 0),
        needed: data.totalNeeded,
      });
    } else {
      merged.set(data.kode, { ...data, levelDetails: [] });
    }
  }

  const materialDataForDatabase: MatRow[] = [];
  for (const [materialId, agg] of merged) {
    const barangJadiDetails: string[] = [];
    for (const [, info] of agg.barangJadiSet) {
      barangJadiDetails.push(`${info.kode} (${info.qty.toLocaleString()})`);
    }
    const reservedData = reservationsByItem.get(materialId);
    const reservationDetailsList: string[] = [];
    if (reservedData && reservedData.spkList.size > 0) {
      for (const spkReservation of reservedData.spkList) {
        reservationDetailsList.push(
          `${spkReservation.namaPO} (${spkReservation.qtyReserved.toLocaleString()})`,
        );
      }
    }
    const reservedByText =
      reservationDetailsList.length > 0 ? reservationDetailsList.join("\n") : "-";
    const variantInfo = getVariantInfo(materialId);
    const totalDibutuhkan = agg.totalNeeded + agg.qtyReserved;
    const available = agg.stockWincp - totalDibutuhkan;
    const kekurangan = totalDibutuhkan - agg.stockWincp;
    let status = "";
    if (agg.stockWincp >= totalDibutuhkan) status = "AMAN";
    else if (agg.stockWincp > 0) status = "KURANG";
    else status = "HABIS";

    let levelInfo = "";
    if (agg.levelDetails.length > 1) {
      const summary = agg.levelDetails
        .map((d) => `Lv${d.level}: ${d.needed.toLocaleString()}`)
        .join(" | ");
      levelInfo = `[Multi Level: ${summary}]`;
    }

    materialDataForDatabase.push({
      "Kode Material": materialId,
      "Nama Material": agg.nama,
      "Nama China": agg.nama_china,
      Spesifikasi: agg.spec,
      Warna: agg.warna,
      Bahan: agg.bahan,
      Departemen: agg.departemen,
      "Barang Jadi": barangJadiDetails.join("\n"),
      "Total Kebutuhan": agg.totalNeeded,
      "Stok Wincp (Real)": agg.stockWincp,
      "Saldo Akhir": agg.stockAkhir,
      "Qty Reserved (PO Lain)": agg.qtyReserved,
      "Total Dibutuhkan": totalDibutuhkan,
      "Qty Available": available,
      "Reserved Oleh SPK": reservedByText,
      "Keterangan Variant": variantInfo,
      "Status Stock": status,
      Kekurangan: kekurangan > 0 ? kekurangan : 0,
      "Info Level": levelInfo,
    });
  }
  materialDataForDatabase.sort((a, b) =>
    String(a["Kode Material"]).localeCompare(String(b["Kode Material"])),
  );

  const wb = XLSX.utils.book_new();

  // ==================== SHEET 1: PO ====================
  const poData: Record<string, string | number>[] = [];
  groups.forEach((group) => {
    linesOf(group).forEach((item) => {
      poData.push({
        "No SPK": group.No_SPK,
        "Tanggal Order": group.lines[0]?.Tanggal_Order ?? "",
        "Tanggal Stok": group.lines[0]?.Tanggal_Order ?? today,
        "Nama PO": item.Nama_PO,
        "Kode Barang Jadi": item.Kode_Barang,
        "QTY PO": item.QTY,
      });
    });
  });
  const wsPO = XLSX.utils.json_to_sheet(poData);
  wsPO["!cols"] = [
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPO, "PO");

  // ==================== SHEET 2: BOM ====================
  const bomData: Record<string, string | number>[] = [];
  let totalINJECTIONRemoved = 0;

  for (const group of groups) {
    for (const barangJadi of linesOf(group)) {
      const bomFlat = bomByKodeBarang.get(barangJadi.Kode_Barang) ?? [];
      if (bomFlat.length === 0) continue;

      const filteredBom = bomFlat.filter(
        (b) => Number(b.Level) > 0 && !isINJECTIONDepartment(b.Departemen),
      );
      totalINJECTIONRemoved += bomFlat.filter(
        (b) => Number(b.Level) > 0 && isINJECTIONDepartment(b.Departemen),
      ).length;
      if (filteredBom.length === 0) continue;

      const accumulatedMap = calculateAccumulatedQty(filteredBom);

      bomData.push({
        "No SPK": group.No_SPK,
        "Kode Barang Jadi": barangJadi.Kode_Barang,
        "Nama PO": barangJadi.Nama_PO,
        "QTY PO": barangJadi.QTY,
        Level: "HEADER",
        "Kode Komponen": "",
        "Nama Komponen": "",
        "Nama Komponen China": "",
        "Qty per Unit (BOM)": "",
        "Accumulated Qty": "",
        "Total Kebutuhan": "",
        Stok: "",
        Status: "",
        "Keterangan Perhitungan Accumulated": "",
      });

      const treeStructure = buildTreeWithDuplicates(filteredBom);
      const displayedItems = new Map<string, number>();

      const traverseTree = (nodes: BomItem[]) => {
        for (const node of nodes) {
          const nodeLevel = Number(node.Level);
          const nodeId = normalizeItemId(node.ItemID);
          const stockRow = stockRows.get(nodeId);
          const accumulatedKey = `${nodeId}_L${nodeLevel}`;
          const accumulatedQty = accumulatedMap.get(accumulatedKey) || node.Qty;
          const totalNeeded = accumulatedQty * barangJadi.QTY;
          const stock = stockRow?.SaldoAkhir || 0;
          const shortage = totalNeeded > stock;

          const prevLevel = displayedItems.get(nodeId);
          const isDuplicate = prevLevel !== undefined && prevLevel !== nodeLevel;
          displayedItems.set(nodeId, nodeLevel);

          let calculationNote = "";
          if (nodeLevel === 1) {
            calculationNote = `Qty per Unit × QTY PO = ${node.Qty} × ${barangJadi.QTY} = ${totalNeeded.toLocaleString()}`;
          } else {
            const parentAccumulated = accumulatedQty / node.Qty;
            calculationNote = `Qty per Unit × Accumulated Parent × QTY PO = ${node.Qty} × ${parentAccumulated} × ${barangJadi.QTY} = ${totalNeeded.toLocaleString()}`;
          }

          bomData.push({
            "No SPK": "",
            "Kode Barang Jadi": "",
            "Nama PO": "",
            "QTY PO": "",
            Level: node.Level,
            "Kode Komponen": node.ItemID,
            "Nama Komponen": formatIndentedName(node.ItemName || node.ItemID, nodeLevel, isDuplicate),
            "Nama Komponen China": node.ItemName2 || "",
            "Qty per Unit (BOM)": node.Qty,
            "Accumulated Qty": accumulatedQty,
            "Total Kebutuhan": totalNeeded.toLocaleString(),
            Stok: stock.toLocaleString(),
            Status: shortage ? "KURANG" : "CUKUP",
            "Keterangan Perhitungan Accumulated": calculationNote,
          });

          if (node.children && node.children.length > 0) traverseTree(node.children);
        }
      };
      traverseTree(treeStructure);
      bomData.push({});
    }
  }

  bomData.push({});
  bomData.push({ "No SPK": "INFORMASI", "Nama Komponen": "📦 = Komponen Level 1" });
  bomData.push({ "No SPK": "INFORMASI", "Nama Komponen": "└─ = Sub-komponen Level 2" });
  bomData.push({ "No SPK": "INFORMASI", "Nama Komponen": "  └─ = Sub-komponen Level 3" });
  bomData.push({ "No SPK": "INFORMASI", "Nama Komponen": "↳ = Duplikat item (kode sama tapi level berbeda)" });
  bomData.push({
    "No SPK": "INFORMASI",
    "Nama Komponen": `* Komponen dengan departemen INJECTION tidak ditampilkan (${totalINJECTIONRemoved} item dihapus)`,
  });

  const wsBOM = XLSX.utils.json_to_sheet(bomData);
  wsBOM["!cols"] = [
    { wch: 15 }, { wch: 18 }, { wch: 35 }, { wch: 12 }, { wch: 10 }, { wch: 18 },
    { wch: 55 }, { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 },
    { wch: 12 }, { wch: 60 },
  ];
  XLSX.utils.book_append_sheet(wb, wsBOM, "BOM");

  // ==================== SHEET PER DEPARTEMEN ====================
  type Cell = string | number;
  const materialsByDept = new Map<string, Map<string, Cell[]>>();
  for (const row of materialDataForDatabase) {
    const dept = String(row["Departemen"] || "UNKNOWN");
    const materialCode = String(row["Kode Material"] ?? "");
    if (!materialsByDept.has(dept)) materialsByDept.set(dept, new Map());
    const deptMap = materialsByDept.get(dept)!;

    const rowArray: Cell[] = [
      row["Barang Jadi"] ?? "",
      row["Kode Material"] ?? "",
      row["Nama Material"] ?? "",
      row["Nama China"] ?? "",
      row["Spesifikasi"] ?? "",
      row["Warna"] ?? "",
      row["Bahan"] ?? "",
      row["Departemen"] ?? "",
      Number(row["Total Kebutuhan"]) || 0,
      Number(row["Qty Reserved (PO Lain)"]) || 0,
      Number(row["Total Dibutuhkan"]) || 0,
      Number(row["Stok Wincp (Real)"]) || 0,
      Number(row["Saldo Akhir"]) || 0,
      Number(row["Qty Available"]) || 0,
      row["Reserved Oleh SPK"] ?? "",
      row["Status Stock"] ?? "",
      row["Keterangan Variant"] ?? "",
      row["Info Level"] || "",
    ];

    if (!deptMap.has(materialCode)) {
      deptMap.set(materialCode, rowArray);
    } else {
      const existing = deptMap.get(materialCode)!;
      existing[8] = Number(existing[8] || 0) + Number(rowArray[8] || 0);
      existing[10] = Number(existing[10] || 0) + Number(rowArray[10] || 0);
      existing[13] = Number(existing[12] || 0) - Number(existing[10] || 0);
      existing[15] =
        Number(existing[13]) > 0 ? "KELEBIHAN" : Number(existing[13]) < 0 ? "KURANG" : "CUKUP";
      const existingBJ = String(existing[0] || "");
      const newBJ = String(rowArray[0] || "");
      if (newBJ && !existingBJ.includes(newBJ.split("\n")[0])) {
        existing[0] = existingBJ + (existingBJ ? "\n" : "") + newBJ;
      }
      const existingReserved = String(existing[14] || "");
      const newReserved = String(rowArray[14] || "");
      if (newReserved !== "-" && newReserved && !existingReserved.includes(newReserved)) {
        existing[14] =
          existingReserved + (existingReserved !== "-" && existingReserved ? "\n" : "") + newReserved;
      }
      const existingVariant = String(existing[16] || "");
      const newVariant = String(rowArray[16] || "");
      if (newVariant !== "-" && newVariant !== existingVariant && !existingVariant.includes(newVariant)) {
        existing[16] = existingVariant + (existingVariant !== "-" && existingVariant ? " / " : "") + newVariant;
      }
      const existingLevelInfo = String(existing[17] || "");
      const newLevelInfo = String(rowArray[17] || "");
      if (newLevelInfo && !existingLevelInfo.includes(newLevelInfo)) {
        existing[17] = existingLevelInfo ? `${existingLevelInfo} | ${newLevelInfo}` : newLevelInfo;
      }
      deptMap.set(materialCode, existing);
    }
  }

  const finalMaterialsByDept = new Map<string, Cell[][]>();
  for (const [dept, materialMap] of materialsByDept) {
    const rows = Array.from(materialMap.values());
    rows.sort((a, b) => String(a[1] || "").localeCompare(String(b[1] || "")));
    finalMaterialsByDept.set(dept, rows);
  }
  const sortedDepartments = Array.from(finalMaterialsByDept.keys()).sort();

  const deptColWidths = [
    { wch: 50 }, { wch: 18 }, { wch: 40 }, { wch: 35 }, { wch: 30 }, { wch: 20 },
    { wch: 25 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 50 }, { wch: 15 }, { wch: 30 }, { wch: 40 },
  ];
  const headersDept = [
    "Barang Jadi",
    "Kode Material",
    "Nama Material",
    "Nama China",
    "Spesifikasi",
    "Warna",
    "Bahan",
    "Departemen",
    "Total Kebutuhan",
    "Reserved (Qty PO Lain)",
    "Total Dibutuhkan",
    "Stok Wincp (Real)",
    "Stok Akhir",
    "Sisa Stok",
    "Reserved Oleh SPK",
    "Status",
    "Keterangan Variant",
    "Info Multi Level",
  ];

  for (const dept of sortedDepartments) {
    const deptMaterials = finalMaterialsByDept.get(dept) || [];
    const totalNeeded = deptMaterials.reduce((sum, row) => sum + Number(row[8] || 0), 0);
    const totalSisa = deptMaterials.reduce((sum, row) => sum + Number(row[13] || 0), 0);

    const wsData: Cell[][] = [
      [`LAPORAN KEBUTUHAN MATERIAL - DEPARTEMEN ${(dept as string).toUpperCase()}`],
      [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
      [`Tanggal Stok: ${today}`],
      [`Catatan: Material dengan kode yang sama dijumlahkan dari SEMUA LEVEL BOM`],
      [],
      ["DETAIL MATERIAL"],
      headersDept,
      ...deptMaterials,
      [],
      [
        `Total: ${deptMaterials.length} material, ` +
          `Kebutuhan: ${totalNeeded.toLocaleString()}, ` +
          `Sisa Stok: ${totalSisa.toLocaleString()}`,
      ],
    ];

    const wsDept = XLSX.utils.aoa_to_sheet(wsData);
    wsDept["!cols"] = deptColWidths;
    wsDept["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headersDept.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headersDept.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headersDept.length - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: headersDept.length - 1 } },
    ];

    const sheetName = getUniqueSheetName(wb, dept.toUpperCase());
    XLSX.utils.book_append_sheet(wb, wsDept, sheetName);
  }

  // ==================== SHEET REKAP PER DEPARTEMEN ====================
  const allDeptSummary: Cell[][] = [
    ["REKAP KEBUTUHAN MATERIAL PER DEPARTEMEN"],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [`Tanggal Stok: ${today}`],
    [],
    ["Departemen", "Jumlah Material", "Total Kebutuhan", "Total Sisa Stok", "Status"],
  ];
  for (const dept of sortedDepartments) {
    const deptMaterials = finalMaterialsByDept.get(dept) || [];
    const totalNeeded = deptMaterials.reduce((sum, row) => sum + Number(row[8] || 0), 0);
    const totalSisa = deptMaterials.reduce((sum, row) => sum + Number(row[13] || 0), 0);
    const status = totalSisa > 0 ? "KELEBIHAN" : totalSisa < 0 ? "KEKURANGAN" : "CUKUP";
    allDeptSummary.push([dept, deptMaterials.length, totalNeeded.toLocaleString(), totalSisa.toLocaleString(), status]);
  }
  const totalAllMaterials = materialDataForDatabase.length;
  const totalAllNeeded = materialDataForDatabase.reduce(
    (sum, row) => sum + (Number(row["Total Kebutuhan"]) || 0), 0,
  );
  const totalAllSisa = materialDataForDatabase.reduce(
    (sum, row) => sum + (Number(row["Qty Available"]) || 0), 0,
  );
  allDeptSummary.push(
    [],
    [
      "TOTAL KESELURUHAN",
      totalAllMaterials,
      totalAllNeeded.toLocaleString(),
      totalAllSisa.toLocaleString(),
      totalAllSisa > 0 ? "KELEBIHAN" : totalAllSisa < 0 ? "KEKURANGAN" : "CUKUP",
    ],
  );

  const wsSummary = XLSX.utils.aoa_to_sheet(allDeptSummary);
  wsSummary["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  wsSummary["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "REKAP_PER_DEPARTEMEN");

  // ==================== SHEET KETERANGAN ====================
  const keteranganData: Cell[][] = [
    ["📋 PETUNJUK MEMBACA LAPORAN KEBUTUHAN MATERIAL"],
    [""],
    ["A. INFORMASI UMUM"],
    ["No", "Item", "Keterangan"],
    ["1", "Tanggal Export", "Tanggal saat laporan diekspor"],
    ["2", "Tanggal Stok", "Tanggal data stok yang digunakan"],
    [""],
    ["B. PENJELASAN KHUSUS - MULTI LEVEL"],
    ["No", "Item", "Keterangan"],
    ["1", "Material Duplikat", "Material yang muncul di multiple level BOM (contoh: 06R123)"],
    ["2", "Perhitungan", "Semua level dihitung dan dijumlahkan (tidak ada yang di-skip)"],
    ["3", "Info Multi Level", "Kolom Info Multi Level menunjukkan breakdown per level"],
    [""],
    ["C. INFORMASI FILE"],
    ["No", "Informasi", "Nilai"],
    ["1", "Nama File", fileName],
    ["2", "Jumlah PO", groups.length],
    ["3", "Total Material", materialDataForDatabase.length],
    ["4", "Tanggal Export", new Date().toLocaleDateString("id-ID")],
    ["5", "Waktu Export", new Date().toLocaleTimeString("id-ID")],
  ];
  const wsKeterangan = XLSX.utils.aoa_to_sheet(keteranganData);
  wsKeterangan["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 50 }];
  wsKeterangan["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } },
    { s: { r: 13, c: 0 }, e: { r: 13, c: 2 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsKeterangan, "KETERANGAN");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, fileName };
}

// ==================== MASTER BARANG EXPORT ====================
export async function exportMasterGoodsToExcel(
  rows: MasterItem[],
  opts?: { q?: string; selectedCount?: number },
): Promise<{ buffer: Buffer; fileName: string }> {
  const today = new Date().toISOString().split("T")[0];
  const safeQ = (opts?.q ?? "").trim().replace(/[\\/*?:"<>|]/g, "").replace(/\s+/g, "_").slice(0, 20);
  const sel = opts?.selectedCount ? `_pilih${opts.selectedCount}` : "";
  const fileName = safeQ
    ? `Master_Barang_${safeQ}${sel}_${today}.xlsx`
    : `Master_Barang_${sel ? `pilih${opts?.selectedCount}` : "semua"}_${today}.xlsx`;

  const wb = XLSX.utils.book_new();

  // Header brutal + data
  const headers = [
    "ItemID",
    "ItemName",
    "namebc",
    "Nama Cina",
    "Warna",
    "Departemen",
    "KodeJenis",
    "NamaJenis",
    "Satuan",
    "Spec",
    "Bahan",
  ];

  const wsData: (string | number)[][] = [
    [`MASTER BARANG — KIW Monitoring Inventori`],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [`Filter: ${opts?.q ? `pencarian "${opts.q}"` : "semua barang (taGoods × taKindofGoods)"}${opts?.selectedCount ? ` | Dipilih ${opts.selectedCount} item` : ""}`],
    [`Total: ${rows.length.toLocaleString("id-ID")} item`],
    [],
    headers,
    ...rows.map((r) => [
      r.ItemID,
      r.ItemName,
      r.namebc,
      r.namecina,
      r.warna,
      r.Departemen,
      r.KodeJenis,
      r.NamaJenis,
      r.Satuan,
      r.Spec,
      r.bahan,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 16 }, // ItemID
    { wch: 32 }, // ItemName
    { wch: 16 }, // namebc
    { wch: 24 }, // namecina
    { wch: 14 }, // warna
    { wch: 14 }, // Departemen
    { wch: 12 }, // KodeJenis
    { wch: 22 }, // NamaJenis
    { wch: 10 }, // Satuan
    { wch: 30 }, // Spec
    { wch: 18 }, // bahan
  ];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: headers.length - 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Master_Barang");

  // Sheet keterangan
  const ket: (string | number)[][] = [
    ["KETERANGAN — MASTER BARANG"],
    [],
    ["Kolom", "Sumber", "Keterangan"],
    ["ItemID", "taGoods.ItemID", "Kode barang unik"],
    ["ItemName", "taGoods.ItemName", "Nama barang"],
    ["namebc", "taGoods.namebc", "Nama BC"],
    ["Nama Cina", "taGoods.ItemName2", "Nama Cina"],
    ["Warna", "taGoods.warnac", "Warna"],
    ["Departemen", "taGoods.Mark", "Departemen / Mark"],
    ["KodeJenis", "taGoods.KodeJenis", "Kode jenis"],
    ["NamaJenis", "taKindofGoods.NamaJenis", "Nama jenis (JOIN)"],
    ["Satuan", "taGoods.SatuanKecil", "Satuan kecil"],
    ["Spec", "taGoods.Spec", "Spesifikasi"],
    ["Bahan", "taGoods.bahan", "Bahan"],
    [],
    ["Query", "", "SELECT ... FROM taGoods a INNER JOIN taKindofGoods b ON a.KodeJenis=b.KodeJenis WHERE ..."],
    ["Filter", "", opts?.q ? `LIKE "%${opts.q}%"` : "tanpa filter"],
    ["Total diekspor", "", rows.length],
    ["Tanggal", "", new Date().toLocaleString("id-ID")],
  ];
  const wsKet = XLSX.utils.aoa_to_sheet(ket);
  wsKet["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 50 }];
  wsKet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsKet, "KETERANGAN");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, fileName };
}

// ==================== MONITORING PRODUKSI EXPORT ====================
export async function exportMonitoringProduksiToExcel(
  rows: MonitoringProduksiRow[],
  opts?: { dept?: string; tipe?: string; q?: string; tgl1?: string; tgl2?: string; selectedCount?: number },
): Promise<{ buffer: Buffer; fileName: string }> {
  const today = new Date().toISOString().split("T")[0];
  const safeDept = (opts?.dept || "SEMUA").replace(/[\\/*?:"<>|]/g, "");
  const safeQ = (opts?.q ?? "").trim().slice(0, 12).replace(/[\\/*?:"<>|]/g, "").replace(/\s+/g, "_");
  const sel = opts?.selectedCount && opts.selectedCount !== rows.length ? `_pilih${opts.selectedCount}` : "";
  const datePart = opts?.tgl1 && opts?.tgl2 ? `_${opts.tgl1}_${opts.tgl2}` : "";
  const fileName = `Monitoring_Produksi_${safeDept || "SEMUA"}${safeQ ? `_${safeQ}` : ""}${datePart}${sel}_${today}.xlsx`;

  const wb = XLSX.utils.book_new();

  const headers = [
    "No_Produksi",
    "Tanggal",
    "Departemen",
    "Tipe_Produksi",
    "SPK",
    "NoRator",
    "Nama_PO",
    "Gudang",
    "Remark",
    "ItemID",
    "Bags",
    "Kgs",
    "Kategori",
    "UserName",
  ];

  const deptLabel: Record<string, string> = {
    IN: "INJEKSI",
    SP: "SPRAY",
    MO: "MOULDING",
    PL: "PLATING",
    AS: "ASSEMBLY",
    "": "SEMUA",
  };
  const tipeLabel: Record<string, string> = { B: "BAHAN", H: "HASIL", "": "SEMUA" };

  const wsData: (string | number)[][] = [
    [`MONITORING PRODUKSI — KIW Monitoring Inventori`],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [
      `Filter: Departemen=${deptLabel[opts?.dept ?? ""] ?? (opts?.dept || "SEMUA")} | Tipe=${tipeLabel[opts?.tipe ?? ""] ?? (opts?.tipe || "SEMUA")}${opts?.tgl1 && opts?.tgl2 ? ` | Tgl=${opts.tgl1}..${opts.tgl2}` : ""}${opts?.q ? ` | Cari="${opts.q}"` : ""}${opts?.selectedCount ? ` | Dipilih ${opts.selectedCount} dari ${rows.length}` : ""}`,
    ],
    [`Total: ${rows.length.toLocaleString("id-ID")} baris`],
    [],
    headers,
    ...rows.map((r) => [
      r.No_Produksi,
      r.Tanggal ?? "",
      r.Departemen,
      r.Tipe_Produksi,
      r.SPK,
      r.NoRator ?? "",
      r.Nama_PO ?? "",
      r.Gudang ?? "",
      r.Remark ?? "",
      r.ItemID,
      r.Bags ?? 0,
      r.Kgs ?? 0,
      r.Kategori ?? "",
      r.UserName ?? "",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 28 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
  ];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: headers.length - 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Monitoring_Produksi");

  const ket: (string | number)[][] = [
    ["KETERANGAN — MONITORING PRODUKSI"],
    [],
    ["Kolom", "Sumber", "Keterangan"],
    ["No_Produksi", "taPRProdHd.ProdID", "Nomor produksi"],
    ["Tanggal", "taPRProdHd.ProdDate", "Tanggal produksi"],
    ["Departemen", "taDeptPROrder.PRDeptName", "IN/SP/MO/PL/AS"],
    ["Tipe_Produksi", "taPRProdDt.ItemType", "B=BAHAN, H=HASIL"],
    ["SPK", "taPRProdHd.OrderID", "Nomor SPK"],
    ["NoRator", "taPRProdHd.NoRator", "No rator"],
    ["Nama_PO", "taPROrder.Remark", "Nama PO"],
    ["Gudang", "taLocation.LocName", "Gudang"],
    ["Remark", "taPRProdHd.Remark", "Catatan produksi"],
    ["ItemID", "taPRProdDt.ItemID", "Kode item"],
    ["Bags", "taPRProdDt.Bags", "Jumlah bags"],
    ["Kgs", "taPRProdDt.Kgs", "Jumlah kg"],
    ["Kategori", "taKindofGoods.NamaJenis", "Kategori barang"],
    ["UserName", "taPRProdDt.UserName", "User input"],
    [],
    ["Filter Departemen", "", deptLabel[opts?.dept ?? ""] ?? (opts?.dept || "SEMUA")],
    ["Filter Tipe", "", tipeLabel[opts?.tipe ?? ""] ?? (opts?.tipe || "SEMUA")],
    ["Filter Tgl", "", opts?.tgl1 && opts?.tgl2 ? `${opts.tgl1} s/d ${opts.tgl2}` : "-"],
    ["Filter Cari", "", opts?.q || "-"],
    ["Total baris", "", rows.length],
    ["Tanggal", "", new Date().toLocaleString("id-ID")],
  ];
  const wsKet = XLSX.utils.aoa_to_sheet(ket);
  wsKet["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 48 }];
  wsKet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsKet, "KETERANGAN");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, fileName };
}

// ==================== SPK EXPORT ====================
export async function exportSPKToExcel(
  rows: SPKRow[],
  opts?: { q?: string; status?: string; selectedCount?: number },
): Promise<{ buffer: Buffer; fileName: string }> {
  const today = new Date().toISOString().split("T")[0];
  const safeQ = (opts?.q ?? "").trim().slice(0, 12).replace(/[\\/*?:"<>|]/g, "").replace(/\s+/g, "_");
  const statusLabel = opts?.status === "completed" ? "SELESAI" : opts?.status === "active" ? "AKTIF" : "SEMUA";
  const sel = opts?.selectedCount && opts.selectedCount !== rows.length ? `_pilih${opts.selectedCount}` : "";
  const fileName = `SPK_${statusLabel}${safeQ ? `_${safeQ}` : ""}${sel}_${today}.xlsx`;

  const wb = XLSX.utils.book_new();
  const headers = ["OrderID (SPK)", "Tanggal Order", "Tipe", "Remark (Nama PO)", "Completed", "FinishedDate"];
  const wsData: (string | number)[][] = [
    [`DAFTAR SPK — KIW Monitoring Inventori`],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [`Filter: Status=${statusLabel}${opts?.q ? ` | Cari="${opts.q}"` : ""}${opts?.selectedCount ? ` | Dipilih ${opts.selectedCount} dari ${rows.length}` : ""}`],
    [`Total: ${rows.length.toLocaleString("id-ID")} SPK`],
    [],
    headers,
    ...rows.map((r) => [
      r.OrderID,
      r.OrderDate ?? "",
      r.OrderType ?? "",
      r.Remark ?? "",
      r.Completed ? "SELESAI" : "AKTIF",
      r.FinishedDate ?? "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 36 }, { wch: 10 }, { wch: 12 }];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: headers.length - 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "SPK");

  const ket: (string | number)[][] = [
    ["KETERANGAN — SPK"],
    [],
    ["Kolom", "Sumber", "Keterangan"],
    ["OrderID", "taPROrder.OrderID", "No SPK (AS%)"],
    ["Tanggal Order", "taPROrder.OrderDate", "Tanggal SPK"],
    ["Tipe", "taPROrder.OrderType", "Tipe order"],
    ["Remark", "taPROrder.Remark", "Nama PO"],
    ["Completed", "taPROrder.Completed", "0=AKTIF, 1=SELESAI"],
    ["FinishedDate", "taPROrder.FinishedDate", "Tanggal selesai (null jika aktif)"],
    [],
    ["Query", "", "UPDATE taPROrder SET Completed=@Completed, FinishedDate=@FinishedDate WHERE OrderID=@OrderID — dalam transaction"],
    ["Filter", "", `Status=${statusLabel} ${opts?.q ? `q=${opts.q}` : ""}`],
    ["Total", "", rows.length],
    ["Tanggal", "", new Date().toLocaleString("id-ID")],
  ];
  const wsKet = XLSX.utils.aoa_to_sheet(ket);
  wsKet["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 48 }];
  wsKet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsKet, "KETERANGAN");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, fileName };
}

// ==================== LBM EXPORT ====================
export async function exportLBMToExcel(rows: LBMRow[], opts?: { q?: string; tgl1?: string; tgl2?: string; selectedCount?: number }): Promise<{ buffer: Buffer; fileName: string }> {
  const today = new Date().toISOString().split("T")[0];
  const safeQ = (opts?.q ?? "").trim().slice(0,12).replace(/[\\/*?:\"<>|]/g,"").replace(/\s+/g,"_");
  const datePart = opts?.tgl1 && opts?.tgl2 ? `_${opts.tgl1}_${opts.tgl2}` : "";
  const sel = opts?.selectedCount && opts.selectedCount !== rows.length ? `_pilih${opts.selectedCount}` : "";
  const fileName = `LBM${safeQ ? `_${safeQ}` : ""}${datePart}${sel}_${today}.xlsx`;
  const wb = XLSX.utils.book_new();
  const headers = ["No_Transaksi","Tanggal","Gudang","NoRator","Keterangan","ItemID","Bags","Kgs","HPPPrice","Kategori","username"];
  const wsData: (string|number)[][] = [
    [`LBM — KIW Monitoring Inventori`],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [`Filter: ${opts?.q ? `Cari="${opts.q}"` : "semua"}${opts?.tgl1 && opts?.tgl2 ? ` | Tgl=${opts.tgl1}..${opts.tgl2}` : ""}${opts?.selectedCount ? ` | Dipilih ${opts.selectedCount} dari ${rows.length}` : ""}`],
    [`Total: ${rows.length.toLocaleString("id-ID")} baris`],
    [],
    headers,
    ...rows.map(r => [r.No_Transaksi, r.Tanggal ?? "", r.Gudang ?? "", r.NoRator ?? "", r.Keterangan ?? "", r.ItemID, r.Bags ?? 0, r.Kgs ?? 0, r.HPPPrice ?? 0, r.Kategori ?? "", r.username ?? ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{wch:14},{wch:12},{wch:16},{wch:10},{wch:28},{wch:14},{wch:8},{wch:8},{wch:12},{wch:16},{wch:14}];
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:headers.length-1}},{s:{r:1,c:0},e:{r:1,c:headers.length-1}},{s:{r:2,c:0},e:{r:2,c:headers.length-1}},{s:{r:3,c:0},e:{r:3,c:headers.length-1}}];
  XLSX.utils.book_append_sheet(wb, ws, "LBM");
    // ==================== KETERANGAN ====================
  const ket: (string|number)[][] = [
    ["PETUNJUK — LBM"],
    ["taOpNameIHD/IDT MoveType A,P"],
    ["Tanggal Export: " + new Date().toLocaleDateString("id-ID") + " " + new Date().toLocaleTimeString("id-ID")],
    [],
    ["No", "Kolom", "Keterangan"],
    ["1", "No_Transaksi", "Kolom No_Transaksi dari file LBM"],
    ["2", "Tanggal", "Kolom Tanggal dari file LBM"],
    ["3", "Gudang", "Kolom Gudang dari file LBM"],
    ["4", "NoRator", "Kolom NoRator dari file LBM"],
    ["5", "Keterangan", "Kolom Keterangan dari file LBM"],
    ["6", "ItemID", "Kolom ItemID dari file LBM"],
    ["7", "Bags", "Kolom Bags dari file LBM"],
    ["8", "Kgs", "Kolom Kgs dari file LBM"],
    ["9", "HPPPrice", "Kolom HPPPrice dari file LBM"],
    ["10", "Kategori", "Kolom Kategori dari file LBM"],
    ["11", "username", "Kolom username dari file LBM"],
  ];
  const wsKet = XLSX.utils.aoa_to_sheet(ket);
  wsKet["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 40 }];
  wsKet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsKet, "KETERANGAN");

  const buffer = XLSX.write(wb, { type:"buffer", bookType:"xlsx"}) as Buffer;
  return { buffer, fileName };
}

// ==================== LBK EXPORT ====================
export async function exportLBKToExcel(rows: LBKRow[], opts?: { q?: string; tgl1?: string; tgl2?: string; selectedCount?: number }): Promise<{ buffer: Buffer; fileName: string }> {
  const today = new Date().toISOString().split("T")[0];
  const safeQ = (opts?.q ?? "").trim().slice(0,12).replace(/[\\/*?:\"<>|]/g,"").replace(/\s+/g,"_");
  const datePart = opts?.tgl1 && opts?.tgl2 ? `_${opts.tgl1}_${opts.tgl2}` : "";
  const sel = opts?.selectedCount && opts.selectedCount !== rows.length ? `_pilih${opts.selectedCount}` : "";
  const fileName = `LBK${safeQ ? `_${safeQ}` : ""}${datePart}${sel}_${today}.xlsx`;
  const wb = XLSX.utils.book_new();
  const headers = ["No_Transaksi","Gudang","Tanggal","Keterangan","NoRator","ItemID","Bags","Kgs","HPPPrice","Kategori","username"];
  const wsData: (string|number)[][] = [
    [`LBK — KIW Monitoring Inventori`],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [`Filter: ${opts?.q ? `Cari="${opts.q}"` : "semua"}${opts?.tgl1 && opts?.tgl2 ? ` | Tgl=${opts.tgl1}..${opts.tgl2}` : ""}`],
    [`Total: ${rows.length.toLocaleString("id-ID")} baris`],
    [],
    headers,
    ...rows.map(r => [r.No_Transaksi, r.Gudang ?? "", r.Tanggal ?? "", r.Keterangan ?? "", r.NoRator ?? "", r.ItemID, r.Bags ?? 0, r.Kgs ?? 0, r.HPPPrice ?? 0, r.Kategori ?? "", r.username ?? ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{wch:14},{wch:16},{wch:12},{wch:28},{wch:10},{wch:14},{wch:8},{wch:8},{wch:12},{wch:16},{wch:14}];
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:headers.length-1}},{s:{r:1,c:0},e:{r:1,c:headers.length-1}},{s:{r:2,c:0},e:{r:2,c:headers.length-1}},{s:{r:3,c:0},e:{r:3,c:headers.length-1}}];
  XLSX.utils.book_append_sheet(wb, ws, "LBK");
    // ==================== KETERANGAN ====================
  const ket: (string|number)[][] = [
    ["PETUNJUK — LBK"],
    ["taOpNameOHD/ODT MoveType A,P"],
    ["Tanggal Export: " + new Date().toLocaleDateString("id-ID") + " " + new Date().toLocaleTimeString("id-ID")],
    [],
    ["No", "Kolom", "Keterangan"],
    ["1", "No_Transaksi", "Kolom No_Transaksi dari file LBK"],
    ["2", "Gudang", "Kolom Gudang dari file LBK"],
    ["3", "Tanggal", "Kolom Tanggal dari file LBK"],
    ["4", "Keterangan", "Kolom Keterangan dari file LBK"],
    ["5", "NoRator", "Kolom NoRator dari file LBK"],
    ["6", "ItemID", "Kolom ItemID dari file LBK"],
    ["7", "Bags", "Kolom Bags dari file LBK"],
    ["8", "Kgs", "Kolom Kgs dari file LBK"],
    ["9", "HPPPrice", "Kolom HPPPrice dari file LBK"],
    ["10", "Kategori", "Kolom Kategori dari file LBK"],
    ["11", "username", "Kolom username dari file LBK"],
  ];
  const wsKet = XLSX.utils.aoa_to_sheet(ket);
  wsKet["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 40 }];
  wsKet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsKet, "KETERANGAN");

  const buffer = XLSX.write(wb, { type:"buffer", bookType:"xlsx"}) as Buffer;
  return { buffer, fileName };
}

// ==================== RETUR PRODUKSI EXPORT ====================
export async function exportReturToExcel(rows: ReturRow[], opts?: { q?: string; tgl1?: string; tgl2?: string; selectedCount?: number }): Promise<{ buffer: Buffer; fileName: string }> {
  const today = new Date().toISOString().split("T")[0];
  const safeQ = (opts?.q ?? "").trim().slice(0,12).replace(/[\\/*?:\"<>|]/g,"").replace(/\s+/g,"_");
  const datePart = opts?.tgl1 && opts?.tgl2 ? `_${opts.tgl1}_${opts.tgl2}` : "";
  const sel = opts?.selectedCount && opts.selectedCount !== rows.length ? `_pilih${opts.selectedCount}` : "";
  const fileName = `Retur_Produksi${safeQ ? `_${safeQ}` : ""}${datePart}${sel}_${today}.xlsx`;
  const wb = XLSX.utils.book_new();
  const headers = ["No_Transaksi","Tanggal","Gudang","NoRator","Keterangan","ItemID","Bags","Kgs","HPPPrice","Kategori","username"];
  const wsData: (string|number)[][] = [
    [`RETUR PRODUKSI — KIW Monitoring Inventori (MoveType=K)`],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [`Filter: ${opts?.q ? `Cari="${opts.q}"` : "semua"}${opts?.tgl1 && opts?.tgl2 ? ` | Tgl=${opts.tgl1}..${opts.tgl2}` : ""}`],
    [`Total: ${rows.length.toLocaleString("id-ID")} baris`],
    [],
    headers,
    ...rows.map(r => [r.No_Transaksi, r.Tanggal ?? "", r.Gudang ?? "", r.NoRator ?? "", r.Keterangan ?? "", r.ItemID, r.Bags ?? 0, r.Kgs ?? 0, r.HPPPrice ?? 0, r.Kategori ?? "", r.username ?? ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{wch:14},{wch:12},{wch:16},{wch:10},{wch:28},{wch:14},{wch:8},{wch:8},{wch:12},{wch:16},{wch:14}];
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:headers.length-1}},{s:{r:1,c:0},e:{r:1,c:headers.length-1}},{s:{r:2,c:0},e:{r:2,c:headers.length-1}},{s:{r:3,c:0},e:{r:3,c:headers.length-1}}];
  XLSX.utils.book_append_sheet(wb, ws, "Retur");
    // ==================== KETERANGAN ====================
  const ket: (string|number)[][] = [
    ["PETUNJUK — RETUR"],
    ["taOpNameIHD/IDT MoveType K"],
    ["Tanggal Export: " + new Date().toLocaleDateString("id-ID") + " " + new Date().toLocaleTimeString("id-ID")],
    [],
    ["No", "Kolom", "Keterangan"],
    ["1", "No_Transaksi", "Kolom No_Transaksi dari file RETUR"],
    ["2", "Tanggal", "Kolom Tanggal dari file RETUR"],
    ["3", "Gudang", "Kolom Gudang dari file RETUR"],
    ["4", "NoRator", "Kolom NoRator dari file RETUR"],
    ["5", "Keterangan", "Kolom Keterangan dari file RETUR"],
    ["6", "ItemID", "Kolom ItemID dari file RETUR"],
    ["7", "Bags", "Kolom Bags dari file RETUR"],
    ["8", "Kgs", "Kolom Kgs dari file RETUR"],
    ["9", "HPPPrice", "Kolom HPPPrice dari file RETUR"],
    ["10", "Kategori", "Kolom Kategori dari file RETUR"],
    ["11", "username", "Kolom username dari file RETUR"],
  ];
  const wsKet = XLSX.utils.aoa_to_sheet(ket);
  wsKet["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 40 }];
  wsKet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsKet, "KETERANGAN");

  const buffer = XLSX.write(wb, { type:"buffer", bookType:"xlsx"}) as Buffer;
  return { buffer, fileName };
}

// ==================== MUTASI GUDANG EXPORT ====================
export async function exportMutasiToExcel(rows: MutasiRow[], opts?: { q?: string; tgl1?: string; tgl2?: string; selectedCount?: number }): Promise<{ buffer: Buffer; fileName: string }> {
  const today = new Date().toISOString().split("T")[0];
  const safeQ = (opts?.q ?? "").trim().slice(0,12).replace(/[\\/*?:\"<>|]/g,"").replace(/\s+/g,"_");
  const datePart = opts?.tgl1 && opts?.tgl2 ? `_${opts.tgl1}_${opts.tgl2}` : "";
  const sel = opts?.selectedCount && opts.selectedCount !== rows.length ? `_pilih${opts.selectedCount}` : "";
  const fileName = `Mutasi_Gudang${safeQ ? `_${safeQ}` : ""}${datePart}${sel}_${today}.xlsx`;
  const wb = XLSX.utils.book_new();
  const headers = ["No_Transaksi","Tanggal","Gudang_Asal","Gudang_Tujuan","NoRator","Keterangan","ItemID","Bags","Kgs","Kategori","username"];
  const wsData: (string|number)[][] = [
    [`MUTASI GUDANG — KIW Monitoring Inventori (MoveType R,M)`],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [`Filter: ${opts?.q ? `Cari="${opts.q}"` : "semua"}${opts?.tgl1 && opts?.tgl2 ? ` | Tgl=${opts.tgl1}..${opts.tgl2}` : ""}`],
    [`Total: ${rows.length.toLocaleString("id-ID")} baris`],
    [],
    headers,
    ...rows.map(r => [r.No_Transaksi, r.Tanggal ?? "", r.Gudang_Asal, r.Gudang_Tujuan, r.NoRator ?? "", r.Keterangan ?? "", r.ItemID, r.Bags ?? 0, r.Kgs ?? 0, r.Kategori ?? "", r.username ?? ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{wch:14},{wch:12},{wch:18},{wch:18},{wch:10},{wch:28},{wch:14},{wch:8},{wch:8},{wch:16},{wch:14}];
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:headers.length-1}},{s:{r:1,c:0},e:{r:1,c:headers.length-1}},{s:{r:2,c:0},e:{r:2,c:headers.length-1}},{s:{r:3,c:0},e:{r:3,c:headers.length-1}}];
  XLSX.utils.book_append_sheet(wb, ws, "Mutasi");
    // ==================== KETERANGAN ====================
  const ket: (string|number)[][] = [
    ["PETUNJUK — MUTASI"],
    ["taMoveHD/DT MoveType R,M"],
    ["Tanggal Export: " + new Date().toLocaleDateString("id-ID") + " " + new Date().toLocaleTimeString("id-ID")],
    [],
    ["No", "Kolom", "Keterangan"],
    ["1", "No_Transaksi", "Kolom No_Transaksi dari file MUTASI"],
    ["2", "Tanggal", "Kolom Tanggal dari file MUTASI"],
    ["3", "Gudang_Asal", "Kolom Gudang_Asal dari file MUTASI"],
    ["4", "Gudang_Tujuan", "Kolom Gudang_Tujuan dari file MUTASI"],
    ["5", "NoRator", "Kolom NoRator dari file MUTASI"],
    ["6", "Keterangan", "Kolom Keterangan dari file MUTASI"],
    ["7", "ItemID", "Kolom ItemID dari file MUTASI"],
    ["8", "Bags", "Kolom Bags dari file MUTASI"],
    ["9", "Kgs", "Kolom Kgs dari file MUTASI"],
    ["10", "Kategori", "Kolom Kategori dari file MUTASI"],
    ["11", "username", "Kolom username dari file MUTASI"],
  ];
  const wsKet = XLSX.utils.aoa_to_sheet(ket);
  wsKet["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 40 }];
  wsKet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsKet, "KETERANGAN");

  const buffer = XLSX.write(wb, { type:"buffer", bookType:"xlsx"}) as Buffer;
  return { buffer, fileName };
}

// ==================== PEMASUKAN GUDANG EXPORT ====================
export async function exportPemasukanToExcel(rows: PemasukanRow[], opts?: { q?: string; tgl1?: string; tgl2?: string; selectedCount?: number }): Promise<{ buffer: Buffer; fileName: string }> {
  const today = new Date().toISOString().split("T")[0];
  const safeQ = (opts?.q ?? "").trim().slice(0,12).replace(/[\\/*?:\"<>|]/g,"").replace(/\s+/g,"_");
  const datePart = opts?.tgl1 && opts?.tgl2 ? `_${opts.tgl1}_${opts.tgl2}` : "";
  const sel = opts?.selectedCount && opts.selectedCount !== rows.length ? `_pilih${opts.selectedCount}` : "";
  const fileName = `Pemasukan_Gudang${safeQ ? `_${safeQ}` : ""}${datePart}${sel}_${today}.xlsx`;
  const wb = XLSX.utils.book_new();
  const headers = ["No_Transaksi","Tanggal","Gudang","Supplier","Nopol","Nopen","TipeDok","ItemID","Bags","Kgs","satuan","Kategori","username"];
  const wsData: (string|number)[][] = [
    [`PEMASUKAN GUDANG — KIW Monitoring Inventori`],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [`Filter: ${opts?.q ? `Cari="${opts.q}"` : "semua"}${opts?.tgl1 && opts?.tgl2 ? ` | Tgl=${opts.tgl1}..${opts.tgl2}` : ""}`],
    [`Total: ${rows.length.toLocaleString("id-ID")} baris`],
    [],
    headers,
    ...rows.map(r => [r.No_Transaksi, r.Tanggal ?? "", r.Gudang ?? "", r.Supplier ?? "", r.Nopol ?? "", r.Nopen ?? "", r.TipeDok ?? "", r.ItemID, r.Bags ?? 0, r.Kgs ?? 0, r.satuan ?? "", r.Kategori ?? "", r.username ?? ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{wch:14},{wch:12},{wch:16},{wch:22},{wch:12},{wch:14},{wch:10},{wch:14},{wch:8},{wch:8},{wch:8},{wch:16},{wch:14}];
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:headers.length-1}},{s:{r:1,c:0},e:{r:1,c:headers.length-1}},{s:{r:2,c:0},e:{r:2,c:headers.length-1}},{s:{r:3,c:0},e:{r:3,c:headers.length-1}}];
  XLSX.utils.book_append_sheet(wb, ws, "Pemasukan");
    // ==================== KETERANGAN ====================
  const ket: (string|number)[][] = [
    ["PETUNJUK — PEMASUKAN"],
    ["taTransIHD2/IDT Pemasukan"],
    ["Tanggal Export: " + new Date().toLocaleDateString("id-ID") + " " + new Date().toLocaleTimeString("id-ID")],
    [],
    ["No", "Kolom", "Keterangan"],
    ["1", "No_Transaksi", "Kolom No_Transaksi dari file PEMASUKAN"],
    ["2", "Tanggal", "Kolom Tanggal dari file PEMASUKAN"],
    ["3", "Gudang", "Kolom Gudang dari file PEMASUKAN"],
    ["4", "Supplier", "Kolom Supplier dari file PEMASUKAN"],
    ["5", "Nopol", "Kolom Nopol dari file PEMASUKAN"],
    ["6", "Nopen", "Kolom Nopen dari file PEMASUKAN"],
    ["7", "TipeDok", "Kolom TipeDok dari file PEMASUKAN"],
    ["8", "ItemID", "Kolom ItemID dari file PEMASUKAN"],
    ["9", "Bags", "Kolom Bags dari file PEMASUKAN"],
    ["10", "Kgs", "Kolom Kgs dari file PEMASUKAN"],
    ["11", "satuan", "Kolom satuan dari file PEMASUKAN"],
    ["12", "Kategori", "Kolom Kategori dari file PEMASUKAN"],
    ["13", "username", "Kolom username dari file PEMASUKAN"],
  ];
  const wsKet = XLSX.utils.aoa_to_sheet(ket);
  wsKet["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 40 }];
  wsKet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsKet, "KETERANGAN");

  const buffer = XLSX.write(wb, { type:"buffer", bookType:"xlsx"}) as Buffer;
  return { buffer, fileName };
}

// ==================== LOG TRANSAKSI (taLogNew) EXPORT ====================
export async function exportTaLogToExcel(rows: TaLogRow[], opts?: { q?: string; tgl1?: string; tgl2?: string; selectedCount?: number }): Promise<{ buffer: Buffer; fileName: string }> {
  const today = new Date().toISOString().split("T")[0];
  const safeQ = (opts?.q ?? "").trim().slice(0,12).replace(/[\\/*?:\"<>|]/g,"").replace(/\s+/g,"_");
  const datePart = opts?.tgl1 && opts?.tgl2 ? `_${opts.tgl1}_${opts.tgl2}` : "";
  const sel = opts?.selectedCount && opts.selectedCount !== rows.length ? `_pilih${opts.selectedCount}` : "";
  const fileName = `Log_Transaksi${safeQ ? `_${safeQ}` : ""}${datePart}${sel}_${today}.xlsx`;
  const wb = XLSX.utils.book_new();
  const headers = ["Pengguna","Tanggal","Jam","Berat (Kg)","Keterangan","No. Transaksi","Kode Barang","Tgl Transaksi","IP"];
  const wsData: (string|number)[][] = [
    [`LOG TRANSAKSI — KIW Monitoring Inventori (taLogNew, terbaru dulu)`],
    [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
    [`Filter: ${opts?.q ? `Cari="${opts.q}"` : "semua"}${opts?.tgl1 && opts?.tgl2 ? ` | Tgl User=${opts.tgl1}..${opts.tgl2}` : ""}${opts?.selectedCount ? ` | Dipilih ${opts.selectedCount} dari ${rows.length}` : ""}`],
    [`Total: ${rows.length.toLocaleString("id-ID")} baris`],
    [],
    headers,
    ...rows.map(r => [r.Username, r.UserDate ?? "", r.UserTime ?? "", r.Kgs ?? 0, r.Remark ?? "", r.TransNo ?? "", r.ItemID ?? "", r.TransDateTime ? String(r.TransDateTime).slice(0, 10) : "", r.IpAddr ?? ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{wch:16},{wch:19},{wch:10},{wch:10},{wch:30},{wch:14},{wch:14},{wch:12},{wch:16}];
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:headers.length-1}},{s:{r:1,c:0},e:{r:1,c:headers.length-1}},{s:{r:2,c:0},e:{r:2,c:headers.length-1}},{s:{r:3,c:0},e:{r:3,c:headers.length-1}}];
  XLSX.utils.book_append_sheet(wb, ws, "Log");
  const ket: (string|number)[][] = [
    ["PETUNJUK — LOG TRANSAKSI"],
    ["taLogNew — ORDER BY UserDateTime DESC"],
    ["Tanggal Export: " + new Date().toLocaleDateString("id-ID") + " " + new Date().toLocaleTimeString("id-ID")],
    [],
    ["No", "Kolom", "Keterangan"],
    ["1", "Pengguna", "User yang melakukan transaksi"],
    ["2", "Tanggal", "Tanggal aksi user saja (YYYY-MM-DD dari UserDateTime)"],
    ["3", "Jam", "Jam aksi user (dari UserDateTime)"],
    ["4", "Berat (Kg)", "Berat kg transaksi"],
    ["5", "Keterangan", "Catatan transaksi"],
    ["6", "No. Transaksi", "Nomor transaksi"],
    ["7", "Kode Barang", "Kode barang"],
    ["8", "Tgl Transaksi", "Tanggal transaksi saja (YYYY-MM-DD dari TransDateTime)"],
    ["9", "IP", "IP address user"],
  ];
  const wsKet = XLSX.utils.aoa_to_sheet(ket);
  wsKet["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 40 }];
  wsKet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, wsKet, "KETERANGAN");

  const buffer = XLSX.write(wb, { type:"buffer", bookType:"xlsx"}) as Buffer;
  return { buffer, fileName };
}

