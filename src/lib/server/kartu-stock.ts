import sql from "mssql";
import { runQuery, runProcedure, log } from "@/lib/db";
import * as XLSX from "xlsx";

export interface KartuStockRow {
  rowNum: number;
  locName: string;
  itemId: string;
  itemName: string;
  moveDate: string;
  kegiatan: string;
  kegiatanLabel: string;
  kegiatanTone: "primary" | "success" | "warning" | "error" | "secondary";
  zakIn: number;
  zakOut: number;
  kgIn: number;
  kgOut: number;
  saldoZak: number;
  saldoKg: number;
  noDoc: string;
  noMemo: string;
  keterangan: string;
  satuan: string;
  locId: string;
}

export interface KartuStockSummary {
  saldoAwalZak: number;
  saldoAwalKg: number;
  totalMasukZak: number;
  totalMasukKg: number;
  totalKeluarZak: number;
  totalKeluarKg: number;
  saldoAkhirZak: number;
  saldoAkhirKg: number;
}

export interface KartuStockItemInfo {
  itemId: string;
  itemName: string;
  satuan: string;
  kodeJenis?: string;
  departemen?: string;
}

export interface WarehouseOption {
  locId: string;
  locName: string;
}

export function formatKegiatan(kegiatan: string): {
  label: string;
  tone: "primary" | "success" | "warning" | "error" | "secondary";
} {
  const k = (kegiatan || "").trim().toUpperCase();
  switch (k) {
    case "S":
      return { label: "SALDO AWAL", tone: "secondary" };
    case "B":
      return { label: "PEMBELIAN (MASUK)", tone: "success" };
    case "E":
      return { label: "PEMAKAIAN (KELUAR)", tone: "error" };
    case "FG":
      return { label: "HASIL PRODUKSI", tone: "primary" };
    case "J":
      return { label: "PENJUALAN / KIRIM", tone: "warning" };
    case "M":
    case "MUT":
    case "TRF":
      return { label: "MUTASI GUDANG", tone: "warning" };
    case "R":
    case "RET":
      return { label: "RETUR", tone: "error" };
    default:
      return { label: k || "MUTASI", tone: "secondary" };
  }
}

function formatDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val);
  if (s.length >= 10 && s.includes("-")) return s.slice(0, 10);
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s;
}

/**
 * Mengambil daftar gudang dari taLocation
 */
export async function getWarehouses(): Promise<WarehouseOption[]> {
  try {
    const res = await runQuery(
      `SELECT LocID, LocName FROM [cp].[dbo].[taLocation] ORDER BY LocID ASC`
    );
    return (res.recordset || []).map((r: any) => ({
      locId: String(r.LocID).trim(),
      locName: String(r.LocName || r.LocID).trim(),
    }));
  } catch (error) {
    log.error({ error }, "Gagal mengambil daftar gudang");
    return [];
  }
}

/**
 * Mencari barang dari master taGoods untuk selector kartu stock
 */
