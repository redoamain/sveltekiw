import { runQuery, withTransaction, log } from "@/lib/db";
import sql from "mssql";
import * as XLSX from "xlsx";

export interface DepartmentOption {
  PRDeptID: string;
  PRDeptName: string;
}

export interface WarehouseOption {
  LocID: string;
  LocName: string;
  virtual?: string | null;
}

export interface SPKOption {
  OrderID: string;
  OrderType: string;
  OrderDate: string | null;
  Remark: string | null;
}

export interface GoodsSearchItem {
  ItemID: string;
  ItemName: string;
  Satuan: string;
  KodeJenis?: string;
  Departemen?: string;
}

export interface ProductionDetailInput {
  itemType: "B" | "H";
  itemId: string;
  itemName?: string;
  bags: number;
  kgs: number;
  bagsLeft?: number;
  kgsLeft?: number;
  jamMulai?: string | null;
  jamSelesai?: string | null;
  batch?: string | null;
  keterangan?: string | null;
}

export interface CreateProductionPayload {
  prodId?: string; // Optional: jika kosong akan digenerate otomatis
  prodType: string; // 'AS' | 'IN' | 'PL' | 'SP' | 'MO'
  prodDate: string; // YYYY-MM-DD
  locId: string; // e.g. 'GUDLOC', 'GUDIN', 'GUDAS'
  orderId: string; // e.g. 'AS-26/07/005'
  orderType?: string; // default 'OI'
  shift?: number; // 1, 2, 3
  remark?: string;
  noRator?: number | null;
  notes?: string;
  details: ProductionDetailInput[];
}

/**
 * Menghitung nomor produksi berikutnya berdasarkan Departemen dan Tanggal.
 * Menggunakan Stored Procedure [NextProdID], dengan fallback YYMM001 jika awal bulan.
 */
export async function getNextProductionId(prodType: string, dateStr: string): Promise<string> {
  const cleanType = (prodType || "AS").trim().toUpperCase();
  const dateObj = dateStr ? new Date(dateStr) : new Date();
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // 1-12

  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");

  try {
    const res = await runQuery(
      `EXEC [cp].[dbo].[NextProdID] @ProdType = @Tipe, @Year = @Thn, @Month = @Bln`,
      [
        { name: "Tipe", type: sql.VarChar(2), value: cleanType },
        { name: "Thn", type: sql.Int, value: year },
        { name: "Bln", type: sql.Int, value: month },
      ]
    );

    const rawId = res.recordset[0]?.ID;
    if (rawId != null && String(rawId).trim() !== "") {
      return String(rawId).trim();
    }
  } catch (err) {
    log.warn({ err, prodType, year, month }, "NextProdID procedure failed, fallback to query max(prodid)");
    
    // Fallback query langsung jika SP gagal
    const fallbackRes = await runQuery(
      `SELECT MAX(CAST(ProdID AS BIGINT)) + 1 AS NextID 
       FROM [cp].[dbo].[taPRProdHd] 
       WHERE ProdType = @Tipe AND YEAR(ProdDate) = @Thn AND MONTH(ProdDate) = @Bln`,
      [
        { name: "Tipe", type: sql.VarChar(2), value: cleanType },
        { name: "Thn", type: sql.Int, value: year },
        { name: "Bln", type: sql.Int, value: month },
      ]
    );
    const nextId = fallbackRes.recordset[0]?.NextID;
    if (nextId) return String(nextId);
  }

  // Jika belum ada data sama sekali di bulan tersebut, mulai dari 001
  return `${yy}${mm}001`;
}

/**
 * Mengambil data awal untuk form input: daftar departemen, gudang, dan SPK aktif
 */
