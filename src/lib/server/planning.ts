// =====================================================================
// SERVICE LAPISAN SERVER — dipakai bersama oleh halaman Astro (SSR)
// dan API endpoints. Semua akses MSSQL konsentrasi di sini.
// =====================================================================
import sql from "mssql";
import { runQuery, runProcedure, withTransaction, log } from "@/lib/db";
import { BoundedCache } from "@/lib/cache";
import {
  aggregateByKodeBarang,
  buildPlan,
  buildTreeStructure,
  groupOrdersBySpk,
  isINJECTIONDepartment,
  normalizeItemId,
  type PlanMaterialRow,
  type PlanSummary,
  type SpkGroup,
} from "@/lib/domain/material";
import type {
  BomItem,
  BomOverride,
  CalculationRecord,
  CommittedPO,
  ProductionOrder,
  SaveCalculationPayload,
  StockReservation,
  StockRow,
} from "@/lib/types";

// ---------- helper tanggal ----------
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const todayISO = () => isoDate(new Date());
export const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
};

// =====================================================================
// ORDERS — SPK aktif dari taPROrder (OrderID 'AS%', belum completed)
// =====================================================================
interface OrderRowDb {
  No_SPK: string;
  Tanggal_Order: Date;
  Nama_PO: string;
  Kode_Barang: string;
  QTY: number;
}

