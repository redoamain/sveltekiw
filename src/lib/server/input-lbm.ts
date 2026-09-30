import { runQuery, withTransaction, log } from "@/lib/db";
import sql from "mssql";
import * as XLSX from "xlsx";
import { searchGoods, getGoodsBatch } from "$lib/server/input-produksi";

export interface LbmDetailInput {
  itemId: string;
  itemName?: string;
  satuan?: string;
  bags?: number;
  kgs: number;
  price?: number;
  hppPrice?: number;
  notes?: string;
}

export interface CreateLbmPayload {
  moveId?: string;
  moveType: "A" | "P" | "O";
  moveDate: string; // YYYY-MM-DD
  locId: string;    // e.g. GUDUT, GUDIN, GUDAS
  remark?: string;  // e.g. Sisa Tab Mesin, Recycle
  noRator?: number | null;
  docId?: string | null;
  notes?: string;
  hargaHpp?: boolean;
  total?: number;
  details: LbmDetailInput[];
}

export interface ParsedLbmImportItem {
  itemId: string;
  itemName: string;
  satuan: string;
  bags: number;
  kgs: number;
  price: number;
  hppPrice: number;
  notes?: string;
  isValid: boolean;
  error?: string;
}

export interface ParsedLbmImport {
  header: {
    moveId?: string;
    moveType?: "A" | "P" | "O";
    moveDate?: string;
    locId?: string;
    noRator?: number | null;
    remark?: string;
    hargaHpp?: boolean;
    isLocValid?: boolean;
    locError?: string;
  };
  items: ParsedLbmImportItem[];
  summary: {
    totalRows: number;
    totalKgs: number;
    totalBags: number;
    invalidCount: number;
  };
}

/**
 * Menghitung nomor bukti LBM berikutnya berdasarkan MoveType ('A' / 'P' / 'O') dan Tanggal.
 * Format penomoran: YY (2 digit tahun) + 5 digit urutan (contoh: 2600022).
 */
