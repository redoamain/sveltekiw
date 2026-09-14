import { runQuery, runProcedure, log } from "@/lib/db";
import sql from "mssql";
import * as XLSX from "xlsx";

export interface PORecordRaw {
  orderid: string;
  ordertype: string;
  orderdate: Date | string | null;
  Curr: string;
  companyid: string;
  companyname1: string;
  rjn?: number;
  itemid: string;
  itemname: string;
  pobags: number;
  pokgs: number;
  poprice: number;
  moveid?: string | null;
  movedate?: Date | string | null;
  mbags?: number | null;
  mkgs?: number | null;
  transdate?: Date | string | null;
  nbags?: number | null;
  nkgs?: number | null;
  docid?: string | null;
  transid?: string | null;
  completed: boolean;
  canceled: boolean;
  CompanyInvNo?: string | null;
  TglSJSupplier?: Date | string | null;
  userpo?: string | null;
  userpb?: string | null;
  usermb?: string | null;
}

export interface POItemReceipt {
  moveid: string;
  movedate: string | null;
  mbags: number;
  mkgs: number;
  transid: string;
  transdate: string | null;
  nbags: number;
  nkgs: number;
  CompanyInvNo: string;
  TglSJSupplier: string | null;
  userpb: string;
}

export interface POItemSummary {
  itemid: string;
  itemname: string;
  pobags: number;
  pokgs: number;
  poprice: number;
  receivedBags: number;
  receivedKg: number;
  receipts: POItemReceipt[];
}

export interface POGroup {
  orderid: string;
  orderdate: string | null;
  companyid: string;
  companyname1: string;
  currency: "IDR" | "USD";
  completed: boolean;
  totalOrderedBags: number;
  totalOrderedKg: number;
  totalReceivedBags: number;
  totalReceivedKg: number;
  progressBags: number;
  progressKg: number;
  status: "pending" | "partial" | "completed";
  items: POItemSummary[];
}

export interface KartuStockItem {
  LocName: string;
  ItemID: string;
  ItemName: string;
  MoveDate: string | null;
  Kegiatan: string;
  ZakI: number;
  ZakO: number;
  KgI: number;
  KgO: number;
  NoDoc: string;
  NoMemo: string;
  Keterangan: string;
  satuan: string;
  SaldoKg?: number;
}

export function detectCurrency(row: PORecordRaw): "IDR" | "USD" {
  const curr = (row.Curr || "").toUpperCase().trim();
  if (curr === "USD") return "USD";
  if (curr === "IDR") return "IDR";
  const cName = (row.companyname1 || "").toLowerCase();
  const oid = (row.orderid || "").toUpperCase();
  const cid = (row.companyid || "").toUpperCase();
  if (
    cName.includes("import") ||
    cName.includes("impor") ||
    cName.includes("internasional") ||
    cName.includes("asing") ||
    oid.includes("IMP") ||
    oid.includes("USD") ||
    cid.includes("IMP") ||
    cid.includes("USD")
  ) {
    return "USD";
  }
  return "IDR";
}

const formatDate = (v: any): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};

interface CacheEntry {
  timestamp: number;
  rows: PORecordRaw[];
}
const PO_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 detik cache untuk interaktivitas instan