export async function getActiveOrders(
  startDate?: string,
  endDate?: string,
  q?: string,
): Promise<ProductionOrder[]> {
  let query = `
      SELECT TOP (10000)
        hd.[OrderID] AS No_SPK,
        hd.[OrderDate] AS Tanggal_Order,
        hd.[Remark] AS Nama_PO,
        dt.[itemID] AS Kode_Barang,
        dt.[Kgs] AS QTY
      FROM [cp].[dbo].[taPROrder] AS hd
      INNER JOIN [cp].[dbo].[taPROrderDt] AS dt
        ON hd.[OrderID] = dt.[OrderID]
        AND hd.[OrderType] = dt.[OrderType]
      WHERE hd.[Completed] = '0' AND hd.[OrderID] LIKE 'AS%'
    `;
  const inputs: Parameters<typeof runQuery>[1] = [];

  if (startDate && endDate) {
    query += `
        AND hd.[OrderDate] >= @StartDate
        AND hd.[OrderDate] <= @EndDate
      `;
    inputs.push(
      { name: "StartDate", type: sql.VarChar, value: `${startDate} 00:00:00` },
      { name: "EndDate", type: sql.VarChar, value: `${endDate} 23:59:59` },
    );
  }

  const qq = (q ?? "").trim();
  if (qq) {
    query += ` AND (hd.[OrderID] LIKE @q OR hd.[Remark] LIKE @q OR dt.[itemID] LIKE @q)`;
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${qq}%` });
  }

  query += ` ORDER BY hd.[OrderDate] DESC`;

  const result = await runQuery(query, inputs);
  return (result.recordset as OrderRowDb[]).map((record) => ({
    ...record,
    QTY: Number(record.QTY) || 0,
    Tanggal_Order: record.Tanggal_Order ? isoDate(new Date(record.Tanggal_Order)) : undefined,
  }));
}

export interface PagedOrdersResult {
  rows: ProductionOrder[];
  total: number;
  totalQty: number;
}

/** Versi terpaginasi untuk ditampilkan di tabel. Dipakai PPIC. */
export async function getActiveOrdersPaged(
  startDate: string | undefined,
  endDate: string | undefined,
  page: number,
  pageSize: number,
  q?: string,
): Promise<PagedOrdersResult> {
  const offset = Math.max(0, (Math.max(1, page) - 1) * Math.max(1, pageSize));
  const limit = Math.max(1, pageSize);

  let where = `WHERE hd.[Completed] = '0' AND hd.[OrderID] LIKE 'AS%'`;
  const inputs: Parameters<typeof runQuery>[1] = [];

  if (startDate && endDate) {
    where += ` AND hd.[OrderDate] >= @StartDate AND hd.[OrderDate] <= @EndDate`;
    inputs.push(
      { name: "StartDate", type: sql.VarChar, value: `${startDate} 00:00:00` },
      { name: "EndDate", type: sql.VarChar, value: `${endDate} 23:59:59` },
    );
  }

  const qq = (q ?? "").trim();
  if (qq) {
    where += ` AND (hd.[OrderID] LIKE @q OR hd.[Remark] LIKE @q OR dt.[itemID] LIKE @q)`;
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${qq}%` });
  }

  // Hitung berbasis DISTINCT SPK + total qty seluruh rentang filter
  const countQuery = `
    SELECT COUNT(DISTINCT hd.[OrderID]) AS tot, COALESCE(SUM(dt.[Kgs]), 0) AS sumQty
    FROM [cp].[dbo].[taPROrder] hd
    INNER JOIN [cp].[dbo].[taPROrderDt] dt ON hd.[OrderID]=dt.[OrderID] AND hd.[OrderType]=dt.[OrderType]
    ${where}`;

  // 1) Ambil daftar OrderID yang masuk halaman ini (distinct SPK, urut tgl terbaru)
  const idsFromClause = qq
    ? `FROM [cp].[dbo].[taPROrder] hd INNER JOIN [cp].[dbo].[taPROrderDt] dt ON hd.[OrderID]=dt.[OrderID] AND hd.[OrderType]=dt.[OrderType]`
    : `FROM [cp].[dbo].[taPROrder] hd`;

  const idsQuery = `
    SELECT hd.[OrderID] AS id
    ${idsFromClause}
    ${where}
    GROUP BY hd.[OrderID], hd.[OrderDate]
    ORDER BY hd.[OrderDate] DESC
    OFFSET @Off ROWS FETCH NEXT @Lim ROWS ONLY`;

  const [countRes, idsRes] = await Promise.all([
    runQuery(countQuery, [...inputs]),
    runQuery(idsQuery, [
      ...inputs,
      { name: "Off", type: sql.Int, value: offset },
      { name: "Lim", type: sql.Int, value: limit },
    ]),
  ]);

  const total = Number(countRes.recordset[0]?.tot) || 0; // jumlah SPK distinct
  const totalQty = Number(countRes.recordset[0]?.sumQty) || 0;
  if (total === 0) return { rows: [], total: 0, totalQty: 0 };

  const pageIds: string[] = (idsRes.recordset as { id: string }[]).map((r) => r.id);
  if (pageIds.length === 0) return { rows: [], total, totalQty };

  // 2) Ambil detail hanya untuk SPK di halaman ini (chunk IN-list agar aman)
  const detailRows: OrderRowDb[] = [];
  const CHUNK = 400;
  for (let i = 0; i < pageIds.length; i += CHUNK) {
    const chunk = pageIds.slice(i, i + CHUNK);
    const ph = chunk.map((_, j) => `@pid${j}`).join(", ");
    const chunkInputs = chunk.map((id, j) => ({
      name: `pid${j}`,
      type: sql.VarChar(50) as unknown as sql.ISqlType,
      value: id,
    }));
    const chunkQ = `
      SELECT hd.[OrderID] AS No_SPK, hd.[OrderDate] AS Tanggal_Order, hd.[Remark] AS Nama_PO, dt.[itemID] AS Kode_Barang, dt.[Kgs] AS QTY
      FROM [cp].[dbo].[taPROrder] hd
      INNER JOIN [cp].[dbo].[taPROrderDt] dt ON hd.[OrderID]=dt.[OrderID] AND hd.[OrderType]=dt.[OrderType]
      WHERE hd.[OrderID] IN (${ph})
      ORDER BY hd.[OrderDate] DESC, hd.[OrderID]`;
    const chunkRes = await runQuery(chunkQ, chunkInputs);
    detailRows.push(...(chunkRes.recordset as OrderRowDb[]));
  }
  const rows = detailRows.map((r) => ({
    ...r,
    QTY: Number(r.QTY) || 0,
    Tanggal_Order: r.Tanggal_Order ? isoDate(new Date(r.Tanggal_Order)) : undefined,
  }));
  // Pastikan urut sesuai idsQuery (ORDER BY tgl DESC) — sudah OK karena chunkQ pakai ORDER BY sama
  return { rows, total, totalQty };
}

// =====================================================================
// MONITORING PO / SO — store procedure existing
// =====================================================================
export interface MonitorBaseParams {
  tgl1: Date;
  tgl2: Date;
  no?: string;
  item?: string;
  company?: string;
  tipe?: string;
}

export async function getMonitoringPO(
  p: MonitorBaseParams & { userinput?: number },
): Promise<Record<string, unknown>[]> {
  const result = await runProcedure("dbo.rpMonitoringPO", [
    { name: "No", type: sql.VarChar(7), value: p.no ?? "%" },
    { name: "Tgl1", type: sql.DateTime, value: p.tgl1 },
    { name: "Tgl2", type: sql.DateTime, value: p.tgl2 },
    { name: "Item", type: sql.VarChar(14), value: p.item ?? "%" },
    { name: "Company", type: sql.VarChar(8), value: p.company ?? "%" },
    { name: "Tipe", type: sql.VarChar(1), value: p.tipe ?? "%" },
    { name: "userinput", type: sql.Int, value: p.userinput ?? 0 },
  ]);
  return result.recordset;
}