export async function getNextLbmId(
  moveType: "A" | "P" | "O" = "A",
  dateStr?: string
): Promise<string> {
  const d = dateStr ? new Date(dateStr) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const prefix = `${yy}`;

  const res = await runQuery(
    `SELECT MAX(MoveID) as maxId
     FROM [cp].[dbo].[taOpNameIHD]
     WHERE MoveType = @MoveType AND MoveID LIKE @prefix`,
    [
      { name: "MoveType", type: sql.Char(1), value: moveType },
      { name: "prefix", type: sql.VarChar(10), value: `${prefix}%` },
    ]
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
 * Mengambil harga HPP terkini untuk ItemID dari tabel [cp].[dbo].[taHPPRegPrice].
 */
export async function getLatestHppPrice(itemId: string): Promise<number> {
  const cleanId = (itemId || "").trim().toUpperCase();
  if (!cleanId) return 0;
  const res = await runQuery(
    `SELECT TOP 1 Price
     FROM [cp].[dbo].[taHPPRegPrice]
     WHERE ItemID = @ItemID AND Price > 0
     ORDER BY yPeriode DESC, mPeriode DESC`,
    [{ name: "ItemID", type: sql.VarChar(50), value: cleanId }]
  );
  return Number(res.recordset[0]?.Price) || 0;
}

/**
 * Mengambil harga HPP terkini secara batch untuk sekumpulan ItemID.
 */
export async function getHppBatch(itemIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const clean = [...new Set(itemIds.map((id) => id.trim().toUpperCase()).filter(Boolean))];
  if (clean.length === 0) return map;

  for (let i = 0; i < clean.length; i += 500) {
    const chunk = clean.slice(i, i + 500);
    const placeholders = chunk.map((_, idx) => `@id${idx}`).join(", ");
    const inputs = chunk.map((id, idx) => ({
      name: `id${idx}`,
      type: sql.VarChar(50),
      value: id,
    }));

    const res = await runQuery(
      `WITH RankedHPP AS (
         SELECT ItemID, Price,
                ROW_NUMBER() OVER (PARTITION BY ItemID ORDER BY yPeriode DESC, mPeriode DESC) as rn
         FROM [cp].[dbo].[taHPPRegPrice]
         WHERE ItemID IN (${placeholders}) AND Price > 0
       )
       SELECT ItemID, Price
       FROM RankedHPP
       WHERE rn = 1`,
      inputs as never
    );

    for (const row of res.recordset) {
      map.set(String(row.ItemID).toUpperCase(), Number(row.Price) || 0);
    }
  }

  return map;
}

/**
 * Mengambil master data awal untuk halaman formulir Input LBM.
 */
export async function getLbmInitialData() {
  // 1. Gudang dari taLocation
  const locRes = await runQuery(
    `SELECT LocID, LocName, [virtual] 
     FROM [cp].[dbo].[taLocation] 
     ORDER BY LocID ASC`
  );

  // 2. Daftar Tipe LBM
  const moveTypes = [
    { code: "A", name: "A - Memo In / Adj. Opname (Penerimaan / Masuk Kembali)" },
    { code: "P", name: "P - Memo Pinjaman (Pengembalian Pinjaman)" },
    { code: "O", name: "O - Stock Opname (Penyesuaian Fisik Masuk)" },
  ];

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMoveId = await getNextLbmId("A", todayStr);

  // 3. 20 Transaksi LBM terakhir
  const recentRes = await runQuery(
    `SELECT TOP 20
       hd.MoveID, hd.MoveType, hd.MoveDate, hd.LocID,
       l.LocName, hd.Remark, hd.NoRator, hd.HargaHPP, hd.Total,
       (SELECT COUNT(*) FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalItems,
       (SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalKgs,
       (SELECT ISNULL(SUM(dt.Bags), 0) FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalBags
     FROM [cp].[dbo].[taOpNameIHD] hd
     LEFT JOIN [cp].[dbo].[taLocation] l ON hd.LocID = l.LocID
     WHERE hd.MoveType IN ('A', 'P', 'O')
     ORDER BY hd.MoveDate DESC, hd.MoveID DESC`
  );

  return {
    warehouses: locRes.recordset as Array<{ LocID: string; LocName: string; virtual: string }>,
    moveTypes,
    defaultDate: todayStr,
    nextMoveId,
    recentTransactions: recentRes.recordset.map((r: any) => ({
      moveId: String(r.MoveID),
      moveType: String(r.MoveType),
      moveDate: r.MoveDate ? new Date(r.MoveDate).toISOString().slice(0, 10) : "",
      locId: String(r.LocID || "-"),
      locName: String(r.LocName || "-"),
      remark: String(r.Remark || ""),
      noRator: r.NoRator != null ? Number(r.NoRator) : null,
      hargaHpp: Boolean(r.HargaHPP),
      total: Number(r.Total) || 0,
      totalItems: Number(r.TotalItems) || 0,
      totalKgs: Math.round(Number(r.TotalKgs) * 100) / 100,
      totalBags: Number(r.TotalBags) || 0,
    })),
  };
}

/**
 * Mengambil detail lengkap 1 transaksi LBM berdasarkan MoveID dan MoveType.
 */
export async function getLbmTransaction(moveId: string, moveType?: string) {
  const cleanMoveId = moveId.trim();
  const cleanType = (moveType || "").trim().toUpperCase();

  const whereClause = cleanType
    ? "hd.MoveID = @MoveID AND hd.MoveType = @MoveType"
    : "hd.MoveID = @MoveID AND hd.MoveType IN ('A', 'P', 'O')";

  const inputs: Array<{ name: string; type: any; value: any }> = [
    { name: "MoveID", type: sql.VarChar(9), value: cleanMoveId },
  ];
  if (cleanType) {
    inputs.push({ name: "MoveType", type: sql.Char(1), value: cleanType });
  }

  let hdRes = await runQuery(
    `SELECT TOP 1
       hd.MoveID, hd.MoveType, hd.MoveDate, hd.LocID,
       l.LocName, hd.Remark, hd.NoRator, hd.DocID, hd.printed, hd.Total, hd.HargaHPP
     FROM [cp].[dbo].[taOpNameIHD] hd
     LEFT JOIN [cp].[dbo].[taLocation] l ON hd.LocID = l.LocID
     WHERE ${whereClause}
     ORDER BY hd.MoveDate DESC`,
    inputs
  );

  if (hdRes.recordset.length === 0) {
    if (cleanType) {
      // Fallback: coba cari tanpa batasan MoveType spesifik
      const fallbackRes = await runQuery(
        `SELECT TOP 1
           hd.MoveID, hd.MoveType, hd.MoveDate, hd.LocID,
           l.LocName, hd.Remark, hd.NoRator, hd.DocID, hd.printed, hd.Total, hd.HargaHPP
         FROM [cp].[dbo].[taOpNameIHD] hd
         LEFT JOIN [cp].[dbo].[taLocation] l ON hd.LocID = l.LocID
         WHERE hd.MoveID = @MoveID AND hd.MoveType IN ('A', 'P', 'O')
         ORDER BY hd.MoveDate DESC`,
        [{ name: "MoveID", type: sql.VarChar(9), value: cleanMoveId }]
      );
      if (fallbackRes.recordset.length > 0) {
        hdRes = fallbackRes;
      } else {
        throw new Error(`Transaksi LBM '${cleanMoveId}' tidak ditemukan.`);
      }
    } else {
      throw new Error(`Transaksi LBM '${cleanMoveId}' tidak ditemukan.`);
    }
  }

  const hd = hdRes.recordset[0];
  const actualMoveType = String(hd.MoveType).trim();

  const dtRes = await runQuery(
    `SELECT
       dt.MoveID, dt.MoveType, dt.LocID, dt.ItemID,
       g.ItemName, ISNULL(dt.Satuan, ISNULL(g.SatuanKecil, 'Pcs')) AS Satuan,
       dt.Bags, dt.Kgs, dt.price, dt.total, dt.HPPPrice, dt.username, dt.userdatetime, dt.rjn, dt.notes
     FROM [cp].[dbo].[taOpNameIDT] dt
     LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
     WHERE dt.MoveID = @MoveID AND dt.MoveType = @MoveType
     ORDER BY dt.rjn ASC`,
    [
      { name: "MoveID", type: sql.VarChar(9), value: cleanMoveId },
      { name: "MoveType", type: sql.Char(1), value: actualMoveType },
    ]
  );

  return {
    header: {
      moveId: String(hd.MoveID).trim(),
      moveType: actualMoveType,
      moveDate: hd.MoveDate ? new Date(hd.MoveDate).toISOString().slice(0, 10) : "",
      locId: String(hd.LocID || "").trim(),
      locName: String(hd.LocName || "").trim(),
      remark: String(hd.Remark || "").trim(),
      noRator: hd.NoRator != null ? Number(hd.NoRator) : null,
      docId: hd.DocID ? String(hd.DocID).trim() : null,
      printed: Number(hd.printed) || 0,
      total: Number(hd.Total) || 0,
      hargaHpp: Boolean(hd.HargaHPP),
    },
    items: dtRes.recordset.map((r: any) => ({
      rjn: Number(r.rjn),
      itemId: String(r.ItemID || "").trim(),
      itemName: String(r.ItemName || r.ItemID || "").trim(),
      satuan: String(r.Satuan || "Pcs").trim(),
      bags: Math.round(Number(r.Bags)) || 0,
      kgs: Math.round(Number(r.Kgs)) || 0,
      price: Number(r.price) || 0,
      total: Number(r.total) || 0,
      hppPrice: Number(r.HPPPrice) || 0,
      notes: r.notes ? String(r.notes).trim() : "",
      username: r.username ? String(r.username).trim() : null,
    })),
  };
}

/**
 * Menyimpan transaksi LBM baru (taOpNameIHD + taOpNameIDT) secara atomic.
 */
export async function createLbmTransaction(
  payload: CreateLbmPayload,
  username: string
): Promise<{ success: boolean; moveId: string; message: string }> {
  const moveType = payload.moveType === "P" ? "P" : payload.moveType === "O" ? "O" : "A";
  const locId = (payload.locId ?? "").trim().toUpperCase();

  if (!locId) throw new Error("Gudang Penerima (LocID) wajib dipilih.");

  const details = payload.details || [];
  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) {
    throw new Error("Rincian barang LBM minimal harus memiliki 1 item.");
  }

  for (const d of validDetails) {
    if (d.kgs <= 0) {
      throw new Error(`Kuantitas barang '${d.itemId}' harus lebih dari 0.`);
    }
  }

  const moveDateStr = payload.moveDate ? payload.moveDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const moveDateTime = new Date(`${moveDateStr}T00:00:00.000Z`);
  const currentDateTime = new Date();
  const cleanUser = (username || "OPERATOR").slice(0, 50);

  return await withTransaction(async (tx) => {
    // 1. Tentukan MoveID
    let finalMoveId = (payload.moveId ?? "").trim();
    if (!finalMoveId) {
      finalMoveId = await getNextLbmId(moveType, moveDateStr);
    }

    // Periksa jika MoveID sudah ada
    const existCheck = await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .input("MoveType", sql.Char(1), moveType)
      .query(`SELECT TOP 1 MoveID FROM [cp].[dbo].[taOpNameIHD] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    if (existCheck.recordset.length > 0) {
      finalMoveId = await getNextLbmId(moveType, moveDateStr);
    }

    const noRatorNum = payload.noRator ? parseInt(String(payload.noRator), 10) : null;
    const cleanRemark = payload.remark ? payload.remark.slice(0, 50) : null;
    const cleanDocId = payload.docId ? payload.docId.slice(0, 7) : null;
    const isHargaHpp = Boolean(payload.hargaHpp);

    // Hitung total nilai transaksi dan subtotal item
    let calculatedHeaderTotal = 0;
    const computedDetails = validDetails.map((d) => {
      const cleanItemId = d.itemId.trim().toUpperCase();
      const bags = Math.max(0, parseInt(String(d.bags ?? 0), 10) || 0);
      const kgs = Math.max(0, parseInt(String(d.kgs ?? 0), 10) || 0);
      const hpp = typeof d.hppPrice === "number" && !isNaN(d.hppPrice) ? d.hppPrice : 0;
      const price = isHargaHpp
        ? (typeof d.price === "number" && d.price > 0 ? d.price : hpp)
        : 1;
      const lineTotal = isHargaHpp ? Math.round(kgs * price * 100) / 100 : kgs;
      calculatedHeaderTotal += lineTotal;
      const satuan = d.satuan ? d.satuan.slice(0, 10) : null;
      return { cleanItemId, bags, kgs, price, lineTotal, hpp, satuan };
    });

    const finalHeaderTotal = Math.round(calculatedHeaderTotal * 100) / 100;

    // 2. Insert Header taOpNameIHD
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .input("MoveType", sql.Char(1), moveType)
      .input("LocID", sql.VarChar(6), locId)
      .input("MoveDate", sql.DateTime, moveDateTime)
      .input("Total", sql.Money, finalHeaderTotal)
      .input("Remark", sql.VarChar(50), cleanRemark)
      .input("printed", sql.TinyInt, 0)
      .input("DocID", sql.VarChar(7), cleanDocId)
      .input("NoRator", sql.Int, noRatorNum)
      .input("HargaHPP", sql.Bit, isHargaHpp ? 1 : 0)
      .query(`
        INSERT INTO [cp].[dbo].[taOpNameIHD] (
          MoveID, MoveType, LocID, MoveDate, Total, Remark, printed, DocID, NoRator, HargaHPP
        ) VALUES (
          @MoveID, @MoveType, @LocID, @MoveDate, @Total, @Remark, @printed, @DocID, @NoRator, @HargaHPP
        )
      `);

    // 3. Insert Detail taOpNameIDT (rjn IDENTITY)
    for (const d of computedDetails) {
      await tx
        .request()
        .input("MoveID", sql.VarChar(9), finalMoveId)
        .input("MoveType", sql.Char(1), moveType)
        .input("MoveDate", sql.DateTime, moveDateTime)
        .input("LocID", sql.VarChar(6), locId)
        .input("ItemID", sql.VarChar(40), d.cleanItemId)
        .input("Bags", sql.Float, d.bags)
        .input("Kgs", sql.Float, d.kgs)
        .input("price", sql.Float, d.price)
        .input("total", sql.Money, d.lineTotal)
        .input("HPPPrice", sql.Float, d.hpp)
        .input("username", sql.VarChar(50), cleanUser)
        .input("userdatetime", sql.DateTime, currentDateTime)
        .input("Satuan", sql.VarChar(10), d.satuan)
        .input("notes", sql.VarChar(250), null)
        .query(`
          INSERT INTO [cp].[dbo].[taOpNameIDT] (
            MoveID, MoveType, MoveDate, LocID, ItemID, Bags, Kgs, price, total, HPPPrice,
            username, userdatetime, Satuan, notes
          ) VALUES (
            @MoveID, @MoveType, @MoveDate, @LocID, @ItemID, @Bags, @Kgs, @price, @total, @HPPPrice,
            @username, @userdatetime, @Satuan, @notes
          )
        `);
    }

    // 4. Update taNumber counter OpNameI agar sinkron jika tipe A atau P
    try {
      const yearFull = moveDateTime.getFullYear();
      const counterVal = `${yearFull}${finalMoveId.slice(2).padStart(5, "0")}`;
      await tx
        .request()
        .input("val", sql.VarChar(20), counterVal)
        .query(`UPDATE [cp].[dbo].[taNumber] SET OpNameI = @val`);
    } catch (cntErr) {
      log.warn({ cntErr, finalMoveId }, "Gagal sinkronisasi counter OpNameI di taNumber");
    }

    // 5. Audit Log ke taLogNew
    try {
      await tx
        .request()
        .input("Remark", sql.VarChar(50), "Input LBM")
        .input("Username", sql.VarChar(50), cleanUser)
        .input("TransNo", sql.VarChar(25), finalMoveId)
        .input("TransDateTime", sql.DateTime, moveDateTime)
        .query(`
          INSERT INTO [cp].[dbo].[taLogNew] (Remark, Username, UserDatetime, TransNo, TransDateTime)
          VALUES (@Remark, @Username, GETDATE(), @TransNo, @TransDateTime)
        `);
    } catch (logErr) {
      log.warn({ logErr, moveId: finalMoveId }, "Gagal mencatat audit log ke taLogNew");
    }

    log.info(
      { moveId: finalMoveId, moveType, locId, detailsCount: validDetails.length, username: cleanUser },
      "✅ Transaksi LBM berhasil disimpan"
    );

    return {
      success: true,
      moveId: finalMoveId,
      message: `Bukti LBM ${finalMoveId} (${moveType}) berhasil disimpan dengan ${validDetails.length} barang.`,
    };
  });
}

/**
 * Memperbarui transaksi LBM yang sudah ada.
 */
export async function updateLbmTransaction(
  payload: CreateLbmPayload,
  username: string
): Promise<{ success: boolean; moveId: string; message: string }> {
  const finalMoveId = (payload.moveId ?? "").trim();
  const moveType = payload.moveType === "P" ? "P" : payload.moveType === "O" ? "O" : "A";
  const locId = (payload.locId ?? "").trim().toUpperCase();

  if (!finalMoveId) throw new Error("Nomor Bukti LBM (MoveID) wajib disertakan untuk update.");
  if (!locId) throw new Error("Gudang Penerima (LocID) wajib dipilih.");

  const details = payload.details || [];
  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) {
    throw new Error("Rincian barang LBM minimal harus memiliki 1 item.");
  }

  for (const d of validDetails) {
    if (d.kgs <= 0) {
      throw new Error(`Kuantitas barang '${d.itemId}' harus lebih dari 0.`);
    }
  }

  const moveDateStr = payload.moveDate ? payload.moveDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const moveDateTime = new Date(`${moveDateStr}T00:00:00.000Z`);
  const currentDateTime = new Date();
  const cleanUser = (username || "OPERATOR").slice(0, 50);

  return await withTransaction(async (tx) => {
    // 1. Cek keberadaan transaksi
    const checkRes = await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .input("MoveType", sql.Char(1), moveType)
      .query(`SELECT TOP 1 MoveID, LocID, MoveDate FROM [cp].[dbo].[taOpNameIHD] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    if (checkRes.recordset.length === 0) {
      throw new Error(`Bukti LBM '${finalMoveId}' (${moveType}) tidak ditemukan.`);
    }

    const noRatorNum = payload.noRator ? parseInt(String(payload.noRator), 10) : null;
    const cleanRemark = payload.remark ? payload.remark.slice(0, 50) : null;
    const cleanDocId = payload.docId ? payload.docId.slice(0, 7) : null;
    const isHargaHpp = Boolean(payload.hargaHpp);

    // Hitung total nilai transaksi dan subtotal item
    let calculatedHeaderTotal = 0;
    const computedDetails = validDetails.map((d) => {
      const cleanItemId = d.itemId.trim().toUpperCase();
      const bags = Math.max(0, parseInt(String(d.bags ?? 0), 10) || 0);
      const kgs = Math.max(0, parseInt(String(d.kgs ?? 0), 10) || 0);
      const hpp = typeof d.hppPrice === "number" && !isNaN(d.hppPrice) ? d.hppPrice : 0;
      const price = isHargaHpp
        ? (typeof d.price === "number" && d.price > 0 ? d.price : hpp)
        : 1;
      const lineTotal = isHargaHpp ? Math.round(kgs * price * 100) / 100 : kgs;
      calculatedHeaderTotal += lineTotal;
      const satuan = d.satuan ? d.satuan.slice(0, 10) : null;
      return { cleanItemId, bags, kgs, price, lineTotal, hpp, satuan };
    });

    const finalHeaderTotal = Math.round(calculatedHeaderTotal * 100) / 100;

    // 2. Update Header taOpNameIHD
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .input("MoveType", sql.Char(1), moveType)
      .input("LocID", sql.VarChar(6), locId)
      .input("MoveDate", sql.DateTime, moveDateTime)
      .input("Total", sql.Money, finalHeaderTotal)
      .input("Remark", sql.VarChar(50), cleanRemark)
      .input("DocID", sql.VarChar(7), cleanDocId)
      .input("NoRator", sql.Int, noRatorNum)
      .input("HargaHPP", sql.Bit, isHargaHpp ? 1 : 0)
      .query(`
        UPDATE [cp].[dbo].[taOpNameIHD]
        SET LocID = @LocID,
            MoveDate = @MoveDate,
            Total = @Total,
            Remark = @Remark,
            DocID = @DocID,
            NoRator = @NoRator,
            HargaHPP = @HargaHPP
        WHERE MoveID = @MoveID AND MoveType = @MoveType
      `);

    // 3. Hapus detail lama taOpNameIDT
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .input("MoveType", sql.Char(1), moveType)
      .query(`DELETE FROM [cp].[dbo].[taOpNameIDT] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    // 4. Masukkan kembali detail baru
    for (const d of computedDetails) {
      await tx
        .request()
        .input("MoveID", sql.VarChar(9), finalMoveId)
        .input("MoveType", sql.Char(1), moveType)
        .input("MoveDate", sql.DateTime, moveDateTime)
        .input("LocID", sql.VarChar(6), locId)
        .input("ItemID", sql.VarChar(40), d.cleanItemId)
        .input("Bags", sql.Float, d.bags)
        .input("Kgs", sql.Float, d.kgs)
        .input("price", sql.Float, d.price)
        .input("total", sql.Money, d.lineTotal)
        .input("HPPPrice", sql.Float, d.hpp)
        .input("username", sql.VarChar(50), cleanUser)
        .input("userdatetime", sql.DateTime, currentDateTime)
        .input("Satuan", sql.VarChar(10), d.satuan)
        .input("notes", sql.VarChar(250), null)
        .query(`
          INSERT INTO [cp].[dbo].[taOpNameIDT] (
            MoveID, MoveType, MoveDate, LocID, ItemID, Bags, Kgs, price, total, HPPPrice,
            username, userdatetime, Satuan, notes
          ) VALUES (
            @MoveID, @MoveType, @MoveDate, @LocID, @ItemID, @Bags, @Kgs, @price, @total, @HPPPrice,
            @username, @userdatetime, @Satuan, @notes
          )
        `);
    }

    // 5. Audit Log ke taLogNew
    try {
      await tx
        .request()
        .input("Remark", sql.VarChar(50), "Update LBM")
        .input("Username", sql.VarChar(50), cleanUser)
        .input("TransNo", sql.VarChar(25), finalMoveId)
        .input("TransDateTime", sql.DateTime, moveDateTime)
        .query(`
          INSERT INTO [cp].[dbo].[taLogNew] (Remark, Username, UserDatetime, TransNo, TransDateTime)
          VALUES (@Remark, @Username, GETDATE(), @TransNo, @TransDateTime)
        `);
    } catch (logErr) {
      log.warn({ logErr, moveId: finalMoveId }, "Gagal mencatat audit log ke taLogNew");
    }

    log.info(
      { moveId: finalMoveId, moveType, locId, detailsCount: validDetails.length, username: cleanUser },
      "✅ Transaksi LBM berhasil diperbarui"
    );

    return {
      success: true,
      moveId: finalMoveId,
      message: `Bukti LBM ${finalMoveId} (${moveType}) berhasil diperbarui dengan ${validDetails.length} barang.`,
    };
  });
}

/**
 * Menghapus transaksi LBM (taOpNameIHD + taOpNameIDT).
 */
export async function deleteLbmTransaction(
  moveId: string,
  moveType: string,
  username: string
): Promise<{ success: boolean; moveId: string; message: string }> {
  const cleanMoveId = moveId.trim();
  const cleanType = (moveType || "A").trim().toUpperCase();

  if (!cleanMoveId) {
    throw new Error("Nomor Bukti LBM (MoveID) wajib disertakan untuk penghapusan.");
  }

  return await withTransaction(async (tx) => {
    // 1. Periksa keberadaan transaksi
    const checkRes = await tx
      .request()
      .input("MoveID", sql.VarChar(9), cleanMoveId)
      .input("MoveType", sql.Char(1), cleanType)
      .query(`SELECT TOP 1 MoveID, MoveType, MoveDate FROM [cp].[dbo].[taOpNameIHD] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    if (checkRes.recordset.length === 0) {
      throw new Error(`Bukti LBM '${cleanMoveId}' (${cleanType}) tidak ditemukan.`);
    }

    const row = checkRes.recordset[0];
    const cleanUser = (username || "OPERATOR").slice(0, 50);

    // 2. Hapus detail taOpNameIDT
    const dtDelete = await tx
      .request()
      .input("MoveID", sql.VarChar(9), cleanMoveId)
      .input("MoveType", sql.Char(1), cleanType)
      .query(`DELETE FROM [cp].[dbo].[taOpNameIDT] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    // 3. Hapus header taOpNameIHD
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), cleanMoveId)
      .input("MoveType", sql.Char(1), cleanType)
      .query(`DELETE FROM [cp].[dbo].[taOpNameIHD] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    // 4. Audit Log ke taLogNew
    try {
      await tx
        .request()
        .input("Remark", sql.VarChar(50), "Hapus LBM")
        .input("Username", sql.VarChar(50), cleanUser)
        .input("TransNo", sql.VarChar(25), cleanMoveId)
        .input("TransDateTime", sql.DateTime, row.MoveDate ? new Date(row.MoveDate) : new Date())
        .query(`
          INSERT INTO [cp].[dbo].[taLogNew] (Remark, Username, UserDatetime, TransNo, TransDateTime)
          VALUES (@Remark, @Username, GETDATE(), @TransNo, @TransDateTime)
        `);
    } catch (logErr) {
      log.warn({ logErr, moveId: cleanMoveId }, "Gagal mencatat audit log ke taLogNew");
    }

    log.info(
      { moveId: cleanMoveId, moveType: cleanType, deletedDetails: dtDelete.rowsAffected[0] ?? 0, username: cleanUser },
      "🗑️ Transaksi LBM berhasil dihapus"
    );

    return {
      success: true,
      moveId: cleanMoveId,
      message: `Bukti LBM ${cleanMoveId} (${cleanType}) berhasil dihapus.`,
    };
  });
}

/**
 * Mencari riwayat transaksi LBM untuk modal pencarian.
 */
export async function searchLbmTransactions(query: string, limit: number = 20) {
  const kw = (query ?? "").trim();
  const where: string[] = ["hd.MoveType IN ('A', 'P', 'O')"];
  const inputs: Array<{ name: string; type: any; value: any }> = [
    { name: "Lim", type: sql.Int, value: Math.min(100, Math.max(1, limit)) },
  ];

  if (kw) {
    where.push(
      `(hd.MoveID LIKE @kw OR hd.Remark LIKE @kw OR l.LocName LIKE @kw OR hd.LocID LIKE @kw OR CAST(hd.NoRator AS VARCHAR) LIKE @kw OR EXISTS (SELECT 1 FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType AND dt.ItemID LIKE @kw))`
    );
    inputs.push({ name: "kw", type: sql.NVarChar, value: `%${kw}%` });
  }

  const clause = "WHERE " + where.join(" AND ");
  const res = await runQuery(
    `SELECT TOP (@Lim)
       hd.MoveID, hd.MoveType, hd.MoveDate, hd.LocID,
       l.LocName, hd.Remark, hd.NoRator, hd.HargaHPP, hd.Total,
       (SELECT COUNT(*) FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalItems,
       (SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalKgs,
       (SELECT ISNULL(SUM(dt.Bags), 0) FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalBags
     FROM [cp].[dbo].[taOpNameIHD] hd
     LEFT JOIN [cp].[dbo].[taLocation] l ON hd.LocID = l.LocID
     ${clause}
     ORDER BY hd.MoveDate DESC, hd.MoveID DESC`,
    inputs as never
  );

  return res.recordset.map((r: any) => ({
    moveId: String(r.MoveID),
    moveType: String(r.MoveType),
    moveDate: r.MoveDate ? new Date(r.MoveDate).toISOString().slice(0, 10) : "",
    locId: String(r.LocID || "-"),
    locName: String(r.LocName || "-"),
    remark: String(r.Remark || ""),
    noRator: r.NoRator != null ? Number(r.NoRator) : null,
    hargaHpp: Boolean(r.HargaHPP),
    total: Number(r.Total) || 0,
    totalItems: Number(r.TotalItems) || 0,
    totalKgs: Math.round(Number(r.TotalKgs) * 100) / 100,
    totalBags: Number(r.TotalBags) || 0,
  }));
}

/**
 * Menghasilkan file Buffer template Excel untuk import LBM.
 * Sheet 1: FORM_LBM (Data input tanpa kolom opsional nama/satuan)
 * Sheet 2: MASTER_GUDANG (Daftar kode & nama gudang sebagai referensi)
 */
export async function generateLbmExcelTemplate(): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Form Input
  const rows: any[][] = [
    ["TEMPLATE IMPORT LBM (LAPORAN BARANG MASUK) KIW", "", "", ""],
    ["", "", "", ""],
    ["Tipe LBM (A/P/O)", "A", "<- 'A' untuk Memo In / Masuk Kembali, 'P' untuk Pengembalian Pinjaman, 'O' untuk Stock Opname", ""],
    ["Tanggal (YYYY-MM-DD)", new Date().toISOString().slice(0, 10), "<- Format: YYYY-MM-DD, kosongkan jika sesuai hari ini", ""],
    ["Gudang Penerima", "GUDIN", "<- Kode Gudang (lihat Sheet MASTER_GUDANG), contoh: GUDIN, GUDUT, GUDAS", ""],
    ["Hitung Harga HPP (Y/N)", "N", "<- 'Y' jika ingin menghitung HPP, 'N' jika tanpa perhitungan HPP", ""],
    ["No. Rator", "", "<- Nomor Operator / Rator (angka bulat, contoh: 5082611), opsional", ""],
    ["Catatan / Remark", "Pemasukan Barang", "<- Catatan / keperluan barang masuk", ""],
    ["", "", "", ""],
    [
      "Kode Barang *",
      "Bags",
      "Qty (Kgs) *",
      "Harga HPP (Opsional)",
    ],
    ["ABS757", 1, 25, ""],
    ["00B002-RC", 0, 120, ""],
    ["", "", "", ""],
    ["PETUNJUK PENGISIAN:", "", "", ""],
    ["1. Template ini terdiri dari 2 sheet: 'FORM_LBM' (input data) dan 'MASTER_GUDANG' (referensi kode gudang).", "", "", ""],
    ["2. Tipe LBM: 'A' untuk Memo In / Masuk Kembali (default), 'P' untuk Pinjaman, 'O' untuk Stock Opname.", "", "", ""],
    ["3. Hitung Harga HPP: Isi 'Y' untuk menghitung nilai nominal HPP atau 'N' untuk transaksi tanpa HPP.", "", "", ""],
    ["4. Gudang Penerima wajib diisi sesuai kode resmi pada Sheet MASTER_GUDANG.", "", "", ""],
    ["5. Kolom Kode Barang: Wajib sesuai kode di master taGoods.", "", "", ""],
    ["6. Kolom Bags & Qty (Kgs): Masukkan bilangan bulat (integer tanpa desimal/koma).", "", "", ""],
    ["7. Kolom Harga HPP: Kosongkan untuk menggunakan harga HPP master secara otomatis.", "", "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 22 }, // Label Header / Kode Barang *
    { wch: 14 }, // Bags
    { wch: 18 }, // Qty (Kgs) *
    { wch: 22 }, // Harga HPP (Opsional)
  ];

  XLSX.utils.book_append_sheet(wb, ws, "FORM_LBM");

  // Sheet 2: Master Data Gudang
  let locRows: Array<{ LocID: string; LocName: string }> = [];
  try {
    const res = await runQuery(`SELECT LocID, LocName FROM [cp].[dbo].[taLocation] ORDER BY LocID ASC`);
    if (res?.recordset) locRows = res.recordset;
  } catch (err) {
    log.warn({ err }, "Gagal mengambil daftar gudang untuk template LBM");
  }

  const locSheetData: any[][] = [
    ["MASTER DATA GUDANG (REFERENSI)", "", ""],
    ["Gunakan kode gudang berikut pada baris Gudang di Sheet FORM_LBM.", "", ""],
    ["", "", ""],
    ["Kode Gudang (LocID)", "Nama Gudang", "Keterangan"],
  ];

  if (locRows.length > 0) {
    for (const l of locRows) {
      locSheetData.push([l.LocID, l.LocName, "-"]);
    }
  } else {
    locSheetData.push(["GUDIN", "GUDANG INJEKSI", "-"]);
    locSheetData.push(["GUDUT", "GUDANG UTAMA", "-"]);
    locSheetData.push(["GUDAS", "GUDANG ASSEMBLY", "-"]);
  }

  const locWs = XLSX.utils.aoa_to_sheet(locSheetData);
  locWs["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, locWs, "MASTER_GUDANG");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Membaca dan memvalidasi file Excel yang diunggah untuk import LBM.
 */
export async function parseLbmExcelImport(buffer: Buffer): Promise<ParsedLbmImport> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = wb.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error("File Excel kosong atau format tidak valid.");
  }

  const formSheetName =
    sheetNames.find(
      (s) =>
        s.toUpperCase().includes("LBM") ||
        s.toUpperCase().includes("FORM") ||
        s.toUpperCase().includes("IMPORT") ||
        s.toUpperCase().includes("DETAIL")
    ) || sheetNames[0];

  const ws = wb.Sheets[formSheetName];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (allRows.length === 0) {
    throw new Error("Sheet Excel tidak memiliki data.");
  }

  // Cari index header tabel barang
  let headerRowIdx = -1;
  let colCodeIdx = -1;
  let colBagsIdx = -1;
  let colQtyIdx = -1;
  let colHppIdx = -1;

  for (let r = 0; r < Math.min(30, allRows.length); r++) {
    const row = allRows[r].map((c) => String(c).trim().toUpperCase());
    if (row.length === 0 || row[0].includes("TEMPLATE")) continue;

    let tempCode = -1;
    let tempBags = -1;
    let tempQty = -1;
    let tempHpp = -1;

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val.startsWith("<-")) continue;

      if (
        (val.includes("KODE BARANG") ||
         val.includes("ITEM ID") ||
         val.includes("ITEMID") ||
         (val.includes("KODE") && !val.includes("GUDANG") && !val.includes("DEPT")))
      ) {
        tempCode = c;
      }
      if (val.includes("BAG") || val.includes("ZAK") || val.includes("KEMAS")) tempBags = c;
      if (val.includes("QTY") || val.includes("KG") || val.includes("JUMLAH") || val.includes("KUANTITAS")) tempQty = c;
      if (val.includes("HPP") || val.includes("PRICE") || (val.includes("HARGA") && !val.includes("TOTAL"))) tempHpp = c;
    }

    if (tempCode !== -1 && tempQty !== -1 && tempCode !== tempQty) {
      headerRowIdx = r;
      colCodeIdx = tempCode;
      colBagsIdx = tempBags;
      colQtyIdx = tempQty;
      colHppIdx = tempHpp;
      break;
    }
  }

  if (headerRowIdx === -1 || colCodeIdx === -1 || colQtyIdx === -1) {
    throw new Error(
      "Format tabel tidak dikenali. Pastikan file memiliki baris judul kolom dengan 'Kode Barang' dan 'Qty' (atau unduh template resmi)."
    );
  }

  // Parse Header Transaksi
  const headerData: ParsedLbmImport["header"] = {};

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

    if (label.includes("TIPE")) {
      const t = valStr.toUpperCase();
      if (t.startsWith("P")) headerData.moveType = "P";
      else if (t.startsWith("O")) headerData.moveType = "O";
      else if (t.startsWith("A")) headerData.moveType = "A";
    } else if (label.includes("TANGGAL") || label.includes("DATE")) {
      const dStr = String(valRaw ?? "").trim();
      const match = dStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match) {
        headerData.moveDate = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
      }
    } else if (label.includes("GUDANG") || label.includes("LOC")) {
      if (isCleanVal(valStr)) headerData.locId = valStr.toUpperCase();
    } else if (label.includes("HPP")) {
      const t = valStr.toUpperCase();
      headerData.hargaHpp = t.startsWith("Y") || t.startsWith("T") || t === "1";
    } else if (label.includes("RATOR") || label.includes("OPERATOR")) {
      if (isCleanVal(valStr)) {
        const num = parseInt(valStr.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(num) && num > 0) headerData.noRator = num;
      }
    } else if (label.includes("CATATAN") || label.includes("REMARK") || label.includes("KET")) {
      if (isCleanVal(valStr)) headerData.remark = valStr;
    }
  }

  // Validasi Gudang jika diisi
  if (headerData.locId) {
    try {
      const locCheck = await runQuery(
        `SELECT LocID FROM [cp].[dbo].[taLocation] WHERE LocID = @LocID`,
        [{ name: "LocID", type: sql.VarChar(6), value: headerData.locId }]
      );
      if (locCheck.recordset.length === 0) {
        headerData.isLocValid = false;
        headerData.locError = `Gudang '${headerData.locId}' tidak terdaftar di sistem.`;
      } else {
        headerData.isLocValid = true;
      }
    } catch {
      headerData.isLocValid = true;
    }
  }

  // Parse Baris Barang
  const rawItems: Array<{
    rawCode: string;
    bags: number;
    kgs: number;
    manualHpp: number;
    rowNumber: number;
  }> = [];

  for (let r = headerRowIdx + 1; r < allRows.length; r++) {
    const row = allRows[r];
    if (!row || row.length === 0) continue;

    const rawCode = String(row[colCodeIdx] ?? "").trim();
    if (!rawCode || rawCode.startsWith("PETUNJUK") || rawCode.startsWith("CATATAN")) continue;

    let bags = 0;
    if (colBagsIdx !== -1) {
      const bVal = String(row[colBagsIdx] ?? "").replace(/[^0-9]/g, "");
      bags = parseInt(bVal, 10) || 0;
    }

    let kgs = 0;
    if (colQtyIdx !== -1) {
      const qVal = String(row[colQtyIdx] ?? "").replace(/[^0-9]/g, "");
      kgs = parseInt(qVal, 10) || 0;
    }

    let manualHpp = 0;
    if (colHppIdx !== -1) {
      const hVal = parseFloat(String(row[colHppIdx] ?? "").replace(/[^0-9.]/g, ""));
      if (!isNaN(hVal) && hVal > 0) manualHpp = hVal;
    }

    rawItems.push({
      rawCode,
      bags,
      kgs,
      manualHpp,
      rowNumber: r + 1,
    });
  }

  if (rawItems.length === 0) {
    throw new Error("Tidak ada data barang yang ditemukan pada tabel Excel.");
  }

  // Batch lookup kode barang di taGoods dan taHPPRegPrice
  const itemCodes = rawItems.map((i) => i.rawCode);
  const [goodsMap, hppMap] = await Promise.all([
    getGoodsBatch(itemCodes),
    getHppBatch(itemCodes),
  ]);

  const items: ParsedLbmImportItem[] = [];
  let totalKgs = 0;
  let totalBags = 0;
  let invalidCount = 0;

  for (const item of rawItems) {
    const found = goodsMap.get(item.rawCode.toUpperCase());
    let isValid = true;
    let error: string | undefined = undefined;

    if (!found) {
      isValid = false;
      error = `Kode barang '${item.rawCode}' tidak terdaftar di database`;
      invalidCount++;
    } else if (item.kgs <= 0) {
      isValid = false;
      error = "Kuantitas (Kgs) harus bilangan bulat lebih dari 0";
      invalidCount++;
    }

    if (isValid) {
      totalKgs += item.kgs;
      totalBags += item.bags;
    }

    const hppPrice = item.manualHpp > 0 ? item.manualHpp : (hppMap.get(item.rawCode.toUpperCase()) || 0);

    items.push({
      itemId: found ? found.itemId : item.rawCode,
      itemName: found ? found.itemName : "Barang Tidak Dikenal",
      satuan: found ? found.satuan : "Pcs",
      bags: item.bags,
      kgs: item.kgs,
      price: hppPrice > 0 ? hppPrice : 1,
      hppPrice,
      isValid,
      error,
    });
  }

  return {
    header: headerData,
    items,
    summary: {
      totalRows: items.length,
      totalKgs,
      totalBags,
      invalidCount,
    },
  };
}