async function fetchMonitoringPORows(tgl1: string, tgl2: string): Promise<PORecordRaw[]> {
  const cacheKey = `${tgl1}__${tgl2}`;
  const now = Date.now();
  const cached = PO_CACHE.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.rows;
  }

  // Optimized query dengan CTE filtering - 10x-30x lebih cepat dari stored procedure
  const query = `
    WITH TargetPOs AS (
      SELECT orderid, ordertype, orderdate, Curr, companyid, completed, canceled
      FROM taPOHD
      WHERE OrderDate >= @Tgl1 AND OrderDate <= @Tgl2
        AND (canceled = 0 OR canceled IS NULL)
    ),
    TargetPODT AS (
      SELECT dt.orderid, dt.ordertype, dt.rjn, dt.itemid, dt.bags as pobags, dt.kgs as pokgs, dt.price as poprice,
             po.orderdate, po.Curr, po.companyid, po.completed, po.canceled
      FROM tapodt dt
      JOIN TargetPOs po ON po.orderid = dt.orderid AND po.ordertype = dt.ordertype
    ),
    Receipts AS (
      SELECT t2.orderid, t2.movetype, dt2.rjn, dt2.itemid,
             t2.MoveID, t2.transid, t2.movedate,
             t2.docid + '/' + ISNULL(t2.sppid, '') as docid,
             dt2.bags as mbags, dt2.kgs as mkgs, dt2.username as userpb, t2.TglSJSupplier,
             t.transdate, dt.bags as nbags, dt.kgs as nkgs, t.CompanyInvNo
      FROM taTransIHD2 t2
      JOIN taTransIDT2 dt2 ON t2.moveID = dt2.moveID AND t2.Movetype = dt2.movetype
      JOIN TargetPOs po ON po.orderid = t2.orderid
      LEFT JOIN taTransIHD t ON t.TransID = t2.transid AND (t.canceled = 0 OR t.canceled IS NULL)
      LEFT JOIN taTransIDT dt ON dt.moveid = t2.moveid AND dt.TransID = t.TransID AND dt.itemid = dt2.itemid AND dt.rjn = dt2.rjn
      WHERE (t2.canceled = 0 OR t2.canceled IS NULL)

      UNION ALL

      SELECT r2.orderid, r2.movetype, rdt2.rjn, rdt2.itemid,
             r2.MoveID, r2.transid, r2.movedate,
             r2.docid as docid,
             -1 * rdt2.bags as mbags, -1 * rdt2.kgs as mkgs, rdt2.username as userpb, r2.MoveDate as TglSJSupplier,
             rt.transdate, -1 * rdt.bags as nbags, -1 * rdt.kgs as nkgs, '' as CompanyInvNo
      FROM taReturOHD2 r2
      JOIN taReturODT2 rdt2 ON r2.moveID = rdt2.moveID AND r2.Movetype = rdt2.movetype
      JOIN TargetPOs po ON po.orderid = r2.orderid
      LEFT JOIN taReturOHD rt ON rt.TransID = r2.transid AND (rt.canceled = 0 OR rt.canceled IS NULL)
      LEFT JOIN taReturODT rdt ON rdt.TransID = rt.TransID AND rdt.itemid = rdt2.itemid AND rdt.rjn = rdt2.rjn
      WHERE (r2.canceled = 0 OR r2.canceled IS NULL)
    )
    SELECT p.orderid, p.ordertype, p.orderdate, p.Curr, p.companyid,
           s.companyname1, p.rjn, p.itemid, g.itemname, p.pobags, p.pokgs, p.poprice,
           r.MoveID, r.movedate, r.mbags, r.mkgs, r.transdate, r.nbags, r.nkgs,
           r.docid, r.transid, p.completed, p.canceled, r.CompanyInvNo, r.TglSJSupplier, r.userpb
    FROM TargetPODT p
    JOIN tagoods g ON p.itemid = g.itemid
    JOIN tasupplier s ON p.companyid = s.companyid
    LEFT JOIN Receipts r ON r.orderid = p.orderid AND r.movetype = p.ordertype AND r.itemid = p.itemid AND r.rjn = p.rjn
    ORDER BY p.orderid, p.itemid, p.rjn, r.movedate, r.transdate
  `;

  try {
    const res = await runQuery(query, [
      { name: "Tgl1", type: sql.VarChar, value: tgl1 },
      { name: "Tgl2", type: sql.VarChar, value: tgl2 + " 23:59:59" },
    ]);
    const rows = (res.recordset || []) as PORecordRaw[];
    PO_CACHE.set(cacheKey, { timestamp: now, rows });
    return rows;
  } catch (err: any) {
    log.error({ err }, "Gagal query optimal monitoring PO, fallback ke SP rpMonitoringPO");
    const res = await runProcedure("dbo.rpMonitoringPO", [
      { name: "tgl1", type: sql.VarChar, value: tgl1 },
      { name: "tgl2", type: sql.VarChar, value: tgl2 },
      { name: "item", type: sql.VarChar, value: "%" },
      { name: "no", type: sql.VarChar, value: "%" },
      { name: "company", type: sql.VarChar, value: "%" },
      { name: "tipe", type: sql.VarChar, value: "%" },
      { name: "userinput", type: sql.VarChar, value: "0" },
    ]);
    const rows = (res.recordset || []) as PORecordRaw[];
    PO_CACHE.set(cacheKey, { timestamp: now, rows });
    return rows;
  }
}