export async function getMonitoringSO(
  p: MonitorBaseParams & { kredit?: number; jenisTOP?: number },
): Promise<Record<string, unknown>[]> {
  const result = await runProcedure("dbo.rpMonitoringSO", [
    { name: "No", type: sql.VarChar(7), value: p.no ?? "%" },
    { name: "Tgl1", type: sql.DateTime, value: p.tgl1 },
    { name: "Tgl2", type: sql.DateTime, value: p.tgl2 },
    { name: "Item", type: sql.VarChar(14), value: p.item ?? "%" },
    { name: "Company", type: sql.VarChar(8), value: p.company ?? "%" },
    { name: "Tipe", type: sql.VarChar(1), value: p.tipe ?? "%" },
    { name: "kredit", type: sql.Int, value: p.kredit ?? 0 },
    { name: "jenisTOP", type: sql.Int, value: p.jenisTOP ?? 0 },
  ]);
  return result.recordset;
}

// =====================================================================
// STOK — dbo.rpStokPPIC2 (+ cache kecil per item)
// =====================================================================
export interface StockParams {
  itemid?: string;
  tgl1?: Date;
  tgl2?: Date;
  loc?: string;
  periodeR?: string;
  kategori?: string;
}

export async function getStockRows(p: StockParams): Promise<StockRow[]> {
  const tgl1 = p.tgl1 ?? new Date();
  const tgl2 = p.tgl2 ?? new Date();

  const result = await runProcedure("dbo.rpStokPPIC2", [
    { name: "Tgl1", type: sql.DateTime, value: tgl1 },
    { name: "Tgl2", type: sql.DateTime, value: tgl2 },
    { name: "Loc", type: sql.VarChar(6), value: p.loc ?? "%" },
    { name: "PeriodeR", type: sql.VarChar(6), value: p.periodeR ?? "201905" },
    { name: "kategori", type: sql.VarChar(20), value: p.kategori ?? "%" },
    { name: "itemid", type: sql.VarChar(50), value: p.itemid ?? "%" },
  ]);

  return (result.recordset as StockRow[]).map((item) => ({
    KodeBarang: item.KodeBarang,
    NamaBarang: item.NamaBarang || item.KodeBarang,
    // Clamp ke ≥ 0 mengikuti kiw (fetchStockForItem pakai Math.max(0, ...)):
    // SaldoAkhir bisa negatif dari sistem stok, tapi tidak ditampilkan minus.
    SaldoAkhir: Math.max(0, Number(item.SaldoAkhir) || 0),
    SaldoAkhirFisik: Math.max(0, Number(item.SaldoAkhirFisik) || 0),
    TotalCommitted: Math.max(0, Number(item.TotalCommitted) || 0),
    TotalReserved: Math.max(0, Number(item.TotalReserved) || 0),
  }));
}

// Cache stok date-aware: SaldoAkhir rpStokPPIC2 bergantung tanggal (Tgl1/Tgl2).
// Kunci `${tanggal}|${itemid}` — stok diambil AS-OF tanggal yang diminta,
// mengikuti kiw (per Tanggal_Order SPK), bukan hanya hari ini.
const stockCache = new BoundedCache<StockRow | null>({
  ttlMs: 60_000,
  maxEntries: 4000,
});

async function getStockForItem(itemId: string, asOfDate?: string): Promise<StockRow | null> {
  const date = asOfDate ?? todayISO();
  const key = `${date}|${itemId.trim().toUpperCase()}`;
  if (!itemId.trim().toUpperCase()) return null;
  const cached = stockCache.get(key);
  if (cached !== undefined) return cached;
  // Batas waktu mengikuti kiw: `new Date("yyyy-mm-dd")` = UTC tengah malam.
  // (memakai "T00:00:00" = jam lokal → saldo bisa beda untuk item yang
  //  bergerak mendekati pergantian hari).
  const tgl = new Date(date);
  const rows = await getStockRows({ itemid: itemId, tgl1: tgl, tgl2: tgl });
  const row = rows[0] ?? null;
  stockCache.set(key, row);
  return row;
}

// Stok paralel per BATCH dengan tanggal yang sama (AS-OF tanggal order).
export async function getStockBatch(
  itemIds: string[],
  concurrency = 8,
  asOfDate?: string,
): Promise<Map<string, StockRow>> {
  const unique = Array.from(new Set(itemIds.map((i) => i.trim().toUpperCase()))).filter(Boolean);
  const map = new Map<string, StockRow>();
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const rows = await Promise.all(batch.map((id) => getStockForItem(id, asOfDate)));
    rows.forEach((row, j) => {
      if (row) map.set(batch[j], row);
    });
  }
  return map;
}

