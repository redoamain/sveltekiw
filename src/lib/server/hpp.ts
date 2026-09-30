/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool, log } from "@/lib/db";
import sql from "mssql";
import * as XLSX from "xlsx";

// ==========================================
// INTERFACES & TYPES
// ==========================================

export interface HPPFilterParams {
  year: string; // e.g. '2024'
  month: string; // e.g. '08'
  tgl1?: string; // YYYY-MM-DD
  tgl2?: string; // YYYY-MM-DD
  opr?: number; // 0 = Semua, 1 = Operasi 1, dst.
  item?: string; // Optional filter nama/kode item
  hideEmpty?: boolean; // Sembunyikan barang bersaldo 0 & tanpa mutasi
  reportType?: 'rekap' | 'cogm' | 'kartu-stock' | 'mutasi-stock' | 'ytd' | 'harga' | 'kalkulasi' | 'all';
}

export interface HPPKartuStockMovement {
  LocID: string;
  locname: string;
  ItemID: string;
  ItemName: string;
  movedate: string | null;
  kegiatan: string;
  transtype: string;
  transno: string;
  zakI: number;
  kgI: number;
  zako: number;
  kgO: number;
  NilaiI: number;
  NilaiO: number;
  HargaI: number;
  hargaO: number;
  saldoKg: number;
  saldoNilai: number;
  saldoHargaAvg: number;
}

export interface HPPKartuStockItemCard {
  itemId: string;
  itemName: string;
  saldoAwalKg: number;
  saldoAwalNilai: number;
  saldoAwalHarga: number;
  totalMasukKg: number;
  totalMasukNilai: number;
  totalKeluarKg: number;
  totalKeluarNilai: number;
  saldoAkhirKg: number;
  saldoAkhirNilai: number;
  saldoAkhirHargaAvg: number;
  movements: HPPKartuStockMovement[];
}

export interface HPPKartuStockResult {
  periodeR: string;
  tgl1: string;
  tgl2: string;
  itemName: string;
  items: HPPKartuStockItemCard[];
  totalItems: number;
  totalMovements: number;
  grandTotalNilaiAkhir: number;
}

export interface HPPMutasiStockRow {
  ItemID: string;
  NamaJenis: string;
  ItemName: string;
  SldZak: number;
  SldKg: number;
  SldNilai: number;
  ZakI: number;
  KgI: number;
  NilaiI: number;
  ZakO: number;
  KgO: number;
  NilaiO: number;
  AkhirZak: number;
  AkhirKg: number;
  AkhirNilai: number;
  hppavg: number;
}

export interface HPPMutasiStockGroup {
  namaJenis: string;
  rows: HPPMutasiStockRow[];
  subtotalSldNilai: number;
  subtotalNilaiI: number;
  subtotalNilaiO: number;
  subtotalAkhirNilai: number;
}

export interface HPPMutasiStockResult {
  periodeR: string;
  tgl1: string;
  tgl2: string;
  groups: HPPMutasiStockGroup[];
  totalItems: number;
  grandTotalSldNilai: number;
  grandTotalNilaiI: number;
  grandTotalNilaiO: number;
  grandTotalAkhirNilai: number;
}

export interface HPPComponentRow {
  alias: string;
  acc: string;
  remark: string;
  totalrp: number;
  remarkint: string;
  jenisbarang: string;
  groupname: string;
  urutandhp: number;
  periode: string;
  opr: number;
  hppprod: number;
}

export interface HPPGroupSummary {
  groupName: string;
  urutan: number;
  items: HPPComponentRow[];
  subtotalRp: number;
}

export interface HPPReportResult {
  year: string;
  month: string;
  periode: string;
  opr: number;
  groups: HPPGroupSummary[];
  totalSaldoAwal: number;
  totalBahanBaku: number;
  totalBiayaProduksi: number;
  totalPersediaanAkhir: number;
  grandTotalHPP: number;
  rawRowsCount: number;
}

export interface HPPCOGMRow {
  TransID: string;
  Acc: string;
  AccName: string;
  Pos: string;
  itemID: string;
  itemname: string;
  itval: number;
  qty: number;
  berat: number | null;
}

export interface HPPCOGMResult {
  year: string;
  month: string;
  periode: string;
  rows: HPPCOGMRow[];
  totalQty: number;
  totalNilai: number;
  totalRows: number;
}

export interface HPPHargaRow {
  ItemID: string;
  ItemName: string;
  Price: number | null;
  Periode: any;
}

