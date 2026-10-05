import { runQuery, withTransaction, log } from "@/lib/db";
import sql from "mssql";
import * as XLSX from "xlsx";
import { getGoodsBatch } from "$lib/server/input-produksi";

export interface SpkDetailInput {
  itemId: string;
  itemName?: string;
  satuan?: string;
  bags?: number;
  kgs: number;
  notes?: string;
}

export interface CreateSpkPayload {
  orderId?: string; // Optional: jika kosong akan digenerate otomatis
  deptId: string;   // 'IN' | 'SP' | 'PL' | 'AS' | 'MO'
  orderDate: string; // YYYY-MM-DD
  planDate: string;  // YYYY-MM-DD
  remark?: string;
  noSo?: string;
  shift?: number | null;
  completed?: boolean;
  finishedDate?: string | null;
  details: SpkDetailInput[];
}

export interface ParsedSpkImportItem {
  itemId: string;
  itemName: string;
  satuan: string;
  deptId?: string;
  deptName?: string;
  bags: number;
  kgs: number;
  notes?: string;
  isValid: boolean;
  error?: string;
  rowNumber: number;
}

export interface ParsedSpkDeptGroup {
  deptId: string;
  deptName: string;
  nextOrderId?: string;
  items: ParsedSpkImportItem[];
  totalKgs: number;
  totalBags: number;
  totalItems: number;
  validCount: number;
  invalidCount: number;
}

export interface ParsedSpkImport {
  header: {
    deptId?: string;
    orderDate?: string;
    planDate?: string;
    remark?: string;
    noSo?: string;
    shift?: number;
  };
  isMultiDept: boolean;
  groups: ParsedSpkDeptGroup[];
  items: ParsedSpkImportItem[];
  summary: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    totalKgs: number;
    totalBags: number;
    totalSpkCount: number;
  };
}

export interface BatchCreateSpkGroup {
  deptId: string;
  orderId?: string;
  details: SpkDetailInput[];
}

export interface BatchCreateSpkPayload {
  orderDate: string;
  planDate: string;
  remark?: string;
  noSo?: string;
  shift?: number | null;
  groups: BatchCreateSpkGroup[];
}

/**
 * Menghitung nomor SPK (OrderID) berikutnya berdasarkan Departemen dan Tanggal.
 * Format: {DEPT}-{YY}/{MM}/{SEQ:003}, contoh: IN-26/09/001, SP-26/08/006
 */
export async function getNextSpkId(deptId: string, dateStr: string): Promise<string> {
  const cleanDept = (deptId || "IN").trim().toUpperCase();
  const dateObj = dateStr ? new Date(dateStr) : new Date();
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;

  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  const prefix = `${cleanDept}-${yy}/${mm}/`;

  const res = await runQuery(
    `SELECT TOP 1 OrderID 
     FROM [cp].[dbo].[taPROrder] 
     WHERE OrderID LIKE @Prefix 
     ORDER BY OrderID DESC`,
    [{ name: "Prefix", type: sql.VarChar(20), value: `${prefix}%` }]
  );

  const currentMax = res.recordset[0]?.OrderID;
  if (currentMax && String(currentMax).startsWith(prefix)) {
    const lastPart = String(currentMax).slice(prefix.length);
    const numPart = parseInt(lastPart, 10);
    const nextNum = isNaN(numPart) ? 1 : numPart + 1;
    return `${prefix}${String(nextNum).padStart(3, "0")}`;
  }

  return `${prefix}001`;
}

/**
 * Mengambil master data awal untuk halaman formulir Input SPK.
 */
export async function getSpkInitialData() {
  // 1. Departemen Produksi
  const deptRes = await runQuery(
    `SELECT PRDeptID, PRDeptName 
     FROM [cp].[dbo].[taDeptPROrder] 
     ORDER BY PRDeptID ASC`
  );

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  
  // Default PlanDate: today + 7 hari
  const planDateObj = new Date(today);
  planDateObj.setDate(planDateObj.getDate() + 7);
  const planDateStr = planDateObj.toISOString().slice(0, 10);

  const defaultDept = deptRes.recordset[0]?.PRDeptID || "IN";
  const nextOrderId = await getNextSpkId(defaultDept, todayStr);

  // 2. Transaksi SPK terakhir (Top 20)
  const recentRes = await runQuery(
    `SELECT TOP 20
       hd.OrderID, hd.OrderType, hd.OrderDate, hd.PlanDate, hd.PRDeptID,
       hd.Remark, hd.NoSO, hd.Completed, hd.FinishedDate, hd.ItemID, hd.Kgs, hd.Bags,
       (SELECT COUNT(*) FROM [cp].[dbo].[taPROrderDT] dt WHERE dt.OrderID = hd.OrderID) AS TotalItems,
       (SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taPROrderDT] dt WHERE dt.OrderID = hd.OrderID) AS TotalKgsDT,
       (SELECT ISNULL(SUM(dt.Bags), 0) FROM [cp].[dbo].[taPROrderDT] dt WHERE dt.OrderID = hd.OrderID) AS TotalBagsDT
     FROM [cp].[dbo].[taPROrder] hd
     ORDER BY hd.OrderDate DESC, hd.OrderID DESC`
  );

  return {
    departments: deptRes.recordset as Array<{ PRDeptID: string; PRDeptName: string }>,
    defaultDate: todayStr,
    defaultPlanDate: planDateStr,
    nextOrderId,
    recentSpks: recentRes.recordset.map((r: any) => ({
      orderId: String(r.OrderID),
      orderType: String(r.OrderType || "OI"),
      deptId: String(r.PRDeptID || "-"),
      orderDate: r.OrderDate ? new Date(r.OrderDate).toISOString().slice(0, 10) : "",
      planDate: r.PlanDate ? new Date(r.PlanDate).toISOString().slice(0, 10) : "",
      remark: String(r.Remark || ""),
      noSo: r.NoSO ? String(r.NoSO) : null,
      completed: Boolean(r.Completed),
      finishedDate: r.FinishedDate ? new Date(r.FinishedDate).toISOString().slice(0, 10) : null,
      itemId: r.ItemID ? String(r.ItemID) : "-",
      totalItems: Number(r.TotalItems) || (r.ItemID ? 1 : 0),
      totalKgs: Math.max(0, parseInt(String(r.TotalKgsDT || r.Kgs || 0), 10) || 0),
      totalBags: Math.max(0, parseInt(String(r.TotalBagsDT || r.Bags || 0), 10) || 0),
    })),
  };
}