export async function getProductionInitialData(dept = "AS") {
  const cleanDept = (dept || "AS").toUpperCase();

  // 1. Departemen
  const deptRes = await runQuery(
    `SELECT PRDeptID, PRDeptName 
     FROM [cp].[dbo].[taDeptPROrder] 
     WHERE Act = 1 
     ORDER BY Urutan ASC`
  );

  // 2. Gudang
  const locRes = await runQuery(
    `SELECT LocID, LocName, [virtual] 
     FROM [cp].[dbo].[taLocation] 
     ORDER BY LocID ASC`
  );

  // 3. SPK yang masih aktif / recent across all departments
  const spkRes = await runQuery(
    `SELECT TOP 500 OrderID, OrderType, OrderDate, Remark, Completed 
     FROM [cp].[dbo].[taPROrder] 
     ORDER BY Completed ASC, OrderDate DESC, OrderID DESC`
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextProdId = await getNextProductionId(cleanDept, todayStr);

  // 4. Transaksi terakhir untuk kemudahan cari / edit (lintas seluruh departemen)
  const recentRes = await runQuery(
    `SELECT TOP 20
      h.ProdID, h.ProdType, h.ProdDate, h.OrderID, h.LocID,
      (SELECT COUNT(*) FROM [cp].[dbo].[taPRProdDt] dt WHERE RTRIM(LTRIM(dt.ProdID)) = RTRIM(LTRIM(h.ProdID)) AND dt.ItemType = 'B') AS TotalBahan,
      (SELECT COUNT(*) FROM [cp].[dbo].[taPRProdDt] dt WHERE RTRIM(LTRIM(dt.ProdID)) = RTRIM(LTRIM(h.ProdID)) AND dt.ItemType = 'H') AS TotalHasil
     FROM [cp].[dbo].[taPRProdHd] h
     ORDER BY h.ProdDate DESC, h.ProdID DESC`
  );

  return {
    departments: deptRes.recordset as DepartmentOption[],
    warehouses: locRes.recordset as WarehouseOption[],
    spkList: spkRes.recordset.map((r) => ({
      OrderID: String(r.OrderID),
      OrderType: String(r.OrderType ?? "OI"),
      OrderDate: r.OrderDate ? new Date(r.OrderDate).toISOString().slice(0, 10) : null,
      Remark: r.Remark != null ? String(r.Remark) : null,
      Completed: Boolean(r.Completed),
    })) as (SPKOption & { Completed?: boolean })[],
    nextProdId,
    defaultDate: todayStr,
    recentTransactions: recentRes.recordset.map((r: any) => ({
      prodId: String(r.ProdID),
      prodType: String(r.ProdType),
      prodDate: r.ProdDate ? new Date(r.ProdDate).toISOString().slice(0, 10) : "",
      orderId: String(r.OrderID || "-"),
      locId: String(r.LocID || "-"),
      totalBahan: Number(r.TotalBahan) || 0,
      totalHasil: Number(r.TotalHasil) || 0,
    })),
  };
}

/**
 * Mencari SPK secara dinamis dengan filter departemen dan keyword
 */
export async function searchSpkList(
  dept?: string,
  q?: string,
  limit = 100
): Promise<(SPKOption & { Completed?: boolean })[]> {
  const where: string[] = [];
  const inputs: Array<{ name: string; type: any; value: any }> = [
    { name: "Lim", type: sql.Int, value: limit },
  ];

  const d = (dept ?? "").trim().toUpperCase();
  if (d && ["AS", "IN", "PL", "SP", "MO"].includes(d)) {
    where.push("OrderID LIKE @DeptPrefix");
    inputs.push({ name: "DeptPrefix", type: sql.VarChar(10), value: `${d}%` });
  }

  const kw = (q ?? "").trim();
  if (kw) {
    where.push("(OrderID LIKE @q OR Remark LIKE @q)");
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${kw}%` });
  }

  const clause = where.length ? "WHERE " + where.join(" AND ") : "";
  const res = await runQuery(
    `SELECT TOP (@Lim) OrderID, OrderType, OrderDate, Remark, Completed
     FROM [cp].[dbo].[taPROrder]
     ${clause}
     ORDER BY Completed ASC, OrderDate DESC, OrderID DESC`,
    inputs as never
  );

  return res.recordset.map((r) => ({
    OrderID: String(r.OrderID),
    OrderType: String(r.OrderType ?? "OI"),
    OrderDate: r.OrderDate ? new Date(r.OrderDate).toISOString().slice(0, 10) : null,
    Remark: r.Remark != null ? String(r.Remark) : null,
    Completed: Boolean(r.Completed),
  }));
}

/**
 * Mengambil item-item hasil dari detail SPK (taPROrderDT)
 */
export async function getSpkDetails(orderId: string, orderType = "OI") {
  const res = await runQuery(
    `SELECT dt.OrderID, dt.OrderType, dt.ItemID, dt.Bags, dt.Kgs, 
            g.ItemName, ISNULL(g.SatuanKecil, 'Pcs') AS Satuan
     FROM [cp].[dbo].[taPROrderDT] dt
     LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
     WHERE dt.OrderID = @OrderID AND dt.OrderType = @OrderType`,
    [
      { name: "OrderID", type: sql.VarChar(25), value: orderId },
      { name: "OrderType", type: sql.VarChar(2), value: orderType },
    ]
  );

  return res.recordset.map((r) => ({
    orderId: String(r.OrderID),
    orderType: String(r.OrderType),
    itemId: String(r.ItemID),
    itemName: String(r.ItemName ?? ""),
    satuan: String(r.Satuan ?? "Pcs"),
    bags: Number(r.Bags) || 0,
    kgs: Number(r.Kgs) || 0,
  }));
}

/**
 * Mencari item barang dari master taGoods
 */
export async function searchGoods(query: string, limit = 25): Promise<GoodsSearchItem[]> {
  const kw = (query ?? "").trim();
  if (!kw) return [];

  const res = await runQuery(
    `SELECT TOP (@Lim) 
       a.ItemID, 
       a.ItemName, 
       ISNULL(a.SatuanKecil, 'Pcs') AS Satuan, 
       a.KodeJenis, 
       a.Mark AS Departemen
     FROM [cp].[dbo].[taGoods] a
     WHERE a.ItemID LIKE @q OR a.ItemName LIKE @q
     ORDER BY a.ItemID ASC`,
    [
      { name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${kw}%` },
      { name: "Lim", type: sql.Int, value: limit },
    ]
  );

  return res.recordset.map((r) => ({
    ItemID: String(r.ItemID),
    ItemName: String(r.ItemName ?? ""),
    Satuan: String(r.Satuan ?? "Pcs"),
    KodeJenis: r.KodeJenis != null ? String(r.KodeJenis) : undefined,
    Departemen: r.Departemen != null ? String(r.Departemen) : undefined,
  }));
}

/**
 * Membuat transaksi produksi baru (Header + Detail) dalam satu transaksi database SQL Server.
 */