export interface HPPHasilKalkulasiRow {
  ItemID: string;
  ItemName: string;
  DefaultHarga: boolean;
  Price: number;
}

// ==========================================
// STORED PROCEDURE CALLS
// ==========================================

/**
 * 1. Rekap HPP Bulanan via [cp].[dbo].[rpHPP]
 */
export async function getHPPData(params: HPPFilterParams): Promise<HPPReportResult> {
  const pool = await getPool();
  const year = params.year || String(new Date().getFullYear());
  const month = (params.month || String(new Date().getMonth() + 1)).padStart(2, "0");
  const opr = params.opr != null ? Number(params.opr) : 0;
  const periode = `${year}${month}`;

  const req = pool.request();
  const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
  (req as any).overrides = { requestTimeout: reportTimeout };

  req.input("year", sql.VarChar(4), year);
  req.input("month", sql.VarChar(2), month);
  req.input("opr", sql.Int, opr);

  try {
    const res = await req.execute("[cp].[dbo].[rpHPP]");
    const rawRows: any[] = res.recordset || [];

    const groupMap = new Map<string, HPPGroupSummary>();
    let totalSaldoAwal = 0;
    let totalBahanBaku = 0;
    let totalBiayaProduksi = 0;
    let totalPersediaanAkhir = 0;

    for (const r of rawRows) {
      const gName = String(r.groupname || "LAIN-LAIN").trim();
      const urutan = Number(r.urutandhp) || 99;
      const totalrp = Number(r.totalrp) || 0;

      if (!groupMap.has(gName)) {
        groupMap.set(gName, {
          groupName: gName,
          urutan,
          items: [],
          subtotalRp: 0,
        });
      }

      const grp = groupMap.get(gName)!;
      grp.items.push({
        alias: String(r.alias || ""),
        acc: String(r.acc || ""),
        remark: String(r.remark || ""),
        totalrp,
        remarkint: String(r.remarkint || ""),
        jenisbarang: String(r.jenisbarang || ""),
        groupname: gName,
        urutandhp: urutan,
        periode: String(r.periode || periode),
        opr: Number(r.opr) || 0,
        hppprod: Number(r.hppprod) || 0,
      });
      grp.subtotalRp += totalrp;

      // Klasifikasi metrik
      if (gName.includes("00-SALDO AWAL")) {
        totalSaldoAwal += totalrp;
      } else if (gName.includes("01-PEMBELIAN") || gName.includes("BAHAN")) {
        totalBahanBaku += totalrp;
      } else if (gName.includes("99-PERSEDIAAN AKHIR")) {
        totalPersediaanAkhir += totalrp;
      } else {
        totalBiayaProduksi += totalrp;
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => a.urutan - b.urutan);
    const grandTotalHPP = totalSaldoAwal + totalBahanBaku + totalBiayaProduksi + totalPersediaanAkhir;

    return {
      year,
      month,
      periode,
      opr,
      groups,
      totalSaldoAwal,
      totalBahanBaku,
      totalBiayaProduksi,
      totalPersediaanAkhir,
      grandTotalHPP,
      rawRowsCount: rawRows.length,
    };
  } catch (err: any) {
    log.error({ err, params }, "Gagal mengeksekusi SP rpHPP");
    throw new Error(`Gagal memuat Rekap HPP: ${err?.message || err}`);
  }
}

/**
 * 2. Rincian COGM (Cost of Goods Manufactured) via [cp].[dbo].[rpHPPCOGM] atau [rpHPPCOGMtes]
 */
export async function getHPPCOGMData(params: HPPFilterParams): Promise<HPPCOGMResult> {
  const pool = await getPool();
  const year = params.year || String(new Date().getFullYear());
  const month = (params.month || String(new Date().getMonth() + 1)).padStart(2, "0");
  const opr = params.opr != null ? Number(params.opr) : 0;
  const item = (params.item || "").trim();
  const periode = `${year}${month}`;

  const req = pool.request();
  const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
  (req as any).overrides = { requestTimeout: reportTimeout };

  req.input("year", sql.VarChar(4), year);
  req.input("month", sql.VarChar(2), month);
  req.input("opr", sql.Int, opr);

  let spName = "[cp].[dbo].[rpHPPCOGM]";
  if (item) {
    spName = "[cp].[dbo].[rpHPPCOGMtes]";
    req.input("item", sql.VarChar(50), item);
  }

  try {
    const res = await req.execute(spName);
    const rawRows: any[] = res.recordset || [];

    let totalQty = 0;
    let totalNilai = 0;

    const rows: HPPCOGMRow[] = rawRows.map((r) => {
      const itval = Number(r.itval) || 0;
      const qty = Number(r.qty) || 0;
      totalQty += qty;
      totalNilai += itval;

      return {
        TransID: String(r.TransID || "").trim(),
        Acc: String(r.Acc || "").trim(),
        AccName: String(r.AccName || "").trim(),
        Pos: String(r.Pos || "").trim(),
        itemID: String(r.itemID || "").trim(),
        itemname: String(r.itemname || "").trim(),
        itval,
        qty,
        berat: r.berat != null ? Number(r.berat) : null,
      };
    });

    return {
      year,
      month,
      periode,
      rows,
      totalQty,
      totalNilai,
      totalRows: rows.length,
    };
  } catch (err: any) {
    log.error({ err, params }, "Gagal mengeksekusi SP rpHPPCOGM");
    throw new Error(`Gagal memuat Rincian COGM HPP: ${err?.message || err}`);
  }
}

/**
 * 3. Rekap Kumulatif YTD HPP via [cp].[dbo].[rpHPPYTD]
 */
export async function getHPPYTDData(params: HPPFilterParams): Promise<HPPReportResult> {
  const pool = await getPool();
  const year = params.year || String(new Date().getFullYear());
  const month = (params.month || String(new Date().getMonth() + 1)).padStart(2, "0");
  const opr = params.opr != null ? Number(params.opr) : 0;
  const periode = `${year}${month}`;

  const req = pool.request();
  const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
  (req as any).overrides = { requestTimeout: reportTimeout };

  req.input("year", sql.VarChar(4), year);
  req.input("month", sql.VarChar(2), month);
  req.input("opr", sql.Int, opr);

  try {
    const res = await req.execute("[cp].[dbo].[rpHPPYTD]");
    const rawRows: any[] = res.recordset || [];

    const groupMap = new Map<string, HPPGroupSummary>();
    let totalSaldoAwal = 0;
    let totalBahanBaku = 0;
    let totalBiayaProduksi = 0;
    let totalPersediaanAkhir = 0;

    for (const r of rawRows) {
      const gName = String(r.groupname || "LAIN-LAIN").trim();
      const urutan = Number(r.urutandhp) || 99;
      const totalrp = Number(r.totalrp) || 0;

      if (!groupMap.has(gName)) {
        groupMap.set(gName, {
          groupName: gName,
          urutan,
          items: [],
          subtotalRp: 0,
        });
      }

      const grp = groupMap.get(gName)!;
      grp.items.push({
        alias: String(r.alias || ""),
        acc: String(r.acc || ""),
        remark: String(r.remark || ""),
        totalrp,
        remarkint: String(r.remarkint || ""),
        jenisbarang: String(r.jenisbarang || ""),
        groupname: gName,
        urutandhp: urutan,
        periode: String(r.periode || periode),
        opr: Number(r.opr) || 0,
        hppprod: Number(r.hppprod) || 0,
      });
      grp.subtotalRp += totalrp;

      if (gName.includes("00-SALDO AWAL")) {
        totalSaldoAwal += totalrp;
      } else if (gName.includes("01-PEMBELIAN") || gName.includes("BAHAN")) {
        totalBahanBaku += totalrp;
      } else if (gName.includes("99-PERSEDIAAN AKHIR")) {
        totalPersediaanAkhir += totalrp;
      } else {
        totalBiayaProduksi += totalrp;
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => a.urutan - b.urutan);
    const grandTotalHPP = totalSaldoAwal + totalBahanBaku + totalBiayaProduksi + totalPersediaanAkhir;

    return {
      year,
      month,
      periode,
      opr,
      groups,
      totalSaldoAwal,
      totalBahanBaku,
      totalBiayaProduksi,
      totalPersediaanAkhir,
      grandTotalHPP,
      rawRowsCount: rawRows.length,
    };
  } catch (err: any) {
    log.error({ err, params }, "Gagal mengeksekusi SP rpHPPYTD");
    throw new Error(`Gagal memuat Rekap HPP YTD: ${err?.message || err}`);
  }
}

/**
 * 4. Daftar Harga HPP Barang via [cp].[dbo].[rpHargaHPP]
 */
export async function getHargaHPPData(params: { date?: string; item?: string }): Promise<HPPHargaRow[]> {
  const pool = await getPool();
  const dateStr = params.date || new Date().toISOString().slice(0, 10);
  const targetDate = new Date(`${dateStr}T23:59:59.000Z`);

  const req = pool.request();
  const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
  (req as any).overrides = { requestTimeout: reportTimeout };

  req.input("Periode", sql.DateTime, targetDate);

  try {
    const res = await req.execute("[cp].[dbo].[rpHargaHPP]");
    let list: HPPHargaRow[] = (res.recordset || []).map((r) => ({
      ItemID: String(r.ItemID || "").trim(),
      ItemName: String(r.ItemName || "").trim(),
      Price: r.Price != null ? Number(r.Price) : null,
      Periode: r.Periode,
    }));

    if (params.item) {
      const q = params.item.toLowerCase();
      list = list.filter((r) => r.ItemID.toLowerCase().includes(q) || r.ItemName.toLowerCase().includes(q));
    }

    return list;
  } catch (err: any) {
    log.error({ err }, "Gagal mengeksekusi SP rpHargaHPP");
    throw new Error(`Gagal memuat Daftar Harga HPP: ${err?.message || err}`);
  }
}

/**
 * 5. Hasil Kalkulasi HPP via [cp].[dbo].[rpHasilKalkulasiHPP]
 */
export async function getHasilKalkulasiHPPData(params: { date?: string }): Promise<HPPHasilKalkulasiRow[]> {
  const pool = await getPool();
  const dateStr = params.date || new Date().toISOString().slice(0, 10);
  const targetDate = new Date(`${dateStr}T23:59:59.000Z`);

  const req = pool.request();
  const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
  (req as any).overrides = { requestTimeout: reportTimeout };

  req.input("Periode", sql.DateTime, targetDate);

  try {
    const res = await req.execute("[cp].[dbo].[rpHasilKalkulasiHPP]");
    return (res.recordset || []).map((r) => ({
      ItemID: String(r.ItemID || "").trim(),
      ItemName: String(r.ItemName || "").trim(),
      DefaultHarga: Boolean(r.DefaultHarga),
      Price: Number(r.Price) || 0,
    }));
  } catch (err: any) {
    log.error({ err }, "Gagal mengeksekusi SP rpHasilKalkulasiHPP");
    throw new Error(`Gagal memuat Hasil Kalkulasi HPP: ${err?.message || err}`);
  }
}

/**
 * 6. Kartu Stock dengan HPP via [cp].[dbo].[rpHPPKartuStockBrgL]
 */
export async function getHPPKartuStockData(params: HPPFilterParams): Promise<HPPKartuStockResult> {
  const pool = await getPool();
  const year = params.year || String(new Date().getFullYear());
  const month = (params.month || String(new Date().getMonth() + 1)).padStart(2, "0");
  const periodeR = `${year}${month}`;

  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const tgl1 = params.tgl1 || `${year}-${month}-01`;
  const tgl2 = params.tgl2 || `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
  const itemName = params.item?.trim() ? `%${params.item.trim()}%` : '%';

  const req = pool.request();
  const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
  (req as any).overrides = { requestTimeout: reportTimeout };

  req.input("PeriodeR", sql.VarChar(6), periodeR);
  req.input("Tgl1", sql.DateTime, new Date(`${tgl1}T00:00:00.000Z`));
  req.input("Tgl2", sql.DateTime, new Date(`${tgl2}T23:59:59.000Z`));
  req.input("ItemName", sql.VarChar(500), itemName);

  try {
    const res = await req.execute("[cp].[dbo].[rpHPPKartuStockBrgL]");
    const rawRows: any[] = res.recordset || [];

    const itemMap = new Map<string, { itemId: string; itemName: string; rawList: any[] }>();

    for (const r of rawRows) {
      const itId = String(r.ItemID || "").trim();
      if (!itId) continue;
      if (!itemMap.has(itId)) {
        itemMap.set(itId, {
          itemId: itId,
          itemName: String(r.ItemName || "").trim(),
          rawList: [],
        });
      }
      itemMap.get(itId)!.rawList.push(r);
    }

    const items: HPPKartuStockItemCard[] = [];
    let grandTotalNilaiAkhir = 0;
    let totalMovements = 0;

    for (const [itId, grp] of itemMap.entries()) {
      let runningKg = 0;
      let runningNilai = 0;
      let saldoAwalKg = 0;
      let saldoAwalNilai = 0;
      let totalMasukKg = 0;
      let totalMasukNilai = 0;
      let totalKeluarKg = 0;
      let totalKeluarNilai = 0;

      const movements: HPPKartuStockMovement[] = [];

      const sorted = grp.rawList.sort((a, b) => {
        if (a.kegiatan === 'SA') return -1;
        if (b.kegiatan === 'SA') return 1;
        const da = a.movedate ? new Date(a.movedate).getTime() : 0;
        const db = b.movedate ? new Date(b.movedate).getTime() : 0;
        return da - db;
      });

      for (const r of sorted) {
        const isSA = String(r.kegiatan || "").trim().toUpperCase() === 'SA';
        const zakI = Number(r.zakI) || 0;
        const kgI = Number(r.kgI) || 0;
        const zako = Number(r.zako) || 0;
        const kgO = Number(r.kgO) || 0;
        const NilaiI = Number(r.NilaiI) || 0;
        const NilaiO = Number(r.NilaiO) || 0;
        const HargaI = r.HargaI != null ? Number(r.HargaI) : (kgI !== 0 ? NilaiI / kgI : 0);
        const hargaO = r.hargaO != null ? Number(r.hargaO) : (kgO !== 0 ? NilaiO / kgO : 0);

        if (isSA) {
          saldoAwalKg = kgI;
          saldoAwalNilai = NilaiI;
          runningKg = kgI;
          runningNilai = NilaiI;
        } else {
          runningKg += kgI - kgO;
          runningNilai += NilaiI - NilaiO;
          totalMasukKg += kgI;
          totalMasukNilai += NilaiI;
          totalKeluarKg += kgO;
          totalKeluarNilai += NilaiO;
        }

        const saldoHargaAvg = runningKg !== 0 ? runningNilai / runningKg : 0;
        const dateStr = r.movedate ? new Date(r.movedate).toISOString().slice(0, 10) : null;

        movements.push({
          LocID: String(r.LocID || "").trim(),
          locname: String(r.locname || "").trim(),
          ItemID: itId,
          ItemName: grp.itemName,
          movedate: dateStr,
          kegiatan: String(r.kegiatan || "").trim(),
          transtype: String(r.transtype || "").trim(),
          transno: String(r.transno || "").trim(),
          zakI,
          kgI,
          zako,
          kgO,
          NilaiI,
          NilaiO,
          HargaI,
          hargaO,
          saldoKg: runningKg,
          saldoNilai: runningNilai,
          saldoHargaAvg,
        });
      }

      const saldoAwalHarga = saldoAwalKg !== 0 ? saldoAwalNilai / saldoAwalKg : 0;
      const saldoAkhirHargaAvg = runningKg !== 0 ? runningNilai / runningKg : 0;

      items.push({
        itemId: itId,
        itemName: grp.itemName,
        saldoAwalKg,
        saldoAwalNilai,
        saldoAwalHarga,
        totalMasukKg,
        totalMasukNilai,
        totalKeluarKg,
        totalKeluarNilai,
        saldoAkhirKg: runningKg,
        saldoAkhirNilai: runningNilai,
        saldoAkhirHargaAvg,
        movements,
      });

      grandTotalNilaiAkhir += runningNilai;
      totalMovements += movements.length;
    }

    return {
      periodeR,
      tgl1,
      tgl2,
      itemName: params.item || '',
      items,
      totalItems: items.length,
      totalMovements,
      grandTotalNilaiAkhir,
    };
  } catch (err: any) {
    log.error({ err, params }, "Gagal mengeksekusi SP rpHPPKartuStockBrgL");
    throw new Error(`Gagal memuat Kartu Stock HPP: ${err?.message || err}`);
  }
}

/**
 * 7. Mutasi Stock dengan HPP via [cp].[dbo].[rpHPPMutasiStockBrg2] (Format template lap-hpp/rphppkartustockbrgmutasi.xls)
 */
export async function getHPPMutasiStockData(params: HPPFilterParams): Promise<HPPMutasiStockResult> {
  const pool = await getPool();
  const year = params.year || String(new Date().getFullYear());
  const month = (params.month || String(new Date().getMonth() + 1)).padStart(2, "0");
  const periodeR = `${year}${month}`;

  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const tgl1 = params.tgl1 || `${year}-${month}-01`;
  const tgl2 = params.tgl2 || `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
  const itemName = params.item?.trim() ? `%${params.item.trim()}%` : '%';
  const hideEmpty = params.hideEmpty !== false;

  const req = pool.request();
  const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
  (req as any).overrides = { requestTimeout: reportTimeout };

  req.input("PeriodeR", sql.VarChar(6), periodeR);
  req.input("Tgl1", sql.DateTime, new Date(`${tgl1}T00:00:00.000Z`));
  req.input("Tgl2", sql.DateTime, new Date(`${tgl2}T23:59:59.000Z`));
  req.input("ItemName", sql.VarChar(500), itemName);

  try {
    const res = await req.execute("[cp].[dbo].[rpHPPMutasiStockBrg2]");
    const rawRows: any[] = res.recordset || [];

    const groupMap = new Map<string, HPPMutasiStockGroup>();
    let grandTotalSldNilai = 0;
    let grandTotalNilaiI = 0;
    let grandTotalNilaiO = 0;
    let grandTotalAkhirNilai = 0;
    let totalItems = 0;

    for (const r of rawRows) {
      const sldZak = Number(r.SldZak) || 0;
      const sldKg = Number(r.SldKg) || 0;
      const sldNilai = Number(r.SldNilai) || 0;
      const zakI = Number(r.ZakI) || 0;
      const kgI = Number(r.KgI) || 0;
      const nilaiI = Number(r.NilaiI) || 0;
      const zakO = Number(r.ZakO) || 0;
      const kgO = Number(r.KgO) || 0;
      const nilaiO = Number(r.NilaiO) || 0;

      const akhirZak = sldZak + zakI - zakO;
      const akhirKg = sldKg + kgI - kgO;
      const akhirNilai = sldNilai + nilaiI - nilaiO;
      const hppavg = Number(r.hppavg) || 0;

      if (
        hideEmpty &&
        Math.abs(sldNilai) < 0.01 &&
        Math.abs(sldKg) < 0.01 &&
        Math.abs(nilaiI) < 0.01 &&
        Math.abs(nilaiO) < 0.01
      ) {
        continue;
      }

      const gName = String(r.NamaJenis || "LAIN-LAIN").trim();
      if (!groupMap.has(gName)) {
        groupMap.set(gName, {
          namaJenis: gName,
          rows: [],
          subtotalSldNilai: 0,
          subtotalNilaiI: 0,
          subtotalNilaiO: 0,
          subtotalAkhirNilai: 0,
        });
      }

      const grp = groupMap.get(gName)!;
      grp.rows.push({
        ItemID: String(r.ItemID || "").trim(),
        NamaJenis: gName,
        ItemName: String(r.ItemName || "").trim(),
        SldZak: sldZak,
        SldKg: sldKg,
        SldNilai: sldNilai,
        ZakI: zakI,
        KgI: kgI,
        NilaiI: nilaiI,
        ZakO: zakO,
        KgO: kgO,
        NilaiO: nilaiO,
        AkhirZak: akhirZak,
        AkhirKg: akhirKg,
        AkhirNilai: akhirNilai,
        hppavg,
      });

      grp.subtotalSldNilai += sldNilai;
      grp.subtotalNilaiI += nilaiI;
      grp.subtotalNilaiO += nilaiO;
      grp.subtotalAkhirNilai += akhirNilai;

      grandTotalSldNilai += sldNilai;
      grandTotalNilaiI += nilaiI;
      grandTotalNilaiO += nilaiO;
      grandTotalAkhirNilai += akhirNilai;
      totalItems++;
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => a.namaJenis.localeCompare(b.namaJenis));

    return {
      periodeR,
      tgl1,
      tgl2,
      groups,
      totalItems,
      grandTotalSldNilai,
      grandTotalNilaiI,
      grandTotalNilaiO,
      grandTotalAkhirNilai,
    };
  } catch (err: any) {
    log.error({ err, params }, "Gagal mengeksekusi SP rpHPPMutasiStockBrg2");
    throw new Error(`Gagal memuat Mutasi Stock HPP: ${err?.message || err}`);
  }
}

// ==========================================
// EXCEL GENERATION
// ==========================================

const MONTH_NAMES = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
];

function getPeriodTitle(year: string, month: string): string {
  const mIdx = parseInt(month, 10) - 1;
  const mName = MONTH_NAMES[mIdx] || month;
  return `PERIODE : ${mName} ${year}`;
}

/**
 * Menghasilkan file Excel (.xlsx) untuk Laporan HPP
 */
export async function generateHPPExcel(
  reportType: 'rekap' | 'cogm' | 'kartu-stock' | 'mutasi-stock' | 'ytd' | 'harga' | 'kalkulasi' | 'all',
  params: HPPFilterParams
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  const year = params.year || String(new Date().getFullYear());
  const month = (params.month || String(new Date().getMonth() + 1)).padStart(2, "0");

  if (reportType === 'rekap' || reportType === 'all') {
    const data = await getHPPData(params);
    const aoa: any[][] = [];

    aoa.push(["PT CITI PLUMB"]);
    aoa.push(["LAPORAN HARGA POKOK PRODUKSI (HPP)"]);
    aoa.push([getPeriodTitle(data.year, data.month)]);
    aoa.push([]);

    aoa.push(["KODE GROUP", "KODE AKUN", "KETERANGAN / NAMA AKUN", "JUMLAH (RP)"]);

    for (const grp of data.groups) {
      aoa.push([grp.groupName, null, null, null]);
      for (const it of grp.items) {
        aoa.push([null, it.acc, it.remark, it.totalrp]);
      }
      aoa.push([null, null, `SUBTOTAL ${grp.groupName}`, grp.subtotalRp]);
      aoa.push([]);
    }

    aoa.push(["GRAND TOTAL HARGA POKOK PRODUKSI", null, null, data.grandTotalHPP]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 45 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, "Rekap HPP");
  }

  if (reportType === 'cogm' || reportType === 'all') {
    const data = await getHPPCOGMData(params);
    const aoa: any[][] = [];

    aoa.push(["PT CITI PLUMB"]);
    aoa.push(["RINCIAN BIAYA PRODUKSI / COGM PER ITEM TRANSAKSI"]);
    aoa.push([getPeriodTitle(data.year, data.month)]);
    aoa.push([]);

    aoa.push(["NO. TRANSAKSI", "KODE AKUN", "NAMA AKUN", "POS", "ITEM ID", "NAMA BARANG", "QTY", "BERAT", "NILAI (RP)"]);

    for (const r of data.rows) {
      aoa.push([r.TransID, r.Acc, r.AccName, r.Pos, r.itemID, r.itemname, r.qty, r.berat, r.itval]);
    }

    aoa.push([]);
    aoa.push(["TOTAL", null, null, null, null, null, data.totalQty, null, data.totalNilai]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 35 }, { wch: 6 },
      { wch: 18 }, { wch: 35 }, { wch: 12 }, { wch: 10 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Rincian COGM");
  }

  if (reportType === 'ytd' || reportType === 'all') {
    const data = await getHPPYTDData(params);
    const aoa: any[][] = [];

    aoa.push(["PT CITI PLUMB"]);
    aoa.push(["LAPORAN HARGA POKOK PRODUKSI KUMULATIF (YEAR TO DATE / YTD)"]);
    aoa.push([`KUMULATIF S/D ${getPeriodTitle(data.year, data.month)}`]);
    aoa.push([]);

    aoa.push(["KODE GROUP", "KODE AKUN", "KETERANGAN / NAMA AKUN", "JUMLAH (RP)"]);

    for (const grp of data.groups) {
      aoa.push([grp.groupName, null, null, null]);
      for (const it of grp.items) {
        aoa.push([null, it.acc, it.remark, it.totalrp]);
      }
      aoa.push([null, null, `SUBTOTAL ${grp.groupName}`, grp.subtotalRp]);
      aoa.push([]);
    }

    aoa.push(["GRAND TOTAL HPP YTD", null, null, data.grandTotalHPP]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 45 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, "Rekap YTD");
  }

  if (reportType === 'harga' || reportType === 'all') {
    const list = await getHargaHPPData({ item: params.item });
    const aoa: any[][] = [];

    aoa.push(["PT CITI PLUMB"]);
    aoa.push(["DAFTAR TARIF / HARGA POKOK BARANG (rpHargaHPP)"]);
    aoa.push([]);

    aoa.push(["ITEM ID", "NAMA BARANG", "TARIF HPP (RP)", "PERIODE"]);

    for (const r of list) {
      aoa.push([r.ItemID, r.ItemName, r.Price, r.Periode]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Tarif HPP Barang");
  }

  if (reportType === 'kalkulasi' || reportType === 'all') {
    const list = await getHasilKalkulasiHPPData({});
    const aoa: any[][] = [];

    aoa.push(["PT CITI PLUMB"]);
    aoa.push(["HASIL KALKULASI HARGA POKOK PRODUKSI (rpHasilKalkulasiHPP)"]);
    aoa.push([]);

    aoa.push(["ITEM ID", "NAMA BARANG", "DEFAULT HARGA", "HARGA KALKULASI (RP)"]);

    for (const r of list) {
      aoa.push([r.ItemID, r.ItemName, r.DefaultHarga ? "YA" : "TIDAK", r.Price]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 16 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, "Kalkulasi HPP");
  }

  // 6. Kartu Stock dengan HPP (rpHPPKartuStockBrgL)
  if (reportType === 'kartu-stock' || reportType === 'all') {
    const data = await getHPPKartuStockData(params);
    const aoa: any[][] = [];

    aoa.push(["PT CITI PLUMB"]);
    aoa.push(["KARTU STOCK DENGAN HARGA POKOK (rpHPPKartuStockBrgL)"]);
    aoa.push([`PERIODE : ${data.tgl1} s/d ${data.tgl2}`]);
    aoa.push([]);

    for (const it of data.items) {
      aoa.push([`ITEM : ${it.itemId} — ${it.itemName}`]);
      aoa.push([
        "Tanggal", "Kegiatan", "No. Bukti", "Tipe", "Gudang",
        "Masuk (Pack)", "Masuk (Qty)", "Masuk (Rp)", "Harga/Kg Masuk",
        "Keluar (Pack)", "Keluar (Qty)", "Keluar (Rp)", "Harga/Kg Keluar",
        "Saldo (Qty)", "Saldo (Rp)", "HPP Rata-rata/Kg"
      ]);

      for (const m of it.movements) {
        aoa.push([
          m.movedate || "-", m.kegiatan, m.transno, m.transtype, m.locname,
          m.zakI, m.kgI, m.NilaiI, m.HargaI,
          m.zako, m.kgO, m.NilaiO, m.hargaO,
          m.saldoKg, m.saldoNilai, m.saldoHargaAvg
        ]);
      }

      aoa.push([
        "TOTAL / SALDO AKHIR", null, null, null, null,
        null, it.totalMasukKg, it.totalMasukNilai, null,
        null, it.totalKeluarKg, it.totalKeluarNilai, null,
        it.saldoAkhirKg, it.saldoAkhirNilai, it.saldoAkhirHargaAvg
      ]);
      aoa.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 18 },
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 15 },
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 15 },
      { wch: 14 }, { wch: 18 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Kartu Stock HPP");
  }

  // 7. Mutasi Stock dengan HPP (Persis template lap-hpp/rphppkartustockbrgmutasi.xls & rphppkartustockbrgmutasi2.xls)
  if (reportType === 'mutasi-stock' || reportType === 'all') {
    const data = await getHPPMutasiStockData(params);
    const aoa: any[][] = [];

    aoa.push(["MUTASI STOCK DENGAN HARGA POKOK"]);
    aoa.push([]);
    aoa.push([]);
    aoa.push([`PERIODE  :  ${data.tgl1} s/d ${data.tgl2}`]);
    aoa.push([]);

    for (const grp of data.groups) {
      aoa.push([grp.namaJenis]);
      aoa.push([]);
      aoa.push([null, "Item Name", null, "Saldo awal", null, null, "In", null, null, "Out", null, null, "Saldo Akhir"]);
      aoa.push(["Item ID", null, "Pack", "Qty", "Nilai", "Pack", "Qty", "Nilai", "Pack", "Qty", "Nilai", "Pack", "Qty", "Nilai"]);

      for (const r of grp.rows) {
        aoa.push([
          r.ItemID, r.ItemName,
          r.SldZak, r.SldKg, r.SldNilai,
          r.ZakI, r.KgI, r.NilaiI,
          r.ZakO, r.KgO, r.NilaiO,
          r.AkhirZak, r.AkhirKg, r.AkhirNilai
        ]);
      }

      aoa.push([
        `SUBTOTAL ${grp.namaJenis}`, null,
        null, null, grp.subtotalSldNilai,
        null, null, grp.subtotalNilaiI,
        null, null, grp.subtotalNilaiO,
        null, null, grp.subtotalAkhirNilai
      ]);
      aoa.push([]);
    }

    aoa.push([
      "GRAND TOTAL", null,
      null, null, data.grandTotalSldNilai,
      null, null, data.grandTotalNilaiI,
      null, null, data.grandTotalNilaiO,
      null, null, data.grandTotalAkhirNilai
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 18 }, { wch: 38 },
      { wch: 10 }, { wch: 12 }, { wch: 16 },
      { wch: 10 }, { wch: 12 }, { wch: 16 },
      { wch: 10 }, { wch: 12 }, { wch: 16 },
      { wch: 10 }, { wch: 12 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Mutasi Stock HPP");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