/**
 * Menyimpan transaksi SPK baru (Header taPROrder & Detail taPROrderDT).
 */
export async function createSpkTransaction(
  payload: CreateSpkPayload,
  username: string
): Promise<{ success: boolean; orderId: string; message: string }> {
  const deptId = (payload.deptId ?? "").trim().toUpperCase();
  if (!deptId) throw new Error("Departemen SPK wajib dipilih.");

  const orderDateStr = payload.orderDate ? payload.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const planDateStr = payload.planDate ? payload.planDate.slice(0, 10) : orderDateStr;

  const details = payload.details || [];
  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) {
    throw new Error("Rincian barang SPK minimal harus memiliki 1 barang.");
  }

  for (const d of validDetails) {
    if (d.kgs <= 0) {
      throw new Error(`Target kuantiti barang '${d.itemId}' harus lebih dari 0.`);
    }
  }

  const orderDateTime = new Date(`${orderDateStr}T00:00:00.000Z`);
  const planDateTime = new Date(`${planDateStr}T00:00:00.000Z`);
  const currentDateTime = new Date();
  const cleanUser = (username || "OPERATOR").slice(0, 50);

  // Ambil data barang pertama untuk header summary
  const primaryItem = validDetails[0];
  const primaryItemId = primaryItem.itemId.trim().toUpperCase();
  const totalBags = validDetails.reduce((acc, d) => acc + (Math.max(0, parseInt(String(d.bags ?? 0), 10)) || 0), 0);
  const totalKgs = validDetails.reduce((acc, d) => acc + (Math.max(0, parseInt(String(d.kgs ?? 0), 10)) || 0), 0);

  return await withTransaction(async (tx) => {
    // 1. Tentukan OrderID final
    let finalOrderId = (payload.orderId ?? "").trim();
    if (!finalOrderId) {
      finalOrderId = await getNextSpkId(deptId, orderDateStr);
    }

    // Cek apakah OrderID sudah ada
    const dupCheck = await tx
      .request()
      .input("OrderID", sql.VarChar(25), finalOrderId)
      .query(`SELECT TOP 1 OrderID FROM [cp].[dbo].[taPROrder] WHERE OrderID = @OrderID`);
    if (dupCheck.recordset.length > 0) {
      throw new Error(`Nomor SPK #${finalOrderId} sudah digunakan di database. Silakan gunakan nomor lain.`);
    }

    // 2. Insert Header taPROrder
    const isCompleted = Boolean(payload.completed);
    const finishedDateTime = isCompleted && payload.finishedDate ? new Date(`${payload.finishedDate.slice(0, 10)}T00:00:00.000Z`) : null;

    await tx
      .request()
      .input("OrderID", sql.VarChar(25), finalOrderId)
      .input("OrderType", sql.VarChar(2), "OI")
      .input("OrderDate", sql.DateTime, orderDateTime)
      .input("PlanDate", sql.DateTime, planDateTime)
      .input("ItemID", sql.VarChar(40), primaryItemId)
      .input("ItemName", sql.VarChar(50), primaryItem.itemName ? primaryItem.itemName.slice(0, 50) : null)
      .input("Bags", sql.Int, totalBags > 0 ? totalBags : null)
      .input("Kgs", sql.Decimal(18, 2), totalKgs)
      .input("Remark", sql.VarChar(200), payload.remark ? payload.remark.slice(0, 200) : null)
      .input("FinishedDate", sql.DateTime, finishedDateTime)
      .input("PRDeptID", sql.VarChar(2), deptId)
      .input("TypeSO", sql.VarChar(1), "P")
      .input("NoSO", sql.VarChar(7), payload.noSo ? payload.noSo.slice(0, 7) : null)
      .input("SONo", sql.VarChar(7), payload.noSo ? payload.noSo.slice(0, 7) : null)
      .input("Shift", sql.TinyInt, payload.shift ? Number(payload.shift) : null)
      .input("Completed", sql.Bit, isCompleted ? 1 : 0)
      .input("Printed", sql.TinyInt, 0)
      .input("UserName", sql.VarChar(50), cleanUser)
      .input("UserDateTime", sql.DateTime, currentDateTime)
      .query(`
        INSERT INTO [cp].[dbo].[taPROrder] (
          OrderID, OrderType, OrderDate, PlanDate, ItemID, ItemName,
          Bags, Kgs, Remark, FinishedDate, PRDeptID, TypeSO, NoSO, SONo,
          Shift, Completed, Printed, UserName, UserDateTime
        ) VALUES (
          @OrderID, @OrderType, @OrderDate, @PlanDate, @ItemID, @ItemName,
          @Bags, @Kgs, @Remark, @FinishedDate, @PRDeptID, @TypeSO, @NoSO, @SONo,
          @Shift, @Completed, @Printed, @UserName, @UserDateTime
        )
      `);

    // 3. Insert Detail taPROrderDT
    for (const d of validDetails) {
      const cleanItemId = d.itemId.trim().toUpperCase();
      const bags = d.bags != null ? Math.max(0, parseInt(String(d.bags), 10)) : null;
      const kgs = Math.max(0, parseInt(String(d.kgs), 10) || 0);

      await tx
        .request()
        .input("OrderID", sql.VarChar(25), finalOrderId)
        .input("OrderType", sql.VarChar(2), "OI")
        .input("ItemID", sql.VarChar(40), cleanItemId)
        .input("Bags", sql.Int, bags)
        .input("Kgs", sql.Decimal(18, 2), kgs)
        .query(`
          INSERT INTO [cp].[dbo].[taPROrderDT] (
            OrderID, OrderType, ItemID, Bags, Kgs
          ) VALUES (
            @OrderID, @OrderType, @ItemID, @Bags, @Kgs
          )
        `);
    }

    return {
      success: true,
      orderId: finalOrderId,
      message: `Surat Perintah Kerja (SPK) #${finalOrderId} berhasil disimpan.`
    };
  });
}

