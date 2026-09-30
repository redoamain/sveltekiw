import { runQuery, log } from "@/lib/db";
import sql from "mssql";
import * as XLSX from "xlsx";

export interface LaporanProduksiFilters {
  dept?: string;
  q?: string;
  tgl1?: string;
  tgl2?: string;
  status?: "all" | "completed" | "ongoing";
  page?: number;
  pageSize?: number;
}

export interface SpkSummaryRow {
  orderId: string;
  orderType: string;
  orderDate: string | null;
  planDate: string | null;
  deptId: string;
  deptName: string;
  targetItemId: string;
  targetItemName: string | null;
  targetSatuan: string | null;
  targetQty: number;
  spkRemark: string | null;
  isCompleted: boolean;
  totalBuktiProduksi: number;
  firstProdDate: string | null;
  lastProdDate: string | null;
  totalBahanKgs: number;
  totalBahanBags: number;
  totalHasilKgs: number;
  totalHasilBags: number;
  completionPct: number;
  yieldPct: number;
}

export interface LaporanProduksiSummaryMetrics {
  totalSpk: number;
  totalTargetQty: number;
  totalHasilKgs: number;
  totalHasilBags: number;
  totalBahanKgs: number;
  totalBahanBags: number;
  avgCompletionPct: number;
}

export interface LaporanProduksiResult {
  metrics: LaporanProduksiSummaryMetrics;
  rows: SpkSummaryRow[];
  total: number;
  page: number;
  pageSize: number;
  departemenOptions: Array<{ value: string; label: string }>;
}

export interface SpkItemDetail {
  itemId: string;
  itemName: string | null;
  satuan: string | null;
  totalBags: number;
  totalKgs: number;
  buktiCount: number;
}

export interface SpkBuktiDetail {
  prodId: string;
  prodType: string;
  prodDate: string | null;
  shift: number | null;
  deptId: string | null;
  locId: string | null;
  locName: string | null;
  remark: string | null;
  notes: string | null;
  userName: string | null;
  userDateTime: string | null;
  totalBahanKgs: number;
  totalHasilKgs: number;
}

export interface SpkDetailData {
  orderId: string;
  orderType: string;
  orderDate: string | null;
  planDate: string | null;
  deptId: string;
  deptName: string;
  targetItemId: string;
  targetItemName: string | null;
  targetSatuan: string | null;
  targetQty: number;
  spkRemark: string | null;
  isCompleted: boolean;
  bahan: SpkItemDetail[];
  hasil: SpkItemDetail[];
  bukti: SpkBuktiDetail[];
  totalBahanKgs: number;
  totalBahanBags: number;
  totalHasilKgs: number;
  totalHasilBags: number;
  completionPct: number;
  yieldPct: number;
}

export const DEPARTEMEN_PRODUKSI_OPTIONS = [
  { value: "", label: "Semua Departemen" },
  { value: "AS", label: "AS — ASSEMBLY" },
  { value: "IN", label: "IN — INJEKSI" },
  { value: "PL", label: "PL — PLATING" },
  { value: "SP", label: "SP — SPRAY" },
  { value: "MO", label: "MO — MOULDING" },
] as const;