// =====================================================================
// BOM — dbo.rpBOMTree (+ tree + cache server-side)
// =====================================================================
export interface BomResponse {
  flat: BomItem[];
  tree: BomItem[];
}

const bomCache = new BoundedCache<BomResponse>({
  ttlMs: 30 * 60 * 1000,
  maxEntries: 200,
});

export async function getBom(itemId: string): Promise<BomResponse> {
  const cached = bomCache.get(itemId);
  if (cached) return cached;

  const result = await runProcedure("dbo.rpBOMTree", [
    { name: "itemid", type: sql.VarChar(50), value: itemId },
  ]);
  const flat = result.recordset as BomItem[];
  const response: BomResponse = { flat, tree: buildTreeStructure(flat) };

  if (flat.length > 0) bomCache.set(itemId, response);
  return response;
}

export async function getBomBatch(
  kodeBarangs: string[],
  concurrency = 8,
): Promise<Map<string, BomItem[]>> {
  const unique = Array.from(new Set(kodeBarangs.map((k) => k.trim()).filter(Boolean)));
  const map = new Map<string, BomItem[]>();
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (kode) => {
        try {
          return (await getBom(kode)).flat ?? [];
        } catch (err) {
          log.warn({ err, kode }, "Gagal ambil BOM item (di-skip)");
          return [];
        }
      }),
    );
    batch.forEach((kode, j) => map.set(kode, results[j]));
  }
  return map;
}

// =====================================================================
// PLAN — hitung kebutuhan material + penyimpanan sementara antar request
// =====================================================================
export interface AggOrder {
  Kode_Barang: string;
  QTY: number;
}

export interface ComputedPlan {
  rows: PlanMaterialRow[];
  summary: PlanSummary;
  agg: AggOrder[];
  groups: SpkGroup[];
  bomByKodeBarang: Map<string, BomItem[]>;
  stockRows: Map<string, StockRow>;
  reservations: StockReservation[];
}

export async function computePlan(
  orders: ProductionOrder[],
  selectedSpks: string[],
): Promise<ComputedPlan> {
  const spkSet = new Set(selectedSpks);
  const selectedOrders =
    spkSet.size > 0 ? orders.filter((o) => spkSet.has(o.No_SPK)) : orders;
  const groups = groupOrdersBySpk(selectedOrders);
  const agg = aggregateByKodeBarang(groups.flatMap((g) => g.lines));

  // 1. BOM per Kode_Barang (paralel, ter-cache)
  const bomByKodeBarang = await getBomBatch(agg.map((a) => a.Kode_Barang));

  // 2. Stok per komponen diambil AS-OF tanggal order SPK (kiw). Untuk
  //    material yang dipakai banyak SPK ber-tanggal beda, tanggal yang
  //    dipakai = date SPK PERTAMA (dalam urutan order) yang memakainya.
  const stockDateByItem = new Map<string, string>();
  for (const o of selectedOrders) {
    const comps = (bomByKodeBarang.get(o.Kode_Barang) ?? []).filter(
      (b) => Number(b.Level) > 0 && !isINJECTIONDepartment(b.Departemen),
    );
    const asOf = o.Tanggal_Order ?? todayISO();
    for (const c of comps) {
      const id = String(c.ItemID).trim().toUpperCase();
      if (!id) continue;
      if (!stockDateByItem.has(id)) stockDateByItem.set(id, asOf);
    }
  }
  // Grup: tanggal → item
  const itemsByDate = new Map<string, string[]>();
  for (const [id, date] of stockDateByItem) {
    const arr = itemsByDate.get(date) ?? [];
    arr.push(id);
    itemsByDate.set(date, arr);
  }
  const stockRows = new Map<string, StockRow>();
  for (const [date, ids] of itemsByDate) {
    const rows = await getStockBatch(ids, 8, date);
    for (const [id, row] of rows) stockRows.set(id, row);
  }

  // 3. Reservasi stok oleh PO/SPK LAIN (tidak termasuk SPK yang sedang
  //    direncanakan) — folow kiw: dimasukkan ke TotalDibutuhkan.
  let reservations: StockReservation[] = [];
  try {
    reservations = (await getCommitted()).reservations;
  } catch {
    reservations = [];
  }
  const reservationsByItem = new Map<string, number>();
  for (const r of reservations) {
    if (r.status !== "RESERVED" || r.reservedQty <= 0 || !r.noSPK) continue;
    if (spkSet.has(r.noSPK)) continue;
    const id = normalizeItemId(r.itemID);
    if (!id) continue;
    reservationsByItem.set(id, (reservationsByItem.get(id) || 0) + Number(r.reservedQty) || 0);
  }

  // 4. Logika murni (klaim kiw): komponen diakumulasi antar-level,
  //    stok = SaldoAkhirFisik, + QtyReserved PO lain.
  const { rows, summary } = buildPlan(agg, bomByKodeBarang, stockRows, reservationsByItem);

  return { rows, summary, agg, groups, bomByKodeBarang, stockRows, reservations };
}