/**
 * Menyimpan beberapa SPK sekaligus dalam 1 transaksi (Multi-Departemen).
 */
export async function createSpkBatchTransactions(
  payload: BatchCreateSpkPayload,
  username: string
): Promise<{
  success: boolean;
  createdOrders: Array<{ orderId: string; deptId: string; totalItems: number; totalKgs: number }>;
  message: string;
}> {
  const groups = payload.groups || [];
  if (groups.length === 0) {
    throw new Error("Tidak ada data grup SPK yang dipilih untuk disimpan.");
  }

  const orderDateStr = payload.orderDate ? payload.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const planDateStr = payload.planDate ? payload.planDate.slice(0, 10) : orderDateStr;
  const orderDateTime = new Date(`${orderDateStr}T00:00:00.000Z`);
  const planDateTime = new Date(`${planDateStr}T00:00:00.000Z`);
  const currentDateTime = new Date();
  const cleanUser = (username || "OPERATOR").slice(0, 50);

  return await withTransaction(async (tx) => {
    const createdOrders: Array<{ orderId: string; deptId: string; totalItems: number; totalKgs: number }> = [];
    const seqTracker = new Map<string, number>();

    for (const grp of groups) {
      const deptId = (grp.deptId ?? "").trim().toUpperCase();
      if (!deptId) throw new Error("Kode departemen wajib diisi.");

      const validDetails = (grp.details || []).filter((d) => d.itemId && d.itemId.trim());
      if (validDetails.length === 0) continue;

      for (const d of validDetails) {
        if (d.kgs <= 0) {
          throw new Error(`Target kuantiti barang '${d.itemId}' pada departemen '${deptId}' harus lebih dari 0.`);
        }
      }

      // Generate sequence OrderID
      const dateObj = new Date(orderDateStr);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const yy = String(year).slice(-2);
      const mm = String(month).padStart(2, "0");
      const prefix = `${deptId}-${yy}/${mm}/`;

      let currentSeq: number;
      if (seqTracker.has(prefix)) {
        currentSeq = seqTracker.get(prefix)! + 1;
      } else {
        const res = await tx
          .request()
          .input("Prefix", sql.VarChar(20), `${prefix}%`)
          .query(`SELECT TOP 1 OrderID FROM [cp].[dbo].[taPROrder] WHERE OrderID LIKE @Prefix ORDER BY OrderID DESC`);

        const currentMax = res.recordset[0]?.OrderID;
        if (currentMax && String(currentMax).startsWith(prefix)) {
          const lastPart = String(currentMax).slice(prefix.length);
          const numPart = parseInt(lastPart, 10);
          currentSeq = isNaN(numPart) ? 1 : numPart + 1;
        } else {
          currentSeq = 1;
        }
      }
      seqTracker.set(prefix, currentSeq);

      const finalOrderId = `${prefix}${String(currentSeq).padStart(3, "0")}`;

      const primaryItem = validDetails[0];
      const primaryItemId = primaryItem.itemId.trim().toUpperCase();
      const totalBags = validDetails.reduce((acc, d) => acc + (Math.max(0, parseInt(String(d.bags ?? 0), 10)) || 0), 0);
      const totalKgs = validDetails.reduce((acc, d) => acc + (Math.max(0, parseInt(String(d.kgs ?? 0), 10)) || 0), 0);

      // 1. Insert Header taPROrder
      await tx
        .request()
        .input("OrderID", sql.VarChar(25), finalOrderId)
        .input("OrderType", sql.VarChar(2), "OI")
        .input("OrderDate", sql.DateTime, orderDateTime)
        .input("PlanDate", sql.DateTime, planDateTime)
        .input("ItemID", sql.VarChar(40), primaryItemId)
        .input("ItemName", sql.VarChar(50), primaryItem.itemName ? primaryItem.itemName.slice(0, 50) : null)
        .input("Bags", sql.Int, totalBags > 0 ? totalBags : null)
        .input("Kgs", sql.Decimal(18, 2), totalKgs)
        .input("Remark", sql.VarChar(200), payload.remark ? payload.remark.slice(0, 200) : null)
        .input("FinishedDate", sql.DateTime, null)
        .input("PRDeptID", sql.VarChar(2), deptId)
        .input("TypeSO", sql.VarChar(5), payload.noSo ? "SO" : null)
        .input("NoSO", sql.VarChar(7), payload.noSo ? payload.noSo.slice(0, 7) : null)
        .input("SONo", sql.VarChar(7), payload.noSo ? payload.noSo.slice(0, 7) : null)
        .input("Shift", sql.TinyInt, payload.shift ? Number(payload.shift) : null)
        .input("Completed", sql.Bit, 0)
        .input("Printed", sql.TinyInt, 0)
        .input("UserName", sql.VarChar(50), cleanUser)
        .input("UserDateTime", sql.DateTime, currentDateTime)
        .query(`
          INSERT INTO [cp].[dbo].[taPROrder] (
            OrderID, OrderType, OrderDate, PlanDate, ItemID, ItemName,
            Bags, Kgs, Remark, FinishedDate, PRDeptID, TypeSO, NoSO, SONo,
            Shift, Completed, Printed, UserName, UserDateTime
          ) VALUES (
            @OrderID, @OrderType, @OrderDate, @PlanDate, @ItemID, @ItemName,
            @Bags, @Kgs, @Remark, @FinishedDate, @PRDeptID, @TypeSO, @NoSO, @SONo,
            @Shift, @Completed, @Printed, @UserName, @UserDateTime
          )
        `);

      // 2. Insert Detail taPROrderDT
      for (const d of validDetails) {
        const cleanItemId = d.itemId.trim().toUpperCase();
        const bags = d.bags != null ? Math.max(0, parseInt(String(d.bags), 10)) : null;
        const kgs = Math.max(0, parseInt(String(d.kgs), 10) || 0);

        await tx
          .request()
          .input("OrderID", sql.VarChar(25), finalOrderId)
          .input("OrderType", sql.VarChar(2), "OI")
          .input("ItemID", sql.VarChar(40), cleanItemId)
          .input("Bags", sql.Int, bags)
          .input("Kgs", sql.Decimal(18, 2), kgs)
          .query(`
            INSERT INTO [cp].[dbo].[taPROrderDT] (
              OrderID, OrderType, ItemID, Bags, Kgs
            ) VALUES (
              @OrderID, @OrderType, @ItemID, @Bags, @Kgs
            )
          `);
      }

      createdOrders.push({
        orderId: finalOrderId,
        deptId,
        totalItems: validDetails.length,
        totalKgs
      });
    }

    if (createdOrders.length === 0) {
      throw new Error("Tidak ada transaksi SPK yang berhasil dibuat.");
    }

    const orderListStr = createdOrders.map((o) => `${o.orderId} (${o.deptId})`).join(", ");
    return {
      success: true,
      createdOrders,
      message: `Berhasil menerbitkan ${createdOrders.length} SPK: ${orderListStr}.`
    };
  });
}