export async function createProductionTransaction(
  payload: CreateProductionPayload,
  username: string
): Promise<{ success: boolean; prodId: string; message: string }> {
  const prodType = (payload.prodType ?? "").trim().toUpperCase();
  if (!["AS", "IN", "PL", "SP", "MO"].includes(prodType)) {
    throw new Error(`Departemen '${payload.prodType}' tidak valid. Pilihan: AS, IN, PL, SP, MO.`);
  }

  const prodDateStr = (payload.prodDate ?? "").trim();
  if (!prodDateStr) throw new Error("Tanggal produksi wajib diisi.");

  const locId = (payload.locId ?? "").trim().toUpperCase();
  if (!locId) throw new Error("Gudang (LocID) wajib dipilih.");

  const orderId = (payload.orderId ?? "").trim();
  if (!orderId) throw new Error("No. SPK (OrderID) wajib dipilih.");
  const orderType = (payload.orderType ?? "OI").trim().toUpperCase();

  const details = payload.details || [];
  if (details.length === 0) {
    throw new Error("Detail produksi minimal harus memiliki 1 baris bahan atau hasil produksi.");
  }

  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) {
    throw new Error("Setiap detail produksi harus memiliki Kode Barang (ItemID).");
  }

  return await withTransaction(async (tx) => {
    // 1. Validasi FK SPK
    const spkCheck = await tx
      .request()
      .input("OrderID", sql.VarChar(25), orderId)
      .input("OrderType", sql.VarChar(2), orderType)
      .query(`SELECT TOP 1 OrderID FROM [cp].[dbo].[taPROrder] WHERE OrderID = @OrderID AND OrderType = @OrderType`);
    if (spkCheck.recordset.length === 0) {
      throw new Error(`SPK '${orderId}' (${orderType}) tidak ditemukan di tabel taPROrder.`);
    }

    // 2. Validasi FK Gudang
    const locCheck = await tx
      .request()
      .input("LocID", sql.VarChar(6), locId)
      .query(`SELECT TOP 1 LocID FROM [cp].[dbo].[taLocation] WHERE LocID = @LocID`);
    if (locCheck.recordset.length === 0) {
      throw new Error(`Gudang '${locId}' tidak ditemukan di tabel taLocation.`);
    }

    // 3. Tentukan ProdID yang valid (jika tidak disediakan atau sudah terpakai, kalkulasi ulang)
    let finalProdId = (payload.prodId ?? "").trim();
    if (!finalProdId) {
      finalProdId = await getNextProductionId(prodType, prodDateStr);
    }

    // Cek apakah ProdID sudah ada di taPRProdHd
    const existCheck = await tx
      .request()
      .input("ProdID", sql.VarChar(25), finalProdId)
      .input("ProdType", sql.VarChar(2), prodType)
      .query(`SELECT TOP 1 ProdID FROM [cp].[dbo].[taPRProdHd] WHERE ProdID = @ProdID AND ProdType = @ProdType`);

    if (existCheck.recordset.length > 0) {
      // Jika nomor sudah terpakai, ambil nomor berikutnya secara otomatis
      finalProdId = await getNextProductionId(prodType, prodDateStr);
    }

    const prodDateTime = new Date(`${prodDateStr}T00:00:00.000Z`);
    const currentDateTime = new Date();
    const cleanUser = (username || "SYSTEM").slice(0, 50);

    // 4. INSERT Header taPRProdHd (kolom rjn tidak disertakan karena IDENTITY)
    await tx
      .request()
      .input("ProdID", sql.VarChar(25), finalProdId)
      .input("ProdType", sql.VarChar(2), prodType)
      .input("ProdDate", sql.DateTime, prodDateTime)
      .input("DeptID", sql.VarChar(2), prodType)
      .input("OrderID", sql.VarChar(25), orderId)
      .input("OrderType", sql.VarChar(2), orderType)
      .input("Shift", sql.TinyInt, Number(payload.shift) || 1)
      .input("LocID", sql.VarChar(6), locId)
      .input("Remark", sql.VarChar(50), payload.remark ? payload.remark.slice(0, 50) : null)
      .input("Printed", sql.TinyInt, 0)
      .input("NoRator", sql.Int, payload.noRator ? Number(payload.noRator) : null)
      .input("Notes", sql.VarChar(500), payload.notes ? payload.notes.slice(0, 500) : null)
      .query(`
        INSERT INTO [cp].[dbo].[taPRProdHd] (
          ProdID, ProdType, ProdDate, DeptID, OrderID, OrderType,
          Shift, LocID, Remark, Printed, NoRator, Notes
        ) VALUES (
          @ProdID, @ProdType, @ProdDate, @DeptID, @OrderID, @OrderType,
          @Shift, @LocID, @Remark, @Printed, @NoRator, @Notes
        )
      `);

    // 5. INSERT Detail taPRProdDt (kolom rjn tidak disertakan karena IDENTITY)
    for (const dt of validDetails) {
      const itemType = dt.itemType === "H" ? "H" : "B";
      const bags = Math.round(Number(dt.bags)) || 0;
      const kgs = Math.round(Number(dt.kgs)) || 0;
      const bagsLeft = Math.round(Number(dt.bagsLeft)) || 0;
      const kgsLeft = Math.round(Number(dt.kgsLeft)) || 0;

      await tx
        .request()
        .input("ProdID", sql.VarChar(25), finalProdId)
        .input("ProdType", sql.VarChar(2), prodType)
        .input("ProdDate", sql.DateTime, prodDateTime)
        .input("ItemID", sql.VarChar(40), dt.itemId.trim())
        .input("ItemType", sql.Char(1), itemType)
        .input("Bags", sql.Float, bags)
        .input("Kgs", sql.Float, kgs)
        .input("BagsLeft", sql.Int, bagsLeft)
        .input("KgsLeft", sql.Float, kgsLeft)
        .input("UserName", sql.VarChar(50), cleanUser)
        .input("UserDateTime", sql.DateTime, currentDateTime)
        .input("Batch", sql.VarChar(15), dt.batch ? dt.batch.slice(0, 15) : null)
        .input("Keterangan", sql.VarChar(255), dt.keterangan ? dt.keterangan.slice(0, 255) : null)
        .input("JamMulai", sql.SmallDateTime, dt.jamMulai ? new Date(dt.jamMulai) : null)
        .input("JamSelesai", sql.SmallDateTime, dt.jamSelesai ? new Date(dt.jamSelesai) : null)
        .query(`
          INSERT INTO [cp].[dbo].[taPRProdDt] (
            ProdID, ProdType, ProdDate, ItemID, ItemType,
            Bags, Kgs, BagsLeft, KgsLeft, UserName, UserDateTime,
            Batch, Keterangan, JamMulai, JamSelesai
          ) VALUES (
            @ProdID, @ProdType, @ProdDate, @ItemID, @ItemType,
            @Bags, @Kgs, @BagsLeft, @KgsLeft, @UserName, @UserDateTime,
            @Batch, @Keterangan, @JamMulai, @JamSelesai
          )
        `);
    }

    log.info(
      { prodId: finalProdId, prodType, orderId, detailsCount: validDetails.length },
      "✅ Transaksi produksi berhasil disimpan"
    );

    return {
      success: true,
      prodId: finalProdId,
      message: `Bukti produksi ${finalProdId} (${prodType}) berhasil disimpan dengan ${validDetails.length} baris detail.`,
    };
  });
}

/**
 * Mengambil data transaksi produksi lengkap (Header + Detail) berdasarkan ProdID
 */