function buildFilterConditions(filters: LaporanProduksiFilters): {
  whereClauses: string[];
  inputs: Array<{ name: string; type: any; value: any }>;
} {
  const whereClauses: string[] = [];
  const inputs: Array<{ name: string; type: any; value: any }> = [];

  // Filter Departemen
  const dept = (filters.dept ?? "").trim().toUpperCase();
  if (dept && ["AS", "IN", "PL", "SP", "MO"].includes(dept)) {
    whereClauses.push("(o.PRDeptID = @Dept OR hd.ProdType = @Dept)");
    inputs.push({ name: "Dept", type: sql.VarChar(2), value: dept });
  }

  // Filter Status SPK
  if (filters.status === "completed") {
    whereClauses.push("o.Completed = 1");
  } else if (filters.status === "ongoing") {
    whereClauses.push("(o.Completed = 0 OR o.Completed IS NULL)");
  }

  // Filter Tanggal Produksi / SPK
  const hasDateRange = Boolean(filters.tgl1 && filters.tgl2);
  if (hasDateRange) {
    whereClauses.push("hd.ProdDate >= @Tgl1 AND hd.ProdDate <= @Tgl2");
    inputs.push({ name: "Tgl1", type: sql.VarChar, value: `${filters.tgl1!} 00:00:00` });
    inputs.push({ name: "Tgl2", type: sql.VarChar, value: `${filters.tgl2!} 23:59:59` });
  } else if (filters.tgl1) {
    whereClauses.push("hd.ProdDate >= @Tgl1");
    inputs.push({ name: "Tgl1", type: sql.VarChar, value: `${filters.tgl1!} 00:00:00` });
  } else if (filters.tgl2) {
    whereClauses.push("hd.ProdDate <= @Tgl2");
    inputs.push({ name: "Tgl2", type: sql.VarChar, value: `${filters.tgl2!} 23:59:59` });
  }

  // Filter Keyword Pencarian
  const keyword = (filters.q ?? "").trim();
  if (keyword) {
    whereClauses.push(`(
      o.OrderID LIKE @Keyword 
      OR o.ItemID LIKE @Keyword 
      OR g.ItemName LIKE @Keyword 
      OR o.Remark LIKE @Keyword 
      OR d.PRDeptName LIKE @Keyword
    )`);
    inputs.push({
      name: "Keyword",
      type: sql.NVarChar as unknown as sql.ISqlType,
      value: `%${keyword}%`,
    });
  }

  return { whereClauses, inputs };
}

/**
 * Mengambil Laporan Produksi Teragregasi Berdasarkan SPK dengan metrik Bahan dan Hasil
 */
