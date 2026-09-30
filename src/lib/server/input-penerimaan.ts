import sql from "mssql";
import { runQuery, withTransaction, log } from "@/lib/db";
import * as XLSX from "xlsx";

export interface PenerimaanDetailInput {
  rjn: number;
  itemId: string;
  itemName?: string;
  satuan?: string;
  bags: number;
  kgs: number;
  qtyPo?: number;
  sisaPo?: number;
  price?: number;
  notes?: string;
}

export interface CreatePenerimaanPayload {
  moveId: string;
  transId?: string;
  orderId: string;
  companyId?: string;
  locId: string;
  moveDate: string; // YYYY-MM-DD
  deliverySlip?: string;
  nopol?: string;
  nopen?: string;
  tglNopen?: string | null;
  remark?: string;
  docId?: string | null;
  details: PenerimaanDetailInput[];
}

export interface ParsedPenerimaanImportItem {
  rowNumber: number;
  rjn?: number;
  orderId?: string;
  itemId: string;
  itemName?: string;
  satuan?: string;
  bags: number;
  kgs: number;
  sisaPo?: number;
  isValid: boolean;
  errorMessage?: string;
}

export interface ParsePenerimaanImportResult {
  header: {
    moveId?: string;
    orderId?: string;
    supplierName?: string;
    locId: string;
    moveDate: string;
    deliverySlip?: string;
    nopol?: string;
    nopen?: string;
    tglNopen?: string | null;
    remark?: string;
    isLocValid?: boolean;
    locError?: string;
  };
  items: ParsedPenerimaanImportItem[];
  summary: {
    totalRows: number;
    totalKgs: number;
    totalBags: number;
    invalidCount: number;
  };
}

/**
 * Menghitung nomor bukti Penerimaan (MoveID) berikutnya berdasarkan tahun dan tanggal.
 * MoveType untuk Pemasukan / Penerimaan Gudang selalu 'P'.
 * Format penomoran: YY (2 digit tahun) + 5 digit urutan (contoh: 2600308).
 */
export async function getNextPenerimaanId(dateStr?: string): Promise<string> {
  const d = dateStr ? new Date(dateStr) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const prefix = `${yy}`;

  const res = await runQuery(
    `SELECT MAX(MoveID) as maxId
     FROM [cp].[dbo].[taTransIHD2]
     WHERE MoveType = 'P' AND MoveID LIKE @prefix`,
    [{ name: "prefix", type: sql.VarChar(10), value: `${prefix}%` }]
  );

  const currentMax = res.recordset[0]?.maxId;
  if (currentMax && String(currentMax).startsWith(prefix)) {
    const numPart = parseInt(String(currentMax).slice(2), 10);
    const nextNum = isNaN(numPart) ? 1 : numPart + 1;
    return `${prefix}${String(nextNum).padStart(5, "0")}`;
  }
  return `${prefix}00001`;
}

/**
 * Menghitung TransID berikutnya berdasarkan tahun dan tanggal.
 */
export async function getNextTransId(dateStr?: string): Promise<string> {
  const d = dateStr ? new Date(dateStr) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const prefix = `${yy}`;

  const res = await runQuery(
    `SELECT MAX(TransID) as maxId
     FROM [cp].[dbo].[taTransIHD2]
     WHERE MoveType = 'P' AND TransID LIKE @prefix`,
    [{ name: "prefix", type: sql.VarChar(10), value: `${prefix}%` }]
  );

  const currentMax = res.recordset[0]?.maxId;
  if (currentMax && String(currentMax).startsWith(prefix)) {
    const numPart = parseInt(String(currentMax).slice(2), 10);
    const nextNum = isNaN(numPart) ? 1 : numPart + 1;
    return `${prefix}${String(nextNum).padStart(5, "0")}`;
  }
  return `${prefix}00001`;
}

/**
 * Mengambil master data awal untuk halaman formulir Input Penerimaan Gudang.
 */