export async function getProductionTransaction(prodId: string) {
  const cleanProdId = prodId.trim();
  if (!cleanProdId) return null;

  // 1. Ambil Header
  const hdResult = await runQuery(
    `SELECT TOP 1
      h.ProdID, h.ProdType, h.ProdDate, h.DeptID, h.OrderID, h.OrderType,
      h.Shift, h.LocID, h.Remark, h.Printed, h.NoRator, h.Notes,
      o.Remark AS SpkRemark
    FROM [cp].[dbo].[taPRProdHd] h
    LEFT JOIN [cp].[dbo].[taPROrder] o ON h.OrderID = o.OrderID AND h.OrderType = o.OrderType
    WHERE RTRIM(LTRIM(h.ProdID)) = RTRIM(LTRIM(@ProdID))`,
    [{ name: "ProdID", type: sql.VarChar(25), value: cleanProdId }]
  );

  if (!hdResult.recordset || hdResult.recordset.length === 0) {
    return null;
  }

  const hd = hdResult.recordset[0];

  // 2. Ambil Detail dengan nama barang & satuan kecil dari taGoods
  const dtResult = await runQuery(
    `SELECT
      d.rjn, d.ProdID, d.ProdType, d.ItemID, d.ItemType,
      d.Bags, d.Kgs,
      g.ItemName, ISNULL(NULLIF(RTRIM(g.SatuanKecil), ''), 'Pcs') AS Satuan
    FROM [cp].[dbo].[taPRProdDt] d
    LEFT JOIN [cp].[dbo].[taGoods] g ON d.ItemID = g.ItemID
    WHERE RTRIM(LTRIM(d.ProdID)) = RTRIM(LTRIM(@ProdID))
    ORDER BY d.rjn ASC`,
    [{ name: "ProdID", type: sql.VarChar(25), value: cleanProdId }]
  );

  const prodDateStr = hd.ProdDate instanceof Date
    ? hd.ProdDate.toISOString().slice(0, 10)
    : String(hd.ProdDate).slice(0, 10);

  return {
    header: {
      prodId: String(hd.ProdID || "").trim(),
      prodType: String(hd.ProdType || hd.DeptID || "").trim(),
      prodDate: prodDateStr,
      locId: String(hd.LocID || "").trim(),
      orderId: String(hd.OrderID || "").trim(),
      orderType: String(hd.OrderType || "OI").trim(),
      shift: Number(hd.Shift) || 1,
      remark: String(hd.Remark || ""),
      spkRemark: String(hd.SpkRemark || ""),
      noRator: hd.NoRator != null ? Number(hd.NoRator) : null,
      notes: String(hd.Notes || ""),
    },
    details: (dtResult.recordset || []).map((d: any) => ({
      rjn: Number(d.rjn),
      itemType: (String(d.ItemType || "B")).trim().toUpperCase() as "B" | "H",
      itemId: String(d.ItemID || "").trim(),
      itemName: String(d.ItemName || d.ItemID || "").trim(),
      satuan: String(d.Satuan || "Pcs").trim(),
      bags: Math.round(Number(d.Bags)) || 0,
      qty: Math.round(Number(d.Kgs)) || 0,
    })),
  };
}

/**
 * Memperbarui transaksi produksi yang sudah ada (Header + Detail)
 */
export async function updateProductionTransaction(
  payload: CreateProductionPayload,
  username: string
): Promise<{ success: boolean; prodId: string; message: string }> {
  const prodId = (payload.prodId ?? "").trim();
  if (!prodId) throw new Error("Nomor Produksi (ProdID) wajib ada untuk update transaksi.");

  const prodType = (payload.prodType ?? "").trim().toUpperCase();
  if (!["AS", "IN", "PL", "SP", "MO"].includes(prodType)) {
    throw new Error(`Departemen '${payload.prodType}' tidak valid. Pilihan: AS, IN, PL, SP, MO.`);
  }

  const prodDateStr = (payload.prodDate ?? "").trim();
  if (!prodDateStr) throw new Error("Tanggal produksi wajib diisi.");

  const locId = (payload.locId ?? "").trim().toUpperCase();
  if (!locId) throw new Error("Gudang (LocID) wajib dipilih.");

  const orderId = (payload.orderId ?? "").trim();
  if (!orderId) throw new Error("No. SPK (OrderID) wajib dipilih.");
  const orderType = (payload.orderType ?? "OI").trim().toUpperCase();

  const details = payload.details || [];
  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) {
    throw new Error("Detail produksi minimal harus memiliki 1 baris bahan atau hasil produksi.");
  }

  return await withTransaction(async (tx) => {
    // 1. Cek keberadaan transaksi
    const hdCheck = await tx
      .request()
      .input("ProdID", sql.VarChar(25), prodId)
      .query(`SELECT TOP 1 ProdID FROM [cp].[dbo].[taPRProdHd] WHERE ProdID = @ProdID`);
    if (hdCheck.recordset.length === 0) {
      throw new Error(`Bukti produksi '${prodId}' tidak ditemukan di database.`);
    }

    // 2. Validasi FK SPK
    const spkCheck = await tx
      .request()
      .input("OrderID", sql.VarChar(25), orderId)
      .input("OrderType", sql.VarChar(2), orderType)
      .query(`SELECT TOP 1 OrderID FROM [cp].[dbo].[taPROrder] WHERE OrderID = @OrderID AND OrderType = @OrderType`);
    if (spkCheck.recordset.length === 0) {
      throw new Error(`SPK '${orderId}' (${orderType}) tidak ditemukan di tabel taPROrder.`);
    }

    // 3. Validasi FK Gudang
    const locCheck = await tx
      .request()
      .input("LocID", sql.VarChar(6), locId)
      .query(`SELECT TOP 1 LocID FROM [cp].[dbo].[taLocation] WHERE LocID = @LocID`);
    if (locCheck.recordset.length === 0) {
      throw new Error(`Gudang '${locId}' tidak ditemukan di tabel taLocation.`);
    }

    const prodDateTime = new Date(`${prodDateStr}T00:00:00.000Z`);
    const currentDateTime = new Date();
    const cleanUser = (username || "SYSTEM").slice(0, 50);

    // 4. UPDATE Header taPRProdHd
    await tx
      .request()
      .input("ProdID", sql.VarChar(25), prodId)
      .input("ProdType", sql.VarChar(2), prodType)
      .input("ProdDate", sql.DateTime, prodDateTime)
      .input("DeptID", sql.VarChar(2), prodType)
      .input("OrderID", sql.VarChar(25), orderId)
      .input("OrderType", sql.VarChar(2), orderType)
      .input("Shift", sql.TinyInt, Number(payload.shift) || 1)
      .input("LocID", sql.VarChar(6), locId)
      .input("Remark", sql.VarChar(50), payload.remark ? payload.remark.slice(0, 50) : null)
      .input("NoRator", sql.Int, payload.noRator ? Number(payload.noRator) : null)
      .input("Notes", sql.VarChar(500), payload.notes ? payload.notes.slice(0, 500) : null)
      .query(`
        UPDATE [cp].[dbo].[taPRProdHd] SET
          ProdType = @ProdType,
          ProdDate = @ProdDate,
          DeptID = @DeptID,
          OrderID = @OrderID,
          OrderType = @OrderType,
          Shift = @Shift,
          LocID = @LocID,
          Remark = @Remark,
          NoRator = @NoRator,
          Notes = @Notes
        WHERE ProdID = @ProdID
      `);

    // 5. Hapus detail lama, kemudian masukkan detail yang diperbarui
    await tx
      .request()
      .input("ProdID", sql.VarChar(25), prodId)
      .query(`DELETE FROM [cp].[dbo].[taPRProdDt] WHERE ProdID = @ProdID`);

    // 6. INSERT ulang Detail taPRProdDt
    for (const dt of validDetails) {
      const itemType = dt.itemType === "H" ? "H" : "B";
      const bags = Math.round(Number(dt.bags)) || 0;
      const kgs = Math.round(Number(dt.kgs)) || 0;
      const bagsLeft = Math.round(Number(dt.bagsLeft)) || 0;
      const kgsLeft = Math.round(Number(dt.kgsLeft)) || 0;

      await tx
        .request()
        .input("ProdID", sql.VarChar(25), prodId)
        .input("ProdType", sql.VarChar(2), prodType)
        .input("ProdDate", sql.DateTime, prodDateTime)
        .input("ItemID", sql.VarChar(40), dt.itemId.trim())
        .input("ItemType", sql.Char(1), itemType)
        .input("Bags", sql.Float, bags)
        .input("Kgs", sql.Float, kgs)
        .input("BagsLeft", sql.Int, bagsLeft)
        .input("KgsLeft", sql.Float, kgsLeft)
        .input("UserName", sql.VarChar(50), cleanUser)
        .input("UserDateTime", sql.DateTime, currentDateTime)
        .input("Batch", sql.VarChar(15), dt.batch ? dt.batch.slice(0, 15) : null)
        .input("Keterangan", sql.VarChar(255), dt.keterangan ? dt.keterangan.slice(0, 255) : null)
        .input("JamMulai", sql.SmallDateTime, dt.jamMulai ? new Date(dt.jamMulai) : null)
        .input("JamSelesai", sql.SmallDateTime, dt.jamSelesai ? new Date(dt.jamSelesai) : null)
        .query(`
          INSERT INTO [cp].[dbo].[taPRProdDt] (
            ProdID, ProdType, ProdDate, ItemID, ItemType,
            Bags, Kgs, BagsLeft, KgsLeft, UserName, UserDateTime,
            Batch, Keterangan, JamMulai, JamSelesai
          ) VALUES (
            @ProdID, @ProdType, @ProdDate, @ItemID, @ItemType,
            @Bags, @Kgs, @BagsLeft, @KgsLeft, @UserName, @UserDateTime,
            @Batch, @Keterangan, @JamMulai, @JamSelesai
          )
        `);
    }

    log.info(
      { prodId, prodType, orderId, detailsCount: validDetails.length },
      "✅ Transaksi produksi berhasil diperbarui (update)"
    );

    return {
      success: true,
      prodId,
      message: `Bukti produksi ${prodId} (${prodType}) berhasil diperbarui dengan ${validDetails.length} baris detail.`,
    };
  });
}