export async function getLaporanProduksiSPK(
  filters: LaporanProduksiFilters = {}
): Promise<LaporanProduksiResult> {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.max(10, Math.min(500, Number(filters.pageSize) || 25));
  const offset = (page - 1) * pageSize;

  const { whereClauses, inputs } = buildFilterConditions(filters);
  const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  // 1. Ambil summary metrik keseluruhan yang sesuai filter (tanpa limit pagination)
  const metricsQuery = `
    WITH FilteredSpk AS (
      SELECT 
        o.OrderID,
        ISNULL(o.Kgs, 0) AS TargetQty,
        ISNULL(SUM(CASE WHEN dt.ItemType = 'B' THEN dt.Kgs ELSE 0 END), 0) AS TotalBahanKgs,
        ISNULL(SUM(CASE WHEN dt.ItemType = 'B' THEN dt.Bags ELSE 0 END), 0) AS TotalBahanBags,
        ISNULL(SUM(CASE WHEN dt.ItemType = 'H' THEN dt.Kgs ELSE 0 END), 0) AS TotalHasilKgs,
        ISNULL(SUM(CASE WHEN dt.ItemType = 'H' THEN dt.Bags ELSE 0 END), 0) AS TotalHasilBags
      FROM taPROrder o
      LEFT JOIN taDeptPROrder d ON o.PRDeptID = d.PRDeptID
      LEFT JOIN taGoods g ON o.ItemID = g.ItemID
      INNER JOIN taPRProdHd hd ON o.OrderID = hd.OrderID
      INNER JOIN taPRProdDt dt ON hd.ProdID = dt.ProdID AND hd.ProdType = dt.ProdType
      ${whereSql}
      GROUP BY o.OrderID, o.Kgs
    )
    SELECT 
      COUNT(*) AS totalSpk,
      ISNULL(SUM(TargetQty), 0) AS totalTargetQty,
      ISNULL(SUM(TotalHasilKgs), 0) AS totalHasilKgs,
      ISNULL(SUM(TotalHasilBags), 0) AS totalHasilBags,
      ISNULL(SUM(TotalBahanKgs), 0) AS totalBahanKgs,
      ISNULL(SUM(TotalBahanBags), 0) AS totalBahanBags
    FROM FilteredSpk
  `;

  // 2. Ambil data baris SPK dengan pagination
  const dataQuery = `
    SELECT 
      o.OrderID,
      o.OrderType,
      o.OrderDate,
      o.PlanDate,
      ISNULL(o.PRDeptID, hd.ProdType) AS DeptID,
      ISNULL(d.PRDeptName, ISNULL(o.PRDeptID, hd.ProdType)) AS DeptName,
      o.ItemID AS TargetItemID,
      g.ItemName AS TargetItemName,
      g.SatuanKecil AS TargetSatuan,
      ISNULL(o.Kgs, 0) AS TargetQty,
      o.Remark AS SpkRemark,
      ISNULL(o.Completed, 0) AS IsCompleted,
      COUNT(DISTINCT hd.ProdID) AS TotalBuktiProduksi,
      MIN(hd.ProdDate) AS FirstProdDate,
      MAX(hd.ProdDate) AS LastProdDate,
      ISNULL(SUM(CASE WHEN dt.ItemType = 'B' THEN dt.Kgs ELSE 0 END), 0) AS TotalBahanKgs,
      ISNULL(SUM(CASE WHEN dt.ItemType = 'B' THEN dt.Bags ELSE 0 END), 0) AS TotalBahanBags,
      ISNULL(SUM(CASE WHEN dt.ItemType = 'H' THEN dt.Kgs ELSE 0 END), 0) AS TotalHasilKgs,
      ISNULL(SUM(CASE WHEN dt.ItemType = 'H' THEN dt.Bags ELSE 0 END), 0) AS TotalHasilBags
    FROM taPROrder o
    LEFT JOIN taDeptPROrder d ON o.PRDeptID = d.PRDeptID
    LEFT JOIN taGoods g ON o.ItemID = g.ItemID
    INNER JOIN taPRProdHd hd ON o.OrderID = hd.OrderID
    INNER JOIN taPRProdDt dt ON hd.ProdID = dt.ProdID AND hd.ProdType = dt.ProdType
    ${whereSql}
    GROUP BY 
      o.OrderID, o.OrderType, o.OrderDate, o.PlanDate, 
      o.PRDeptID, hd.ProdType, d.PRDeptName, o.ItemID, g.ItemName, g.SatuanKecil,
      o.Kgs, o.Remark, o.Completed
    ORDER BY MAX(hd.ProdDate) DESC, o.OrderID DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY
  `;

  const queryInputs = [
    ...inputs,
    { name: "Offset", type: sql.Int, value: offset },
    { name: "PageSize", type: sql.Int, value: pageSize },
  ];

  try {
    const [metricsRes, dataRes] = await Promise.all([
      runQuery(metricsQuery, inputs),
      runQuery(dataQuery, queryInputs),
    ]);

    const m = metricsRes.recordset[0] || {};
    const totalSpk = Number(m.totalSpk) || 0;
    const totalTargetQty = Number(m.totalTargetQty) || 0;
    const totalHasilKgs = Number(m.totalHasilKgs) || 0;
    const totalHasilBags = Number(m.totalHasilBags) || 0;
    const totalBahanKgs = Number(m.totalBahanKgs) || 0;
    const totalBahanBags = Number(m.totalBahanBags) || 0;

    const avgCompletionPct =
      totalTargetQty > 0 ? Math.min(999, Math.round((totalHasilKgs / totalTargetQty) * 1000) / 10) : 0;

    const metrics: LaporanProduksiSummaryMetrics = {
      totalSpk,
      totalTargetQty,
      totalHasilKgs,
      totalHasilBags,
      totalBahanKgs,
      totalBahanBags,
      avgCompletionPct,
    };

    const rows: SpkSummaryRow[] = dataRes.recordset.map((r: any) => {
      const targetQty = Number(r.TargetQty) || 0;
      const bKgs = Number(r.TotalBahanKgs) || 0;
      const bBags = Number(r.TotalBahanBags) || 0;
      const hKgs = Number(r.TotalHasilKgs) || 0;
      const hBags = Number(r.TotalHasilBags) || 0;

      const completionPct =
        targetQty > 0 ? Math.round((hKgs / targetQty) * 1000) / 10 : 0;
      const yieldPct =
        bKgs > 0 ? Math.round((hKgs / bKgs) * 1000) / 10 : 0;

      return {
        orderId: String(r.OrderID ?? "").trim(),
        orderType: String(r.OrderType ?? "OI").trim(),
        orderDate: r.OrderDate ? new Date(r.OrderDate).toISOString().slice(0, 10) : null,
        planDate: r.PlanDate ? new Date(r.PlanDate).toISOString().slice(0, 10) : null,
        deptId: String(r.DeptID ?? "").trim(),
        deptName: String(r.DeptName ?? r.DeptID ?? "").trim(),
        targetItemId: String(r.TargetItemID ?? "").trim(),
        targetItemName: r.TargetItemName ? String(r.TargetItemName).trim() : null,
        targetSatuan: r.TargetSatuan ? String(r.TargetSatuan).trim() : "PCS",
        targetQty,
        spkRemark: r.SpkRemark ? String(r.SpkRemark).trim() : null,
        isCompleted: Boolean(r.IsCompleted),
        totalBuktiProduksi: Number(r.TotalBuktiProduksi) || 0,
        firstProdDate: r.FirstProdDate ? new Date(r.FirstProdDate).toISOString().slice(0, 10) : null,
        lastProdDate: r.LastProdDate ? new Date(r.LastProdDate).toISOString().slice(0, 10) : null,
        totalBahanKgs: bKgs,
        totalBahanBags: bBags,
        totalHasilKgs: hKgs,
        totalHasilBags: hBags,
        completionPct,
        yieldPct,
      };
    });

    return {
      metrics,
      rows,
      total: totalSpk,
      page,
      pageSize,
      departemenOptions: [...DEPARTEMEN_PRODUKSI_OPTIONS],
    };
  } catch (err: any) {
    log.error({ err, filters }, "Gagal mengambil data laporan produksi SPK");
    throw new Error(`Gagal memuat laporan produksi SPK: ${err?.message || err}`);
  }
}

