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
 * Mencari barang pembelian dari riwayat taTransIDT untuk selector kartu stock pembelian
 */
export async function searchPurchasedGoods(query: string, limit = 25): Promise<KartuStockItemInfo[]> {
  const kw = (query ?? "").trim();
  try {
    const whereQuery = kw ? "AND (g.ItemID LIKE @q OR g.ItemName LIKE @q)" : "";
    const params: any[] = [{ name: "Lim", type: sql.Int, value: limit }];
    if (kw) {
      params.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${kw}%` });
    }

    const res = await runQuery(
      `SELECT TOP (@Lim) 
         g.ItemID, 
         g.ItemName, 
         ISNULL(g.SatuanKecil, 'Pcs') AS Satuan, 
         g.KodeJenis, 
         g.Mark AS Departemen
       FROM [cp].[dbo].[taGoods] g
       WHERE EXISTS (
         SELECT 1 FROM [cp].[dbo].[taTransIDT] t WHERE t.ItemID = g.ItemID
       )
       ${whereQuery}
       ORDER BY g.ItemID ASC`,
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
    log.error({ error, query }, "Gagal mencari barang pembelian dari taTransIDT");
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
    const resolvedSatuan = String(itemInfo?.satuan || r.satuan || "Pcs").trim();

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
      satuan: resolvedSatuan,
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

  const unitLabel = report.itemInfo?.satuan || "Pcs";

  const titleRows = [
    ["LAPORAN KARTU STOCK BARANG"],
    [`Periode: ${meta.tgl1} s/d ${meta.tgl2}`],
    [`Gudang: ${meta.locName || "Semua Gudang"}`],
    [
      `Barang: ${report.itemInfo?.itemId || "-"} - ${
        report.itemInfo?.itemName || ""
      } (${unitLabel})`,
    ],
    [], // Blank row
    [
      "Ringkasan:",
      `Saldo Awal: ${report.summary.saldoAwalKg.toLocaleString("id-ID")} ${unitLabel} (${report.summary.saldoAwalZak} Zak)`,
      `Total Masuk: ${report.summary.totalMasukKg.toLocaleString("id-ID")} ${unitLabel} (${report.summary.totalMasukZak} Zak)`,
      `Total Keluar: ${report.summary.totalKeluarKg.toLocaleString("id-ID")} ${unitLabel} (${report.summary.totalKeluarZak} Zak)`,
      `Saldo Akhir: ${report.summary.saldoAkhirKg.toLocaleString("id-ID")} ${unitLabel} (${report.summary.saldoAkhirZak} Zak)`,
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
    `Masuk (${unitLabel})`,
    "Keluar (Zak)",
    `Keluar (${unitLabel})`,
    "Saldo (Zak)",
    `Saldo (${unitLabel})`,
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
    unitLabel,
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

export interface RekapMutasiPembelianRow {
  rowNum: number;
  itemId: string;
  itemName: string;
  satuan: string;
  kodeJenis?: string;
  departemen?: string;
  saldoAwalZak: number;
  saldoAwalKg: number;
  masukZak: number;
  masukKg: number;
  keluarZak: number;
  keluarKg: number;
  saldoAkhirZak: number;
  saldoAkhirKg: number;
}

export interface RekapMutasiPembelianSummary {
  totalSaldoAwalZak: number;
  totalSaldoAwalKg: number;
  totalMasukZak: number;
  totalMasukKg: number;
  totalKeluarZak: number;
  totalKeluarKg: number;
  totalSaldoAkhirZak: number;
  totalSaldoAkhirKg: number;
  totalItems: number;
}

export interface RekapMutasiPembelianResult {
  rows: RekapMutasiPembelianRow[];
  summary: RekapMutasiPembelianSummary;
  totalRows: number;
}

/**
 * Mencari periode closing taACR terdekat yang valid (memiliki data saldo closing)
 */
export async function getBestClosingPeriode(tgl1Str: string): Promise<string> {
  const clean = tgl1Str.replace(/[^0-9]/g, "").slice(0, 6) || "202602";
  try {
    const res = await runQuery(
      `SELECT TOP 1 Periode 
       FROM [cp].[dbo].[taACR] 
       WHERE Periode <= @p 
       GROUP BY Periode 
       HAVING COUNT(*) > 500 
       ORDER BY Periode DESC`,
      [{ name: "p", type: sql.VarChar(6), value: clean }]
    );
    if (res.recordset && res.recordset.length > 0 && res.recordset[0].Periode) {
      return String(res.recordset[0].Periode).trim();
    }
  } catch (err) {
    log.warn({ err }, "Gagal mengambil best closing periode, fallback ke 202602");
  }
  return "202602";
}

/**
 * Mengambil rekapitulasi mutasi stok semua barang pembelian dari riwayat taTransIDT
 * menggunakan stored procedure dbo.rpMutasiStockBrgL
 */
export async function getRekapMutasiPembelian(opts: {
  tgl1: string;
  tgl2: string;
  loc?: string;
  periodeR?: string;
  hideZero?: boolean;
  search?: string;
}): Promise<RekapMutasiPembelianResult> {
  const cleanLoc = (opts.loc ?? "").trim() || "%";
  const cleanPeriodeR = (opts.periodeR ?? "").trim() || "201905";
  const hideZero = opts.hideZero !== false;
  const searchKw = (opts.search ?? "").trim().toLowerCase();

  const d1 = new Date(opts.tgl1);
  const d2 = new Date(opts.tgl2);
  d2.setHours(23, 59, 59, 999);

  try {
    const [transItemsRes, goodsRes, procRes] = await Promise.all([
      runQuery(
        `SELECT DISTINCT LTRIM(RTRIM(ItemID)) AS ItemID 
         FROM [cp].[dbo].[taTransIDT] 
         WHERE ItemID IS NOT NULL AND ItemID <> ''`
      ),
      runQuery(
        `SELECT 
           LTRIM(RTRIM(ItemID)) AS ItemID, 
           ItemName, 
           ISNULL(SatuanKecil, 'Pcs') AS Satuan, 
           KodeJenis, 
           Mark AS Departemen 
         FROM [cp].[dbo].[taGoods]`
      ),
      runProcedure("dbo.rpMutasiStockBrgL", [
        { name: "Tgl1", type: sql.DateTime, value: d1 },
        { name: "Tgl2", type: sql.DateTime, value: d2 },
        { name: "Loc", type: sql.VarChar(6), value: cleanLoc },
        { name: "Item", type: sql.VarChar(14), value: "%" },
        { name: "PeriodeR", type: sql.VarChar(6), value: cleanPeriodeR },
        { name: "company", type: sql.Int, value: 1 },
      ]),
    ]);

    const transSet = new Set(
      (transItemsRes.recordset || []).map((r: any) => String(r.ItemID || "").trim())
    );

    const goodsMap = new Map<string, any>();
    for (const g of goodsRes.recordset || []) {
      goodsMap.set(String(g.ItemID || "").trim(), g);
    }

    const rawRows = (procRes.recordset || []) as any[];
    const rows: RekapMutasiPembelianRow[] = [];

    let totalSaldoAwalZak = 0;
    let totalSaldoAwalKg = 0;
    let totalMasukZak = 0;
    let totalMasukKg = 0;
    let totalKeluarZak = 0;
    let totalKeluarKg = 0;
    let totalSaldoAkhirZak = 0;
    let totalSaldoAkhirKg = 0;

    let rowNum = 1;
    for (const r of rawRows) {
      const itemId = String(r.ItemID || "").trim();
      if (!itemId || !transSet.has(itemId)) continue;

      const saZak = Number(r.SaBags) || 0;
      const saKg = Number(r.SaKgs) || 0;
      const inZak = Number(r.ZakI) || 0;
      const inKg = Number(r.KgI) || 0;
      const outZak = Number(r.ZakO) || 0;
      const outKg = Number(r.KgO) || 0;

      // Sembunyikan item jika saldo dan pergerakan semuanya 0
      if (
        hideZero &&
        saZak === 0 &&
        saKg === 0 &&
        inZak === 0 &&
        inKg === 0 &&
        outZak === 0 &&
        outKg === 0
      ) {
        continue;
      }

      const gInfo = goodsMap.get(itemId);
      const itemName = String(r.itemName || gInfo?.ItemName || "").trim();

      // Search keyword filter
      if (searchKw) {
        const matchItem = itemId.toLowerCase().includes(searchKw);
        const matchName = itemName.toLowerCase().includes(searchKw);
        if (!matchItem && !matchName) continue;
      }

      const saldoAkhirZak = Math.round((saZak + inZak - outZak) * 100) / 100;
      const saldoAkhirKg = Math.round((saKg + inKg - outKg) * 100) / 100;

      totalSaldoAwalZak += saZak;
      totalSaldoAwalKg += saKg;
      totalMasukZak += inZak;
      totalMasukKg += inKg;
      totalKeluarZak += outZak;
      totalKeluarKg += outKg;
      totalSaldoAkhirZak += saldoAkhirZak;
      totalSaldoAkhirKg += saldoAkhirKg;

      rows.push({
        rowNum: rowNum++,
        itemId,
        itemName,
        satuan: String(gInfo?.Satuan || "Pcs").trim(),
        kodeJenis: gInfo?.KodeJenis != null ? String(gInfo.KodeJenis).trim() : undefined,
        departemen: gInfo?.Departemen != null ? String(gInfo.Departemen).trim() : undefined,
        saldoAwalZak: Math.round(saZak * 100) / 100,
        saldoAwalKg: Math.round(saKg * 100) / 100,
        masukZak: Math.round(inZak * 100) / 100,
        masukKg: Math.round(inKg * 100) / 100,
        keluarZak: Math.round(outZak * 100) / 100,
        keluarKg: Math.round(outKg * 100) / 100,
        saldoAkhirZak,
        saldoAkhirKg,
      });
    }

    const summary: RekapMutasiPembelianSummary = {
      totalSaldoAwalZak: Math.round(totalSaldoAwalZak * 100) / 100,
      totalSaldoAwalKg: Math.round(totalSaldoAwalKg * 100) / 100,
      totalMasukZak: Math.round(totalMasukZak * 100) / 100,
      totalMasukKg: Math.round(totalMasukKg * 100) / 100,
      totalKeluarZak: Math.round(totalKeluarZak * 100) / 100,
      totalKeluarKg: Math.round(totalKeluarKg * 100) / 100,
      totalSaldoAkhirZak: Math.round(totalSaldoAkhirZak * 100) / 100,
      totalSaldoAkhirKg: Math.round(totalSaldoAkhirKg * 100) / 100,
      totalItems: rows.length,
    };

    return {
      rows,
      summary,
      totalRows: rows.length,
    };
  } catch (error) {
    log.error({ error, opts }, "Gagal mengambil rekap mutasi pembelian");
    throw error;
  }
}

/**
 * Mengekspor data rekapitulasi mutasi stok barang pembelian ke file Excel (.xlsx)
 */
export function exportRekapMutasiPembelianToExcel(
  report: RekapMutasiPembelianResult,
  meta: {
    tgl1: string;
    tgl2: string;
    locName?: string;
  }
): { buffer: Buffer; fileName: string } {
  const wb = XLSX.utils.book_new();

  const titleRows = [
    ["LAPORAN REKAPITULASI MUTASI STOK SEMUA BARANG PEMBELIAN (taTransIDT)"],
    [`Periode: ${meta.tgl1} s/d ${meta.tgl2}`],
    [`Gudang: ${meta.locName || "Semua Gudang"}`],
    [`Total Jenis Barang: ${report.summary.totalItems.toLocaleString("id-ID")}`],
    [],
    [
      "Ringkasan Total:",
      `Saldo Awal: ${report.summary.totalSaldoAwalKg.toLocaleString("id-ID")} Qty (${report.summary.totalSaldoAwalZak.toLocaleString("id-ID")} Zak)`,
      `Total Masuk: ${report.summary.totalMasukKg.toLocaleString("id-ID")} Qty (${report.summary.totalMasukZak.toLocaleString("id-ID")} Zak)`,
      `Total Keluar: ${report.summary.totalKeluarKg.toLocaleString("id-ID")} Qty (${report.summary.totalKeluarZak.toLocaleString("id-ID")} Zak)`,
      `Saldo Akhir: ${report.summary.totalSaldoAkhirKg.toLocaleString("id-ID")} Qty (${report.summary.totalSaldoAkhirZak.toLocaleString("id-ID")} Zak)`,
    ],
    [],
  ];

  const tableHeaders = [
    "No",
    "Kode Barang",
    "Nama Barang",
    "Satuan",
    "Saldo Awal (Zak)",
    "Saldo Awal (Qty)",
    "Masuk (Zak)",
    "Masuk (Qty)",
    "Keluar (Zak)",
    "Keluar (Qty)",
    "Saldo Akhir (Zak)",
    "Saldo Akhir (Qty)",
  ];

  const dataRows = report.rows.map((r) => [
    r.rowNum,
    r.itemId,
    r.itemName,
    r.satuan,
    r.saldoAwalZak,
    r.saldoAwalKg,
    r.masukZak,
    r.masukKg,
    r.keluarZak,
    r.keluarKg,
    r.saldoAkhirZak,
    r.saldoAkhirKg,
  ]);

  const totalRow = [
    "",
    "TOTAL KESELURUHAN",
    "",
    "",
    report.summary.totalSaldoAwalZak,
    report.summary.totalSaldoAwalKg,
    report.summary.totalMasukZak,
    report.summary.totalMasukKg,
    report.summary.totalKeluarZak,
    report.summary.totalKeluarKg,
    report.summary.totalSaldoAkhirZak,
    report.summary.totalSaldoAkhirKg,
  ];

  const sheetData = [...titleRows, tableHeaders, ...dataRows, totalRow];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!cols"] = [
    { wch: 6 },  // No
    { wch: 18 }, // Kode Barang
    { wch: 35 }, // Nama Barang
    { wch: 10 }, // Satuan
    { wch: 16 }, // Saldo Awal Zak
    { wch: 18 }, // Saldo Awal Kg
    { wch: 14 }, // Masuk Zak
    { wch: 16 }, // Masuk Kg
    { wch: 14 }, // Keluar Zak
    { wch: 16 }, // Keluar Kg
    { wch: 16 }, // Saldo Akhir Zak
    { wch: 18 }, // Saldo Akhir Kg
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Rekap Mutasi");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const fileName = `Rekap_Mutasi_Pembelian_${meta.tgl1}_sd_${meta.tgl2}.xlsx`;

  return { buffer, fileName };
}