/**
 * Menghapus transaksi produksi (Header + Detail) dalam satu transaksi database
 */
export async function deleteProductionTransaction(
  prodId: string,
  username: string
): Promise<{ success: boolean; prodId: string; message: string }> {
  const cleanProdId = prodId.trim();
  if (!cleanProdId) {
    throw new Error("Nomor Produksi (ProdID) wajib disertakan untuk penghapusan.");
  }

  return await withTransaction(async (tx) => {
    // 1. Cek keberadaan transaksi
    const checkRes = await tx
      .request()
      .input("ProdID", sql.VarChar(25), cleanProdId)
      .query(`SELECT TOP 1 ProdID, ProdType, ProdDate FROM [cp].[dbo].[taPRProdHd] WHERE ProdID = @ProdID`);

    if (checkRes.recordset.length === 0) {
      throw new Error(`Bukti produksi '${cleanProdId}' tidak ditemukan di database.`);
    }

    const row = checkRes.recordset[0];
    const cleanUser = (username || "OPERATOR").slice(0, 50);

    // 2. Hapus detail taPRProdDt
    const dtDelete = await tx
      .request()
      .input("ProdID", sql.VarChar(25), cleanProdId)
      .query(`DELETE FROM [cp].[dbo].[taPRProdDt] WHERE ProdID = @ProdID`);

    // 3. Hapus header taPRProdHd
    await tx
      .request()
      .input("ProdID", sql.VarChar(25), cleanProdId)
      .query(`DELETE FROM [cp].[dbo].[taPRProdHd] WHERE ProdID = @ProdID`);

    // 4. Catat ke taLogNew
    try {
      await tx
        .request()
        .input("Remark", sql.VarChar(50), "Hapus Produksi")
        .input("Username", sql.VarChar(50), cleanUser)
        .input("TransNo", sql.VarChar(25), cleanProdId)
        .input("TransDateTime", sql.DateTime, row.ProdDate ? new Date(row.ProdDate) : new Date())
        .query(`
          INSERT INTO [cp].[dbo].[taLogNew] (Remark, Username, UserDatetime, TransNo, TransDateTime)
          VALUES (@Remark, @Username, GETDATE(), @TransNo, @TransDateTime)
        `);
    } catch (logErr) {
      log.warn({ logErr, prodId: cleanProdId }, "Gagal mencatat audit log ke taLogNew");
    }

    log.info(
      { prodId: cleanProdId, deletedDetails: dtDelete.rowsAffected[0] ?? 0, username: cleanUser },
      "🗑️ Transaksi produksi berhasil dihapus"
    );

    return {
      success: true,
      prodId: cleanProdId,
      message: `Bukti produksi ${cleanProdId} berhasil dihapus dari database.`,
    };
  });
}

/**
 * Mengambil informasi barang dari master taGoods secara batch
 */
export async function getGoodsBatch(
  itemIds: string[]
): Promise<Map<string, { itemId: string; itemName: string; satuan: string }>> {
  const cleanIds = Array.from(new Set(itemIds.map((id) => (id || "").trim()).filter(Boolean)));
  const map = new Map<string, { itemId: string; itemName: string; satuan: string }>();
  if (cleanIds.length === 0) return map;

  const placeholders = cleanIds.map((_, i) => `@id${i}`).join(", ");
  const params = cleanIds.map((id, i) => ({
    name: `id${i}`,
    type: sql.VarChar(50),
    value: id,
  }));

  const res = await runQuery(
    `SELECT a.ItemID, a.ItemName, ISNULL(a.SatuanKecil, 'Pcs') AS Satuan
     FROM [cp].[dbo].[taGoods] a
     WHERE a.ItemID IN (${placeholders})`,
    params
  );

  for (const r of res.recordset || []) {
    const rawId = String(r.ItemID).trim();
    map.set(rawId.toUpperCase(), {
      itemId: rawId,
      itemName: String(r.ItemName || "").trim(),
      satuan: String(r.Satuan || "Pcs").trim(),
    });
  }

  return map;
}

