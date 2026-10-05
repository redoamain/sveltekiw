// Export hasil rencana produksi ke Excel — struktur mengikuti project kiw (persis).
// Berjalan penuh di server (Astro SSR): master item diambil langsung dari DB,
// workbook dikembalikan sebagai Buffer untuk dikirim sebagai response download.
import type * as XLSXTypes from "xlsx";
import xlsxStyleModule from "xlsx-js-style";
import JSZipModule from "jszip";

const XLSX = ((xlsxStyleModule as any).default || xlsxStyleModule) as typeof XLSXTypes;
const JSZip = (JSZipModule as any).default || JSZipModule;
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
  mode?: "full" | "simple" | "no-tree" | "erp-china";
}

// ==================== TEMA WARNA PER DEPARTEMEN ====================
export interface DeptTheme {
  name: string;
  tabColor: string; // RGB Hex 6 digit (misal: "2563EB")
  bannerFill: string; // Hex untuk header/banner judul sheet
  bannerFont: string; // Warna font banner
  headerFill: string; // Hex untuk baris header kolom tabel
  headerFont: string; // Warna font header kolom
  folderFill: string; // Hex untuk baris Folder SPK (akar pohon)
  folderFont: string; // Warna font baris Folder SPK
  badgeFill: string; // Hex untuk badge sel Departemen
  badgeFont: string;
}

export function getDeptTheme(deptName?: string): DeptTheme {
  const d = (deptName || "").trim().toUpperCase();
  if (d.includes("INJ") || d === "IN" || d.includes("INJEKSI")) {
    // INJECTION: Royal Blue Theme
    return {
      name: "INJECTION",
      tabColor: "2563EB",
      bannerFill: "1D4ED8",
      bannerFont: "FFFFFF",
      headerFill: "1E40AF",
      headerFont: "FFFFFF",
      folderFill: "DBEAFE",
      folderFont: "1E3A8A",
      badgeFill: "2563EB",
      badgeFont: "FFFFFF",
    };
  }
  if (d.includes("SPRAY") || d === "SP") {
    // SPRAYING: Ocean Cyan / Teal Theme
    return {
      name: "SPRAYING",
      tabColor: "06B6D4",
      bannerFill: "0891B2",
      bannerFont: "FFFFFF",
      headerFill: "155E75",
      headerFont: "FFFFFF",
      folderFill: "CFFAFE",
      folderFont: "155E75",
      badgeFill: "0891B2",
      badgeFont: "FFFFFF",
    };
  }
  if (d.includes("MOULD") || d === "MO") {
    // MOULDING: Warm Amber / Orange Theme
    return {
      name: "MOULDING",
      tabColor: "F59E0B",
      bannerFill: "D97706",
      bannerFont: "FFFFFF",
      headerFill: "92400E",
      headerFont: "FFFFFF",
      folderFill: "FEF3C7",
      folderFont: "92400E",
      badgeFill: "D97706",
      badgeFont: "FFFFFF",
    };
  }
  if (d.includes("PLAT") || d === "PL") {
    // PLATTING: Vivid Purple Theme
    return {
      name: "PLATTING",
      tabColor: "8B5CF6",
      bannerFill: "7C3AED",
      bannerFont: "FFFFFF",
      headerFill: "581C87",
      headerFont: "FFFFFF",
      folderFill: "F3E8FF",
      folderFont: "581C87",
      badgeFill: "7C3AED",
      badgeFont: "FFFFFF",
    };
  }
  if (d.includes("ASS") || d === "AS") {
    // ASSEMBLY: Emerald Green Theme
    return {
      name: "ASSEMBLY",
      tabColor: "10B981",
      bannerFill: "059669",
      bannerFont: "FFFFFF",
      headerFill: "064E3B",
      headerFont: "FFFFFF",
      folderFill: "D1FAE5",
      folderFont: "064E3B",
      badgeFill: "059669",
      badgeFont: "FFFFFF",
    };
  }
  if (d.includes("GUDANG") || d === "GDG" || d === "WH") {
    // GUDANG: Slate Theme
    return {
      name: "GUDANG",
      tabColor: "64748B",
      bannerFill: "475569",
      bannerFont: "FFFFFF",
      headerFill: "334155",
      headerFont: "FFFFFF",
      folderFill: "F1F5F9",
      folderFont: "334155",
      badgeFill: "64748B",
      badgeFont: "FFFFFF",
    };
  }
  // Default / Lainnya: Slate Gray
  return {
    name: d || "LAINNYA",
    tabColor: "64748B",
    bannerFill: "475569",
    bannerFont: "FFFFFF",
    headerFill: "1E293B",
    headerFont: "FFFFFF",
    folderFill: "F1F5F9",
    folderFont: "0F172A",
    badgeFill: "475569",
    badgeFont: "FFFFFF",
  };
}

function setCellStyle(ws: any, cellAddr: string, style: any) {
  if (!ws[cellAddr]) {
    ws[cellAddr] = { t: "s", v: "" };
  }
  ws[cellAddr].s = { ...(ws[cellAddr].s || {}), ...style };
}

async function applyWorkbookTabColors(
  xlsxBuffer: Buffer,
  tabColorMap: Record<string, string>,
): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(xlsxBuffer);
    const wbXmlFile = zip.file("xl/workbook.xml");
    const relsXmlFile = zip.file("xl/_rels/workbook.xml.rels");
    if (!wbXmlFile || !relsXmlFile) return xlsxBuffer;

    const wbXml = await wbXmlFile.async("text");
    const relsXml = await relsXmlFile.async("text");

    const relMap: Record<string, string> = {};
    const relRegex = /<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"[^>]*\/>/g;
    let match: RegExpExecArray | null;
    while ((match = relRegex.exec(relsXml)) !== null) {
      relMap[match[1]] = match[2];
    }

    const sheetRegex = /<sheet[^>]*name="([^"]*)"[^>]*sheetId="([^"]*)"[^>]*r:id="([^"]*)"[^>]*\/>/g;
    while ((match = sheetRegex.exec(wbXml)) !== null) {
      const sName = match[1];
      const rId = match[3];
      const target = relMap[rId];
      const colorHex = tabColorMap[sName];
      if (colorHex && target) {
        const cleanTarget = target.replace(/^\//, "");
        const zipPath = cleanTarget.startsWith("worksheets/")
          ? `xl/${cleanTarget}`
          : cleanTarget.startsWith("xl/")
          ? cleanTarget
          : `xl/worksheets/${cleanTarget.split("/").pop()}`;

        const sheetFile = zip.file(zipPath);
        if (sheetFile) {
          let sXml = await sheetFile.async("text");
          const argb = colorHex.length === 6 ? `FF${colorHex}` : colorHex;
          if (sXml.includes("<sheetPr>")) {
            sXml = sXml.replace("<sheetPr>", `<sheetPr><tabColor rgb="${argb}"/>`);
          } else if (sXml.includes("<sheetPr ")) {
            sXml = sXml.replace(/<sheetPr([^>]*)>/, `<sheetPr$1><tabColor rgb="${argb}"/>`);
          } else {
            sXml = sXml.replace(
              /<worksheet([^>]*)>/,
              `<worksheet$1><sheetPr><tabColor rgb="${argb}"/></sheetPr>`,
            );
          }
          zip.file(zipPath, sXml);
        }
      }
    }

    return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  } catch (err) {
    console.error("Failed to inject sheet tab colors:", err);
    return xlsxBuffer;
  }
}