/**
 * Mengambil detail transaksi SPK untuk mode edit atau pratinjau.
 */
export async function getSpkTransaction(orderId: string) {
  const cleanId = (orderId ?? "").trim();
  if (!cleanId) return null;

  const hdResult = await runQuery(
    `SELECT TOP 1
       h.OrderID, h.OrderType, h.OrderDate, h.PlanDate, h.ItemID, h.ItemName,
       h.Bags, h.Kgs, h.Remark, h.FinishedDate, h.PRDeptID, h.NoSO, h.SONo,
       h.Shift, h.Completed, h.Printed, h.UserName,
       d.PRDeptName
     FROM [cp].[dbo].[taPROrder] h
     LEFT JOIN [cp].[dbo].[taDeptPROrder] d ON h.PRDeptID = d.PRDeptID
     WHERE h.OrderID = @OrderID`,
    [{ name: "OrderID", type: sql.VarChar(25), value: cleanId }]
  );

  if (hdResult.recordset.length === 0) return null;
  const hd = hdResult.recordset[0];

  const dtResult = await runQuery(
    `SELECT dt.OrderID, dt.OrderType, dt.ItemID, dt.Bags, dt.Kgs, dt.rjn,
            g.ItemName, ISNULL(g.SatuanKecil, 'Pcs') AS Satuan
     FROM [cp].[dbo].[taPROrderDT] dt
     LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
     WHERE dt.OrderID = @OrderID
     ORDER BY dt.rjn ASC`,
    [{ name: "OrderID", type: sql.VarChar(25), value: cleanId }]
  );

  let details = dtResult.recordset.map((r: any) => ({
    itemId: String(r.ItemID).trim(),
    itemName: String(r.ItemName || "-"),
    satuan: String(r.Satuan || "Pcs"),
    bags: r.Bags != null ? Number(r.Bags) : 0,
    kgs: Math.max(0, parseInt(String(r.Kgs || 0), 10) || 0),
    rjn: Number(r.rjn)
  }));

  // Fallback jika tidak ada baris di taPROrderDT tetapi header memiliki ItemID
  if (details.length === 0 && hd.ItemID) {
    let fallbackSatuan = "Pcs";
    try {
      const gRes = await runQuery(
        `SELECT TOP 1 ISNULL(SatuanKecil, 'Pcs') AS Satuan FROM [cp].[dbo].[taGoods] WHERE ItemID = @ItemID`,
        [{ name: "ItemID", type: sql.VarChar(40), value: String(hd.ItemID).trim() }]
      );
      if (gRes.recordset.length > 0 && gRes.recordset[0]?.Satuan) {
        fallbackSatuan = String(gRes.recordset[0].Satuan).trim();
      }
    } catch {}

    details = [{
      itemId: String(hd.ItemID).trim(),
      itemName: String(hd.ItemName || "-"),
      satuan: fallbackSatuan,
      bags: hd.Bags != null ? Number(hd.Bags) : 0,
      kgs: Math.max(0, parseInt(String(hd.Kgs || 0), 10) || 0),
      rjn: 1
    }];
  }

  return {
    header: {
      orderId: String(hd.OrderID),
      orderType: String(hd.OrderType || "OI"),
      deptId: String(hd.PRDeptID || ""),
      deptName: String(hd.PRDeptName || ""),
      orderDate: hd.OrderDate ? new Date(hd.OrderDate).toISOString().slice(0, 10) : "",
      planDate: hd.PlanDate ? new Date(hd.PlanDate).toISOString().slice(0, 10) : "",
      remark: String(hd.Remark || ""),
      noSo: hd.NoSO ? String(hd.NoSO) : (hd.SONo ? String(hd.SONo) : ""),
      shift: hd.Shift != null ? Number(hd.Shift) : null,
      completed: Boolean(hd.Completed),
      finishedDate: hd.FinishedDate ? new Date(hd.FinishedDate).toISOString().slice(0, 10) : "",
      userName: hd.UserName ? String(hd.UserName) : null
    },
    details
  };
}

/**
 * Memperbarui transaksi SPK (Header + Detail).
 */