// Penyimpanan plan antara POST hitung → commit/simpan/export (tanpa hidden JSON besar).
const planStore = new BoundedCache<ComputedPlan>({ ttlMs: 30 * 60 * 1000, maxEntries: 50 });

export function storePlan(plan: ComputedPlan): string {
  const id = `P-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  planStore.set(id, plan);
  return id;
}

export const getStoredPlan = (id: string): ComputedPlan | undefined =>
  id ? planStore.get(id) : undefined;

// =====================================================================
// COMMIT / UNCOMMIT — transaksi reserve/release stok
// =====================================================================
export interface CommitMaterialInput {
  itemId: string;
  itemName: string;
  qtyPerUnit: number;
  totalNeeded: number;
  stockBefore: number;
  stockAfter: number;
  qtyUsed: number;
  departemen?: string | null;
  level: number;
}

export async function commitSPK(params: {
  noSPK: string;
  kodeBarang: string;
  namaPO: string;
  qty: number;
  userID: string;
  materialUsage: CommitMaterialInput[];
}): Promise<number> {
  const { noSPK, kodeBarang, namaPO, qty, userID, materialUsage } = params;

  return withTransaction(async (tx) => {
    const commitResult = await tx
      .request()
      .input("No_SPK", sql.VarChar(50), noSPK)
      .input("KodeBarang", sql.VarChar(500), kodeBarang)
      .input("NamaPO", sql.VarChar(500), namaPO)
      .input("Qty", sql.Decimal(18, 2), qty)
      .input("UserID", sql.VarChar(50), userID).query(`
          INSERT INTO [dbo].[taCommitPO] (No_SPK, KodeBarang, NamaPO, Qty, UserID)
          OUTPUT INSERTED.CommitID
          VALUES (@No_SPK, @KodeBarang, @NamaPO, @Qty, @UserID)
        `);
    const commitID = commitResult.recordset[0].CommitID as number;

    let totalMaterials = 0;
    let totalQtyReserved = 0;
    const txReq = tx.request();
    for (const m of materialUsage) {
      if (m.qtyUsed <= 0) continue;
      await txReq
        .input("CommitID", sql.Int, commitID)
        .input("ItemID", sql.VarChar(50), m.itemId)
        .input("ItemName", sql.VarChar(500), m.itemName)
        .input("QtyPerUnit", sql.Decimal(18, 4), m.qtyPerUnit)
        .input("TotalNeeded", sql.Decimal(18, 2), m.totalNeeded)
        .input("StockBefore", sql.Decimal(18, 2), m.stockBefore)
        .input("StockAfter", sql.Decimal(18, 2), m.stockAfter)
        .input("QtyUsed", sql.Decimal(18, 2), m.qtyUsed)
        .input("Departemen", sql.VarChar(100), m.departemen || null)
        .input("Level", sql.Int, m.level)
        .input("No_SPK", sql.VarChar(50), noSPK).query(`
            INSERT INTO [dbo].[taCommitPODetail]
              (CommitID, ItemID, ItemName, QtyPerUnit, TotalNeeded, StockBefore, StockAfter, QtyUsed, Departemen, Level)
            VALUES
              (@CommitID, @ItemID, @ItemName, @QtyPerUnit, @TotalNeeded, @StockBefore, @StockAfter, @QtyUsed, @Departemen, @Level);
            INSERT INTO [dbo].[taStockReservation]
              (CommitID, ItemID, ItemName, ReservedQty, No_SPK, ExpiryDate)
            VALUES
              (@CommitID, @ItemID, @ItemName, @QtyUsed, @No_SPK, DATEADD(day, 30, GETDATE()));
          `);
      totalMaterials++;
      totalQtyReserved += m.qtyUsed;
    }

    await txReq
      .input("CommitID", sql.Int, commitID)
      .input("No_SPK", sql.VarChar(50), noSPK)
      .input("KodeBarang", sql.VarChar(500), kodeBarang)
      .input("Action", sql.VarChar(50), "COMMIT")
      .input("OldStatus", sql.VarChar(20), null)
      .input("NewStatus", sql.VarChar(20), "COMMITTED")
      .input("UserID", sql.VarChar(50), userID)
      .input(
        "Remarks",
        sql.VarChar(1000),
        `Commit PO dengan ${totalMaterials} material, total reserved: ${totalQtyReserved}`,
      ).query(`
          INSERT INTO [dbo].[taCommitPOHistory]
            (CommitID, No_SPK, KodeBarang, Action, OldStatus, NewStatus, UserID, Remarks)
          VALUES
            (@CommitID, @No_SPK, @KodeBarang, @Action, @OldStatus, @NewStatus, @UserID, @Remarks)
        `);

    invalidateCommittedCache();
    return commitID;
  });
}

export async function uncommitPO(noSPK: string, userID: string): Promise<void> {
  await withTransaction(async (tx) => {
    const commitResult = await tx
      .request()
      .input("No_SPK", sql.VarChar(50), noSPK)
      .input("Status", sql.VarChar(20), "COMMITTED").query(`
          SELECT CommitID, KodeBarang
          FROM [dbo].[taCommitPO]
          WHERE No_SPK = @No_SPK AND Status = @Status
        `);

    if (commitResult.recordset.length === 0) {
      throw new Error("COMMITTED_NOT_FOUND");
    }
    const commitID = commitResult.recordset[0].CommitID as number;
    const kodeBarang = commitResult.recordset[0].KodeBarang as string;

    const stats = await tx
      .request()
      .input("CommitID", sql.Int, commitID).query(`
          SELECT
            (SELECT COUNT(*) FROM [dbo].[taCommitPODetail] WHERE CommitID = @CommitID) AS totalMaterials,
            (SELECT COALESCE(SUM(ReservedQty), 0) FROM [dbo].[taStockReservation] WHERE CommitID = @CommitID AND Status = 'RESERVED') AS totalQtyReserved
        `);
    const totalMaterials = stats.recordset[0]?.totalMaterials ?? 0;
    const totalQtyReserved = stats.recordset[0]?.totalQtyReserved ?? 0;

    await tx
      .request()
      .input("CommitID", sql.Int, commitID)
      .input("OldStatus", sql.VarChar(20), "COMMITTED")
      .input("NewStatus", sql.VarChar(20), "UNCOMMITTED")
      .input("UserID", sql.VarChar(50), userID).query(`
          UPDATE [dbo].[taCommitPO]
          SET Status = @NewStatus, UpdatedAt = GETDATE(), UpdatedBy = @UserID
          WHERE CommitID = @CommitID AND Status = @OldStatus
        `);

    await tx
      .request()
      .input("CommitID", sql.Int, commitID)
      .input("OldStatus", sql.VarChar(20), "RESERVED")
      .input("NewStatus", sql.VarChar(20), "RELEASED").query(`
          UPDATE [dbo].[taStockReservation]
          SET Status = @NewStatus, ReleasedDate = GETDATE()
          WHERE CommitID = @CommitID AND Status = @OldStatus
        `);

    await tx
      .request()
      .input("CommitID", sql.Int, commitID)
      .input("No_SPK", sql.VarChar(50), noSPK)
      .input("KodeBarang", sql.VarChar(500), kodeBarang)
      .input("Action", sql.VarChar(50), "UNCOMMIT")
      .input("OldStatus", sql.VarChar(20), "COMMITTED")
      .input("NewStatus", sql.VarChar(20), "UNCOMMITTED")
      .input("UserID", sql.VarChar(50), userID)
      .input(
        "Remarks",
        sql.VarChar(1000),
        `Uncommit PO: ${totalMaterials} materials released, ${totalQtyReserved} qty freed`,
      ).query(`
          INSERT INTO [dbo].[taCommitPOHistory]
            (CommitID, No_SPK, KodeBarang, Action, OldStatus, NewStatus, UserID, Remarks)
          VALUES
            (@CommitID, @No_SPK, @KodeBarang, @Action, @OldStatus, @NewStatus, @UserID, @Remarks)
        `);
    invalidateCommittedCache();
  });
}

// ---------- Committed POs + reservasi ----------
export interface CommittedData {
  committedPOs: CommittedPO[];
  reservations: StockReservation[];
}

let committedCache: { data: CommittedData; timestamp: number } | null = null;
const COMMITTED_CACHE_TTL = 30_000; // 30s

export function invalidateCommittedCache() {
  committedCache = null;
}

export async function getCommitted(): Promise<CommittedData> {
  const now = Date.now();
  if (committedCache && (now - committedCache.timestamp) < COMMITTED_CACHE_TTL) {
    return committedCache.data;
  }

  const [poResult, resResult] = await Promise.all([
    runQuery(`
      SELECT
        cp.CommitID,
        cp.No_SPK AS noSPK,
        cp.KodeBarang AS kodeBarang,
        cp.NamaPO AS namaPO,
        cp.Qty AS qty,
        cp.TanggalCommit AS tanggalCommit,
        cp.UserID AS userID,
        cp.Status AS status,
        (SELECT COUNT(*) FROM [dbo].[taCommitPODetail] cpd WHERE cpd.CommitID = cp.CommitID) AS totalMaterials,
        (SELECT COALESCE(SUM(sr.ReservedQty), 0) FROM [dbo].[taStockReservation] sr WHERE sr.CommitID = cp.CommitID AND sr.Status = 'RESERVED') AS totalQtyReserved
      FROM [dbo].[taCommitPO] cp
      WHERE cp.Status IN ('COMMITTED', 'UNCOMMITTED')
        AND NOT EXISTS (
          SELECT 1 FROM [cp].[dbo].[taPROrder] o
          WHERE o.OrderID = cp.No_SPK AND (o.Completed = 1 OR o.Completed = '1')
        )
      ORDER BY cp.CreatedAt DESC
    `),
    runQuery(`
      SELECT
        sr.ReservationID AS reservationID,
        sr.CommitID AS commitID,
        sr.ItemID AS itemID,
        sr.ItemName AS itemName,
        sr.ReservedQty AS reservedQty,
        sr.ReservationDate AS reservationDate,
        sr.Status AS status,
        sr.ExpiryDate AS expiryDate,
        sr.No_SPK AS noSPK,
        cp.NamaPO AS namaPO
      FROM [dbo].[taStockReservation] sr
      INNER JOIN [dbo].[taCommitPO] cp ON sr.CommitID = cp.CommitID
      WHERE sr.Status IN ('RESERVED', 'RELEASED')
        AND NOT EXISTS (
          SELECT 1 FROM [cp].[dbo].[taPROrder] o
          WHERE o.OrderID = sr.No_SPK AND (o.Completed = 1 OR o.Completed = '1')
        )
      ORDER BY sr.ReservationDate DESC
    `)
  ]);

  const committedPOs = (poResult.recordset ?? []) as CommittedPO[];
  const reservations = (resResult.recordset ?? []) as StockReservation[];
  const data: CommittedData = { committedPOs, reservations };
  committedCache = { data, timestamp: now };
  return data;
}

// =====================================================================
// BOM OVERRIDE CRUD
// =====================================================================
export async function getOverrides(): Promise<BomOverride[]> {
  const result = await runQuery(`
      SELECT
        id,
        original_item_id AS originalItemId,
        replacement_item_id AS replacementItemId,
        replacement_item_name AS replacementItemName,
        replacement_item_name2 AS replacementItemName2,
        is_active AS isActive,
        target_kode_barang AS targetKodeBarang,
        target_kode_barangs AS targetKodeBarangs,
        created_by,
        created_at,
        updated_at
      FROM bom_overrides
      ORDER BY created_at DESC
    `);
  return result.recordset;
}

export interface OverrideInput {
  originalItemId: string;
  replacementItemId: string;
  replacementItemName?: string;
  replacementItemName2?: string;
  isActive?: boolean;
  createdBy?: string;
}

export async function saveOverride(o: OverrideInput): Promise<Record<string, unknown>> {
  return withTransaction(async (tx) => {
    const name = o.replacementItemName || o.replacementItemId;
    const name2 = o.replacementItemName2 || o.replacementItemId;
    const ins = await tx
      .request()
      .input("originalItemId", sql.NVarChar, o.originalItemId)
      .input("replacementItemId", sql.NVarChar, o.replacementItemId)
      .input("replacementItemName", sql.NVarChar, name)
      .input("replacementItemName2", sql.NVarChar, name2)
      .input("isActive", sql.Bit, o.isActive ?? true)
      .input("createdBy", sql.NVarChar, o.createdBy ?? "system").query(`
          INSERT INTO bom_overrides (
            original_item_id, replacement_item_id, replacement_item_name,
            replacement_item_name2, is_active, created_by, created_at, updated_at
          ) VALUES (
            @originalItemId, @replacementItemId, @replacementItemName,
            @replacementItemName2, @isActive, @createdBy, GETDATE(), GETDATE()
          );
          SELECT SCOPE_IDENTITY() AS id;
        `);
    const id = Number(ins.recordset[0]?.id);
    const get = await tx
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM bom_overrides WHERE id = @id`);
    return get.recordset[0];
  });
}