/**
 * Mengambil Rincian Lengkap Bahan, Hasil, dan Bukti Transaksi untuk 1 SPK Tertentu
 */
export async function getDetailProduksiSPK(orderId: string): Promise<SpkDetailData | null> {
  const cleanOrderId = orderId.trim();
  if (!cleanOrderId) return null;

  try {
    // 1. Header SPK
    const spkRes = await runQuery(
      `SELECT TOP 1
        o.OrderID,
        o.OrderType,
        o.OrderDate,
        o.PlanDate,
        o.PRDeptID AS DeptID,
        d.PRDeptName AS DeptName,
        o.ItemID AS TargetItemID,
        g.ItemName AS TargetItemName,
        g.SatuanKecil AS TargetSatuan,
        ISNULL(o.Kgs, 0) AS TargetQty,
        o.Remark AS SpkRemark,
        ISNULL(o.Completed, 0) AS IsCompleted
      FROM taPROrder o
      LEFT JOIN taDeptPROrder d ON o.PRDeptID = d.PRDeptID
      LEFT JOIN taGoods g ON o.ItemID = g.ItemID
      WHERE o.OrderID = @OrderID`,
      [{ name: "OrderID", type: sql.VarChar(25), value: cleanOrderId }]
    );

    if (!spkRes.recordset || spkRes.recordset.length === 0) {
      return null;
    }
    const o = spkRes.recordset[0];

    // 2. Rincian Bahan (B)
    const bahanRes = await runQuery(
      `SELECT 
        dt.ItemID,
        g.ItemName,
        g.SatuanKecil AS Satuan,
        ISNULL(SUM(dt.Bags), 0) AS TotalBags,
        ISNULL(SUM(dt.Kgs), 0) AS TotalKgs,
        COUNT(DISTINCT hd.ProdID) AS BuktiCount
      FROM taPRProdHd hd
      INNER JOIN taPRProdDt dt ON hd.ProdID = dt.ProdID AND hd.ProdType = dt.ProdType
      LEFT JOIN taGoods g ON dt.ItemID = g.ItemID
      WHERE hd.OrderID = @OrderID AND dt.ItemType = 'B'
      GROUP BY dt.ItemID, g.ItemName, g.SatuanKecil
      ORDER BY TotalKgs DESC, dt.ItemID ASC`,
      [{ name: "OrderID", type: sql.VarChar(25), value: cleanOrderId }]
    );

    // 3. Rincian Hasil (H)
    const hasilRes = await runQuery(
      `SELECT 
        dt.ItemID,
        g.ItemName,
        g.SatuanKecil AS Satuan,
        ISNULL(SUM(dt.Bags), 0) AS TotalBags,
        ISNULL(SUM(dt.Kgs), 0) AS TotalKgs,
        COUNT(DISTINCT hd.ProdID) AS BuktiCount
      FROM taPRProdHd hd
      INNER JOIN taPRProdDt dt ON hd.ProdID = dt.ProdID AND hd.ProdType = dt.ProdType
      LEFT JOIN taGoods g ON dt.ItemID = g.ItemID
      WHERE hd.OrderID = @OrderID AND dt.ItemType = 'H'
      GROUP BY dt.ItemID, g.ItemName, g.SatuanKecil
      ORDER BY TotalKgs DESC, dt.ItemID ASC`,
      [{ name: "OrderID", type: sql.VarChar(25), value: cleanOrderId }]
    );

    // 4. Daftar Bukti Transaksi Produksi (taPRProdHd)
    const buktiRes = await runQuery(
      `SELECT 
        hd.ProdID,
        hd.ProdType,
        hd.ProdDate,
        hd.Shift,
        hd.DeptID,
        hd.LocID,
        l.LocName,
        hd.Remark,
        hd.Notes,
        dtSummary.UserName,
        dtSummary.MaxUserDateTime AS UserDateTime,
        ISNULL(dtSummary.TotalBahanKgs, 0) AS TotalBahanKgs,
        ISNULL(dtSummary.TotalHasilKgs, 0) AS TotalHasilKgs
      FROM taPRProdHd hd
      LEFT JOIN taLocation l ON hd.LocID = l.LocID
      CROSS APPLY (
        SELECT 
          MAX(dt.UserName) AS UserName,
          MAX(dt.UserDateTime) AS MaxUserDateTime,
          SUM(CASE WHEN dt.ItemType = 'B' THEN dt.Kgs ELSE 0 END) AS TotalBahanKgs,
          SUM(CASE WHEN dt.ItemType = 'H' THEN dt.Kgs ELSE 0 END) AS TotalHasilKgs
        FROM taPRProdDt dt
        WHERE dt.ProdID = hd.ProdID AND dt.ProdType = hd.ProdType
      ) dtSummary
      WHERE hd.OrderID = @OrderID
      ORDER BY hd.ProdDate DESC, hd.ProdID DESC`,
      [{ name: "OrderID", type: sql.VarChar(25), value: cleanOrderId }]
    );

    const bahan: SpkItemDetail[] = bahanRes.recordset.map((b: any) => ({
      itemId: String(b.ItemID ?? "").trim(),
      itemName: b.ItemName ? String(b.ItemName).trim() : null,
      satuan: b.Satuan ? String(b.Satuan).trim() : "PCS",
      totalBags: Number(b.TotalBags) || 0,
      totalKgs: Number(b.TotalKgs) || 0,
      buktiCount: Number(b.BuktiCount) || 0,
    }));

    const hasil: SpkItemDetail[] = hasilRes.recordset.map((h: any) => ({
      itemId: String(h.ItemID ?? "").trim(),
      itemName: h.ItemName ? String(h.ItemName).trim() : null,
      satuan: h.Satuan ? String(h.Satuan).trim() : "PCS",
      totalBags: Number(h.TotalBags) || 0,
      totalKgs: Number(h.TotalKgs) || 0,
      buktiCount: Number(h.BuktiCount) || 0,
    }));

    const bukti: SpkBuktiDetail[] = buktiRes.recordset.map((k: any) => ({
      prodId: String(k.ProdID ?? "").trim(),
      prodType: String(k.ProdType ?? "").trim(),
      prodDate: k.ProdDate ? new Date(k.ProdDate).toISOString().slice(0, 10) : null,
      shift: k.Shift != null ? Number(k.Shift) : null,
      deptId: k.DeptID ? String(k.DeptID).trim() : null,
      locId: k.LocID ? String(k.LocID).trim() : null,
      locName: k.LocName ? String(k.LocName).trim() : null,
      remark: k.Remark ? String(k.Remark).trim() : null,
      notes: k.Notes ? String(k.Notes).trim() : null,
      userName: k.UserName ? String(k.UserName).trim() : null,
      userDateTime: k.UserDateTime ? new Date(k.UserDateTime).toLocaleString("id-ID") : null,
      totalBahanKgs: Number(k.TotalBahanKgs) || 0,
      totalHasilKgs: Number(k.TotalHasilKgs) || 0,
    }));

    const targetQty = Number(o.TargetQty) || 0;
    const totalBahanKgs = bahan.reduce((acc, curr) => acc + curr.totalKgs, 0);
    const totalBahanBags = bahan.reduce((acc, curr) => acc + curr.totalBags, 0);
    const totalHasilKgs = hasil.reduce((acc, curr) => acc + curr.totalKgs, 0);
    const totalHasilBags = hasil.reduce((acc, curr) => acc + curr.totalBags, 0);

    const completionPct =
      targetQty > 0 ? Math.round((totalHasilKgs / targetQty) * 1000) / 10 : 0;
    const yieldPct =
      totalBahanKgs > 0 ? Math.round((totalHasilKgs / totalBahanKgs) * 1000) / 10 : 0;

    return {
      orderId: String(o.OrderID ?? "").trim(),
      orderType: String(o.OrderType ?? "OI").trim(),
      orderDate: o.OrderDate ? new Date(o.OrderDate).toISOString().slice(0, 10) : null,
      planDate: o.PlanDate ? new Date(o.PlanDate).toISOString().slice(0, 10) : null,
      deptId: String(o.DeptID ?? "").trim(),
      deptName: String(o.DeptName ?? o.DeptID ?? "").trim(),
      targetItemId: String(o.TargetItemID ?? "").trim(),
      targetItemName: o.TargetItemName ? String(o.TargetItemName).trim() : null,
      targetSatuan: o.TargetSatuan ? String(o.TargetSatuan).trim() : "PCS",
      targetQty,
      spkRemark: o.SpkRemark ? String(o.SpkRemark).trim() : null,
      isCompleted: Boolean(o.IsCompleted),
      bahan,
      hasil,
      bukti,
      totalBahanKgs,
      totalBahanBags,
      totalHasilKgs,
      totalHasilBags,
      completionPct,
      yieldPct,
    };
  } catch (err: any) {
    log.error({ err, orderId }, "Gagal mengambil rincian detail SPK produksi");
    throw new Error(`Gagal memuat detail SPK '${orderId}': ${err?.message || err}`);
  }
}