const sanitizeSheetName = (name: string): string => {
  let clean = name.replace(/[\\/*?:\[\]]/g, "");
  clean = clean.replace(/\|/g, "");
  if (clean.length > 31) clean = clean.substring(0, 31);
  if (clean.trim() === "") clean = "DEPARTEMEN";
  return clean;
};

const getUniqueSheetName = (wb: XLSXTypes.WorkBook, baseName: string): string => {
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
  warnac: string;
  bahan: string;
  departemen: string;
  totalNeeded: number;
  stockWincp: number;
  stockAkhir: number;
  qtyReserved: number;
  barangJadiSet: Map<string, { qty: number; nama: string; kode: string }>;
}

function extractChinaSpec(master?: { spec?: string; namecina?: string }): string {
  if (!master) return "";
  const namecina = master.namecina || "";
  if (namecina.includes("|")) {
    const afterBar = namecina.split("|").slice(1).join("|").trim();
    const specPart = afterBar.split("+")[0].trim();
    if (specPart) return specPart;
  }
  if (master.spec && master.spec !== "-" && !/^\d+[\*x]/i.test(master.spec.trim())) {
    return master.spec.trim();
  }
  return "";
}

export async function exportPlanToExcel(
  payload: ExportPlanPayload,
): Promise<{ buffer: Buffer; fileName: string }> {
  const { groups, bomByKodeBarang, stockRows, reservations, mode = "full" } = payload;
  const isSimple = mode === "simple";
  const isNoTree = mode === "no-tree";
  const isChina = mode === "erp-china";
  const today = new Date().toISOString().split("T")[0];

  if (groups.length === 0) {
    throw new Error("Tidak ada SPK yang dipilih untuk di-export!");
  }

  // ============ NAMA FILE ============
  const cleanName = (n: string, len: number) =>
    (n || "").replace(/[\\/*?:"<>|]/g, "").replace(/\s+/g, "_").substring(0, len);
  const suffixMode = isChina ? "_ERP_China" : isNoTree ? "_Tanpa_Tree" : isSimple ? "_Simpel" : "";
  let fileName: string;
  if (groups.length === 1) {
    const g = groups[0];
    fileName = `${cleanName(g.Nama_PO || g.No_SPK, 50)}${suffixMode}_${today}.xlsx`;
  } else {
    const first = groups[0];
    fileName = `${cleanName(first.Nama_PO || first.No_SPK, 40)}_dan_${groups.length - 1}_lainnya${suffixMode}_${today}.xlsx`;
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

  const allFinishedGoodsIds = groups.flatMap((g) =>
    g.lines.map((l) => normalizeItemId(l.Kode_Barang)),
  );
  const allTargetIds = Array.from(
    new Set([...allMaterialIds, ...allFinishedGoodsIds]),
  ).filter(Boolean);

  const masterDataMap = new Map<
    string,
    {
      name: string;
      namecina: string;
      spec: string;
      warna: string;
      warnac: string;
      bahan: string;
      mark: string;
      namaJenis: string;
    }
  >();
  if (allTargetIds.length > 0) {
    try {
      const items = await getMasterItems(allTargetIds);
      items.forEach((m) => {
        masterDataMap.set(normalizeItemId(String(m.ItemID)), {
          name: String(m.ItemName ?? ""),
          namecina: String(m.namecina ?? ""),
          spec: String(m.Spec ?? "-"),
          warna: String(m.warna ?? "-"),
          warnac: String(m.warnac ?? "-"),
          bahan: String(m.bahan ?? "-"),
          mark: String(m.Departemen ?? m.Mark ?? ""),
          namaJenis: String(m.NamaJenis ?? ""),
        });
      });
    } catch {
      // abaikan, default "-"
    }
  }
  const masterOf = (id: string) =>
    masterDataMap.get(id) ?? {
      name: "",
      namecina: "",
      spec: "-",
      warna: "-",
      warnac: "-",
      bahan: "-",
      mark: "",
      namaJenis: "",
    };

  const isKategoriInjeksiBB = (
    deptOrMark?: string,
    masterMark?: string,
    namaJenis?: string,
  ): boolean => {
    const check = (val?: string) => {
      if (!val) return false;
      const s = String(val).trim().toUpperCase();
      return (
        s.includes("INJEKSI-BB") ||
        s.includes("INJEKSI BB") ||
        s.includes("INJEKSI_BB") ||
        s === "INJEKSIBB" ||
        s === "INJ-BB"
      );
    };
    return check(deptOrMark) || check(masterMark) || check(namaJenis);
  };

  // ============ MODE ERP CHINA ============
  if (isChina) {
    const wbChina = XLSX.utils.book_new();
    const rows: (string | number | null)[][] = [
      ["PT. CITI PLUMB"],
      [],
      [],
      ["生产单"],
      [
        "No",
        "Doc",
        "Product No",
        "Product Name",
        "Spec",
        "Start",
        "End",
        null,
        "Plan",
        null,
        "Complete",
        "Remaining",
      ],
      [],
    ];

    let seq = 1;
    for (const group of groups) {
      for (const line of group.lines) {
        const normId = normalizeItemId(line.Kode_Barang);
        const master = masterOf(normId);
        const doc = (group.Nama_PO || group.No_SPK || "").trim();
        const productNo = line.Kode_Barang;
        const productName = master.name || line.Nama_Barang || line.Kode_Barang;
        const spec = extractChinaSpec(master);
        const start = line.Tanggal_Order || today;
        const end = line.Plan_Date || start;
        const planQty = Number(line.QTY) || 0;
        const completeQty = 0;
        const remainingQty = planQty;

        rows.push([
          String(seq++),
          doc,
          productNo,
          productName,
          spec,
          start,
          end,
          null,
          planQty,
          null,
          completeQty,
          remainingQty,
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 },  // A: No
      { wch: 25 }, // B: Doc
      { wch: 22 }, // C: Product No
      { wch: 50 }, // D: Product Name
      { wch: 25 }, // E: Spec
      { wch: 14 }, // F: Start
      { wch: 14 }, // G: End
      { wch: 5 },  // H: (blank)
      { wch: 12 }, // I: Plan
      { wch: 5 },  // J: (blank)
      { wch: 12 }, // K: Complete
      { wch: 12 }, // L: Remaining
    ];
    XLSX.utils.book_append_sheet(wbChina, ws, "Sheet1");

    return {
      buffer: XLSX.write(wbChina, { type: "buffer", bookType: "xlsx" }) as Buffer,
      fileName,
    };
  }

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
            warnac: master.warnac,
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
      "Warna China": agg.warnac && agg.warnac !== "-" ? agg.warnac : "",
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
  const tabColorMap: Record<string, string> = {};

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
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 18 }, { wch: 12 },
  ];
  tabColorMap["PO"] = "4338CA";
  for (let c = 0; c < 6; c++) {
    setCellStyle(wsPO, XLSX.utils.encode_cell({ r: 0, c }), {
      fill: { fgColor: { rgb: "3730A3" } },
      font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: { bottom: { style: "medium", color: { rgb: "1E1B4B" } } },
    });
  }
  for (let r = 1; r <= poData.length; r++) {
    for (let c = 0; c < 6; c++) {
      setCellStyle(wsPO, XLSX.utils.encode_cell({ r, c }), {
        font: { name: "Calibri", sz: 10, color: { rgb: "1F2937" } },
        alignment: {
          horizontal: c === 5 ? "right" : (c <= 2 ? "center" : "left"),
          vertical: "center",
        },
        border: { bottom: { style: "thin", color: { rgb: "F3F4F6" } } },
      });
    }
  }
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
  tabColorMap["BOM"] = "334155";
  for (let c = 0; c < 14; c++) {
    setCellStyle(wsBOM, XLSX.utils.encode_cell({ r: 0, c }), {
      fill: { fgColor: { rgb: "1E293B" } },
      font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: { bottom: { style: "medium", color: { rgb: "0F172A" } } },
    });
  }
  for (let r = 1; r <= bomData.length; r++) {
    const rowObj = bomData[r - 1];
    const isHeaderRow = rowObj && rowObj.Level === "HEADER";
    const isInfoRow = rowObj && rowObj["No SPK"] === "INFORMASI";
    for (let c = 0; c < 14; c++) {
      if (isHeaderRow) {
        setCellStyle(wsBOM, XLSX.utils.encode_cell({ r, c }), {
          fill: { fgColor: { rgb: "E2E8F0" } },
          font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "0F172A" } },
          border: { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } } },
        });
      } else if (isInfoRow) {
        setCellStyle(wsBOM, XLSX.utils.encode_cell({ r, c }), {
          font: { name: "Calibri", sz: 9, italic: true, color: { rgb: "64748B" } },
        });
      } else {
        const isStatusCol = c === 12;
        const statusVal = rowObj && rowObj.Status;
        if (isStatusCol && statusVal) {
          setCellStyle(wsBOM, XLSX.utils.encode_cell({ r, c }), {
            fill: { fgColor: { rgb: statusVal === "KURANG" ? "FEE2E2" : "D1FAE5" } },
            font: { name: "Calibri", sz: 10, bold: true, color: { rgb: statusVal === "KURANG" ? "991B1B" : "065F46" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: { bottom: { style: "thin", color: { rgb: "F3F4F6" } } },
          });
        } else {
          setCellStyle(wsBOM, XLSX.utils.encode_cell({ r, c }), {
            font: { name: "Calibri", sz: 10, color: { rgb: "1F2937" } },
            border: { bottom: { style: "thin", color: { rgb: "F3F4F6" } } },
          });
        }
      }
    }
  }
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
      row["Warna China"] ?? "",
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
      if (!existing[18] && rowArray[18]) {
        existing[18] = rowArray[18];
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

  const deptColWidthsFull = [
    { wch: 32 }, // Col 0: Kode Barang (Tree)
    { wch: 40 }, // Col 1: Nama Barang
    { wch: 25 }, // Col 2: Nama China
    { wch: 25 }, // Col 3: Spec
    { wch: 20 }, // Col 4: Bahan
    { wch: 18 }, // Col 5: Warna China
    { wch: 12 }, // Col 6: Tipe Item (SPK / HASIL / BAHAN)
    { wch: 12 }, // Col 7: Level BOM
    { wch: 15 }, // Col 8: Departemen
    { wch: 12 }, // Col 9: Qty / Unit
    { wch: 16 }, // Col 10: Total Kebutuhan
    { wch: 20 }, // Col 11: Qty Diambil PO Lain
    { wch: 18 }, // Col 12: Stok Wincp (Real)
    { wch: 15 }, // Col 13: Stok Akhir
    { wch: 20 }, // Col 14: Sisa Setelah Produksi
    { wch: 14 }, // Col 15: Status Stok
    { wch: 20 }, // Col 16: Kode Barang Induk
    { wch: 18 }, // Col 17: No SPK
    { wch: 35 }, // Col 18: Keterangan / Variant
  ];

  const deptColWidthsSimple = [
    { wch: 32 }, // Col 0: Kode Barang (Tree)
    { wch: 40 }, // Col 1: Nama Barang
    { wch: 25 }, // Col 2: Nama China
    { wch: 25 }, // Col 3: Spec
    { wch: 20 }, // Col 4: Bahan
    { wch: 18 }, // Col 5: Warna China
    { wch: 12 }, // Col 6: Qty / Unit
    { wch: 16 }, // Col 7: Total Kebutuhan
    { wch: 20 }, // Col 8: Qty Diambil PO Lain
    { wch: 18 }, // Col 9: Stok Gudang (Real)
    { wch: 20 }, // Col 10: Sisa Setelah Produksi
    { wch: 14 }, // Col 11: Status Stok
  ];

  const headersDeptTreeFull: Cell[] = [
    "Kode Barang",
    "Nama Barang",
    "Nama China",
    "Spec",
    "Bahan",
    "Warna China",
    "Tipe Item",
    "Level BOM",
    "Departemen",
    "Qty / Unit",
    "Total Kebutuhan",
    "Qty Diambil PO Lain",
    "Stok Wincp (Real)",
    "Stok Akhir",
    "Sisa Setelah Produksi",
    "Status Stok",
    "Kode Barang Induk",
    "No SPK",
    "Keterangan / Variant",
  ];

  const headersDeptTreeSimple: Cell[] = [
    "Kode Barang",
    "Nama Barang",
    "Nama China",
    "Spec",
    "Bahan",
    "Warna China",
    "Qty / Unit",
    "Total Kebutuhan",
    "Qty Diambil PO Lain",
    "Stok Gudang (Real)",
    "Sisa Setelah Produksi",
    "Status Stok",
  ];

  const deptColWidths = isSimple ? deptColWidthsSimple : deptColWidthsFull;
  const headersDeptTree = isSimple ? headersDeptTreeSimple : headersDeptTreeFull;

  // Helper struktur File Tree per Departemen
  interface FileTreeNode {
    curr: BomItem;
    parentKodeBarang: string;
    isLeaf: boolean;
    isFromOtherDept: boolean;
    children: FileTreeNode[];
  }

  const buildDeptFileTree = (
    node: BomItem,
    parentKodeBarang: string,
    targetDept: string,
  ): FileTreeNode => {
    const isTarget = (node.Departemen || "UNKNOWN").trim().toUpperCase() === targetDept;
    const resultChildren: FileTreeNode[] = [];

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const childDept = (child.Departemen || "UNKNOWN").trim().toUpperCase();
        if (childDept === targetDept) {
          resultChildren.push(buildDeptFileTree(child, node.ItemID, targetDept));
        } else {
          resultChildren.push({
            curr: child,
            parentKodeBarang: node.ItemID,
            isLeaf: true,
            isFromOtherDept: true,
            children: [],
          });
        }
      }
    }

    return {
      curr: node,
      parentKodeBarang,
      isLeaf: resultChildren.length === 0,
      isFromOtherDept: !isTarget,
      children: resultChildren,
    };
  };

  const findDeptEntryRoots = (
    nodes: BomItem[],
    parentKodeBarang: string,
    targetDept: string,
    out: FileTreeNode[],
  ) => {
    for (const node of nodes) {
      const nodeDept = (node.Departemen || "UNKNOWN").trim().toUpperCase();
      if (nodeDept === targetDept) {
        out.push(buildDeptFileTree(node, parentKodeBarang, targetDept));
      } else {
        if (node.children && node.children.length > 0) {
          findDeptEntryRoots(node.children, node.ItemID, targetDept, out);
        }
      }
    }
  };

  for (const dept of sortedDepartments) {
    if (isNoTree && isKategoriInjeksiBB(dept)) {
      continue;
    }

    const rawDeptMaterials = finalMaterialsByDept.get(dept) || [];
    const deptMaterials = isNoTree
      ? rawDeptMaterials.filter((r) => {
          const materialId = normalizeItemId(String(r[1]));
          const master = masterOf(materialId);
          const itemDept = String(r[7] || "");
          return !isKategoriInjeksiBB(itemDept, master.mark, master.namaJenis);
        })
      : rawDeptMaterials;

    if (isNoTree && deptMaterials.length === 0) {
      continue;
    }

    const totalNeeded = deptMaterials.reduce((sum, row) => sum + Number(row[8] || 0), 0);
    const totalSisa = deptMaterials.reduce((sum, row) => sum + Number(row[13] || 0), 0);

    const normTargetDept = (dept || "").trim().toUpperCase();
    const theme = getDeptTheme(dept);

    if (isNoTree) {
      const headersDeptNoTree: Cell[] = [
        "No",
        "Kode Barang",
        "Nama Barang",
        "Nama China",
        "Spec",
        "Bahan",
        "Warna China",
        "Departemen",
        "Total Kebutuhan",
        "Qty Diambil PO Lain",
        "Stok Gudang (Real)",
        "Sisa Setelah Produksi",
        "Status Stok",
        "Untuk SPK / Barang Jadi",
        "Keterangan / Variant",
      ];

      const deptColWidthsNoTree = [
        { wch: 6 },  // 0: No
        { wch: 22 }, // 1: Kode Barang
        { wch: 38 }, // 2: Nama Barang
        { wch: 25 }, // 3: Nama China
        { wch: 22 }, // 4: Spec
        { wch: 18 }, // 5: Bahan
        { wch: 18 }, // 6: Warna China
        { wch: 15 }, // 7: Departemen
        { wch: 16 }, // 8: Total Kebutuhan
        { wch: 20 }, // 9: Qty Diambil PO Lain
        { wch: 18 }, // 10: Stok Gudang (Real)
        { wch: 20 }, // 11: Sisa Setelah Produksi
        { wch: 14 }, // 12: Status Stok
        { wch: 32 }, // 13: Untuk SPK / Barang Jadi
        { wch: 28 }, // 14: Keterangan / Variant
      ];

      const numCols = headersDeptNoTree.length;
      const deptNoTreeRows: Cell[][] = [];

      for (let i = 0; i < deptMaterials.length; i++) {
        const r = deptMaterials[i];
        const variant = String(r[16] || "").trim();
        const infoLevel = String(r[17] || "").trim();
        let ket = variant !== "-" ? variant : "";
        if (infoLevel) {
          ket = ket ? `${ket} | ${infoLevel}` : infoLevel;
        }
        if (!ket) ket = "-";

        deptNoTreeRows.push([
          i + 1,
          r[1],
          r[2],
          r[3] !== "-" ? r[3] : "",
          r[4] !== "-" ? r[4] : "",
          r[6] !== "-" ? r[6] : "",
          r[18] && r[18] !== "-" ? r[18] : "",
          r[7] || normTargetDept,
          Number(r[8]) || 0,
          Number(r[9]) || 0,
          Number(r[11]) || 0,
          Number(r[13]) || 0,
          r[15] || "-",
          r[0] || "-",
          ket,
        ]);
      }

      if (deptNoTreeRows.length === 0) {
        deptNoTreeRows.push([
          "-",
          "Tidak ada material untuk departemen ini",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
      }

      // Summary row at the bottom
      const summaryText = `TOTAL KEBUTUHAN MATERIAL DEPARTEMEN ${(dept as string).toUpperCase()}: ${totalNeeded.toLocaleString()} UNIT | SISA STOK REAL: ${totalSisa.toLocaleString()} UNIT`;
      const summaryRow: Cell[] = [summaryText];
      for (let c = 1; c < numCols; c++) {
        summaryRow.push("");
      }
      deptNoTreeRows.push(summaryRow);

      const wsData: Cell[][] = [
        [`LAPORAN RENCANA PRODUKSI (DAFTAR MATERIAL) - DEPARTEMEN ${(dept as string).toUpperCase()}`],
        [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
        [`Tanggal Stok: ${today}`],
        [`Catatan: Format daftar material langsung tanpa pohon hierarki (Flat Material List).`],
        [],
        headersDeptNoTree,
        ...deptNoTreeRows,
      ];

      const summaryRowIdx = 6 + deptNoTreeRows.length - 1;
      const merges: XLSXTypes.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: numCols - 1 } },
        { s: { r: summaryRowIdx, c: 0 }, e: { r: summaryRowIdx, c: numCols - 1 } },
      ];

      const wsDept = XLSX.utils.aoa_to_sheet(wsData);
      wsDept["!cols"] = deptColWidthsNoTree;
      wsDept["!merges"] = merges;

      // Row 0: Banner Judul
      for (let c = 0; c < numCols; c++) {
        setCellStyle(wsDept, XLSX.utils.encode_cell({ r: 0, c }), {
          fill: { fgColor: { rgb: theme.bannerFill } },
          font: { name: "Calibri", sz: 12, bold: true, color: { rgb: theme.bannerFont } },
          alignment: { vertical: "center", indent: 1 },
        });
      }

      // Row 1..3: Meta Info
      for (let r = 1; r <= 3; r++) {
        for (let c = 0; c < numCols; c++) {
          setCellStyle(wsDept, XLSX.utils.encode_cell({ r, c }), {
            font: { name: "Calibri", sz: 9, italic: true, color: { rgb: "4B5563" } },
            alignment: { vertical: "center" },
          });
        }
      }

      // Row 5: Table Header
      for (let c = 0; c < numCols; c++) {
        setCellStyle(wsDept, XLSX.utils.encode_cell({ r: 5, c }), {
          fill: { fgColor: { rgb: theme.headerFill } },
          font: { name: "Calibri", sz: 10, bold: true, color: { rgb: theme.headerFont } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "374151" } },
            bottom: { style: "medium", color: { rgb: "111827" } },
            left: { style: "thin", color: { rgb: "374151" } },
            right: { style: "thin", color: { rgb: "374151" } },
          },
        });
      }

      // Data rows styling
      for (let i = 0; i < deptNoTreeRows.length; i++) {
        const r = 6 + i;
        if (r === summaryRowIdx) {
          // Summary row
          for (let c = 0; c < numCols; c++) {
            setCellStyle(wsDept, XLSX.utils.encode_cell({ r, c }), {
              fill: { fgColor: { rgb: theme.folderFill } },
              font: { name: "Calibri", sz: 11, bold: true, color: { rgb: theme.headerFill } },
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "medium", color: { rgb: theme.tabColor } },
                bottom: { style: "double", color: { rgb: theme.tabColor } },
              },
            });
          }
          continue;
        }

        const row = deptNoTreeRows[i];
        for (let c = 0; c < numCols; c++) {
          const val = row[c];
          const isNumeric = c === 8 || c === 9 || c === 10 || c === 11;
          const isCenter = c === 0 || c === 5 || c === 6 || c === 7 || c === 12;

          const cellStyle: any = {
            font: { name: "Calibri", sz: 10, color: { rgb: "1F2937" } },
            alignment: {
              horizontal: isNumeric ? "right" : isCenter ? "center" : "left",
              vertical: "center",
              wrapText: c === 13,
            },
            border: {
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
              right: { style: "thin", color: { rgb: "F3F4F6" } },
            },
          };

          // Col 1: Kode Barang (Bold)
          if (c === 1) {
            cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "111827" } };
          }

          // Col 7: Departemen (Badge with department colors)
          if (c === 7 && val && val !== "-") {
            const dTh = getDeptTheme(String(val));
            cellStyle.fill = { fgColor: { rgb: dTh.folderFill } };
            cellStyle.font = { name: "Calibri", sz: 9, bold: true, color: { rgb: dTh.headerFill } };
          }

          // Col 8: Total Kebutuhan (Bold)
          if (c === 8) {
            cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "111827" } };
          }

          // Col 9: Qty Diambil PO Lain (Highlight amber if > 0)
          if (c === 9 && Number(val) > 0) {
            cellStyle.fill = { fgColor: { rgb: "FEF3C7" } };
            cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "92400E" } };
          }

          // Col 11: Sisa Setelah Produksi
          if (c === 11 && val !== "" && val != null) {
            const num = Number(val);
            if (num < 0) {
              cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "DC2626" } };
            } else if (num > 0) {
              cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "047857" } };
            }
          }

          // Col 12: Status Stok
          if (c === 12 && val) {
            const sStr = String(val).trim().toUpperCase();
            if (sStr === "AMAN" || sStr === "CUKUP" || sStr === "KELEBIHAN") {
              cellStyle.fill = { fgColor: { rgb: "D1FAE5" } };
              cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "065F46" } };
            } else if (sStr === "KURANG") {
              cellStyle.fill = { fgColor: { rgb: "FEE2E2" } };
              cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "991B1B" } };
            } else if (sStr === "HABIS") {
              cellStyle.fill = { fgColor: { rgb: "FEE2E2" } };
              cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "7F1D1D" } };
            }
          }

          // Col 13: Untuk SPK / Barang Jadi
          if (c === 13) {
            cellStyle.font = { name: "Calibri", sz: 9, color: { rgb: "4B5563" } };
          }

          // Col 14: Keterangan
          if (c === 14) {
            cellStyle.font = { name: "Calibri", sz: 9, color: { rgb: "6B7280" } };
          }

          setCellStyle(wsDept, XLSX.utils.encode_cell({ r, c }), cellStyle);
        }
      }

      const sheetName = getUniqueSheetName(wb, dept.toUpperCase());
      tabColorMap[sheetName] = theme.tabColor;
      XLSX.utils.book_append_sheet(wb, wsDept, sheetName);
      continue;
    }

    // Map total kebutuhan se-departemen untuk tiap kode material
    const deptTotalMap = new Map<string, number>();
    const deptMap = materialsByDept.get(dept);
    if (deptMap) {
      for (const [code, r] of deptMap) {
        deptTotalMap.set(code, Number(r[8]) || 0);
      }
    }

    const deptTreeRows: Cell[][] = [];
    const outRowMeta: { level: number }[] = [
      { level: 0 }, // Row 0: Title
      { level: 0 }, // Row 1: Tanggal Export
      { level: 0 }, // Row 2: Tanggal Stok
      { level: 0 }, // Row 3: Petunjuk Outline
      { level: 0 }, // Row 4: Empty row
      { level: 0 }, // Row 5: Table Header
    ];

    const merges: XLSXTypes.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headersDeptTree.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headersDeptTree.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headersDeptTree.length - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: headersDeptTree.length - 1 } },
    ];

    for (const group of groups) {
      for (const barangJadi of linesOf(group)) {
        const bomFlat = bomByKodeBarang.get(barangJadi.Kode_Barang) ?? [];
        if (bomFlat.length === 0) continue;

        const filteredBom = bomFlat.filter(
          (b) => Number(b.Level) > 0 && !isINJECTIONDepartment(b.Departemen),
        );
        if (filteredBom.length === 0) continue;

        const accumulatedMap = calculateAccumulatedQty(filteredBom);
        const treeStructure = buildTreeWithDuplicates(filteredBom);

        const deptRoots: FileTreeNode[] = [];
        findDeptEntryRoots(treeStructure, barangJadi.Kode_Barang, normTargetDept, deptRoots);

        if (deptRoots.length === 0) continue;

        // Baris Header Folder SPK (Root level) menggunakan Kode Barang
        const spkTitle = `📁 ${barangJadi.Kode_Barang}`;
        const masterBJ = masterOf(normalizeItemId(barangJadi.Kode_Barang));
        if (isSimple) {
          deptTreeRows.push([
            spkTitle,                                                    // Col 0: Kode Barang (Tree)
            barangJadi.Nama_PO || barangJadi.Kode_Barang,                // Col 1: Nama Barang
            masterBJ.namecina || "",                                     // Col 2: Nama China
            masterBJ.spec !== "-" ? masterBJ.spec : "",                  // Col 3: Spec
            masterBJ.bahan !== "-" ? masterBJ.bahan : "",                // Col 4: Bahan
            masterBJ.warnac !== "-" ? masterBJ.warnac : "",              // Col 5: Warna China
            1,                                                           // Col 6: Qty / Unit
            barangJadi.QTY,                                              // Col 7: Total Kebutuhan
            "",                                                          // Col 8: Qty Diambil PO Lain
            "",                                                          // Col 9: Stok Gudang (Real)
            "",                                                          // Col 10: Sisa Setelah Produksi
            "-",                                                         // Col 11: Status Stok
          ]);
        } else {
          deptTreeRows.push([
            spkTitle,                                                    // Col 0: Kode Barang (Tree)
            barangJadi.Nama_PO || barangJadi.Kode_Barang,                // Col 1: Nama Barang
            masterBJ.namecina || "",                                     // Col 2: Nama China
            masterBJ.spec !== "-" ? masterBJ.spec : "",                  // Col 3: Spec
            masterBJ.bahan !== "-" ? masterBJ.bahan : "",                // Col 4: Bahan
            masterBJ.warnac !== "-" ? masterBJ.warnac : "",              // Col 5: Warna China
            "SPK",                                                       // Col 6: Tipe Item
            "Level 0",                                                   // Col 7: Level BOM
            normTargetDept,                                              // Col 8: Departemen
            1,                                                           // Col 9: Qty / Unit
            barangJadi.QTY,                                              // Col 10: Total Kebutuhan
            "",                                                          // Col 11: Qty Diambil PO Lain
            "",                                                          // Col 12: Stok Wincp (Real)
            "",                                                          // Col 13: Stok Akhir
            "",                                                          // Col 14: Sisa Setelah Produksi
            "-",                                                         // Col 15: Status Stok
            "-",                                                         // Col 16: Kode Barang Induk
            group.No_SPK,                                                // Col 17: No SPK
            `Target Order SPK: ${barangJadi.QTY.toLocaleString()} Unit`, // Col 18: Keterangan
          ]);
        }
        outRowMeta.push({ level: 0 });

        const displayedItems = new Map<string, number>();

        const renderFileTreeNode = (
          node: FileTreeNode,
          ancestorPrefix: string,
          isLast: boolean,
          outlineLevel: number,
        ) => {
          const curr = node.curr;
          const currId = normalizeItemId(curr.ItemID);
          const currLevel = Number(curr.Level);
          const stockRow = stockRows.get(currId);
          const accumulatedKey = `${currId}_L${currLevel}`;
          const accumulatedQty = accumulatedMap.get(accumulatedKey) || curr.Qty;
          const neededThisLine = accumulatedQty * barangJadi.QTY;
          const totalSeDept = deptTotalMap.get(currId) ?? neededThisLine;
          const stockWincp = stockRow?.SaldoAkhirFisik || 0;
          const stockAkhir = stockRow?.SaldoAkhir || 0;
          const reservedData = reservationsByItem.get(currId);
          const qtyReserved = reservedData?.totalQty || 0;
          const sisaStok = stockWincp - totalSeDept - qtyReserved;

          const prevLevel = displayedItems.get(currId);
          const isDuplicate = prevLevel !== undefined && prevLevel !== currLevel;
          displayedItems.set(currId, currLevel);

          const hasChildren = node.children.length > 0;
          let tipeItem = "BAHAN";
          if (hasChildren && !node.isFromOtherDept) {
            tipeItem = "HASIL";
          }

          const statusStock = sisaStok >= 0 ? "AMAN" : stockWincp > 0 ? "KURANG" : "HABIS";

          const branchChar = isDuplicate ? "↳ " : isLast ? "└── " : "├── ";
          let icon = "";
          if (tipeItem === "HASIL") {
            icon = "📦 ";
          } else if (node.isFromOtherDept) {
            icon = `📄 [${curr.Departemen || "GUDANG"}] `;
          } else {
            icon = "📄 ";
          }

          // File tree murni berbasis KODE BARANG
          const treeCol = `${ancestorPrefix}${branchChar}${icon}${curr.ItemID}`;

          let calcNote = "";
          if (currLevel === 1) {
            calcNote = `${curr.Qty} × ${barangJadi.QTY} = ${neededThisLine.toLocaleString()}`;
          } else {
            const parentAcc = curr.Qty > 0 ? accumulatedQty / curr.Qty : 1;
            calcNote = `${curr.Qty} × ${parentAcc} × ${barangJadi.QTY} = ${neededThisLine.toLocaleString()}`;
          }

          const variantInfo = getVariantInfo(currId);
          const reservedDetails = reservedData && reservedData.spkList.size > 0
            ? Array.from(reservedData.spkList).map(s => `${s.namaPO} (${s.qtyReserved.toLocaleString()})`).join(", ")
            : "";
          const reservedNote = reservedDetails ? `Reserved PO Lain: ${reservedDetails}` : "";
          const fullNotes = [variantInfo, calcNote, reservedNote].filter(Boolean).join(" | ");

          const masterItem = masterOf(currId);

          if (isSimple) {
            deptTreeRows.push([
              treeCol,                                                   // Col 0: Kode Barang (Tree)
              curr.ItemName || curr.ItemID,                              // Col 1: Nama Barang
              masterItem.namecina || curr.ItemName2 || "",               // Col 2: Nama China
              masterItem.spec !== "-" ? masterItem.spec : "",            // Col 3: Spec
              masterItem.bahan !== "-" ? masterItem.bahan : "",          // Col 4: Bahan
              masterItem.warnac !== "-" ? masterItem.warnac : "",        // Col 5: Warna China
              curr.Qty,                                                  // Col 6: Qty / Unit
              totalSeDept,                                               // Col 7: Total Kebutuhan
              qtyReserved > 0 ? qtyReserved : 0,                         // Col 8: Qty Diambil PO Lain
              stockWincp,                                                // Col 9: Stok Gudang (Real)
              sisaStok,                                                  // Col 10: Sisa Setelah Produksi
              statusStock,                                               // Col 11: Status Stok
            ]);
          } else {
            deptTreeRows.push([
              treeCol,                                                   // Col 0: Kode Barang (Tree)
              curr.ItemName || curr.ItemID,                              // Col 1: Nama Barang
              masterItem.namecina || curr.ItemName2 || "",               // Col 2: Nama China
              masterItem.spec !== "-" ? masterItem.spec : "",            // Col 3: Spec
              masterItem.bahan !== "-" ? masterItem.bahan : "",          // Col 4: Bahan
              masterItem.warnac !== "-" ? masterItem.warnac : "",        // Col 5: Warna China
              tipeItem,                                                  // Col 6: Tipe Item
              `Level ${curr.Level}`,                                     // Col 7: Level BOM
              curr.Departemen || "-",                                    // Col 8: Departemen
              curr.Qty,                                                  // Col 9: Qty / Unit
              totalSeDept,                                               // Col 10: Total Kebutuhan
              qtyReserved > 0 ? qtyReserved : 0,                         // Col 11: Qty Diambil PO Lain
              stockWincp,                                                // Col 12: Stok Wincp (Real)
              stockAkhir,                                                // Col 13: Stok Akhir
              sisaStok,                                                  // Col 14: Sisa Setelah Produksi
              statusStock,                                               // Col 15: Status Stok
              node.parentKodeBarang,                                     // Col 16: Kode Barang Induk
              group.No_SPK,                                              // Col 17: No SPK
              fullNotes,                                                 // Col 18: Keterangan
            ]);
          }

          outRowMeta.push({ level: Math.min(outlineLevel, 7) });

          const nextPrefix = ancestorPrefix + (isLast ? "    " : "│   ");
          for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            const isLastChild = i === node.children.length - 1;
            renderFileTreeNode(child, nextPrefix, isLastChild, outlineLevel + 1);
          }
        };

        for (let i = 0; i < deptRoots.length; i++) {
          const isLastRoot = i === deptRoots.length - 1;
          renderFileTreeNode(deptRoots[i], "", isLastRoot, 1);
        }

        deptTreeRows.push([]);
        outRowMeta.push({ level: 0 });
      }
    }

    if (deptTreeRows.length === 0) {
      deptTreeRows.push([
        "Tidak ada item yang diproses atau dikonsumsi di departemen ini untuk SPK terpilih.",
      ]);
      outRowMeta.push({ level: 0 });
    } else {
      const summaryRowIndex = 6 + deptTreeRows.length;
      deptTreeRows.push([
        `TOTAL KEBUTUHAN MATERIAL DEPARTEMEN ${normTargetDept}: ${totalNeeded.toLocaleString()} UNIT | SISA STOK REAL: ${totalSisa.toLocaleString()} UNIT`,
      ]);
      outRowMeta.push({ level: 0 });
      merges.push({ s: { r: summaryRowIndex, c: 0 }, e: { r: summaryRowIndex, c: headersDeptTree.length - 1 } });

      deptTreeRows.push([]);
      outRowMeta.push({ level: 0 });

      const legendHeaderIndex = 6 + deptTreeRows.length;
      deptTreeRows.push(["LEGENDA SIMBOL FILE TREE & PETUNJUK:"]);
      outRowMeta.push({ level: 0 });
      merges.push({ s: { r: legendHeaderIndex, c: 0 }, e: { r: legendHeaderIndex, c: headersDeptTree.length - 1 } });

      const legends = [
        "📁 [Kode Barang] = Target Order SPK / Barang Jadi (Root Level)",
        "📦 HASIL = Sub-rakitan / komponen utama yang dihasilkan di departemen ini",
        "📄 BAHAN = Komponen / bahan konsumsi yang langsung dipasang ke induknya",
        "📄 [DEPT] = Komponen masuk yang dipasok dari departemen lain (misal: [SPRAY], [MOULDING], [GUDANG])",
        "↳ = Item duplikat yang muncul di level rakitan berbeda",
        "Pohon File Tree = Ditampilkan murni menggunakan Kode Barang agar ringkas; nama lengkap tersedia di kolom 'Nama Barang'",
        "Tombol [1] [2] [3] = Gunakan panel outline di margin kiri Excel untuk membuka/menutup folder",
      ];
      for (const leg of legends) {
        const rIdx = 6 + deptTreeRows.length;
        deptTreeRows.push([leg]);
        outRowMeta.push({ level: 0 });
        merges.push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: headersDeptTree.length - 1 } });
      }
    }

    const wsData: Cell[][] = [
      [`LAPORAN RENCANA PRODUKSI (FILE TREE ${isSimple ? "SIMPEL" : "DETAIL"}) - DEPARTEMEN ${(dept as string).toUpperCase()}`],
      [`Tanggal Export: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`],
      [`Tanggal Stok: ${today}`],
      [`Petunjuk: Gunakan tombol outline [1] [2] [3] di sebelah kiri Excel untuk expand / collapse pohon rakitan.`],
      [],
      headersDeptTree,
      ...deptTreeRows,
    ];

    const wsDept = XLSX.utils.aoa_to_sheet(wsData);
    wsDept["!cols"] = deptColWidths;
    wsDept["!merges"] = merges;
    wsDept["!rows"] = outRowMeta;

    const numCols = headersDeptTree.length;

    // Row 0: Banner Judul (Merged A1..<col>1)
    for (let c = 0; c < numCols; c++) {
      setCellStyle(wsDept, XLSX.utils.encode_cell({ r: 0, c }), {
        fill: { fgColor: { rgb: theme.bannerFill } },
        font: { name: "Calibri", sz: 12, bold: true, color: { rgb: theme.bannerFont } },
        alignment: { vertical: "center", indent: 1 },
      });
    }

    // Row 1..3: Meta Info (Export info)
    for (let r = 1; r <= 3; r++) {
      for (let c = 0; c < numCols; c++) {
        setCellStyle(wsDept, XLSX.utils.encode_cell({ r, c }), {
          font: { name: "Calibri", sz: 9, italic: true, color: { rgb: "4B5563" } },
          alignment: { vertical: "center" },
        });
      }
    }

    // Row 5: Table Header
    for (let c = 0; c < numCols; c++) {
      setCellStyle(wsDept, XLSX.utils.encode_cell({ r: 5, c }), {
        fill: { fgColor: { rgb: theme.headerFill } },
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: theme.headerFont } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "374151" } },
          bottom: { style: "medium", color: { rgb: "111827" } },
          left: { style: "thin", color: { rgb: "374151" } },
          right: { style: "thin", color: { rgb: "374151" } },
        },
      });
    }

    // Row 6+: Data Rows
    const statusColIdx = isSimple ? 11 : 15;
    const qtyReservedColIdx = isSimple ? 8 : 11;
    const sisaColIdx = isSimple ? 10 : 14;
    const deptColIdx = isSimple ? -1 : 8;

    for (let i = 0; i < deptTreeRows.length; i++) {
      const r = 6 + i;
      const row = deptTreeRows[i];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || "").trim();
      const isFolderSPK = firstCell.startsWith("📁");
      const isSummaryRow = firstCell.startsWith("TOTAL KEBUTUHAN MATERIAL DEPARTEMEN");
      const isLegend =
        firstCell.startsWith("LEGENDA") ||
        firstCell.startsWith("📁 [") ||
        firstCell.startsWith("📦") ||
        firstCell.startsWith("📄") ||
        firstCell.startsWith("↳") ||
        firstCell.startsWith("Pohon") ||
        firstCell.startsWith("Tombol") ||
        firstCell.startsWith("Tidak ada item");

      if (isFolderSPK) {
        for (let c = 0; c < numCols; c++) {
          setCellStyle(wsDept, XLSX.utils.encode_cell({ r, c }), {
            fill: { fgColor: { rgb: theme.folderFill } },
            font: { name: "Calibri", sz: 10, bold: true, color: { rgb: theme.folderFont } },
            border: {
              top: { style: "thin", color: { rgb: theme.tabColor } },
              bottom: { style: "thin", color: { rgb: theme.tabColor } },
            },
            alignment: {
              horizontal: c === 0 || c === 1 ? "left" : "center",
              vertical: "center",
            },
          });
        }
      } else if (isSummaryRow) {
        for (let c = 0; c < numCols; c++) {
          setCellStyle(wsDept, XLSX.utils.encode_cell({ r, c }), {
            fill: { fgColor: { rgb: theme.folderFill } },
            font: { name: "Calibri", sz: 11, bold: true, color: { rgb: theme.headerFill } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "medium", color: { rgb: theme.tabColor } },
              bottom: { style: "double", color: { rgb: theme.tabColor } },
            },
          });
        }
      } else if (isLegend) {
        for (let c = 0; c < numCols; c++) {
          setCellStyle(wsDept, XLSX.utils.encode_cell({ r, c }), {
            fill: { fgColor: { rgb: "F8FAFC" } },
            font: { name: "Calibri", sz: 9, italic: true, color: { rgb: "475569" } },
            alignment: { vertical: "center" },
          });
        }
      } else {
        // Regular material row
        for (let c = 0; c < numCols; c++) {
          const val = row[c];
          const isNumeric = isSimple ? (c >= 6 && c <= 10) : (c >= 9 && c <= 14);
          const isCenter = isSimple
            ? (c === 5 || c === 11)
            : (c === 5 || c === 6 || c === 7 || c === 8 || c === 15 || c === 17);

          const cellStyle: any = {
            font: { name: "Calibri", sz: 10, color: { rgb: "1F2937" } },
            alignment: {
              horizontal: isNumeric ? "right" : isCenter ? "center" : "left",
              vertical: "center",
            },
            border: {
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
              right: { style: "thin", color: { rgb: "F3F4F6" } },
            },
          };

          // Badge warna per departemen di kolom Tree (Kolom 0: Kode Barang)
          // Contoh: │   ├── 📄 [INJEKSI] LC-02B001 -> diberi warna sesuai departemen INJEKSI
          if (c === 0 && val) {
            const valStr = String(val);
            const otherDeptMatch = valStr.match(/📄\s*\[(.*?)\]/);
            if (otherDeptMatch) {
              const otherDeptName = otherDeptMatch[1];
              const otherDeptTheme = getDeptTheme(otherDeptName);
              cellStyle.fill = { fgColor: { rgb: otherDeptTheme.folderFill } };
              cellStyle.font = {
                name: "Calibri",
                sz: 10,
                bold: true,
                color: { rgb: otherDeptTheme.headerFill },
              };
              cellStyle.border = {
                top: { style: "thin", color: { rgb: otherDeptTheme.tabColor } },
                bottom: { style: "thin", color: { rgb: otherDeptTheme.tabColor } },
                left: { style: "thin", color: { rgb: otherDeptTheme.tabColor } },
                right: { style: "thin", color: { rgb: otherDeptTheme.tabColor } },
              };
            } else if (valStr.includes("📦")) {
              // Sub-rakitan utama (HASIL) di departemen ini
              cellStyle.font = {
                name: "Calibri",
                sz: 10,
                bold: true,
                color: { rgb: theme.headerFill },
              };
            }
          }

          // Badge Departemen di mode Full jika dari departemen lain
          if (c === deptColIdx && val && val !== "-") {
            const dTh = getDeptTheme(String(val));
            cellStyle.fill = { fgColor: { rgb: dTh.folderFill } };
            cellStyle.font = { name: "Calibri", sz: 9, bold: true, color: { rgb: dTh.headerFill } };
          }

          // Highlight Qty Diambil PO Lain jika ada
          if (c === qtyReservedColIdx && Number(val) > 0) {
            cellStyle.fill = { fgColor: { rgb: "FEF3C7" } };
            cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "92400E" } };
          }

          // Format Sisa Stok
          if (c === sisaColIdx && val !== "" && val != null) {
            const num = Number(val);
            if (num < 0) {
              cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "DC2626" } };
            } else if (num > 0) {
              cellStyle.font = { name: "Calibri", sz: 10, color: { rgb: "047857" } };
            }
          }

          // Highlight Status Stok
          if (c === statusColIdx && val) {
            const sStr = String(val).trim().toUpperCase();
            if (sStr === "AMAN") {
              cellStyle.fill = { fgColor: { rgb: "D1FAE5" } };
              cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "065F46" } };
            } else if (sStr === "KURANG") {
              cellStyle.fill = { fgColor: { rgb: "FEE2E2" } };
              cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "991B1B" } };
            } else if (sStr === "HABIS") {
              cellStyle.fill = { fgColor: { rgb: "FEE2E2" } };
              cellStyle.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "7F1D1D" } };
            }
          }

          setCellStyle(wsDept, XLSX.utils.encode_cell({ r, c }), cellStyle);
        }
      }
    }

    const sheetName = getUniqueSheetName(wb, dept.toUpperCase());
    tabColorMap[sheetName] = theme.tabColor;
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
  const displayedDepartments: string[] = [];
  for (const dept of sortedDepartments) {
    if (isNoTree && isKategoriInjeksiBB(dept)) {
      continue;
    }
    const rawDeptMaterials = finalMaterialsByDept.get(dept) || [];
    const deptMaterials = isNoTree
      ? rawDeptMaterials.filter((r) => {
          const materialId = normalizeItemId(String(r[1]));
          const master = masterOf(materialId);
          const itemDept = String(r[7] || "");
          return !isKategoriInjeksiBB(itemDept, master.mark, master.namaJenis);
        })
      : rawDeptMaterials;

    if (isNoTree && deptMaterials.length === 0) {
      continue;
    }

    displayedDepartments.push(dept);
    const totalNeeded = deptMaterials.reduce((sum, row) => sum + Number(row[8] || 0), 0);
    const totalSisa = deptMaterials.reduce((sum, row) => sum + Number(row[13] || 0), 0);
    const status = totalSisa > 0 ? "KELEBIHAN" : totalSisa < 0 ? "KEKURANGAN" : "CUKUP";
    allDeptSummary.push([dept, deptMaterials.length, totalNeeded.toLocaleString(), totalSisa.toLocaleString(), status]);
  }

  const activeMaterialsForSummary = isNoTree
    ? materialDataForDatabase.filter((row) => {
        const materialId = normalizeItemId(String(row["Kode Material"]));
        const master = masterOf(materialId);
        const itemDept = String(row["Departemen"] || "");
        return !isKategoriInjeksiBB(itemDept, master.mark, master.namaJenis);
      })
    : materialDataForDatabase;

  const totalAllMaterials = activeMaterialsForSummary.length;
  const totalAllNeeded = activeMaterialsForSummary.reduce(
    (sum, row) => sum + (Number(row["Total Kebutuhan"]) || 0), 0,
  );
  const totalAllSisa = activeMaterialsForSummary.reduce(
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

  tabColorMap["REKAP_PER_DEPARTEMEN"] = "0D9488";

  // Banner judul Row 0
  for (let c = 0; c < 5; c++) {
    setCellStyle(wsSummary, XLSX.utils.encode_cell({ r: 0, c }), {
      fill: { fgColor: { rgb: "0F766E" } },
      font: { name: "Calibri", sz: 12, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { vertical: "center", indent: 1 },
    });
  }
  // Meta info Row 1..2
  for (let r = 1; r <= 2; r++) {
    for (let c = 0; c < 5; c++) {
      setCellStyle(wsSummary, XLSX.utils.encode_cell({ r, c }), {
        font: { name: "Calibri", sz: 9, italic: true, color: { rgb: "4B5563" } },
        alignment: { vertical: "center" },
      });
    }
  }
  // Table header Row 4
  for (let c = 0; c < 5; c++) {
    setCellStyle(wsSummary, XLSX.utils.encode_cell({ r: 4, c }), {
      fill: { fgColor: { rgb: "115E59" } },
      font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "134E4A" } },
        bottom: { style: "medium", color: { rgb: "042F2E" } },
      },
    });
  }
  // Data rows
  for (let idx = 0; idx < displayedDepartments.length; idx++) {
    const r = 5 + idx;
    const deptName = displayedDepartments[idx];
    const dTheme = getDeptTheme(deptName);

    // Col 0: Departemen (Badge warna tema departemen!)
    setCellStyle(wsSummary, XLSX.utils.encode_cell({ r, c: 0 }), {
      fill: { fgColor: { rgb: dTheme.badgeFill } },
      font: { name: "Calibri", sz: 10, bold: true, color: { rgb: dTheme.badgeFont } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
      },
    });

    // Col 1..3: Jumlah Material, Total Kebutuhan, Total Sisa Stok
    for (let c = 1; c <= 3; c++) {
      setCellStyle(wsSummary, XLSX.utils.encode_cell({ r, c }), {
        font: { name: "Calibri", sz: 10, color: { rgb: "1F2937" } },
        alignment: { horizontal: "right", vertical: "center" },
        border: {
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "F3F4F6" } },
        },
      });
    }

    // Col 4: Status (KELEBIHAN / KEKURANGAN / CUKUP)
    const statusVal = String(allDeptSummary[r]?.[4] || "");
    const isKurang = statusVal === "KEKURANGAN";
    const isLebih = statusVal === "KELEBIHAN";
    setCellStyle(wsSummary, XLSX.utils.encode_cell({ r, c: 4 }), {
      fill: { fgColor: { rgb: isKurang ? "FEE2E2" : isLebih ? "D1FAE5" : "F3F4F6" } },
      font: {
        name: "Calibri",
        sz: 10,
        bold: true,
        color: { rgb: isKurang ? "991B1B" : isLebih ? "065F46" : "374151" },
      },
      alignment: { horizontal: "center", vertical: "center" },
      border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } },
    });
  }

  // Row Total Keseluruhan
  const totalRowIdx = 5 + displayedDepartments.length + 1;
  for (let c = 0; c < 5; c++) {
    setCellStyle(wsSummary, XLSX.utils.encode_cell({ r: totalRowIdx, c }), {
      fill: { fgColor: { rgb: "E2E8F0" } },
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "0F172A" } },
      alignment: { horizontal: c === 0 ? "left" : c === 4 ? "center" : "right", vertical: "center" },
      border: {
        top: { style: "medium", color: { rgb: "94A3B8" } },
        bottom: { style: "double", color: { rgb: "94A3B8" } },
      },
    });
  }

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
    ["B. STRUKTUR SHEET DEPARTEMEN" + (isNoTree ? " (DAFTAR MATERIAL)" : " (FILE TREE)")],
    ["No", "Fitur", "Keterangan"],
    ["1", isNoTree ? "Format Daftar Flat" : "Format File Tree", isNoTree ? "Daftar langsung semua material kebutuhan departemen (tanpa hierarki pohon)" : "Struktur tunggal terpadu berhierarki (Folder SPK 📁 -> Sub-rakitan 📦 -> Bahan 📄)"],
    ["2", "Outline Grouping", isNoTree ? "Tanpa outline grouping level pohon (semua baris material langsung terlihat)" : "Tombol [1] [2] [3] di sebelah kiri margin Excel untuk expand / collapse pohon rakitan"],
    ["3", "Kebutuhan Material", "Kolom 'Total Kebutuhan' adalah total jumlah material yang harus disiapkan untuk target SPK ini"],
    ["4", "Qty Diambil PO Lain", "Jumlah stok material yang telah dialokasikan / di-reservasi oleh SPK atau PO lain di luar yang sedang direncanakan"],
    ["5", "Sisa Setelah Produksi", "Dihitung dari: Stok Gudang (Real) - Total Kebutuhan - Qty Diambil PO Lain. Positif = AMAN, Negatif = KURANG"],
    ["6", "Asal Pasokan", "Bahan masuk dari departemen lain ditandai dengan label [DEPT] (misal: [SPRAY], [MOULDING], [GUDANG])"],
    ["7", "Mode Template", `Format saat ini: ${isChina ? "ERP CHINA (生产单)" : isNoTree ? "TANPA TREE (15 Kolom daftar material datar langsung)" : isSimple ? "SIMPEL (12 Kolom ringkas dengan Spec, Nama China, Bahan, Warna China, Qty Diambil PO Lain)" : "DETAIL (19 Kolom lengkap)"}`],
    ...(isNoTree ? [["8", "Filter Kategori", "Material dengan kategori INJEKSI-BB tidak ditampilkan pada format ini"]] : []),
    [""],
    ["C. PENJELASAN KHUSUS - MULTI LEVEL"],
    ["No", "Item", "Keterangan"],
    ["1", "Material Duplikat", "Material yang muncul di multiple level BOM (contoh: 06R123)"],
    ["2", "Perhitungan", "Semua level dihitung dan dijumlahkan (tidak ada yang di-skip)"],
    ["3", "Info Multi Level", "Kolom Info Multi Level menunjukkan breakdown per level"],
    [""],
    ["D. INFORMASI FILE"],
    ["No", "Informasi", "Nilai"],
    ["1", "Nama File", fileName],
    ["2", "Jumlah PO", groups.length],
    ["3", "Total Material", totalAllMaterials],
    ["4", "Tanggal Export", new Date().toLocaleDateString("id-ID")],
    ["5", "Waktu Export", new Date().toLocaleTimeString("id-ID")],
  ];
  const wsKeterangan = XLSX.utils.aoa_to_sheet(keteranganData);
  wsKeterangan["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 50 }];

  const mergesKet: XLSXTypes.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
  ];
  for (let r = 0; r < keteranganData.length; r++) {
    const fVal = String(keteranganData[r]?.[0] || "");
    if (fVal.startsWith("A.") || fVal.startsWith("B.") || fVal.startsWith("C.") || fVal.startsWith("D.")) {
      mergesKet.push({ s: { r, c: 0 }, e: { r, c: 2 } });
    }
  }
  wsKeterangan["!merges"] = mergesKet;

  tabColorMap["KETERANGAN"] = "6B7280";

  // Banner judul Row 0
  for (let c = 0; c < 3; c++) {
    setCellStyle(wsKeterangan, XLSX.utils.encode_cell({ r: 0, c }), {
      fill: { fgColor: { rgb: "374151" } },
      font: { name: "Calibri", sz: 12, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { vertical: "center", indent: 1 },
    });
  }
  // Section headers and tables
  for (let r = 1; r < keteranganData.length; r++) {
    const rData = keteranganData[r];
    if (!rData || rData.length === 0) continue;
    const fVal = String(rData[0] || "");
    const isSectionHeader = fVal.startsWith("A.") || fVal.startsWith("B.") || fVal.startsWith("C.") || fVal.startsWith("D.");
    const isTableHeader = fVal === "No" && rData[1] !== undefined;

    if (isSectionHeader) {
      for (let c = 0; c < 3; c++) {
        setCellStyle(wsKeterangan, XLSX.utils.encode_cell({ r, c }), {
          fill: { fgColor: { rgb: "F1F5F9" } },
          font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "1E293B" } },
          border: { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } } },
        });
      }
    } else if (isTableHeader) {
      for (let c = 0; c < 3; c++) {
        setCellStyle(wsKeterangan, XLSX.utils.encode_cell({ r, c }), {
          fill: { fgColor: { rgb: "4B5563" } },
          font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
          alignment: { horizontal: c === 0 ? "center" : "left", vertical: "center" },
        });
      }
    } else if (rData.length > 1) {
      for (let c = 0; c < 3; c++) {
        setCellStyle(wsKeterangan, XLSX.utils.encode_cell({ r, c }), {
          font: { name: "Calibri", sz: 10, color: { rgb: "334155" } },
          alignment: { horizontal: c === 0 ? "center" : "left", vertical: "center" },
          border: { bottom: { style: "thin", color: { rgb: "F1F5F9" } } },
        });
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsKeterangan, "KETERANGAN");

  const rawBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const buffer = await applyWorkbookTabColors(rawBuffer, tabColorMap);
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
    "Warna Indo",
    "Warna Mandarin",
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
      r.warnac,
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
    { wch: 16 }, // warna
    { wch: 18 }, // warnac
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
    ["Warna Indo", "taGoods.warna", "Warna Indonesia"],
    ["Warna Mandarin", "taGoods.warnac", "Warna Mandarin / Cina"],
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