export async function updateSpkTransaction(
  payload: CreateSpkPayload,
  username: string
): Promise<{ success: boolean; orderId: string; message: string }> {
  const orderId = (payload.orderId ?? "").trim();
  if (!orderId) throw new Error("Nomor SPK (OrderID) wajib diisi untuk pembaruan.");

  const deptId = (payload.deptId ?? "").trim().toUpperCase();
  if (!deptId) throw new Error("Departemen SPK wajib dipilih.");

  const details = payload.details || [];
  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) throw new Error("Rincian SPK minimal harus memiliki 1 barang.");

  for (const d of validDetails) {
    if (d.kgs <= 0) throw new Error(`Target kuantiti barang '${d.itemId}' harus lebih dari 0.`);
  }

  const orderDateStr = payload.orderDate ? payload.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const planDateStr = payload.planDate ? payload.planDate.slice(0, 10) : orderDateStr;
  const orderDateTime = new Date(`${orderDateStr}T00:00:00.000Z`);
  const planDateTime = new Date(`${planDateStr}T00:00:00.000Z`);

  const primaryItem = validDetails[0];
  const primaryItemId = primaryItem.itemId.trim().toUpperCase();
  const totalBags = validDetails.reduce((acc, d) => acc + (Math.max(0, parseInt(String(d.bags ?? 0), 10)) || 0), 0);
  const totalKgs = validDetails.reduce((acc, d) => acc + (Math.max(0, parseInt(String(d.kgs ?? 0), 10)) || 0), 0);

  const isCompleted = Boolean(payload.completed);
  const finishedDateTime = isCompleted && payload.finishedDate ? new Date(`${payload.finishedDate.slice(0, 10)}T00:00:00.000Z`) : null;

  return await withTransaction(async (tx) => {
    // 1. Cek keberadaan SPK
    const chk = await tx
      .request()
      .input("OrderID", sql.VarChar(25), orderId)
      .query(`SELECT TOP 1 OrderID FROM [cp].[dbo].[taPROrder] WHERE OrderID = @OrderID`);
    if (chk.recordset.length === 0) {
      throw new Error(`Transaksi SPK #${orderId} tidak ditemukan.`);
    }

    // 2. Update Header taPROrder
    await tx
      .request()
      .input("OrderID", sql.VarChar(25), orderId)
      .input("OrderDate", sql.DateTime, orderDateTime)
      .input("PlanDate", sql.DateTime, planDateTime)
      .input("ItemID", sql.VarChar(40), primaryItemId)
      .input("ItemName", sql.VarChar(50), primaryItem.itemName ? primaryItem.itemName.slice(0, 50) : null)
      .input("Bags", sql.Int, totalBags > 0 ? totalBags : null)
      .input("Kgs", sql.Decimal(18, 2), totalKgs)
      .input("Remark", sql.VarChar(200), payload.remark ? payload.remark.slice(0, 200) : null)
      .input("FinishedDate", sql.DateTime, finishedDateTime)
      .input("PRDeptID", sql.VarChar(2), deptId)
      .input("NoSO", sql.VarChar(7), payload.noSo ? payload.noSo.slice(0, 7) : null)
      .input("SONo", sql.VarChar(7), payload.noSo ? payload.noSo.slice(0, 7) : null)
      .input("Shift", sql.TinyInt, payload.shift ? Number(payload.shift) : null)
      .input("Completed", sql.Bit, isCompleted ? 1 : 0)
      .query(`
        UPDATE [cp].[dbo].[taPROrder] SET
          OrderDate = @OrderDate,
          PlanDate = @PlanDate,
          ItemID = @ItemID,
          ItemName = @ItemName,
          Bags = @Bags,
          Kgs = @Kgs,
          Remark = @Remark,
          FinishedDate = @FinishedDate,
          PRDeptID = @PRDeptID,
          NoSO = @NoSO,
          SONo = @SONo,
          Shift = @Shift,
          Completed = @Completed
        WHERE OrderID = @OrderID
      `);

    // 3. Hapus detail lama
    await tx
      .request()
      .input("OrderID", sql.VarChar(25), orderId)
      .query(`DELETE FROM [cp].[dbo].[taPROrderDT] WHERE OrderID = @OrderID`);

    // 4. Masukkan detail baru
    for (const d of validDetails) {
      const cleanItemId = d.itemId.trim().toUpperCase();
      const bags = d.bags != null ? Math.max(0, parseInt(String(d.bags), 10)) : null;
      const kgs = Math.max(0, parseInt(String(d.kgs), 10) || 0);

      await tx
        .request()
        .input("OrderID", sql.VarChar(25), orderId)
        .input("OrderType", sql.VarChar(2), "OI")
        .input("ItemID", sql.VarChar(40), cleanItemId)
        .input("Bags", sql.Int, bags)
        .input("Kgs", sql.Decimal(18, 2), kgs)
        .query(`
          INSERT INTO [cp].[dbo].[taPROrderDT] (
            OrderID, OrderType, ItemID, Bags, Kgs
          ) VALUES (
            @OrderID, @OrderType, @ItemID, @Bags, @Kgs
          )
        `);
    }

    return {
      success: true,
      orderId,
      message: `Surat Perintah Kerja (SPK) #${orderId} berhasil diperbarui.`
    };
  });
}

/**
 * Menghapus transaksi SPK (Header + Detail).
 */
export async function deleteSpkTransaction(
  orderId: string,
  username: string
): Promise<{ success: boolean; message: string }> {
  const cleanId = (orderId ?? "").trim();
  if (!cleanId) throw new Error("Nomor SPK wajib diisi.");

  return await withTransaction(async (tx) => {
    // Cek apakah SPK sudah digunakan di transaksi produksi taPROrder
    const chkProd = await tx
      .request()
      .input("OrderID", sql.VarChar(25), cleanId)
      .query(`SELECT TOP 1 ProdID FROM [cp].[dbo].[taProdHD] WHERE OrderID = @OrderID`);
    if (chkProd.recordset.length > 0) {
      throw new Error(`SPK #${cleanId} tidak dapat dihapus karena sudah memiliki histori pengerjaan produksi.`);
    }

    await tx
      .request()
      .input("OrderID", sql.VarChar(25), cleanId)
      .query(`DELETE FROM [cp].[dbo].[taPROrderDT] WHERE OrderID = @OrderID`);

    const delRes = await tx
      .request()
      .input("OrderID", sql.VarChar(25), cleanId)
      .query(`DELETE FROM [cp].[dbo].[taPROrder] WHERE OrderID = @OrderID`);

    if (delRes.rowsAffected[0] === 0) {
      throw new Error(`SPK #${cleanId} tidak ditemukan.`);
    }

    log.info({ orderId: cleanId, username }, "Transaksi SPK berhasil dihapus.");
    return {
      success: true,
      message: `SPK #${cleanId} berhasil dihapus dari sistem.`
    };
  });
}