/**
 * Menghasilkan File Excel (.xlsx) dengan 3 Sheet:
 * 1. RINGKASAN_SPK
 * 2. RINCIAN_BAHAN
 * 3. RINCIAN_HASIL
 */
export async function generateLaporanProduksiExcel(
  filters: LaporanProduksiFilters = {}
): Promise<Buffer> {
  const { whereClauses, inputs } = buildFilterConditions(filters);
  const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  // 1. Ringkasan SPK
  const spkQuery = `
    SELECT 
      o.OrderID AS [No SPK],
      CONVERT(varchar(10), o.OrderDate, 120) AS [Tgl SPK],
      CONVERT(varchar(10), o.PlanDate, 120) AS [Tgl Rencana],
      ISNULL(d.PRDeptName, o.PRDeptID) AS [Departemen],
      o.ItemID AS [Kode Target Item],
      g.ItemName AS [Nama Target Item],
      ISNULL(o.Kgs, 0) AS [Target Qty],
      g.SatuanKecil AS [Satuan],
      COUNT(DISTINCT hd.ProdID) AS [Jumlah Bukti],
      CONVERT(varchar(10), MIN(hd.ProdDate), 120) AS [Tgl Mulai Prod],
      CONVERT(varchar(10), MAX(hd.ProdDate), 120) AS [Tgl Akhir Prod],
      ISNULL(SUM(CASE WHEN dt.ItemType = 'B' THEN dt.Kgs ELSE 0 END), 0) AS [Total Bahan (Kg)],
      ISNULL(SUM(CASE WHEN dt.ItemType = 'B' THEN dt.Bags ELSE 0 END), 0) AS [Total Bahan (Bags)],
      ISNULL(SUM(CASE WHEN dt.ItemType = 'H' THEN dt.Kgs ELSE 0 END), 0) AS [Total Hasil (Kg)],
      ISNULL(SUM(CASE WHEN dt.ItemType = 'H' THEN dt.Bags ELSE 0 END), 0) AS [Total Hasil (Bags)],
      CASE 
        WHEN ISNULL(o.Kgs, 0) > 0 THEN ROUND((SUM(CASE WHEN dt.ItemType = 'H' THEN dt.Kgs ELSE 0 END) / o.Kgs) * 100, 2)
        ELSE 0 
      END AS [% Capai SPK],
      CASE 
        WHEN SUM(CASE WHEN dt.ItemType = 'B' THEN dt.Kgs ELSE 0 END) > 0 
          THEN ROUND((SUM(CASE WHEN dt.ItemType = 'H' THEN dt.Kgs ELSE 0 END) / SUM(CASE WHEN dt.ItemType = 'B' THEN dt.Kgs ELSE 0 END)) * 100, 2)
        ELSE 0 
      END AS [Rasio Hasil/Bahan (%)],
      CASE WHEN o.Completed = 1 THEN 'SELESAI' ELSE 'BERJALAN' END AS [Status SPK],
      o.Remark AS [Remark SPK]
    FROM taPROrder o
    LEFT JOIN taDeptPROrder d ON o.PRDeptID = d.PRDeptID
    LEFT JOIN taGoods g ON o.ItemID = g.ItemID
    INNER JOIN taPRProdHd hd ON o.OrderID = hd.OrderID
    INNER JOIN taPRProdDt dt ON hd.ProdID = dt.ProdID AND hd.ProdType = dt.ProdType
    ${whereSql}
    GROUP BY 
      o.OrderID, o.OrderDate, o.PlanDate, o.PRDeptID, d.PRDeptName,
      o.ItemID, g.ItemName, g.SatuanKecil, o.Kgs, o.Completed, o.Remark
    ORDER BY MAX(hd.ProdDate) DESC, o.OrderID DESC
  `;

  // 2. Rincian Bahan yang Terpakai
  const bahanQuery = `
    SELECT 
      hd.OrderID AS [No SPK],
      hd.ProdID AS [No Bukti Prod],
      CONVERT(varchar(10), hd.ProdDate, 120) AS [Tgl Produksi],
      hd.DeptID AS [Departemen],
      dt.ItemID AS [Kode Bahan],
      bg.ItemName AS [Nama Bahan],
      dt.Bags AS [Bags],
      dt.Kgs AS [Qty Bahan (Kg)],
      bg.SatuanKecil AS [Satuan],
      dt.Batch AS [No Batch],
      dt.UserName AS [Operator],
      dt.Keterangan AS [Keterangan]
    FROM taPRProdHd hd
    INNER JOIN taPRProdDt dt ON hd.ProdID = dt.ProdID AND hd.ProdType = dt.ProdType
    INNER JOIN taPROrder o ON hd.OrderID = o.OrderID
    LEFT JOIN taDeptPROrder d ON o.PRDeptID = d.PRDeptID
    LEFT JOIN taGoods g ON o.ItemID = g.ItemID
    LEFT JOIN taGoods bg ON dt.ItemID = bg.ItemID
    ${whereSql ? whereSql + " AND dt.ItemType = 'B'" : "WHERE dt.ItemType = 'B'"}
    ORDER BY hd.OrderID ASC, hd.ProdDate DESC, dt.ItemID ASC
  `;

  // 3. Rincian Hasil yang Diproduksi
  const hasilQuery = `
    SELECT 
      hd.OrderID AS [No SPK],
      hd.ProdID AS [No Bukti Prod],
      CONVERT(varchar(10), hd.ProdDate, 120) AS [Tgl Produksi],
      hd.DeptID AS [Departemen],
      dt.ItemID AS [Kode Hasil],
      hg.ItemName AS [Nama Hasil],
      dt.Bags AS [Bags],
      dt.Kgs AS [Qty Hasil (Kg/Pcs)],
      hg.SatuanKecil AS [Satuan],
      dt.Batch AS [No Batch],
      dt.UserName AS [Operator],
      dt.Keterangan AS [Keterangan]
    FROM taPRProdHd hd
    INNER JOIN taPRProdDt dt ON hd.ProdID = dt.ProdID AND hd.ProdType = dt.ProdType
    INNER JOIN taPROrder o ON hd.OrderID = o.OrderID
    LEFT JOIN taDeptPROrder d ON o.PRDeptID = d.PRDeptID
    LEFT JOIN taGoods g ON o.ItemID = g.ItemID
    LEFT JOIN taGoods hg ON dt.ItemID = hg.ItemID
    ${whereSql ? whereSql + " AND dt.ItemType = 'H'" : "WHERE dt.ItemType = 'H'"}
    ORDER BY hd.OrderID ASC, hd.ProdDate DESC, dt.ItemID ASC
  `;

  const [spkRes, bahanRes, hasilRes] = await Promise.all([
    runQuery(spkQuery, inputs),
    runQuery(bahanQuery, inputs),
    runQuery(hasilQuery, inputs),
  ]);

  const wb = XLSX.utils.book_new();

  // Sheet 1: RINGKASAN SPK
  const wsSpk = XLSX.utils.json_to_sheet(spkRes.recordset);
  XLSX.utils.book_append_sheet(wb, wsSpk, "RINGKASAN_SPK");

  // Sheet 2: DETAIL BAHAN
  const wsBahan = XLSX.utils.json_to_sheet(bahanRes.recordset);
  XLSX.utils.book_append_sheet(wb, wsBahan, "DETAIL_BAHAN");

  // Sheet 3: DETAIL HASIL
  const wsHasil = XLSX.utils.json_to_sheet(hasilRes.recordset);
  XLSX.utils.book_append_sheet(wb, wsHasil, "DETAIL_HASIL");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