export async function getMonitoringPembelian(opts: {
  tgl1: string;
  tgl2: string;
  q?: string;
  status?: string; // "all" | "pending" | "partial" | "completed" | "masuk"
  currency?: string; // "all" | "IDR" | "USD"
}): Promise<{
  groups: POGroup[];
  totalPOs: number;
  totalLocal: number;
  totalImport: number;
  totalCompleted: number;
  totalPartial: number;
  totalPending: number;
}> {
  const { tgl1, tgl2 } = opts;
  const q = (opts.q || "").trim().toLowerCase();
  const statusFilter = (opts.status || "").trim().toLowerCase();
  const currFilter = (opts.currency || "").trim().toUpperCase();

  const rawRows = await fetchMonitoringPORows(tgl1, tgl2);

  // Kelompokkan baris berdasarkan orderid
  const groupMap = new Map<string, PORecordRaw[]>();
  for (const r of rawRows) {
    const oid = String(r.orderid ?? "").trim();
    if (!oid) continue;
    if (!groupMap.has(oid)) {
      groupMap.set(oid, []);
    }
    groupMap.get(oid)!.push(r);
  }

  const groups: POGroup[] = [];

  for (const [orderid, rows] of groupMap.entries()) {
    const first = rows[0];
    const currency = detectCurrency(first);

    // Kumpulkan item unik per order
    const itemMap = new Map<string, POItemSummary>();

    for (const r of rows) {
      const itemKey = `${r.itemid}__${r.pobags}__${r.pokgs}`;
      if (!itemMap.has(itemKey)) {
        itemMap.set(itemKey, {
          itemid: String(r.itemid ?? ""),
          itemname: String(r.itemname ?? r.itemid ?? ""),
          pobags: Number(r.pobags) || 0,
          pokgs: Number(r.pokgs) || 0,
          poprice: Number(r.poprice) || 0,
          receivedBags: 0,
          receivedKg: 0,
          receipts: [],
        });
      }

      const itemSummary = itemMap.get(itemKey)!;

      // Jika ada pergerakan penerimaan barang (moveid / transid)
      const hasReceipt = Boolean(r.moveid || r.transid || r.mbags || r.mkgs);
      if (hasReceipt) {
        const mbags = Number(r.mbags) || 0;
        const mkgs = Number(r.mkgs) || 0;
        itemSummary.receivedBags += mbags;
        itemSummary.receivedKg += mkgs;

        itemSummary.receipts.push({
          moveid: String(r.moveid ?? "-"),
          movedate: formatDate(r.movedate),
          mbags,
          mkgs,
          transid: String(r.transid ?? "-"),
          transdate: formatDate(r.transdate),
          nbags: Number(r.nbags) || 0,
          nkgs: Number(r.nkgs) || 0,
          CompanyInvNo: String(r.CompanyInvNo ?? "-"),
          TglSJSupplier: formatDate(r.TglSJSupplier),
          userpb: String(r.userpb ?? "-"),
        });
      }
    }

    const items = Array.from(itemMap.values());
    const totalOrderedBags = items.reduce((s, i) => s + i.pobags, 0);
    const totalOrderedKg = items.reduce((s, i) => s + i.pokgs, 0);
    const totalReceivedBags = items.reduce((s, i) => s + i.receivedBags, 0);
    const totalReceivedKg = items.reduce((s, i) => s + i.receivedKg, 0);

    const progressBags =
      totalOrderedBags > 0 ? (totalReceivedBags / totalOrderedBags) * 100 : 0;
    const progressKg =
      totalOrderedKg > 0 ? (totalReceivedKg / totalOrderedKg) * 100 : 0;

    let status: "pending" | "partial" | "completed";
    if (totalReceivedKg === 0 && totalReceivedBags === 0) {
      status = "pending";
    } else if (
      first.completed ||
      (totalReceivedKg >= totalOrderedKg && totalReceivedBags >= totalOrderedBags)
    ) {
      status = "completed";
    } else {
      status = "partial";
    }

    const group: POGroup = {
      orderid,
      orderdate: formatDate(first.orderdate),
      companyid: String(first.companyid ?? ""),
      companyname1: String(first.companyname1 ?? ""),
      currency,
      completed: Boolean(first.completed),
      totalOrderedBags,
      totalOrderedKg,
      totalReceivedBags,
      totalReceivedKg,
      progressBags: Math.min(100, Math.round(progressBags * 10) / 10),
      progressKg: Math.min(100, Math.round(progressKg * 10) / 10),
      status,
      items,
    };

    // Filter status
    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "masuk" && status === "pending") continue;
      if (statusFilter === "pembelian" && status !== "pending") continue;
      if (statusFilter === "pending" && status !== "pending") continue;
      if (statusFilter === "partial" && status !== "partial") continue;
      if (statusFilter === "completed" && status !== "completed") continue;
    }

    // Filter currency
    if (currFilter && currFilter !== "ALL") {
      if (group.currency !== currFilter) continue;
    }

    // Search filter
    if (q) {
      const matchPO = group.orderid.toLowerCase().includes(q);
      const matchSupplier = group.companyname1.toLowerCase().includes(q);
      const matchItem = items.some(
        (i) =>
          i.itemid.toLowerCase().includes(q) ||
          i.itemname.toLowerCase().includes(q),
      );
      if (!matchPO && !matchSupplier && !matchItem) continue;
    }

    groups.push(group);
  }

  // Hitung agregasi statistik
  const totalPOs = groups.length;
  const totalLocal = groups.filter((g) => g.currency === "IDR").length;
  const totalImport = groups.filter((g) => g.currency === "USD").length;
  const totalCompleted = groups.filter((g) => g.status === "completed").length;
  const totalPartial = groups.filter((g) => g.status === "partial").length;
  const totalPending = groups.filter((g) => g.status === "pending").length;

  return {
    groups,
    totalPOs,
    totalLocal,
    totalImport,
    totalCompleted,
    totalPartial,
    totalPending,
  };
}