export async function getPenerimaanInitialData() {
  const locRes = await runQuery(
    `SELECT LocID, LocName, [virtual] 
     FROM [cp].[dbo].[taLocation] 
     ORDER BY LocID ASC`
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMoveId = await getNextPenerimaanId(todayStr);
  const nextTransId = await getNextTransId(todayStr);

  const recentRes = await runQuery(
    `SELECT TOP 20
       hd.MoveID, hd.MoveType, hd.TransID, hd.OrderID, hd.CompanyID, hd.LocID,
       l.LocName, s.CompanyName1 AS SupplierName, hd.DeliverySlip, hd.MoveDate,
       hd.Nopol, hd.Nopen, hd.TglNopen, hd.Remark, po.TipeDok,
       (SELECT COUNT(*) FROM [cp].[dbo].[taTransIDT2] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalItems,
       (SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taTransIDT2] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalKgs,
       (SELECT ISNULL(SUM(dt.Bags), 0) FROM [cp].[dbo].[taTransIDT2] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalBags
     FROM [cp].[dbo].[taTransIHD2] hd
     LEFT JOIN [cp].[dbo].[taSupplier] s ON hd.CompanyID = s.CompanyID
     LEFT JOIN [cp].[dbo].[taLocation] l ON hd.LocID = l.LocID
     LEFT JOIN [cp].[dbo].[taPOHd] po ON hd.OrderID = po.OrderID
     WHERE hd.MoveType = 'P' AND ISNULL(hd.Canceled, 0) = 0
     ORDER BY hd.MoveDate DESC, hd.MoveID DESC`
  );

  return {
    warehouses: locRes.recordset as Array<{ LocID: string; LocName: string; virtual: string }>,
    defaultDate: todayStr,
    nextMoveId,
    nextTransId,
    recentTransactions: recentRes.recordset.map((r: any) => ({
      moveId: String(r.MoveID),
      transId: String(r.TransID || ""),
      orderId: String(r.OrderID || ""),
      moveType: "P",
      moveDate: r.MoveDate ? new Date(r.MoveDate).toISOString().slice(0, 10) : "",
      locId: String(r.LocID || "-"),
      locName: String(r.LocName || "-"),
      supplierName: String(r.SupplierName || "-"),
      deliverySlip: String(r.DeliverySlip || ""),
      nopol: String(r.Nopol || ""),
      nopen: String(r.Nopen || ""),
      tglNopen: r.TglNopen ? new Date(r.TglNopen).toISOString().slice(0, 10) : null,
      remark: String(r.Remark || ""),
      tipeDok: String(r.TipeDok || ""),
      totalItems: Number(r.TotalItems) || 0,
      totalKgs: Math.round(Number(r.TotalKgs) * 100) / 100,
      totalBags: Number(r.TotalBags) || 0,
    })),
  };
}

/**
 * Mencari Purchase Order (taPOHd) yang masih open (belum selesai/batal dan memiliki sisa quantity).
 */
export async function searchOpenPOs(keyword: string = "", limit: number = 20) {
  const kw = keyword.trim();
  let whereClause = `WHERE po.Canceled = 0 AND po.Completed = 0 AND dt.KgsL > 0`;
  const inputs: Array<{ name: string; type: any; value: any }> = [
    { name: "limit", type: sql.Int, value: limit },
  ];

  if (kw) {
    whereClause += ` AND (po.OrderID LIKE @kw OR s.CompanyName1 LIKE @kw OR dt.ItemID LIKE @kw OR po.Remark LIKE @kw)`;
    inputs.push({ name: "kw", type: sql.VarChar(100), value: `%${kw}%` });
  }

  const query = `
    SELECT TOP (@limit)
      po.OrderID, po.OrderDate, po.CompanyID, s.CompanyName1 AS SupplierName,
      po.TipeDok, po.Remark,
      COUNT(dt.RJN) AS ItemCount,
      SUM(dt.Kgs) AS TotalOrderKgs,
      SUM(dt.KgsL) AS TotalSisaKgs
    FROM [cp].[dbo].[taPOHd] po
    INNER JOIN [cp].[dbo].[taPODt] dt ON po.OrderID = dt.OrderID
    LEFT JOIN [cp].[dbo].[taSupplier] s ON po.CompanyID = s.CompanyID
    ${whereClause}
    GROUP BY po.OrderID, po.OrderDate, po.CompanyID, s.CompanyName1, po.TipeDok, po.Remark
    ORDER BY po.OrderDate DESC, po.OrderID DESC
  `;

  const res = await runQuery(query, inputs);
  return res.recordset.map((r: any) => ({
    orderId: String(r.OrderID),
    orderDate: r.OrderDate ? new Date(r.OrderDate).toISOString().slice(0, 10) : "",
    companyId: String(r.CompanyID),
    supplierName: String(r.SupplierName || "-"),
    tipeDok: String(r.TipeDok || ""),
    remark: String(r.Remark || ""),
    itemCount: Number(r.ItemCount) || 0,
    totalOrderKgs: Math.round(Number(r.TotalOrderKgs) * 100) / 100,
    totalSisaKgs: Math.round(Number(r.TotalSisaKgs) * 100) / 100,
  }));
}

/**
 * Mengambil daftar item barang dalam suatu Purchase Order (taPODt).
 */
export async function getPOItems(orderId: string) {
  const cleanId = orderId.trim();
  if (!cleanId) return [];

  const res = await runQuery(
    `SELECT
       dt.RJN, dt.OrderID, dt.ItemID, g.ItemName, dt.Bags,
       dt.Kgs AS QtyPO, dt.KgsL AS SisaPO, dt.Price, dt.Satuan
     FROM [cp].[dbo].[taPODt] dt
     LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
     WHERE dt.OrderID = @orderId
     ORDER BY dt.recno ASC, dt.RJN ASC`,
    [{ name: "orderId", type: sql.VarChar(10), value: cleanId }]
  );

  return res.recordset.map((r: any) => ({
    rjn: Number(r.RJN),
    orderId: String(r.OrderID),
    itemId: String(r.ItemID),
    itemName: String(r.ItemName || r.ItemID),
    bags: Number(r.Bags) || 1,
    qtyPo: Math.round(Number(r.QtyPO) * 100) / 100,
    sisaPo: Math.round(Number(r.SisaPO) * 100) / 100,
    price: Number(r.Price) || 0,
    satuan: String(r.Satuan || "Pcs"),
  }));
}

/**
 * Mengambil detail transaksi Penerimaan Gudang berdasarkan MoveID.
 */
export async function getPenerimaanTransaction(moveId: string) {
  const cleanMoveId = moveId.trim();
  if (!cleanMoveId) return null;

  const hdRes = await runQuery(
    `SELECT TOP 1
       hd.MoveID, hd.MoveType, hd.TransID, hd.OrderID, hd.CompanyID, hd.LocID,
       l.LocName, s.CompanyName1 AS SupplierName, hd.DeliverySlip, hd.MoveDate,
       hd.DocID, hd.Nopol, hd.Nopen, hd.TglNopen, hd.Remark, po.TipeDok
     FROM [cp].[dbo].[taTransIHD2] hd
     LEFT JOIN [cp].[dbo].[taSupplier] s ON hd.CompanyID = s.CompanyID
     LEFT JOIN [cp].[dbo].[taLocation] l ON hd.LocID = l.LocID
     LEFT JOIN [cp].[dbo].[taPOHd] po ON hd.OrderID = po.OrderID
     WHERE hd.MoveID = @MoveID AND hd.MoveType = 'P'`,
    [{ name: "MoveID", type: sql.VarChar(20), value: cleanMoveId }]
  );

  if (hdRes.recordset.length === 0) return null;
  const hd = hdRes.recordset[0];

  const dtRes = await runQuery(
    `SELECT
       dt.MoveID, dt.RJN, dt.TransID, dt.MoveDate, dt.LocID,
       dt.ItemID, g.ItemName, dt.Bags, dt.Kgs, dt.Satuan,
       poDt.Kgs AS QtyPO, poDt.KgsL AS SisaPO, poDt.Price,
       dt.username, dt.userdatetime
     FROM [cp].[dbo].[taTransIDT2] dt
     LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
     LEFT JOIN [cp].[dbo].[taPODt] poDt ON dt.RJN = poDt.RJN
     WHERE dt.MoveID = @MoveID AND dt.MoveType = 'P'
     ORDER BY dt.rjn2 ASC, dt.RJN ASC`,
    [{ name: "MoveID", type: sql.VarChar(20), value: cleanMoveId }]
  );

  return {
    header: {
      moveId: String(hd.MoveID),
      transId: String(hd.TransID || ""),
      orderId: String(hd.OrderID || ""),
      companyId: String(hd.CompanyID || ""),
      supplierName: String(hd.SupplierName || "-"),
      locId: String(hd.LocID || ""),
      locName: String(hd.LocName || ""),
      deliverySlip: String(hd.DeliverySlip || ""),
      moveDate: hd.MoveDate ? new Date(hd.MoveDate).toISOString().slice(0, 10) : "",
      docId: String(hd.DocID || ""),
      nopol: String(hd.Nopol || ""),
      nopen: String(hd.Nopen || ""),
      tglNopen: hd.TglNopen ? new Date(hd.TglNopen).toISOString().slice(0, 10) : null,
      remark: String(hd.Remark || ""),
      tipeDok: String(hd.TipeDok || ""),
    },
    items: dtRes.recordset.map((r: any) => ({
      rjn: Number(r.RJN),
      itemId: String(r.ItemID),
      itemName: String(r.ItemName || r.ItemID),
      bags: Number(r.Bags) || 0,
      kgs: Math.round(Number(r.Kgs) * 100) / 100,
      qtyPo: Math.round(Number(r.QtyPO || 0) * 100) / 100,
      sisaPo: Math.round(Number(r.SisaPO || 0) * 100) / 100,
      price: Number(r.Price) || 0,
      satuan: String(r.Satuan || "Pcs"),
    })),
  };
}

/**
 * Menyimpan transaksi Penerimaan Gudang baru secara atomic.
 */
export async function createPenerimaanTransaction(
  payload: CreatePenerimaanPayload,
  username: string
) {
  if (!payload.orderId?.trim()) {
    throw new Error("Nomor Purchase Order (PO / OrderID) wajib dipilih.");
  }
  if (!payload.locId?.trim()) {
    throw new Error("Gudang penerima wajib dipilih.");
  }
  if (!payload.moveDate?.trim()) {
    throw new Error("Tanggal penerimaan barang wajib diisi.");
  }
  if (!payload.details || payload.details.length === 0) {
    throw new Error("Daftar barang yang diterima minimal harus ada 1 baris.");
  }

  const validDetails = payload.details.filter(
    (d) => d.itemId && d.itemId.trim() && Number(d.kgs) > 0
  );
  if (validDetails.length === 0) {
    throw new Error("Minimal harus ada 1 baris barang dengan Qty (Kgs) lebih besar dari 0.");
  }

  return await withTransaction(async (tx) => {
    // 1. Dapatkan OrderID & Supplier Info dari taPOHd
    const poReq = new sql.Request(tx);
    poReq.input("OrderID", sql.VarChar(10), payload.orderId.trim());
    const poRes = await poReq.query(
      `SELECT TOP 1 OrderID, CompanyID, TipeDok FROM [cp].[dbo].[taPOHd] WHERE OrderID = @OrderID`
    );
    if (poRes.recordset.length === 0) {
      throw new Error(`PO #${payload.orderId} tidak ditemukan dalam database.`);
    }
    const companyId = payload.companyId?.trim() || poRes.recordset[0].CompanyID;

    // 2. Generate MoveID dan TransID jika belum ada
    let finalMoveId = payload.moveId?.trim();
    if (!finalMoveId) {
      finalMoveId = await getNextPenerimaanId(payload.moveDate);
    }

    let finalTransId = payload.transId?.trim();
    if (!finalTransId) {
      finalTransId = await getNextTransId(payload.moveDate);
    }

    // Pastikan MoveID belum pernah dipakai
    const checkReq = new sql.Request(tx);
    checkReq.input("MoveID", sql.VarChar(20), finalMoveId);
    const checkRes = await checkReq.query(
      `SELECT TOP 1 MoveID FROM [cp].[dbo].[taTransIHD2] WHERE MoveID = @MoveID AND MoveType = 'P'`
    );
    if (checkRes.recordset.length > 0) {
      throw new Error(`Nomor Bukti Penerimaan '${finalMoveId}' sudah pernah digunakan.`);
    }

    // 3. Insert Header taTransIHD2
    const hdReq = new sql.Request(tx);
    hdReq.input("MoveID", sql.VarChar(20), finalMoveId);
    hdReq.input("MoveType", sql.VarChar(1), "P");
    hdReq.input("OrderID", sql.VarChar(7), payload.orderId.trim());
    hdReq.input("TransID", sql.VarChar(7), finalTransId);
    hdReq.input("CompanyID", sql.VarChar(8), companyId);
    hdReq.input("LocID", sql.VarChar(6), payload.locId.trim());
    hdReq.input("DeliverySlip", sql.VarChar(9), payload.deliverySlip?.trim() || "X");
    hdReq.input("MoveDate", sql.DateTime, new Date(`${payload.moveDate}T12:00:00`));
    hdReq.input("DocID", sql.VarChar(7), payload.docId?.trim() || "X");
    hdReq.input("Printed", sql.TinyInt, 0);
    hdReq.input("Canceled", sql.Bit, 0);
    hdReq.input("CancelReason", sql.VarChar(30), "");
    hdReq.input("Timbang", sql.Bit, 1);
    hdReq.input("Nopol", sql.VarChar(30), payload.nopol?.trim() || null);
    hdReq.input("Nopen", sql.VarChar(10), payload.nopen?.trim() || null);
    hdReq.input(
      "TglNopen",
      sql.SmallDateTime,
      payload.tglNopen ? new Date(payload.tglNopen) : null
    );
    hdReq.input("Remark", sql.VarChar(50), payload.remark?.trim() || null);

    await hdReq.query(`
      INSERT INTO [cp].[dbo].[taTransIHD2] (
        MoveID, MoveType, OrderID, TransID, CompanyID, LocID,
        DeliverySlip, MoveDate, DocID, Printed, Canceled, CancelReason,
        Timbang, Nopol, Nopen, TglNopen, Remark
      ) VALUES (
        @MoveID, @MoveType, @OrderID, @TransID, @CompanyID, @LocID,
        @DeliverySlip, @MoveDate, @DocID, @Printed, @Canceled, @CancelReason,
        @Timbang, @Nopol, @Nopen, @TglNopen, @Remark
      )
    `);

    // 4. Hitung rjn2 awal untuk taTransIDT2
    const maxRjn2Req = new sql.Request(tx);
    const maxRjn2Res = await maxRjn2Req.query(
      `SELECT ISNULL(MAX(rjn2), 0) AS maxRjn2 FROM [cp].[dbo].[taTransIDT2]`
    );
    let nextRjn2 = Number(maxRjn2Res.recordset[0]?.maxRjn2) || 0;

    // 5. Insert Detail taTransIDT2
    for (const d of validDetails) {
      nextRjn2 += 1;
      const dtReq = new sql.Request(tx);
      dtReq.input("MoveID", sql.VarChar(20), finalMoveId);
      dtReq.input("RJN", sql.Int, Number(d.rjn));
      dtReq.input("MoveType", sql.VarChar(1), "P");
      dtReq.input("TransID", sql.VarChar(8), finalTransId);
      dtReq.input("MoveDate", sql.DateTime, new Date(`${payload.moveDate}T12:00:00`));
      dtReq.input("LocID", sql.VarChar(6), payload.locId.trim());
      dtReq.input("ItemID", sql.VarChar(40), d.itemId.trim());
      dtReq.input("Bags", sql.Int, Math.max(0, parseInt(String(d.bags || 0), 10)));
      dtReq.input("BagsStkO", sql.Int, Math.max(0, parseInt(String(d.bags || 0), 10)));
      dtReq.input("Kgs", sql.Float, Math.max(0, parseFloat(String(d.kgs || 0))));
      dtReq.input("KgsStkO", sql.Float, Math.max(0, parseFloat(String(d.kgs || 0))));
      dtReq.input("StkO", sql.Bit, 1);
      dtReq.input("Satuan", sql.VarChar(10), d.satuan?.trim() || "Pcs");
      dtReq.input("username", sql.VarChar(50), username || "OPERATOR");
      dtReq.input("userdatetime", sql.DateTime, new Date());
      dtReq.input("rjn2", sql.Int, nextRjn2);

      await dtReq.query(`
        INSERT INTO [cp].[dbo].[taTransIDT2] (
          MoveID, RJN, MoveType, TransID, MoveDate, LocID,
          ItemID, Bags, BagsStkO, Kgs, KgsStkO, StkO,
          Satuan, username, userdatetime, rjn2
        ) VALUES (
          @MoveID, @RJN, @MoveType, @TransID, @MoveDate, @LocID,
          @ItemID, @Bags, @BagsStkO, @Kgs, @KgsStkO, @StkO,
          @Satuan, @username, @userdatetime, @rjn2
        )
      `);
    }

    // 6. Audit Log
    try {
      const logReq = new sql.Request(tx);
      logReq.input("Keterangan", sql.VarChar(sql.MAX), `INPUT PENERIMAAN GUDANG: ${finalMoveId} (PO: ${payload.orderId})`);
      logReq.input("UserName", sql.VarChar(50), username || "OPERATOR");
      await logReq.query(`
        INSERT INTO [cp].[dbo].[taLogNew] (Keterangan, UserName, UserDateTime)
        VALUES (@Keterangan, @UserName, GETDATE())
      `);
    } catch (e) {
      log.warn("Gagal menulis audit log taLogNew: %s", (e as any)?.message);
    }

    return {
      success: true,
      message: `Bukti Penerimaan Gudang #${finalMoveId} berhasil disimpan.`,
      moveId: finalMoveId,
      transId: finalTransId,
    };
  });
}

/**
 * Memperbarui transaksi Penerimaan Gudang yang sudah tersimpan.
 */
export async function updatePenerimaanTransaction(
  payload: CreatePenerimaanPayload,
  username: string
) {
  const cleanMoveId = payload.moveId?.trim();
  if (!cleanMoveId) {
    throw new Error("Nomor Bukti Penerimaan (MoveID) wajib disertakan.");
  }
  if (!payload.locId?.trim()) {
    throw new Error("Gudang penerima wajib dipilih.");
  }
  if (!payload.moveDate?.trim()) {
    throw new Error("Tanggal penerimaan wajib diisi.");
  }

  const validDetails = (payload.details || []).filter(
    (d) => d.itemId && d.itemId.trim() && Number(d.kgs) > 0
  );
  if (validDetails.length === 0) {
    throw new Error("Minimal harus ada 1 baris barang dengan Qty (Kgs) lebih besar dari 0.");
  }

  return await withTransaction(async (tx) => {
    // 1. Cek keberadaan transaksi lama
    const existReq = new sql.Request(tx);
    existReq.input("MoveID", sql.VarChar(20), cleanMoveId);
    const existRes = await existReq.query(
      `SELECT TOP 1 MoveID, TransID, OrderID, CompanyID FROM [cp].[dbo].[taTransIHD2] WHERE MoveID = @MoveID AND MoveType = 'P'`
    );
    if (existRes.recordset.length === 0) {
      throw new Error(`Transaksi Penerimaan #${cleanMoveId} tidak ditemukan.`);
    }
    const oldHd = existRes.recordset[0];
    const transId = payload.transId?.trim() || oldHd.TransID;
    const orderId = payload.orderId?.trim() || oldHd.OrderID;

    // 2. Update Header
    const hdReq = new sql.Request(tx);
    hdReq.input("MoveID", sql.VarChar(20), cleanMoveId);
    hdReq.input("LocID", sql.VarChar(6), payload.locId.trim());
    hdReq.input("DeliverySlip", sql.VarChar(9), payload.deliverySlip?.trim() || "X");
    hdReq.input("MoveDate", sql.DateTime, new Date(`${payload.moveDate}T12:00:00`));
    hdReq.input("DocID", sql.VarChar(7), payload.docId?.trim() || "X");
    hdReq.input("Nopol", sql.VarChar(30), payload.nopol?.trim() || null);
    hdReq.input("Nopen", sql.VarChar(10), payload.nopen?.trim() || null);
    hdReq.input(
      "TglNopen",
      sql.SmallDateTime,
      payload.tglNopen ? new Date(payload.tglNopen) : null
    );
    hdReq.input("Remark", sql.VarChar(50), payload.remark?.trim() || null);

    await hdReq.query(`
      UPDATE [cp].[dbo].[taTransIHD2] SET
        LocID = @LocID,
        DeliverySlip = @DeliverySlip,
        MoveDate = @MoveDate,
        DocID = @DocID,
        Nopol = @Nopol,
        Nopen = @Nopen,
        TglNopen = @TglNopen,
        Remark = @Remark
      WHERE MoveID = @MoveID AND MoveType = 'P'
    `);

    // 3. Hapus baris detail lama (Trigger DELETE tTransIDT2D otomatis mengembalikan sisa PO KgsL)
    const delDtReq = new sql.Request(tx);
    delDtReq.input("MoveID", sql.VarChar(20), cleanMoveId);
    await delDtReq.query(
      `DELETE FROM [cp].[dbo].[taTransIDT2] WHERE MoveID = @MoveID AND MoveType = 'P'`
    );

    // 4. Hitung rjn2 awal untuk insert ulang
    const maxRjn2Req = new sql.Request(tx);
    const maxRjn2Res = await maxRjn2Req.query(
      `SELECT ISNULL(MAX(rjn2), 0) AS maxRjn2 FROM [cp].[dbo].[taTransIDT2]`
    );
    let nextRjn2 = Number(maxRjn2Res.recordset[0]?.maxRjn2) || 0;

    // 5. Insert Detail baru (Trigger INSERT tTransIDT2I otomatis memvalidasi dan memotong KgsL)
    for (const d of validDetails) {
      nextRjn2 += 1;
      const dtReq = new sql.Request(tx);
      dtReq.input("MoveID", sql.VarChar(20), cleanMoveId);
      dtReq.input("RJN", sql.Int, Number(d.rjn));
      dtReq.input("MoveType", sql.VarChar(1), "P");
      dtReq.input("TransID", sql.VarChar(8), transId);
      dtReq.input("MoveDate", sql.DateTime, new Date(`${payload.moveDate}T12:00:00`));
      dtReq.input("LocID", sql.VarChar(6), payload.locId.trim());
      dtReq.input("ItemID", sql.VarChar(40), d.itemId.trim());
      dtReq.input("Bags", sql.Int, Math.max(0, parseInt(String(d.bags || 0), 10)));
      dtReq.input("BagsStkO", sql.Int, Math.max(0, parseInt(String(d.bags || 0), 10)));
      dtReq.input("Kgs", sql.Float, Math.max(0, parseFloat(String(d.kgs || 0))));
      dtReq.input("KgsStkO", sql.Float, Math.max(0, parseFloat(String(d.kgs || 0))));
      dtReq.input("StkO", sql.Bit, 1);
      dtReq.input("Satuan", sql.VarChar(10), d.satuan?.trim() || "Pcs");
      dtReq.input("username", sql.VarChar(50), username || "OPERATOR");
      dtReq.input("userdatetime", sql.DateTime, new Date());
      dtReq.input("rjn2", sql.Int, nextRjn2);

      await dtReq.query(`
        INSERT INTO [cp].[dbo].[taTransIDT2] (
          MoveID, RJN, MoveType, TransID, MoveDate, LocID,
          ItemID, Bags, BagsStkO, Kgs, KgsStkO, StkO,
          Satuan, username, userdatetime, rjn2
        ) VALUES (
          @MoveID, @RJN, @MoveType, @TransID, @MoveDate, @LocID,
          @ItemID, @Bags, @BagsStkO, @Kgs, @KgsStkO, @StkO,
          @Satuan, @username, @userdatetime, @rjn2
        )
      `);
    }

    // 6. Audit Log
    try {
      const logReq = new sql.Request(tx);
      logReq.input("Keterangan", sql.VarChar(sql.MAX), `UPDATE PENERIMAAN GUDANG: ${cleanMoveId} (PO: ${orderId})`);
      logReq.input("UserName", sql.VarChar(50), username || "OPERATOR");
      await logReq.query(`
        INSERT INTO [cp].[dbo].[taLogNew] (Keterangan, UserName, UserDateTime)
        VALUES (@Keterangan, @UserName, GETDATE())
      `);
    } catch (e) {
      log.warn("Gagal menulis audit log taLogNew: %s", (e as any)?.message);
    }

    return {
      success: true,
      message: `Bukti Penerimaan Gudang #${cleanMoveId} berhasil diperbarui.`,
      moveId: cleanMoveId,
      transId,
    };
  });
}

/**
 * Menghapus transaksi Penerimaan Gudang.
 */
export async function deletePenerimaanTransaction(moveId: string, username: string) {
  const cleanMoveId = moveId.trim();
  if (!cleanMoveId) {
    throw new Error("Nomor Bukti Penerimaan (MoveID) wajib diisi.");
  }

  return await withTransaction(async (tx) => {
    // 1. Cek data transaksi
    const chkReq = new sql.Request(tx);
    chkReq.input("MoveID", sql.VarChar(20), cleanMoveId);
    const chkRes = await chkReq.query(
      `SELECT TOP 1 MoveID, OrderID FROM [cp].[dbo].[taTransIHD2] WHERE MoveID = @MoveID AND MoveType = 'P'`
    );
    if (chkRes.recordset.length === 0) {
      throw new Error(`Transaksi Penerimaan #${cleanMoveId} tidak ditemukan.`);
    }
    const orderId = chkRes.recordset[0].OrderID;

    // 2. Hapus detail taTransIDT2 (Trigger DELETE otomatis mengembalikan sisa PO KgsL)
    const delDtReq = new sql.Request(tx);
    delDtReq.input("MoveID", sql.VarChar(20), cleanMoveId);
    await delDtReq.query(
      `DELETE FROM [cp].[dbo].[taTransIDT2] WHERE MoveID = @MoveID AND MoveType = 'P'`
    );

    // 3. Hapus header taTransIHD2
    const delHdReq = new sql.Request(tx);
    delHdReq.input("MoveID", sql.VarChar(20), cleanMoveId);
    await delHdReq.query(
      `DELETE FROM [cp].[dbo].[taTransIHD2] WHERE MoveID = @MoveID AND MoveType = 'P'`
    );

    // 4. Audit Log
    try {
      const logReq = new sql.Request(tx);
      logReq.input("Keterangan", sql.VarChar(sql.MAX), `DELETE PENERIMAAN GUDANG: ${cleanMoveId} (PO: ${orderId})`);
      logReq.input("UserName", sql.VarChar(50), username || "OPERATOR");
      await logReq.query(`
        INSERT INTO [cp].[dbo].[taLogNew] (Keterangan, UserName, UserDateTime)
        VALUES (@Keterangan, @UserName, GETDATE())
      `);
    } catch (e) {
      log.warn("Gagal menulis audit log taLogNew: %s", (e as any)?.message);
    }

    return {
      success: true,
      message: `Bukti Penerimaan Gudang #${cleanMoveId} berhasil dihapus dan kuantiti PO telah dikembalikan.`,
    };
  });
}

/**
 * Mencari riwayat transaksi Penerimaan Gudang tersimpan.
 */
export async function searchPenerimaanTransactions(keyword: string = "", limit: number = 20) {
  const kw = keyword.trim();
  let whereClause = `WHERE hd.MoveType = 'P' AND ISNULL(hd.Canceled, 0) = 0`;
  const inputs: Array<{ name: string; type: any; value: any }> = [
    { name: "limit", type: sql.Int, value: limit },
  ];

  if (kw) {
    whereClause += ` AND (hd.MoveID LIKE @kw OR hd.OrderID LIKE @kw OR s.CompanyName1 LIKE @kw OR hd.Nopol LIKE @kw OR hd.Nopen LIKE @kw OR hd.DeliverySlip LIKE @kw OR hd.Remark LIKE @kw OR l.LocName LIKE @kw)`;
    inputs.push({ name: "kw", type: sql.VarChar(100), value: `%${kw}%` });
  }

  const query = `
    SELECT TOP (@limit)
      hd.MoveID, hd.MoveType, hd.TransID, hd.OrderID, hd.CompanyID, hd.LocID,
      l.LocName, s.CompanyName1 AS SupplierName, hd.DeliverySlip, hd.MoveDate,
      hd.Nopol, hd.Nopen, hd.TglNopen, hd.Remark, po.TipeDok,
      (SELECT COUNT(*) FROM [cp].[dbo].[taTransIDT2] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalItems,
      (SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taTransIDT2] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalKgs,
      (SELECT ISNULL(SUM(dt.Bags), 0) FROM [cp].[dbo].[taTransIDT2] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalBags
    FROM [cp].[dbo].[taTransIHD2] hd
    LEFT JOIN [cp].[dbo].[taSupplier] s ON hd.CompanyID = s.CompanyID
    LEFT JOIN [cp].[dbo].[taLocation] l ON hd.LocID = l.LocID
    LEFT JOIN [cp].[dbo].[taPOHd] po ON hd.OrderID = po.OrderID
    ${whereClause}
    ORDER BY hd.MoveDate DESC, hd.MoveID DESC
  `;

  const res = await runQuery(query, inputs);
  return res.recordset.map((r: any) => ({
    moveId: String(r.MoveID),
    transId: String(r.TransID || ""),
    orderId: String(r.OrderID || ""),
    moveType: "P",
    moveDate: r.MoveDate ? new Date(r.MoveDate).toISOString().slice(0, 10) : "",
    locId: String(r.LocID || "-"),
    locName: String(r.LocName || "-"),
    supplierName: String(r.SupplierName || "-"),
    deliverySlip: String(r.DeliverySlip || ""),
    nopol: String(r.Nopol || ""),
    nopen: String(r.Nopen || ""),
    tglNopen: r.TglNopen ? new Date(r.TglNopen).toISOString().slice(0, 10) : null,
    remark: String(r.Remark || ""),
    tipeDok: String(r.TipeDok || ""),
    totalItems: Number(r.TotalItems) || 0,
    totalKgs: Math.round(Number(r.TotalKgs) * 100) / 100,
    totalBags: Number(r.TotalBags) || 0,
  }));
}

/**
 * Menghasilkan file Excel template untuk import Penerimaan Gudang.
 */
export async function generatePenerimaanExcelTemplate(): Promise<Uint8Array> {
  const locRes = await runQuery(
    `SELECT LocID, LocName FROM [cp].[dbo].[taLocation] ORDER BY LocID ASC`
  );

  const poRes = await runQuery(
    `SELECT TOP 50
       po.OrderID, po.OrderDate, s.CompanyName1 AS SupplierName,
       dt.RJN, dt.ItemID, g.ItemName, dt.Bags, dt.KgsL AS SisaPO, dt.Satuan
     FROM [cp].[dbo].[taPOHd] po
     INNER JOIN [cp].[dbo].[taPODt] dt ON po.OrderID = dt.OrderID
     LEFT JOIN [cp].[dbo].[taSupplier] s ON po.CompanyID = s.CompanyID
     LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
     WHERE po.Canceled = 0 AND po.Completed = 0 AND dt.KgsL > 0
     ORDER BY po.OrderDate DESC, po.OrderID DESC`
  );

  const wb = XLSX.utils.book_new();

  const formRows = [
    {
      "No PO": "2600211",
      "RJN Baris PO": 45569,
      "Kode Barang": "E 26012010(PW)",
      "Nama Barang": "BEER BOX_26012010(PW)",
      "Bags (Zak)": 1,
      "Qty Terima (Kgs)": 3020,
      "Satuan": "PCS",
      "No Surat Jalan": "SJ-9988",
      "Nopol": "S 1852 QE",
      "Nopen": "072046",
      "Tgl Nopen": "2026-08-31",
      "Gudang": "GUDLOC",
      "Catatan": "Pengiriman Batch 1",
    },
  ];

  const wsForm = XLSX.utils.json_to_sheet(formRows);
  XLSX.utils.book_append_sheet(wb, wsForm, "FORM_PENERIMAAN");

  const wsPo = XLSX.utils.json_to_sheet(
    poRes.recordset.map((r: any) => ({
      "No PO": r.OrderID,
      "Tanggal PO": r.OrderDate ? new Date(r.OrderDate).toISOString().slice(0, 10) : "",
      "Supplier": r.SupplierName || "-",
      "RJN Baris PO": r.RJN,
      "Kode Barang": r.ItemID,
      "Nama Barang": r.ItemName || "-",
      "Sisa PO (Kgs)": r.SisaPO,
      "Satuan": r.Satuan || "Pcs",
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsPo, "REFERENSI_PO_AKTIF");

  const wsLoc = XLSX.utils.json_to_sheet(
    locRes.recordset.map((r: any) => ({
      "Kode Gudang": r.LocID,
      "Nama Gudang": r.LocName,
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsLoc, "MASTER_GUDANG");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buf);
}

/**
 * Membaca dan memvalidasi file Excel import Penerimaan Gudang.
 */
export async function parsePenerimaanExcelImport(
  buffer: ArrayBuffer | Buffer
): Promise<ParsePenerimaanImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (rawRows.length === 0) {
    throw new Error("File Excel kosong atau sheet pertama tidak berisi data.");
  }

  const firstRow = rawRows[0];
  const orderId = String(firstRow["No PO"] || firstRow["OrderID"] || firstRow["PO"] || "").trim();
  const locId = String(firstRow["Gudang"] || firstRow["LocID"] || firstRow["Kode Gudang"] || "GUDLOC").trim();
  const deliverySlip = String(firstRow["No Surat Jalan"] || firstRow["DeliverySlip"] || firstRow["SJ"] || "").trim();
  const nopol = String(firstRow["Nopol"] || firstRow["No Polisi"] || "").trim();
  const nopen = String(firstRow["Nopen"] || "").trim();
  const tglNopen = String(firstRow["Tgl Nopen"] || firstRow["Tanggal Nopen"] || "").trim() || null;
  const remark = String(firstRow["Catatan"] || firstRow["Remark"] || "").trim();

  // Validasi PO
  let supplierName = "-";
  if (orderId) {
    const poRes = await runQuery(
      `SELECT TOP 1 po.OrderID, s.CompanyName1 AS SupplierName
       FROM [cp].[dbo].[taPOHd] po
       LEFT JOIN [cp].[dbo].[taSupplier] s ON po.CompanyID = s.CompanyID
       WHERE po.OrderID = @orderId`,
      [{ name: "orderId", type: sql.VarChar(10), value: orderId }]
    );
    if (poRes.recordset.length > 0) {
      supplierName = poRes.recordset[0].SupplierName || "-";
    }
  }

  // Validasi Gudang
  const locRes = await runQuery(
    `SELECT LocID FROM [cp].[dbo].[taLocation] WHERE LocID = @locId`,
    [{ name: "locId", type: sql.VarChar(10), value: locId }]
  );
  const isLocValid = locRes.recordset.length > 0;

  // Ambil data PO items untuk validasi baris
  const poItems = orderId ? await getPOItems(orderId) : [];

  const items: ParsedPenerimaanImportItem[] = [];
  let totalKgs = 0;
  let totalBags = 0;
  let invalidCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const rowNum = i + 2;
    const itemId = String(r["Kode Barang"] || r["ItemID"] || r["Kode"] || "").trim();
    const rawRjn = parseInt(String(r["RJN Baris PO"] || r["RJN"] || ""), 10);
    const bags = Math.max(0, parseInt(String(r["Bags (Zak)"] || r["Bags"] || 0), 10));
    const kgs = Math.max(0, parseFloat(String(r["Qty Terima (Kgs)"] || r["Kgs"] || r["Qty"] || 0)));
    const satuan = String(r["Satuan"] || "Pcs").trim();

    if (!itemId && kgs <= 0) continue;

    let matchedPoItem = poItems.find((p) => p.rjn === rawRjn);
    if (!matchedPoItem && itemId) {
      matchedPoItem = poItems.find((p) => p.itemId.toUpperCase() === itemId.toUpperCase());
    }

    const isValidItem = Boolean(matchedPoItem);
    const isQtyOk = matchedPoItem ? kgs <= matchedPoItem.sisaPo : true;
    const isValid = Boolean(isValidItem && isQtyOk && kgs > 0);

    let errorMessage: string | undefined;
    if (!isValidItem) {
      errorMessage = `Item '${itemId}' tidak terdaftar pada PO #${orderId}`;
      invalidCount++;
    } else if (kgs <= 0) {
      errorMessage = "Qty terima (Kgs) harus lebih besar dari 0";
      invalidCount++;
    } else if (!isQtyOk) {
      errorMessage = `Qty ${kgs} melebihi sisa PO (${matchedPoItem?.sisaPo})`;
      invalidCount++;
    }

    totalKgs += kgs;
    totalBags += bags;

    items.push({
      rowNumber: rowNum,
      rjn: matchedPoItem?.rjn || rawRjn || 0,
      orderId,
      itemId: matchedPoItem?.itemId || itemId,
      itemName: matchedPoItem?.itemName || String(r["Nama Barang"] || itemId),
      satuan: matchedPoItem?.satuan || satuan,
      bags,
      kgs,
      sisaPo: matchedPoItem?.sisaPo || 0,
      isValid,
      errorMessage,
    });
  }

  return {
    header: {
      orderId,
      supplierName,
      locId,
      moveDate: new Date().toISOString().slice(0, 10),
      deliverySlip,
      nopol,
      nopen,
      tglNopen,
      remark,
      isLocValid,
      locError: isLocValid ? undefined : `Kode gudang '${locId}' tidak ditemukan`,
    },
    items,
    summary: {
      totalRows: items.length,
      totalKgs: Math.round(totalKgs * 100) / 100,
      totalBags,
      invalidCount,
    },
  };
}