function parseExcelDate(val: any): string | undefined {
  if (!val) return undefined;
  if (typeof val === "number") {
    try {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch {}
  }
  const str = String(val).trim();
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  if (str.match(/^\d{4}\/\d{2}\/\d{2}$/)) return str.replace(/\//g, "-");
  const m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

/**
 * Menghasilkan file Buffer template Excel untuk import produksi
 * Sheet 1: IMPORT_PRODUKSI (hanya kolom esensial: Tipe, Kode Barang, Bags, Qty)
 * Sheet 2: MASTER_SPK (Daftar referensi No. SPK aktif & Nama SPK / PO)
 */
export async function generateProductionExcelTemplate(dept?: string): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template Input Produksi (Tanpa Kolom Opsional)
  const rows: any[][] = [
    ["TEMPLATE IMPORT INPUT PRODUKSI KIW", "", "", ""],
    ["", "", "", ""],
    ["No. SPK", "", "<- Isi No SPK (lihat daftar di sheet MASTER_SPK), atau KOSONGKAN jika ingin pilih di web", ""],
    ["Tanggal (YYYY-MM-DD)", new Date().toISOString().slice(0, 10), "<- Format: YYYY-MM-DD, kosongkan jika sesuai hari ini", ""],
    ["Gudang", "", "<- Kode Gudang (misal GUDLOC), kosongkan untuk gudang default departemen", ""],
    ["Shift", 1, "<- Shift kerja: 1, 2, atau 3", ""],
    ["No. Rator", "", "<- Nomor Operator / Rator (angka bulat, misal: 1026467), opsional", ""],
    ["Catatan / Remark", "Produksi Reguler", "<- Catatan / keterangan produksi", ""],
    ["", "", "", ""],
    [
      "Tipe (B/H) *",
      "Kode Barang *",
      "Bags",
      "Qty *",
    ],
    ["B", "CONTOH_BAHAN_01", 10, 250],
    ["B", "CONTOH_BAHAN_02", 1, 25],
    ["H", "CONTOH_HASIL_01", 5, 270],
    ["", "", "", ""],
    ["PETUNJUK PENGISIAN:", "", "", ""],
    ["1. Template ini terdiri dari 2 sheet: 'IMPORT_PRODUKSI' (input) dan 'MASTER_SPK' (daftar referensi SPK aktif).", "", "", ""],
    ["2. No. SPK (baris 3): Salin No. SPK dari sheet MASTER_SPK, atau kosongkan jika ingin memilih di web.", "", "", ""],
    ["3. Kolom Tipe: Wajib diisi 'B' untuk Bahan Baku atau 'H' untuk Hasil Produksi.", "", "", ""],
    ["4. Kolom Kode Barang: Wajib sesuai kode di master taGoods.", "", "", ""],
    ["5. Kolom Bags & Qty: Masukkan jumlah zak/kemasan (angka bulat) dan kuantiti total.", "", "", ""],
    ["6. Kolom Nama Barang & Satuan tidak perlu diisi karena otomatis ditarik dari database saat file diunggah.", "", "", ""],
    ["7. No. Rator (baris 7): Masukkan nomor operator/rator (angka bulat) jika ada.", "", "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 18 }, // Kolom A: Label Header / Tipe
    { wch: 26 }, // Kolom B: Nilai Header / Kode Barang
    { wch: 14 }, // Kolom C: Petunjuk / Bags
    { wch: 18 }, // Kolom D: Qty
  ];

  XLSX.utils.book_append_sheet(wb, ws, "IMPORT_PRODUKSI");

  // Sheet 2: Master Data SPK Aktif
  let spkRows: Array<{ OrderID: string; Remark: string | null; OrderDate: any }> = [];
  try {
    const where: string[] = ["Completed = 0"];
    const inputs: Array<{ name: string; type: any; value: any }> = [];

    const d = (dept ?? "").trim().toUpperCase();
    if (d && ["AS", "IN", "PL", "SP", "MO"].includes(d)) {
      where.push("OrderID LIKE @DeptPrefix");
      inputs.push({ name: "DeptPrefix", type: sql.VarChar(10), value: `${d}%` });
    }

    const clause = where.length ? "WHERE " + where.join(" AND ") : "";
    const res = await runQuery(
      `SELECT TOP 500 OrderID, Remark, OrderDate
       FROM [cp].[dbo].[taPROrder]
       ${clause}
       ORDER BY OrderDate DESC, OrderID DESC`,
      inputs as never
    );
    if (res?.recordset) {
      spkRows = res.recordset;
    }
  } catch (err) {
    log.warn({ err }, "Gagal mengambil daftar SPK untuk template Excel");
  }

  const spkSheetData: any[][] = [
    ["MASTER DATA SPK AKTIF (REFERENSI)", "", ""],
    ["Salin No. SPK dari tabel ini ke sheet IMPORT_PRODUKSI (baris 3, kolom B)", "", ""],
    ["", "", ""],
    ["No. SPK", "Nama SPK / Remark PO", "Tanggal Order"],
  ];

  if (spkRows.length > 0) {
    for (const r of spkRows) {
      const orderDateStr = r.OrderDate ? new Date(r.OrderDate).toISOString().slice(0, 10) : "-";
      spkSheetData.push([
        String(r.OrderID || "").trim(),
        r.Remark ? String(r.Remark).trim() : "-",
        orderDateStr,
      ]);
    }
  } else {
    spkSheetData.push(
      ["AS-26/07/001", "PO CONTOH CUSTOMER A - Casing", new Date().toISOString().slice(0, 10)],
      ["AS-26/07/002", "PO CONTOH CUSTOMER B - Bracket", new Date().toISOString().slice(0, 10)]
    );
  }

  const wsSpk = XLSX.utils.aoa_to_sheet(spkSheetData);
  wsSpk["!cols"] = [
    { wch: 22 }, // No. SPK
    { wch: 50 }, // Nama SPK / Remark PO
    { wch: 16 }, // Tanggal Order
  ];

  XLSX.utils.book_append_sheet(wb, wsSpk, "MASTER_SPK");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export interface ParsedProductionImportItem {
  itemType: "B" | "H";
  itemId: string;
  itemName: string;
  satuan: string;
  bags: number;
  qty: number;
  keterangan: string;
  isValid: boolean;
  error?: string;
}

export interface ParsedProductionImport {
  header: {
    orderId?: string;
    isSpkValid?: boolean;
    spkRemark?: string;
    orderType?: string;
    spkError?: string;
    prodDate?: string;
    locId?: string;
    shift?: number;
    remark?: string;
    noRator?: number | null;
  };
  bahanList: ParsedProductionImportItem[];
  hasilList: ParsedProductionImportItem[];
  summary: {
    totalBahanRows: number;
    totalHasilRows: number;
    totalBahanQty: number;
    totalHasilQty: number;
    totalBahanBags: number;
    totalHasilBags: number;
    invalidCount: number;
  };
}

/**
 * Membaca file Excel yang diunggah (1 Sheet atau multi-sheet) dan memvalidasi SPK serta kode barang
 */
export async function parseProductionExcelImport(buffer: Buffer): Promise<ParsedProductionImport> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = wb.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error("File Excel kosong atau format tidak valid.");
  }

  // 1. Pilih sheet rincian (utamakan sheet pertama atau yang memuat rincian/import)
  const rincianSheetName =
    sheetNames.find(
      (s) =>
        s.toUpperCase().includes("IMPORT") ||
        s.toUpperCase().includes("PRODUKSI") ||
        s.toUpperCase().includes("RINCIAN") ||
        s.toUpperCase().includes("DETAIL")
    ) || sheetNames[0];

  const ws = wb.Sheets[rincianSheetName];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (allRows.length === 0) {
    throw new Error("Sheet Excel tidak memiliki data.");
  }

  // Cari index header tabel barang
  let headerRowIdx = -1;
  let colTypeIdx = -1;
  let colCodeIdx = -1;
  let colNameIdx = -1;
  let colSatuanIdx = -1;
  let colBagsIdx = -1;
  let colQtyIdx = -1;
  let colKetIdx = -1;
  let colSpkIdx = -1;

  for (let r = 0; r < Math.min(30, allRows.length); r++) {
    const row = allRows[r].map((c) => String(c).trim().toUpperCase());
    if (row.length === 0 || row[0].includes("TEMPLATE")) continue;

    let tempType = -1;
    let tempCode = -1;
    let tempName = -1;
    let tempSatuan = -1;
    let tempBags = -1;
    let tempQty = -1;
    let tempKet = -1;
    let tempSpk = -1;

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val.startsWith("<-")) continue;

      if (val.includes("TIPE") || val.includes("TYPE") || val.includes("JENIS")) tempType = c;
      if (
        (val.includes("KODE BARANG") ||
         val.includes("ITEM ID") ||
         val.includes("ITEMID") ||
         (val.includes("KODE") && !val.includes("DEPT") && !val.includes("DEPARTEMEN")))
      ) {
        tempCode = c;
      }
      if (val.includes("NAMA") || val.includes("DESC")) tempName = c;
      if (val.includes("SATUAN") || val.includes("UNIT") || val.includes("UOM")) tempSatuan = c;
      if (val.includes("BAG") || val.includes("ZAK") || val.includes("KEMAS")) tempBags = c;
      if (val.includes("QTY") || val.includes("JUMLAH") || val.includes("KG") || val.includes("KUANTITAS")) tempQty = c;
      if (val.includes("KET") || val.includes("REMARK") || val.includes("NOTE")) tempKet = c;
      if (val.includes("SPK") || val.includes("ORDER")) tempSpk = c;
    }

    if (tempCode !== -1 && tempQty !== -1 && tempCode !== tempQty) {
      headerRowIdx = r;
      colTypeIdx = tempType !== -1 ? tempType : 0;
      colCodeIdx = tempCode;
      colNameIdx = tempName;
      colSatuanIdx = tempSatuan;
      colBagsIdx = tempBags;
      colQtyIdx = tempQty;
      colKetIdx = tempKet;
      colSpkIdx = tempSpk;
      break;
    }
  }

  if (headerRowIdx === -1 || colCodeIdx === -1 || colQtyIdx === -1) {
    throw new Error(
      "Format tabel tidak dikenali. Pastikan file memiliki baris judul kolom dengan 'Kode Barang' dan 'Qty' (atau unduh template resmi)."
    );
  }

  if (colTypeIdx === -1) colTypeIdx = 0;

  // 2. Parse Header Transaksi (dari baris atas sebelum tabel atau dari sheet header legacy)
  const headerData: ParsedProductionImport["header"] = {};

  // Scan baris sebelum headerRowIdx untuk key-value header
  for (let r = 0; r < headerRowIdx; r++) {
    const row = allRows[r];
    if (!row || row.length === 0) continue;

    const label = String(row[0] ?? "").trim().toUpperCase();
    const valRaw = row[1];
    const valStr = String(valRaw ?? "").trim();

    // Helper untuk membuang teks panduan yang diawali '<-' atau 'CONTOH'
    const isCleanVal = (s: string) =>
      Boolean(s) &&
      !s.startsWith("<-") &&
      !s.toUpperCase().includes("KOSONGKAN") &&
      !s.toUpperCase().includes("PILIH DI WEB");

    if (label.includes("SPK") || label.includes("ORDER")) {
      if (isCleanVal(valStr)) headerData.orderId = valStr;
    } else if (label.includes("TANGGAL") || label.includes("DATE")) {
      const parsedDate = parseExcelDate(valRaw);
      if (parsedDate) headerData.prodDate = parsedDate;
    } else if (label.includes("GUDANG") || label.includes("LOC")) {
      if (isCleanVal(valStr)) headerData.locId = valStr.toUpperCase();
    } else if (label.includes("SHIFT")) {
      const s = parseInt(valStr, 10);
      if (s >= 1 && s <= 3) headerData.shift = s;
    } else if (label.includes("CATATAN") || label.includes("REMARK") || label.includes("KET")) {
      if (isCleanVal(valStr)) headerData.remark = valStr;
    } else if (label.includes("RATOR") || label.includes("OPERATOR")) {
      if (isCleanVal(valStr)) {
        const num = parseInt(valStr.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(num) && num > 0) headerData.noRator = num;
      }
    }
  }

  // Jika belum dapat header dari 1-sheet, coba periksa apakah ada sheet HEADER terpisah (kompatibilitas template lama)
  const legacyHeaderSheetName = sheetNames.find(
    (s) => s.toUpperCase().includes("HEADER") || s.toUpperCase().includes("INFO")
  );
  if (legacyHeaderSheetName && !headerData.orderId) {
    const wsHeader = wb.Sheets[legacyHeaderSheetName];
    const headerRows: any[][] = XLSX.utils.sheet_to_json(wsHeader, { header: 1, defval: "" });
    if (headerRows.length >= 2) {
      const colLabels = headerRows[0].map((c) => String(c).trim().toUpperCase());
      const firstDataRow = headerRows[1];
      for (let c = 0; c < colLabels.length; c++) {
        const lbl = colLabels[c];
        const val = String(firstDataRow[c] ?? "").trim();
        if (!val) continue;
        if (lbl.includes("SPK") || lbl.includes("ORDER")) headerData.orderId = val;
        if (lbl.includes("TANGGAL") || lbl.includes("DATE")) {
          const parsedDate = parseExcelDate(firstDataRow[c]);
          if (parsedDate) headerData.prodDate = parsedDate;
        }
        if (lbl.includes("GUDANG") || lbl.includes("LOC")) headerData.locId = val.toUpperCase();
        if (lbl.includes("SHIFT")) {
          const s = parseInt(val, 10);
          if (s >= 1 && s <= 3) headerData.shift = s;
        }
        if (lbl.includes("KET") || lbl.includes("REMARK")) headerData.remark = val;
        if (lbl.includes("RATOR") || lbl.includes("OPERATOR")) {
          const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
          if (!isNaN(num) && num > 0) headerData.noRator = num;
        }
      }
    }
  }

  // 3. Validasi SPK terhadap database taPROrder jika No SPK dicantumkan di Excel
  if (headerData.orderId) {
    const cleanSpk = headerData.orderId.trim();
    try {
      const spkRes = await runQuery(
        `SELECT TOP 1 OrderID, OrderType, OrderDate, Remark, Completed
         FROM [cp].[dbo].[taPROrder]
         WHERE OrderID = @OrderID`,
        [{ name: "OrderID", type: sql.VarChar(25), value: cleanSpk }]
      );

      if (spkRes.recordset && spkRes.recordset.length > 0) {
        const spkRow = spkRes.recordset[0];
        headerData.orderId = String(spkRow.OrderID).trim();
        headerData.orderType = String(spkRow.OrderType ?? "OI").trim();
        headerData.spkRemark = spkRow.Remark ? String(spkRow.Remark).trim() : "";
        headerData.isSpkValid = true;
      } else {
        headerData.isSpkValid = false;
        headerData.spkError = `No. SPK '${cleanSpk}' tidak ditemukan di tabel taPROrder.`;
      }
    } catch (e: any) {
      log.warn({ err: e, orderId: cleanSpk }, "Gagal memverifikasi SPK di database saat import");
      headerData.isSpkValid = false;
      headerData.spkError = e?.message || "Gagal memvalidasi SPK di database.";
    }
  }

  // 4. Kumpulkan baris barang dari tabel rincian
  const rawItemEntries: Array<{
    itemType: "B" | "H";
    itemId: string;
    rawName: string;
    rawSatuan: string;
    bags: number;
    qty: number;
    keterangan: string;
    rowNumber: number;
  }> = [];

  for (let r = headerRowIdx + 1; r < allRows.length; r++) {
    const row = allRows[r];
    if (!row || row.length === 0) continue;

    const rawCode = String(row[colCodeIdx] ?? "").trim();
    // Berhenti jika baris kosong atau mencapai petunjuk pengisian
    if (!rawCode) continue;
    if (rawCode.toUpperCase().includes("PETUNJUK") || rawCode.toUpperCase().includes("CATATAN")) break;

    const rawType = String(row[colTypeIdx] ?? "").trim().toUpperCase();
    const itemType: "B" | "H" =
      rawType.startsWith("H") || rawType.includes("HASIL") || rawType.includes("OUTPUT") ? "H" : "B";

    const rawName = colNameIdx !== -1 ? String(row[colNameIdx] ?? "").trim() : "";
    const rawSatuan = colSatuanIdx !== -1 ? String(row[colSatuanIdx] ?? "").trim() : "";
    const bags =
      colBagsIdx !== -1
        ? Math.max(0, parseInt(String(row[colBagsIdx] ?? "0").replace(/[^0-9-]/g, "") || "0", 10))
        : 0;
    const qty = Math.max(0, parseFloat(String(row[colQtyIdx] ?? "0").replace(/[^0-9.-]/g, "") || "0"));
    const keterangan = colKetIdx !== -1 ? String(row[colKetIdx] ?? "").trim() : "";

    // Ambil orderId dari kolom baris jika ada dan belum terisi dari header
    if (!headerData.orderId && colSpkIdx !== -1) {
      const rowSpk = String(row[colSpkIdx] ?? "").trim();
      if (rowSpk && !rowSpk.startsWith("<-")) {
        headerData.orderId = rowSpk;
      }
    }

    rawItemEntries.push({
      itemType,
      itemId: rawCode,
      rawName,
      rawSatuan,
      bags,
      qty,
      keterangan,
      rowNumber: r + 1,
    });
  }

  if (rawItemEntries.length === 0) {
    throw new Error("Tidak ditemukan baris barang di dalam file Excel.");
  }

  // 5. Batch query ke taGoods untuk verifikasi & ambil nama/satuan resmi
  const allCodes = rawItemEntries.map((e) => e.itemId);
  const goodsMap = await getGoodsBatch(allCodes);

  const bahanList: ParsedProductionImportItem[] = [];
  const hasilList: ParsedProductionImportItem[] = [];
  let invalidCount = 0;

  for (const entry of rawItemEntries) {
    const matched = goodsMap.get(entry.itemId.toUpperCase());
    let isValid = Boolean(matched);
    let error: string | undefined;

    if (!matched) {
      error = `Kode '${entry.itemId}' tidak terdaftar di master taGoods`;
      isValid = false;
    } else if (entry.qty <= 0) {
      error = `Qty untuk barang '${entry.itemId}' harus lebih dari 0`;
      isValid = false;
    }

    if (!isValid) invalidCount++;

    const item: ParsedProductionImportItem = {
      itemType: entry.itemType,
      itemId: matched ? matched.itemId : entry.itemId,
      itemName: matched ? matched.itemName : entry.rawName || "-",
      satuan: matched ? matched.satuan : entry.rawSatuan || "Pcs",
      bags: entry.bags,
      qty: entry.qty,
      keterangan: entry.keterangan,
      isValid,
      error,
    };

    if (entry.itemType === "H") {
      hasilList.push(item);
    } else {
      bahanList.push(item);
    }
  }

  const totalBahanQty = bahanList.reduce((acc, b) => acc + b.qty, 0);
  const totalHasilQty = hasilList.reduce((acc, h) => acc + h.qty, 0);
  const totalBahanBags = bahanList.reduce((acc, b) => acc + b.bags, 0);
  const totalHasilBags = hasilList.reduce((acc, h) => acc + h.bags, 0);

  return {
    header: headerData,
    bahanList,
    hasilList,
    summary: {
      totalBahanRows: bahanList.length,
      totalHasilRows: hasilList.length,
      totalBahanQty: Math.round(totalBahanQty * 100) / 100,
      totalHasilQty: Math.round(totalHasilQty * 100) / 100,
      totalBahanBags,
      totalHasilBags,
      invalidCount,
    },
  };
}