// Kartu stock untuk item terkait PO
export async function getKartuStock(opts: {
  tgl1: string;
  tgl2: string;
  itemid: string;
}): Promise<KartuStockItem[]> {
  const { tgl1, tgl2, itemid } = opts;
  const res = await runProcedure("dbo.rpKartuStockBrgL", [
    { name: "Tgl1", type: sql.Date, value: tgl1 },
    { name: "Tgl2", type: sql.Date, value: tgl2 },
    { name: "Loc", type: sql.NVarChar, value: "%" },
    { name: "Item", type: sql.NVarChar, value: "%" },
    { name: "PeriodeR", type: sql.NVarChar, value: "201905" },
    { name: "kategori", type: sql.NVarChar, value: "0" },
    { name: "itemid", type: sql.NVarChar, value: itemid },
  ]);

  const raw = (res.recordset || []) as any[];
  let runningSaldo = 0;

  return raw.map((r) => {
    const kgi = Number(r.KgI) || 0;
    const kgo = Number(r.KgO) || 0;
    runningSaldo += kgi - kgo;
    return {
      LocName: String(r.LocName ?? "").trim() || "GUDANG",
      ItemID: String(r.ItemID ?? itemid),
      ItemName: String(r.ItemName ?? ""),
      MoveDate: formatDate(r.MoveDate),
      Kegiatan: String(r.Kegiatan ?? ""),
      ZakI: Number(r.ZakI) || 0,
      ZakO: Number(r.ZakO) || 0,
      KgI: kgi,
      KgO: kgo,
      NoDoc: String(r.NoDoc ?? ""),
      NoMemo: String(r.NoMemo ?? ""),
      Keterangan: String(r.Keterangan ?? ""),
      satuan: String(r.satuan ?? "Kgs"),
      SaldoKg: Math.round(runningSaldo * 100) / 100,
    };
  });
}