export async function toggleOverride(id: number, isActive: boolean): Promise<Record<string, unknown>> {
  return withTransaction(async (tx) => {
    await tx
      .request()
      .input("id", sql.Int, id)
      .input("isActive", sql.Bit, isActive)
      .query(`UPDATE bom_overrides SET is_active = @isActive, updated_at = GETDATE() WHERE id = @id`);
    const get = await tx
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT * FROM bom_overrides WHERE id = @id`);
    return get.recordset[0];
  });
}

export async function deleteOverride(id: number): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.request().input("id", sql.Int, id).query(`DELETE FROM bom_overrides WHERE id = @id`);
  });
}

// =====================================================================
// HISTORY PERHITUNGAN
// =====================================================================
export async function saveCalculation(payload: SaveCalculationPayload): Promise<void> {
  const d = payload;
  const existing = await runQuery(
    `SELECT id FROM material_requirements_history WHERE calculation_id = @calculation_id`,
    [{ name: "calculation_id", type: sql.VarChar, value: d.calculation_id }],
  );

  const params: Parameters<typeof runQuery>[1] = [
    { name: "calculation_id", type: sql.VarChar, value: d.calculation_id },
    { name: "calculation_name", type: sql.NVarChar, value: d.calculation_name || d.calculation_id },
    { name: "user_id", type: sql.VarChar, value: d.user_id },
    { name: "po_list", type: sql.NVarChar, value: JSON.stringify(d.po_list) },
    { name: "total_po", type: sql.Int, value: d.total_po },
    { name: "material_data", type: sql.NVarChar, value: JSON.stringify(d.material_data) },
    { name: "total_materials", type: sql.Int, value: d.total_materials },
    { name: "total_kebutuhan", type: sql.Decimal(15, 2), value: d.total_kebutuhan },
    { name: "total_kekurangan", type: sql.Decimal(15, 2), value: d.total_kekurangan },
    { name: "material_aman", type: sql.Int, value: d.material_aman },
    { name: "material_kurang", type: sql.Int, value: d.material_kurang },
    { name: "material_habis", type: sql.Int, value: d.material_habis },
    { name: "stock_date", type: sql.Date, value: d.stock_date ? new Date(d.stock_date) : new Date() },
    { name: "notes", type: sql.NVarChar, value: d.notes || "" },
  ];

  if (existing.recordset.length > 0) {
    await runQuery(
      `UPDATE material_requirements_history
       SET calculation_name = @calculation_name, user_id = @user_id, po_list = @po_list,
           total_po = @total_po, material_data = @material_data, total_materials = @total_materials,
           total_kebutuhan = @total_kebutuhan, total_kekurangan = @total_kekurangan,
           material_aman = @material_aman, material_kurang = @material_kurang,
           material_habis = @material_habis, stock_date = @stock_date, notes = @notes,
           updated_at = GETDATE()
       WHERE calculation_id = @calculation_id`,
      params,
    );
  } else {
    await runQuery(
      `INSERT INTO material_requirements_history (
         calculation_id, calculation_name, calculation_date, user_id, po_list,
         total_po, material_data, total_materials, total_kebutuhan, total_kekurangan,
         material_aman, material_kurang, material_habis, stock_date, notes
       ) VALUES (
         @calculation_id, @calculation_name, GETDATE(), @user_id, @po_list,
         @total_po, @material_data, @total_materials, @total_kebutuhan, @total_kekurangan,
         @material_aman, @material_kurang, @material_habis, @stock_date, @notes
       )`,
      params,
    );
  }
}

export async function getCalculations(limit = 50, offset = 0): Promise<CalculationRecord[]> {
  const result = await runQuery(
    `
      SELECT id, calculation_id, calculation_name, calculation_date, user_id, po_list,
             total_po, material_data, total_materials, total_kebutuhan, total_kekurangan,
             material_aman, material_kurang, material_habis, stock_date, notes, created_at, updated_at
      FROM material_requirements_history
      ORDER BY calculation_date DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `,
    [
      { name: "offset", type: sql.Int, value: offset },
      { name: "limit", type: sql.Int, value: limit },
    ],
  );
  return (result.recordset as CalculationRecord[]).map((record) => ({
    ...record,
    po_list: typeof record.po_list === "string" ? JSON.parse(record.po_list) : [],
    material_data:
      typeof record.material_data === "string" ? JSON.parse(record.material_data) : [],
  }));
}

export async function getCalculation(calculationId: string): Promise<CalculationRecord | null> {
  const all = await getCalculations(1000);
  return all.find((r) => r.calculation_id === calculationId) ?? null;
}

export async function deleteCalculation(calculationId: string): Promise<void> {
  await runQuery(`DELETE FROM material_requirements_history WHERE calculation_id = @calculation_id`, [
    { name: "calculation_id", type: sql.VarChar, value: calculationId },
  ]);
}