/**
 * Membuat file Template Excel Resmi untuk Import SPK.
 */
export async function generateSpkExcelTemplate(): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: FORM_SPK
  const todayStr = new Date().toISOString().slice(0, 10);
  const planDateObj = new Date();
  planDateObj.setDate(planDateObj.getDate() + 7);
  const planDateStr = planDateObj.toISOString().slice(0, 10);

  // Ambil contoh item nyata dari database taGoods
  let sampleItems: Array<{ ItemID: string; ItemName: string }> = [];
  try {
    const sRes = await runQuery(
      `SELECT TOP 2 ItemID, ItemName FROM [cp].[dbo].[taGoods] WHERE ItemID IS NOT NULL AND RTRIM(ItemID) <> '' ORDER BY userdatetime DESC`
    );
    if (sRes?.recordset?.length > 0) sampleItems = sRes.recordset;
  } catch {}

  const sample1 = sampleItems[0]?.ItemID || "ABS757";
  const sample2 = sampleItems[1]?.ItemID || "00B002-RC";

  const rows: any[][] = [
    ["TEMPLATE IMPORT SPK (SURAT PERINTAH KERJA) KIW", "", "", "", ""],
    ["", "", "", "", ""],
    ["Departemen (IN/SP/PL/AS/MO atau SEMUA) *", "SEMUA", "<- Kode Dept (lihat Sheet MASTER_DEPT), atau 'SEMUA' untuk terbit ke seluruh departemen", "", ""],
    ["Tanggal Order (YYYY-MM-DD)", todayStr, "<- Format: YYYY-MM-DD, kosongkan jika sesuai hari ini", "", ""],
    ["Target Selesai (Plan Date)", planDateStr, "<- Format: YYYY-MM-DD, tanggal target pengerjaan", "", ""],
    ["Keterangan / Remark (PO)", "BORINE", "<- Keterangan order / nama customer / PO", "", ""],
    ["Nomor SO (Sales Order)", "", "<- Nomor Sales Order (opsional)", "", ""],
    ["", "", "", "", ""],
    [
      "Departemen (Opsional)",
      "Kode Barang *",
      "Qty Target (Kgs) *",
      "Bags (Zak/Kemasan)",
      "Keterangan Part (Opsional)",
    ],
    ["IN", sample1, 500, 20, "Part Injeksi"],
    ["SP", sample1, 500, 20, "Part Spraying"],
    ["AS", sample2, 300, 10, "Part Assembling"],
    ["", "", "", "", ""],
    ["PETUNJUK PENGISIAN MULTI-DEPARTEMEN:", "", "", "", ""],
    ["1. Template ini mendukung penerbitan SPK untuk seluruh departemen sekaligus.", "", "", "", ""],
    ["2. Opsi A (Per Baris): Isi kolom 'Departemen' pada baris barang (IN, SP, PL, AS, MO) untuk membuat SPK berbeda tiap departemen.", "", "", "", ""],
    ["3. Opsi B (Otomatis ke Semua): Kosongkan kolom 'Departemen' di tabel dan isi Departemen di baris atas dengan 'SEMUA'. Seluruh barang akan otomatis diterbitkan ke semua 5 departemen (IN, SP, PL, AS, MO) secara serentak.", "", "", "", ""],
    ["4. Opsi C (1 Departemen Saja): Cukup ubah Departemen di baris atas (misal 'IN') dan kosongkan kolom departemen di tabel.", "", "", "", ""],
    ["5. Kolom Kode Barang: Wajib sesuai kode di master taGoods. Qty Target & Bags harus bilangan bulat.", "", "", "", ""],
    ["6. Nama barang & satuan otomatis ditarik dari database taGoods.", "", "", "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 22 }, // Departemen
    { wch: 28 }, // Kode Barang
    { wch: 18 }, // Qty Target
    { wch: 18 }, // Bags
    { wch: 30 }, // Keterangan
  ];
  XLSX.utils.book_append_sheet(wb, ws, "FORM_SPK");

  // Sheet 2: MASTER_DEPT
  let deptRows: Array<{ PRDeptID: string; PRDeptName: string }> = [];
  try {
    const res = await runQuery(`SELECT PRDeptID, PRDeptName FROM [cp].[dbo].[taDeptPROrder] ORDER BY PRDeptID ASC`);
    if (res?.recordset) deptRows = res.recordset;
  } catch (err) {
    log.warn({ err }, "Gagal mengambil daftar departemen untuk template SPK");
  }

  const deptSheetData: any[][] = [
    ["MASTER DATA DEPARTEMEN", ""],
    ["Gunakan kode berikut pada kolom Departemen di Sheet FORM_SPK.", ""],
    ["", ""],
    ["Kode Departemen (PRDeptID)", "Nama Departemen"],
  ];

  if (deptRows.length > 0) {
    for (const d of deptRows) {
      deptSheetData.push([d.PRDeptID, d.PRDeptName]);
    }
  } else {
    deptSheetData.push(
      ["IN", "INJEKSI"],
      ["SP", "SPRAYING"],
      ["PL", "PLATING"],
      ["AS", "ASSEMBLING"],
      ["MO", "MOLDING"]
    );
  }

  const wsDept = XLSX.utils.aoa_to_sheet(deptSheetData);
  wsDept["!cols"] = [{ wch: 28 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsDept, "MASTER_DEPT");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Mem-parse file Excel import SPK dan memvalidasi barang ke master taGoods.
 * Mendukung Multi-Departemen (per baris atau otomatis ke seluruh departemen).
 */
export async function parseSpkExcelImport(fileBuffer: Buffer): Promise<ParsedSpkImport> {
  const wb = XLSX.read(fileBuffer, { type: "buffer" });

  let formSheetName = wb.SheetNames.find((s) => s.toUpperCase().includes("FORM") || s.toUpperCase().includes("SPK"));
  if (!formSheetName) formSheetName = wb.SheetNames[0];

  const ws = wb.Sheets[formSheetName];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (allRows.length === 0) {
    throw new Error("Sheet Excel tidak memiliki data.");
  }

  // 1. Ambil daftar departemen valid dari database
  let deptList: Array<{ PRDeptID: string; PRDeptName: string }> = [];
  try {
    const dRes = await runQuery(`SELECT PRDeptID, PRDeptName FROM [cp].[dbo].[taDeptPROrder] ORDER BY PRDeptID ASC`);
    if (dRes?.recordset?.length > 0) deptList = dRes.recordset;
  } catch {}

  if (deptList.length === 0) {
    deptList = [
      { PRDeptID: "IN", PRDeptName: "INJEKSI" },
      { PRDeptID: "SP", PRDeptName: "SPRAYING" },
      { PRDeptID: "PL", PRDeptName: "PLATING" },
      { PRDeptID: "AS", PRDeptName: "ASSEMBLING" },
      { PRDeptID: "MO", PRDeptName: "MOLDING" },
    ];
  }

  const deptMap = new Map<string, string>();
  for (const d of deptList) {
    deptMap.set(d.PRDeptID.toUpperCase(), d.PRDeptName);
  }

  // 2. Cari index header tabel barang
  let headerRowIdx = -1;
  let colDeptIdx = -1;
  let colCodeIdx = -1;
  let colQtyIdx = -1;
  let colBagsIdx = -1;
  let colNotesIdx = -1;

  for (let r = 0; r < Math.min(30, allRows.length); r++) {
    const row = allRows[r].map((c) => String(c).trim().toUpperCase());
    if (row.length === 0 || row[0].includes("TEMPLATE")) continue;

    let tempDept = -1;
    let tempCode = -1;
    let tempQty = -1;
    let tempBags = -1;
    let tempNotes = -1;

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val.startsWith("<-")) continue;

      // Header Keterangan Part / Notes (cek duluan agar 'Keterangan Part' tidak kena ke 'PART')
      if (val.includes("KET") || val.includes("REMARK") || val.includes("NOTE") || val.includes("DESC") || val === "DOC" || val === "SPEC") {
        tempNotes = c;
        continue;
      }

      // Header Bags
      if (val.includes("BAG") || val.includes("ZAK") || val.includes("KEMAS")) {
        tempBags = c;
        continue;
      }

      // Header Qty: ada QTY / TARGET / JUMLAH / KG / PLAN, tapi bukan tanggal target selesai
      if (
        (val.includes("QTY") || val.includes("JUMLAH") || val.includes("KG") || val.includes("KUANTITAS") || val === "PLAN" ||
         (val.includes("TARGET") && !val.includes("SELESAI") && !val.includes("DATE") && !val.includes("PLAN") && !val.includes("TANGGAL")))
      ) {
        tempQty = c;
        continue;
      }

      // Header Departemen tabel
      if (val.includes("DEPT") || val.includes("DEPARTEMEN") || val.includes("BAGIAN")) {
        tempDept = c;
        continue;
      }

      // Header Kode Barang: wajib ada "KODE" atau "ITEM ID", bukan departemen
      if (
        (val.includes("KODE BARANG") ||
         val.includes("ITEM ID") ||
         val.includes("ITEMID") ||
         val.includes("PART NO") ||
         val.includes("PART NUMBER") ||
         val.includes("PRODUCT NO") ||
         val.includes("PRODUCT NUMBER") ||
         (val.includes("KODE") && !val.includes("DEPT") && !val.includes("DEPARTEMEN")) ||
         val === "KODE" ||
         val === "ITEM")
      ) {
        tempCode = c;
        continue;
      }
    }

    if (tempCode !== -1 && tempQty !== -1 && tempCode !== tempQty) {
      headerRowIdx = r;
      colDeptIdx = tempDept;
      colCodeIdx = tempCode;
      colQtyIdx = tempQty;
      colBagsIdx = tempBags;
      colNotesIdx = tempNotes;
      break;
    }
  }

  if (headerRowIdx === -1 || colCodeIdx === -1 || colQtyIdx === -1) {
    throw new Error(
      "Format tabel tidak dikenali. Pastikan file memiliki baris judul kolom dengan 'Kode Barang' dan 'Qty Target' (atau unduh template resmi)."
    );
  }

  // 3. Parse Header Transaksi (sebelum baris header tabel)
  const headerData: ParsedSpkImport["header"] = {};

  const isCleanVal = (s: string) =>
    Boolean(s) &&
    !s.startsWith("<-") &&
    !s.toUpperCase().includes("KOSONGKAN") &&
    !s.toUpperCase().includes("PILIH DI WEB");

  for (let r = 0; r < headerRowIdx; r++) {
    const row = allRows[r];
    if (!row || row.length === 0) continue;

    const label = String(row[0] ?? "").trim().toUpperCase();
    const valRaw = row[1];
    const valStr = String(valRaw ?? "").trim();

    if (label.includes("DEPARTEMEN") || label.includes("DEPT")) {
      if (isCleanVal(valStr)) headerData.deptId = valStr.toUpperCase();
    } else if (label.includes("TANGGAL ORDER") || (label.includes("TANGGAL") && !label.includes("TARGET") && !label.includes("PLAN"))) {
      const match = valStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match) {
        headerData.orderDate = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
      }
    } else if (label.includes("TARGET") || label.includes("PLAN")) {
      const match = valStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match) {
        headerData.planDate = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
      }
    } else if (label.includes("REMARK") || label.includes("KET")) {
      if (isCleanVal(valStr)) headerData.remark = valStr;
    } else if (label.includes("SO") || label.includes("SALES")) {
      if (isCleanVal(valStr)) headerData.noSo = valStr;
    }
  }

  const rawHeaderDept = headerData.deptId ? headerData.deptId.toUpperCase().trim() : "";
  const isAllDeptHeader = rawHeaderDept === "SEMUA" || rawHeaderDept === "ALL" || rawHeaderDept === "MULTI" || rawHeaderDept === "SEMUADEPT";

  // 4. Kumpulkan baris barang
  interface RawEntry {
    itemId: string;
    deptId: string;
    bags: number;
    kgs: number;
    notes: string;
    rowNumber: number;
  }
  const rawItemEntries: RawEntry[] = [];

  for (let r = headerRowIdx + 1; r < allRows.length; r++) {
    const row = allRows[r];
    if (!row || row.length === 0) continue;

    const rawCode = String(row[colCodeIdx] ?? "").trim();
    if (!rawCode) continue;

    const upperCode = rawCode.toUpperCase();
    if (
      upperCode.includes("PETUNJUK") ||
      upperCode.includes("CATATAN") ||
      upperCode.includes("INFORMASI") ||
      upperCode.includes("PENGISIAN")
    ) {
      break;
    }

    if (rawCode.startsWith("<-") || upperCode.includes("KODE BARANG")) {
      continue;
    }

    const bags =
      colBagsIdx !== -1
        ? Math.max(0, parseInt(String(row[colBagsIdx] ?? "0").replace(/[^0-9-]/g, "") || "0", 10))
        : 0;
    const kgs = Math.max(0, parseInt(String(row[colQtyIdx] ?? "0").replace(/[^0-9]/g, "") || "0", 10));
    const notes = colNotesIdx !== -1 ? String(row[colNotesIdx] ?? "").trim() : "";

    const rowDeptRaw = colDeptIdx !== -1 ? String(row[colDeptIdx] ?? "").trim().toUpperCase() : "";
    const isRowAllDept = rowDeptRaw === "SEMUA" || rowDeptRaw === "ALL" || (isAllDeptHeader && !rowDeptRaw);

    if (isRowAllDept) {
      // Replikasi untuk seluruh departemen
      for (const d of deptList) {
        rawItemEntries.push({
          itemId: rawCode,
          deptId: d.PRDeptID,
          bags,
          kgs,
          notes,
          rowNumber: r + 1,
        });
      }
    } else {
      const targetDept = rowDeptRaw || rawHeaderDept || "IN";
      rawItemEntries.push({
        itemId: rawCode,
        deptId: targetDept,
        bags,
        kgs,
        notes,
        rowNumber: r + 1,
      });
    }
  }

  if (rawItemEntries.length === 0) {
    throw new Error("Tidak ditemukan baris barang di dalam file Excel.");
  }

  // 5. Batch validasi ke taGoods
  const allCodes = Array.from(new Set(rawItemEntries.map((e) => e.itemId)));
  const goodsMap = await getGoodsBatch(allCodes);

  const items: ParsedSpkImportItem[] = [];
  let invalidCount = 0;

  for (const entry of rawItemEntries) {
    const matched = goodsMap.get(entry.itemId.toUpperCase());
    let isValid = Boolean(matched);
    let error: string | undefined;

    if (!matched) {
      error = `Kode '${entry.itemId}' tidak terdaftar di master taGoods`;
      isValid = false;
    } else if (entry.kgs <= 0) {
      error = `Target kuantiti untuk '${entry.itemId}' harus lebih dari 0`;
      isValid = false;
    }

    if (!isValid) invalidCount++;

    const deptName = deptMap.get(entry.deptId) || entry.deptId;

    items.push({
      itemId: entry.itemId,
      itemName: matched ? matched.itemName : "",
      satuan: matched ? matched.satuan || "Pcs" : "Pcs",
      deptId: entry.deptId,
      deptName,
      bags: entry.bags,
      kgs: entry.kgs,
      notes: entry.notes,
      isValid,
      error,
      rowNumber: entry.rowNumber,
    });
  }

  // 6. Buat pengelompokan per Departemen
  const orderDateStr = headerData.orderDate || new Date().toISOString().slice(0, 10);
  const deptGroupMap = new Map<string, ParsedSpkImportItem[]>();

  for (const item of items) {
    const dId = item.deptId || "IN";
    if (!deptGroupMap.has(dId)) {
      deptGroupMap.set(dId, []);
    }
    deptGroupMap.get(dId)!.push(item);
  }

  const groups: ParsedSpkDeptGroup[] = [];

  for (const [dId, grpItems] of deptGroupMap.entries()) {
    const deptName = deptMap.get(dId) || dId;
    let nextOrderId = "";
    try {
      nextOrderId = await getNextSpkId(dId, orderDateStr);
    } catch {}

    const totalKgs = grpItems.reduce((acc, it) => acc + it.kgs, 0);
    const totalBags = grpItems.reduce((acc, it) => acc + it.bags, 0);
    const invalidInGroup = grpItems.filter((it) => !it.isValid).length;

    groups.push({
      deptId: dId,
      deptName,
      nextOrderId,
      items: grpItems,
      totalKgs,
      totalBags,
      totalItems: grpItems.length,
      validCount: grpItems.length - invalidInGroup,
      invalidCount: invalidInGroup,
    });
  }

  const isMultiDept = groups.length > 1 || isAllDeptHeader;
  const totalKgs = items.reduce((acc, it) => acc + it.kgs, 0);
  const totalBags = items.reduce((acc, it) => acc + it.bags, 0);

  return {
    header: headerData,
    isMultiDept,
    groups,
    items,
    summary: {
      totalRows: items.length,
      validCount: items.length - invalidCount,
      invalidCount,
      totalKgs,
      totalBags,
      totalSpkCount: groups.length,
    },
  };
}