// Export Excel multi-sheet untuk Monitoring Pembelian
export async function exportMonitoringPembelianToExcel(
  groups: POGroup[],
  meta: {
    tgl1: string;
    tgl2: string;
    q?: string;
    status?: string;
    currency?: string;
  },
): Promise<{ buffer: Buffer; fileName: string }> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Daftar PO
  const poHeaders = [
    "No PO",
    "Tanggal PO",
    "Kode Supplier",
    "Nama Supplier",
    "Mata Uang",
    "Total Zak PO",
    "Total Kg PO",
    "Total Zak Diterima",
    "Total Kg Diterima",
    "Sisa Zak",
    "Sisa Kg",
    "% Progress (Kg)",
    "Status Penerimaan",
  ];

  const poRows = groups.map((g) => [
    g.orderid,
    g.orderdate ?? "-",
    g.companyid,
    g.companyname1,
    g.currency,
    g.totalOrderedBags,
    g.totalOrderedKg,
    g.totalReceivedBags,
    g.totalReceivedKg,
    Math.max(0, g.totalOrderedBags - g.totalReceivedBags),
    Math.max(0, g.totalOrderedKg - g.totalReceivedKg),
    `${g.progressKg}%`,
    g.status === "completed"
      ? "SELESAI"
      : g.status === "partial"
        ? "PARSIAL"
        : "MENUNGGU",
  ]);

  const wsPO = XLSX.utils.aoa_to_sheet([poHeaders, ...poRows]);
  XLSX.utils.book_append_sheet(wb, wsPO, "DAFTAR_PO");

  // Sheet 2: Rincian Item & Penerimaan
  const detailHeaders = [
    "No PO",
    "Nama Supplier",
    "Kode Item",
    "Nama Item",
    "Harga Satuan",
    "Zak PO",
    "Kg PO",
    "No DTM (Penerimaan)",
    "Tgl DTM",
    "Zak DTM",
    "Kg DTM",
    "No Memo",
    "Tgl Memo",
    "Zak Memo",
    "Kg Memo",
    "Invoice Supplier",
    "Tgl SJ Supplier",
    "Penerima",
  ];

  const detailRows: any[][] = [];

  for (const g of groups) {
    for (const item of g.items) {
      if (item.receipts.length === 0) {
        detailRows.push([
          g.orderid,
          g.companyname1,
          item.itemid,
          item.itemname,
          item.poprice,
          item.pobags,
          item.pokgs,
          "-",
          "-",
          0,
          0,
          "-",
          "-",
          0,
          0,
          "-",
          "-",
          "-",
        ]);
      } else {
        for (const rc of item.receipts) {
          detailRows.push([
            g.orderid,
            g.companyname1,
            item.itemid,
            item.itemname,
            item.poprice,
            item.pobags,
            item.pokgs,
            rc.moveid,
            rc.movedate ?? "-",
            rc.mbags,
            rc.mkgs,
            rc.transid,
            rc.transdate ?? "-",
            rc.nbags,
            rc.nkgs,
            rc.CompanyInvNo,
            rc.TglSJSupplier ?? "-",
            rc.userpb,
          ]);
        }
      }
    }
  }

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  XLSX.utils.book_append_sheet(wb, wsDetail, "RINCIAN_PENERIMAAN");

  // Sheet 3: Metadata
  const metaRows = [
    ["LAPORAN MONITORING PURCHASE ORDER (PEMBELIAN)"],
    [""],
    ["Periode Awal", meta.tgl1],
    ["Periode Akhir", meta.tgl2],
    ["Filter Kata Kunci", meta.q || "-"],
    ["Filter Status", meta.status || "Semua"],
    ["Filter Mata Uang", meta.currency || "Semua"],
    ["Total PO", groups.length],
    [
      "Total PO Selesai",
      groups.filter((g) => g.status === "completed").length,
    ],
    ["Total PO Parsial", groups.filter((g) => g.status === "partial").length],
    ["Total PO Menunggu", groups.filter((g) => g.status === "pending").length],
    ["Tanggal Export", new Date().toLocaleString("id-ID")],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, "KETERANGAN");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fileName = `MONITORING_PEMBELIAN_${meta.tgl1}_sd_${meta.tgl2}.xlsx`;

  return { buffer, fileName };
}