export async function searchGoods(query: string, limit = 25): Promise<KartuStockItemInfo[]> {
  const kw = (query ?? "").trim();
  try {
    const where = kw ? "WHERE a.ItemID LIKE @q OR a.ItemName LIKE @q" : "";
    const params: any[] = [{ name: "Lim", type: sql.Int, value: limit }];
    if (kw) {
      params.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${kw}%` });
    }

    const res = await runQuery(
      `SELECT TOP (@Lim) 
         a.ItemID, 
         a.ItemName, 
         ISNULL(a.SatuanKecil, 'Pcs') AS Satuan, 
         a.KodeJenis, 
         a.Mark AS Departemen
       FROM [cp].[dbo].[taGoods] a
       ${where}
       ORDER BY a.ItemID ASC`,
      params
    );

    return (res.recordset || []).map((r: any) => ({
      itemId: String(r.ItemID).trim(),
      itemName: String(r.ItemName ?? "").trim(),
      satuan: String(r.Satuan ?? "Pcs").trim(),
      kodeJenis: r.KodeJenis != null ? String(r.KodeJenis).trim() : undefined,
      departemen: r.Departemen != null ? String(r.Departemen).trim() : undefined,
    }));
  } catch (error) {
    log.error({ error, query }, "Gagal mencari barang untuk kartu stock");
    return [];
  }
}

/**
 * Mengambil informasi detail item dari taGoods
 */
export async function getItemInfo(itemId: string): Promise<KartuStockItemInfo | null> {
  const cleanId = itemId.trim();
  if (!cleanId) return null;

  try {
    const res = await runQuery(
      `SELECT TOP 1
         a.ItemID, 
         a.ItemName, 
         ISNULL(a.SatuanKecil, 'Pcs') AS Satuan, 
         a.KodeJenis, 
         a.Mark AS Departemen
       FROM [cp].[dbo].[taGoods] a
       WHERE RTRIM(LTRIM(a.ItemID)) = RTRIM(LTRIM(@itemId))`,
      [{ name: "itemId", type: sql.VarChar(50), value: cleanId }]
    );

    if (!res.recordset || res.recordset.length === 0) return null;
    const r = res.recordset[0];
    return {
      itemId: String(r.ItemID).trim(),
      itemName: String(r.ItemName ?? "").trim(),
      satuan: String(r.Satuan ?? "Pcs").trim(),
      kodeJenis: r.KodeJenis != null ? String(r.KodeJenis).trim() : undefined,
      departemen: r.Departemen != null ? String(r.Departemen).trim() : undefined,
    };
  } catch (error) {
    log.error({ error, itemId }, "Gagal mengambil item info");
    return null;
  }
}

export interface KartuStockReportResult {
  itemInfo: KartuStockItemInfo | null;
  summary: KartuStockSummary;
  rows: KartuStockRow[];
  totalRows: number;
}

/**
 * Memanggil stored procedure dbo.rpKartuStockBrgL dan menyusun laporan mutasi kartu stock
 */
export async function getKartuStockReport(opts: {
  tgl1: string;
  tgl2: string;
  itemid: string;
  loc?: string;
  periodeR?: string;
  kategori?: string;
}): Promise<KartuStockReportResult> {
  const cleanItemId = (opts.itemid ?? "").trim();
  const cleanLoc = (opts.loc ?? "").trim() || "%";
  const cleanPeriodeR = (opts.periodeR ?? "").trim() || "201905";
  const cleanKategori = (opts.kategori ?? "").trim() || "0";

  const d1 = new Date(opts.tgl1);
  const d2 = new Date(opts.tgl2);
  // Pastikan waktu d2 mencakup sampai akhir hari jika date-only
  d2.setHours(23, 59, 59, 999);

  // Ambil metadata item terlebih dahulu bila spesifik
  let itemInfo: KartuStockItemInfo | null = null;
  if (cleanItemId && cleanItemId !== "%") {
    itemInfo = await getItemInfo(cleanItemId);
  }

  const res = await runProcedure("dbo.rpKartuStockBrgL", [
    { name: "Tgl1", type: sql.DateTime, value: d1 },
    { name: "Tgl2", type: sql.DateTime, value: d2 },
    { name: "Loc", type: sql.VarChar(6), value: cleanLoc },
    { name: "Item", type: sql.VarChar(500), value: "%" },
    { name: "PeriodeR", type: sql.VarChar(6), value: cleanPeriodeR },
    { name: "kategori", type: sql.VarChar(20), value: cleanKategori },
    { name: "itemid", type: sql.VarChar(50), value: cleanItemId || "%" },
  ]);

  const raw = (res.recordset || []) as any[];

  let runningSaldoZak = 0;
  let runningSaldoKg = 0;

  let saldoAwalZak = 0;
  let saldoAwalKg = 0;
  let totalMasukZak = 0;
  let totalMasukKg = 0;
  let totalKeluarZak = 0;
  let totalKeluarKg = 0;

  const rows: KartuStockRow[] = [];

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const kegiatanRaw = String(r.Kegiatan ?? "").trim().toUpperCase();
    const isSaldoAwal = kegiatanRaw === "S";

    const zakIn = Number(r.ZakI) || 0;
    const zakOut = Number(r.ZakO) || 0;
    const kgIn = Number(r.KgI) || 0;
    const kgOut = Number(r.KgO) || 0;

    // Update akumulasi
    if (isSaldoAwal) {
      saldoAwalZak += zakIn;
      saldoAwalKg += kgIn;
      runningSaldoZak = zakIn;
      runningSaldoKg = kgIn;
    } else {
      totalMasukZak += zakIn;
      totalMasukKg += kgIn;
      totalKeluarZak += zakOut;
      totalKeluarKg += kgOut;
      runningSaldoZak += zakIn - zakOut;
      runningSaldoKg += kgIn - kgOut;
    }

    const { label: kegiatanLabel, tone: kegiatanTone } = formatKegiatan(kegiatanRaw);

    rows.push({
      rowNum: i + 1,
      locName: String(r.LocName ?? "").trim() || (isSaldoAwal ? "SEMUA GUDANG" : "GUDANG"),
      itemId: String(r.ItemID ?? cleanItemId).trim(),
      itemName: String(r.ItemName ?? itemInfo?.itemName ?? "").trim(),
      moveDate: formatDate(r.MoveDate),
      kegiatan: kegiatanRaw,
      kegiatanLabel,
      kegiatanTone,
      zakIn,
      zakOut,
      kgIn,
      kgOut,
      saldoZak: Math.round(runningSaldoZak * 100) / 100,
      saldoKg: Math.round(runningSaldoKg * 100) / 100,
      noDoc: String(r.NoDoc ?? "").trim(),
      noMemo: String(r.NoMemo ?? "").trim(),
      keterangan: String(r.Keterangan ?? "").trim(),
      satuan: String(r.satuan ?? itemInfo?.satuan ?? "Kgs").trim(),
      locId: String(r.locid ?? "").trim(),
    });
  }

  const summary: KartuStockSummary = {
    saldoAwalZak: Math.round(saldoAwalZak * 100) / 100,
    saldoAwalKg: Math.round(saldoAwalKg * 100) / 100,
    totalMasukZak: Math.round(totalMasukZak * 100) / 100,
    totalMasukKg: Math.round(totalMasukKg * 100) / 100,
    totalKeluarZak: Math.round(totalKeluarZak * 100) / 100,
    totalKeluarKg: Math.round(totalKeluarKg * 100) / 100,
    saldoAkhirZak: Math.round(runningSaldoZak * 100) / 100,
    saldoAkhirKg: Math.round(runningSaldoKg * 100) / 100,
  };

  return {
    itemInfo,
    summary,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Mengekspor data kartu stock ke file Excel (.xlsx)
 */
export function exportKartuStockToExcel(
  report: KartuStockReportResult,
  meta: {
    tgl1: string;
    tgl2: string;
    locName?: string;
  }
): { buffer: Buffer; fileName: string } {
  const wb = XLSX.utils.book_new();

  const titleRows = [
    ["LAPORAN KARTU STOCK BARANG"],
    [`Periode: ${meta.tgl1} s/d ${meta.tgl2}`],
    [`Gudang: ${meta.locName || "Semua Gudang"}`],
    [
      `Barang: ${report.itemInfo?.itemId || "-"} - ${
        report.itemInfo?.itemName || ""
      } (${report.itemInfo?.satuan || "Kgs"})`,
    ],
    [], // Blank row
    [
      "Ringkasan:",
      `Saldo Awal: ${report.summary.saldoAwalKg.toLocaleString("id-ID")} ${report.itemInfo?.satuan || "Kg"} (${report.summary.saldoAwalZak} Zak)`,
      `Total Masuk: ${report.summary.totalMasukKg.toLocaleString("id-ID")} ${report.itemInfo?.satuan || "Kg"} (${report.summary.totalMasukZak} Zak)`,
      `Total Keluar: ${report.summary.totalKeluarKg.toLocaleString("id-ID")} ${report.itemInfo?.satuan || "Kg"} (${report.summary.totalKeluarZak} Zak)`,
      `Saldo Akhir: ${report.summary.saldoAkhirKg.toLocaleString("id-ID")} ${report.itemInfo?.satuan || "Kg"} (${report.summary.saldoAkhirZak} Zak)`,
    ],
    [], // Blank row
  ];

  const tableHeaders = [
    "No",
    "Tanggal",
    "Gudang",
    "Kegiatan",
    "No. Dokumen",
    "No. Memo / Bukti",
    "Keterangan",
    "Masuk (Zak)",
    "Masuk (Kg/Qty)",
    "Keluar (Zak)",
    "Keluar (Kg/Qty)",
    "Saldo (Zak)",
    "Saldo (Kg/Qty)",
    "Satuan",
  ];

  const dataRows = report.rows.map((r) => [
    r.rowNum,
    r.moveDate,
    r.locName,
    r.kegiatanLabel,
    r.noDoc,
    r.noMemo,
    r.keterangan,
    r.zakIn,
    r.kgIn,
    r.zakOut,
    r.kgOut,
    r.saldoZak,
    r.saldoKg,
    r.satuan,
  ]);

  const totalRow = [
    "",
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    report.summary.totalMasukZak,
    report.summary.totalMasukKg,
    report.summary.totalKeluarZak,
    report.summary.totalKeluarKg,
    report.summary.saldoAkhirZak,
    report.summary.saldoAkhirKg,
    report.itemInfo?.satuan || "Kgs",
  ];

  const sheetData = [...titleRows, tableHeaders, ...dataRows, totalRow];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws["!cols"] = [
    { wch: 5 },  // No
    { wch: 12 }, // Tanggal
    { wch: 20 }, // Gudang
    { wch: 18 }, // Kegiatan
    { wch: 16 }, // No Doc
    { wch: 18 }, // No Memo
    { wch: 28 }, // Keterangan
    { wch: 12 }, // Zak In
    { wch: 15 }, // Kg In
    { wch: 12 }, // Zak Out
    { wch: 15 }, // Kg Out
    { wch: 12 }, // Saldo Zak
    { wch: 16 }, // Saldo Kg
    { wch: 8 },  // Satuan
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Kartu Stock");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const safeItemId = (report.itemInfo?.itemId || "ALL").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Kartu_Stock_${safeItemId}_${meta.tgl1}_sd_${meta.tgl2}.xlsx`;

  return { buffer, fileName };
}
