import sql from "mssql";
import { runQuery, withTransaction, log } from "@/lib/db";
import * as XLSX from "xlsx";
import { getHppBatch, getLatestHppPrice } from "./input-lbm";

export interface ReturDetailInput {
  itemId: string;
  itemName?: string;
  satuan?: string;
  bags: number;
  kgs: number;
  price?: number;
  hppPrice?: number;
  notes?: string;
}

export interface CreateReturPayload {
  moveId: string;
  moveDate: string; // YYYY-MM-DD
  locId: string;
  remark?: string;
  noRator?: number | null;
  hargaHpp?: boolean;
  docId?: string | null;
  details: ReturDetailInput[];
}

export interface ParsedReturImportItem {
  rowNumber: number;
  itemId: string;
  itemName?: string;
  satuan?: string;
  bags: number;
  kgs: number;
  price: number;
  hppPrice: number;
  notes?: string;
  isValid: boolean;
  errorMessage?: string;
}

export interface ParseReturImportResult {
  header: {
    moveId?: string;
    moveDate: string;
    locId: string;
    noRator?: number | null;
    remark?: string;
    hargaHpp?: boolean;
    isLocValid?: boolean;
    locError?: string;
  };
  items: ParsedReturImportItem[];
  summary: {
    totalRows: number;
    totalKgs: number;
    totalBags: number;
    invalidCount: number;
  };
}

/**
 * Menghitung nomor bukti Retur berikutnya berdasarkan tahun dan tanggal.
 * MoveType untuk Retur Produksi selalu 'K'.
 * Format penomoran: YY (2 digit tahun) + 5 digit urutan (contoh: 2600001).
 */
export async function getNextReturId(dateStr?: string): Promise<string> {
  const d = dateStr ? new Date(dateStr) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const prefix = `${yy}`;

  const res = await runQuery(
    `SELECT MAX(MoveID) as maxId
     FROM [cp].[dbo].[taOpNameIHD]
     WHERE MoveType = 'K' AND MoveID LIKE @prefix`,
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
 * Mengambil master data awal untuk halaman formulir Input Retur Produksi.
 */
export async function getReturInitialData() {
  const locRes = await runQuery(
    `SELECT LocID, LocName, [virtual] 
     FROM [cp].[dbo].[taLocation] 
     ORDER BY LocID ASC`
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMoveId = await getNextReturId(todayStr);

  const recentRes = await runQuery(
    `SELECT TOP 20
       hd.MoveID, hd.MoveType, hd.MoveDate, hd.LocID,
       l.LocName, hd.Remark, hd.NoRator, hd.HargaHPP, hd.Total,
       (SELECT COUNT(*) FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalItems,
       (SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalKgs,
       (SELECT ISNULL(SUM(dt.Bags), 0) FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalBags
     FROM [cp].[dbo].[taOpNameIHD] hd
     LEFT JOIN [cp].[dbo].[taLocation] l ON hd.LocID = l.LocID
     WHERE hd.MoveType = 'K'
     ORDER BY hd.MoveDate DESC, hd.MoveID DESC`
  );

  return {
    warehouses: locRes.recordset as Array<{ LocID: string; LocName: string; virtual: string }>,
    defaultDate: todayStr,
    nextMoveId,
    recentTransactions: recentRes.recordset.map((r: any) => ({
      moveId: String(r.MoveID),
      moveType: 'K',
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
 * Mengambil detail transaksi Retur Produksi berdasarkan MoveID.
 */
export async function getReturTransaction(moveId: string) {
  const cleanMoveId = moveId.trim();
  if (!cleanMoveId) return null;

  const hdRes = await runQuery(
    `SELECT TOP 1
       hd.MoveID, hd.MoveType, hd.MoveDate, hd.LocID,
       l.LocName, hd.Remark, hd.NoRator, hd.HargaHPP, hd.Total, hd.DocID
     FROM [cp].[dbo].[taOpNameIHD] hd
     LEFT JOIN [cp].[dbo].[taLocation] l ON hd.LocID = l.LocID
     WHERE hd.MoveID = @MoveID AND hd.MoveType = 'K'`,
    [{ name: "MoveID", type: sql.VarChar(9), value: cleanMoveId }]
  );

  if (hdRes.recordset.length === 0) return null;
  const hd = hdRes.recordset[0];

  const dtRes = await runQuery(
    `SELECT
       dt.rjn, dt.ItemID, g.ItemName, dt.Bags, dt.Kgs, dt.price, dt.total,
       dt.HPPPrice, dt.Satuan, dt.notes, dt.username, dt.userdatetime,
       kr.NamaJenis as Kategori
     FROM [cp].[dbo].[taOpNameIDT] dt
     LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
     LEFT JOIN [cp].[dbo].[taKindofGoods] kr ON g.KodeJenis = kr.KodeJenis
     WHERE dt.MoveID = @MoveID AND dt.MoveType = 'K'
     ORDER BY dt.rjn ASC`,
    [{ name: "MoveID", type: sql.VarChar(9), value: cleanMoveId }]
  );

  return {
    header: {
      moveId: String(hd.MoveID),
      moveType: 'K',
      moveDate: hd.MoveDate ? new Date(hd.MoveDate).toISOString().slice(0, 10) : "",
      locId: String(hd.LocID || ""),
      locName: String(hd.LocName || ""),
      remark: String(hd.Remark || ""),
      noRator: hd.NoRator != null ? Number(hd.NoRator) : null,
      hargaHpp: Boolean(hd.HargaHPP),
      total: Number(hd.Total) || 0,
      docId: hd.DocID ? String(hd.DocID) : null,
    },
    items: dtRes.recordset.map((r: any) => ({
      rjn: Number(r.rjn),
      itemId: String(r.ItemID),
      itemName: String(r.ItemName || r.ItemID),
      bags: Number(r.Bags) || 0,
      kgs: Number(r.Kgs) || 0,
      price: Number(r.price) || 1,
      total: Number(r.total) || 0,
      hppPrice: Number(r.HPPPrice) || 0,
      satuan: String(r.Satuan || "Pcs"),
      notes: r.notes ? String(r.notes) : "",
      kategori: r.Kategori ? String(r.Kategori) : "",
    })),
  };
}

/**
 * Menyimpan transaksi Retur Produksi baru secara atomic.
 */
export async function createReturTransaction(
  payload: CreateReturPayload,
  username: string
): Promise<{ success: boolean; moveId: string; message: string }> {
  let finalMoveId = (payload.moveId ?? "").trim();
  const locId = (payload.locId ?? "").trim().toUpperCase();

  if (!locId) throw new Error("Gudang Penerima Retur (LocID) wajib dipilih.");

  const details = payload.details || [];
  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) {
    throw new Error("Minimal harus ada 1 item barang yang valid untuk disimpan.");
  }

  for (const d of validDetails) {
    if (d.kgs < 0) throw new Error(`Qty (Kgs) untuk item '${d.itemId}' tidak boleh negatif.`);
    if (d.bags < 0) throw new Error(`Bags untuk item '${d.itemId}' tidak boleh negatif.`);
  }

  const cleanRemark = (payload.remark ?? "Retur Produksi").trim().slice(0, 50);
  const noRator = payload.noRator != null && !isNaN(payload.noRator) ? Number(payload.noRator) : null;
  const hargaHpp = Boolean(payload.hargaHpp);
  const cleanUser = (username || "OPERATOR").slice(0, 20);

  const moveDateStr = payload.moveDate || new Date().toISOString().slice(0, 10);
  const moveDateTime = new Date(`${moveDateStr} 08:00:00`);
  const currentDateTime = new Date();

  return await withTransaction(async (tx) => {
    // 1. Cek atau generate nomor bukti MoveID
    if (!finalMoveId) {
      finalMoveId = await getNextReturId(moveDateStr);
    } else {
      const existingCheck = await tx
        .request()
        .input("MoveID", sql.VarChar(9), finalMoveId)
        .query(`SELECT TOP 1 MoveID FROM [cp].[dbo].[taOpNameIHD] WHERE MoveID = @MoveID AND MoveType = 'K'`);

      if (existingCheck.recordset.length > 0) {
        throw new Error(`Nomor Bukti Retur '${finalMoveId}' sudah terpakai.`);
      }
    }

    // Ambil HPP untuk item yang belum memiliki HPP
    const itemIdsToFetchHpp = validDetails
      .filter((d) => !d.hppPrice || Number(d.hppPrice) <= 0)
      .map((d) => d.itemId);
    const hppMap = await getHppBatch(itemIdsToFetchHpp);

    let calculatedHeaderTotal = 0;
    const computedDetails = validDetails.map((d) => {
      const cleanItemId = d.itemId.trim().toUpperCase();
      const bags = Math.max(0, Math.floor(Number(d.bags) || 0));
      const kgs = Math.max(0, Number(d.kgs) || 0);
      const hpp = Number(d.hppPrice) > 0 ? Number(d.hppPrice) : (hppMap.get(cleanItemId) || 0);
      const price = Number(d.price) || 1;
      const total = Math.round(kgs * price * 100) / 100;
      calculatedHeaderTotal += total;
      const satuan = (d.satuan || "Pcs").slice(0, 10);

      return {
        cleanItemId,
        bags,
        kgs,
        price,
        total,
        hppPrice: hpp,
        satuan,
      };
    });

    const finalHeaderTotal = Math.round(calculatedHeaderTotal * 100) / 100;

    // 2. Insert Header taOpNameIHD
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .input("MoveType", sql.Char(1), 'K')
      .input("LocID", sql.VarChar(6), locId)
      .input("MoveDate", sql.DateTime, moveDateTime)
      .input("Total", sql.Money, finalHeaderTotal)
      .input("Remark", sql.VarChar(50), cleanRemark)
      .input("printed", sql.SmallInt, 0)
      .input("DocID", sql.VarChar(20), payload.docId || null)
      .input("NoRator", sql.Int, noRator)
      .input("HargaHPP", sql.Bit, hargaHpp ? 1 : 0)
      .query(`
        INSERT INTO [cp].[dbo].[taOpNameIHD] (
          MoveID, MoveType, LocID, MoveDate, Total, Remark, printed, DocID, NoRator, HargaHPP
        ) VALUES (
          @MoveID, @MoveType, @LocID, @MoveDate, @Total, @Remark, @printed, @DocID, @NoRator, @HargaHPP
        )
      `);

    // 3. Insert Detail taOpNameIDT (trigger taOpnameIDTIn otomatis mencatat log)
    for (const d of computedDetails) {
      await tx
        .request()
        .input("MoveID", sql.VarChar(9), finalMoveId)
        .input("MoveType", sql.Char(1), 'K')
        .input("MoveDate", sql.DateTime, moveDateTime)
        .input("LocID", sql.VarChar(6), locId)
        .input("ItemID", sql.VarChar(40), d.cleanItemId)
        .input("Bags", sql.Float, d.bags)
        .input("Kgs", sql.Float, d.kgs)
        .input("price", sql.Float, d.price)
        .input("total", sql.Float, d.total)
        .input("HPPPrice", sql.Float, d.hppPrice)
        .input("username", sql.VarChar(20), cleanUser)
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

    log.info({ moveId: finalMoveId, itemsCount: computedDetails.length }, "Retur Produksi berhasil disimpan.");
    return {
      success: true,
      moveId: finalMoveId,
      message: `Transaksi Retur Produksi '${finalMoveId}' berhasil disimpan (${computedDetails.length} item).`,
    };
  });
}

/**
 * Memperbarui transaksi Retur Produksi.
 */
export async function updateReturTransaction(
  payload: CreateReturPayload,
  username: string
): Promise<{ success: boolean; moveId: string; message: string }> {
  const finalMoveId = (payload.moveId ?? "").trim();
  const locId = (payload.locId ?? "").trim().toUpperCase();

  if (!finalMoveId) throw new Error("Nomor Bukti Retur (MoveID) wajib disertakan untuk update.");
  if (!locId) throw new Error("Gudang Penerima Retur (LocID) wajib dipilih.");

  const details = payload.details || [];
  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) {
    throw new Error("Minimal harus ada 1 item barang yang valid untuk disimpan.");
  }

  const cleanRemark = (payload.remark ?? "Retur Produksi").trim().slice(0, 50);
  const noRator = payload.noRator != null && !isNaN(payload.noRator) ? Number(payload.noRator) : null;
  const hargaHpp = Boolean(payload.hargaHpp);
  const cleanUser = (username || "OPERATOR").slice(0, 20);

  const moveDateStr = payload.moveDate || new Date().toISOString().slice(0, 10);
  const moveDateTime = new Date(`${moveDateStr} 08:00:00`);
  const currentDateTime = new Date();

  return await withTransaction(async (tx) => {
    const checkRes = await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .query(`SELECT TOP 1 MoveID, LocID, MoveDate FROM [cp].[dbo].[taOpNameIHD] WHERE MoveID = @MoveID AND MoveType = 'K'`);

    if (checkRes.recordset.length === 0) {
      throw new Error(`Bukti Retur '${finalMoveId}' tidak ditemukan.`);
    }

    const itemIdsToFetchHpp = validDetails
      .filter((d) => !d.hppPrice || Number(d.hppPrice) <= 0)
      .map((d) => d.itemId);
    const hppMap = await getHppBatch(itemIdsToFetchHpp);

    let calculatedHeaderTotal = 0;
    const computedDetails = validDetails.map((d) => {
      const cleanItemId = d.itemId.trim().toUpperCase();
      const bags = Math.max(0, Math.floor(Number(d.bags) || 0));
      const kgs = Math.max(0, Number(d.kgs) || 0);
      const hpp = Number(d.hppPrice) > 0 ? Number(d.hppPrice) : (hppMap.get(cleanItemId) || 0);
      const price = Number(d.price) || 1;
      const total = Math.round(kgs * price * 100) / 100;
      calculatedHeaderTotal += total;
      const satuan = (d.satuan || "Pcs").slice(0, 10);

      return {
        cleanItemId,
        bags,
        kgs,
        price,
        total,
        hppPrice: hpp,
        satuan,
      };
    });

    const finalHeaderTotal = Math.round(calculatedHeaderTotal * 100) / 100;

    // Update Header
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .input("LocID", sql.VarChar(6), locId)
      .input("MoveDate", sql.DateTime, moveDateTime)
      .input("Total", sql.Money, finalHeaderTotal)
      .input("Remark", sql.VarChar(50), cleanRemark)
      .input("DocID", sql.VarChar(20), payload.docId || null)
      .input("NoRator", sql.Int, noRator)
      .input("HargaHPP", sql.Bit, hargaHpp ? 1 : 0)
      .query(`
        UPDATE [cp].[dbo].[taOpNameIHD]
        SET LocID = @LocID,
            MoveDate = @MoveDate,
            Total = @Total,
            Remark = @Remark,
            DocID = @DocID,
            NoRator = @NoRator,
            HargaHPP = @HargaHPP
        WHERE MoveID = @MoveID AND MoveType = 'K'
      `);

    // Hapus detail lama & masukkan detail baru
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .query(`DELETE FROM [cp].[dbo].[taOpNameIDT] WHERE MoveID = @MoveID AND MoveType = 'K'`);

    for (const d of computedDetails) {
      await tx
        .request()
        .input("MoveID", sql.VarChar(9), finalMoveId)
        .input("MoveType", sql.Char(1), 'K')
        .input("MoveDate", sql.DateTime, moveDateTime)
        .input("LocID", sql.VarChar(6), locId)
        .input("ItemID", sql.VarChar(40), d.cleanItemId)
        .input("Bags", sql.Float, d.bags)
        .input("Kgs", sql.Float, d.kgs)
        .input("price", sql.Float, d.price)
        .input("total", sql.Float, d.total)
        .input("HPPPrice", sql.Float, d.hppPrice)
        .input("username", sql.VarChar(20), cleanUser)
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

    return {
      success: true,
      moveId: finalMoveId,
      message: `Perubahan Retur Produksi '${finalMoveId}' berhasil diperbarui (${computedDetails.length} item).`,
    };
  });
}

/**
 * Menghapus transaksi Retur Produksi.
 */
export async function deleteReturTransaction(
  moveId: string,
  username: string
): Promise<{ success: boolean; moveId: string; message: string }> {
  const cleanMoveId = moveId.trim();
  if (!cleanMoveId) throw new Error("Nomor Bukti Retur (MoveID) wajib disertakan untuk penghapusan.");

  return await withTransaction(async (tx) => {
    const checkRes = await tx
      .request()
      .input("MoveID", sql.VarChar(9), cleanMoveId)
      .query(`SELECT TOP 1 MoveID, MoveType, MoveDate FROM [cp].[dbo].[taOpNameIHD] WHERE MoveID = @MoveID AND MoveType = 'K'`);

    if (checkRes.recordset.length === 0) {
      throw new Error(`Bukti Retur '${cleanMoveId}' tidak ditemukan.`);
    }

    const cleanUser = (username || "OPERATOR").slice(0, 50);

    // Hapus detail & header
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), cleanMoveId)
      .query(`DELETE FROM [cp].[dbo].[taOpNameIDT] WHERE MoveID = @MoveID AND MoveType = 'K'`);

    await tx
      .request()
      .input("MoveID", sql.VarChar(9), cleanMoveId)
      .query(`DELETE FROM [cp].[dbo].[taOpNameIHD] WHERE MoveID = @MoveID AND MoveType = 'K'`);

    try {
      await tx
        .request()
        .input("Remark", sql.VarChar(200), `HAPUS RETUR PRODUKSI: ${cleanMoveId}`)
        .input("Username", sql.VarChar(50), cleanUser)
        .input("TransNo", sql.VarChar(25), cleanMoveId)
        .input("TransDateTime", sql.DateTime, new Date())
        .query(`
          INSERT INTO [cp].[dbo].[taLogNew] (Remark, Username, TransNo, TransDateTime, UserDatetime)
          VALUES (@Remark, @Username, @TransNo, @TransDateTime, GETDATE())
        `);
    } catch {}

    return {
      success: true,
      moveId: cleanMoveId,
      message: `Transaksi Retur Produksi '${cleanMoveId}' berhasil dihapus.`,
    };
  });
}

/**
 * Pencarian transaksi Retur Produksi.
 */
export async function searchReturTransactions(kw: string, limit: number = 20) {
  const keyword = kw.trim();
  const where: string[] = ["hd.MoveType = 'K'"];
  const inputs: Array<{ name: string; type: any; value: any }> = [
    { name: "Lim", type: sql.Int, value: Math.min(100, Math.max(1, limit)) },
  ];

  if (keyword) {
    where.push(
      `(hd.MoveID LIKE @kw OR hd.Remark LIKE @kw OR l.LocName LIKE @kw OR hd.LocID LIKE @kw OR CAST(hd.NoRator AS VARCHAR) LIKE @kw OR EXISTS (SELECT 1 FROM [cp].[dbo].[taOpNameIDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType AND dt.ItemID LIKE @kw))`
    );
    inputs.push({ name: "kw", type: sql.NVarChar, value: `%${keyword}%` });
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
    moveType: 'K',
    moveDate: r.MoveDate ? new Date(r.MoveDate).toISOString().slice(0, 10) : "",
    locId: String(r.LocID || "-"),
    locName: String(r.LocName || "-"),
    remark: String(r.Remark || ""),
    noRator: r.NoRator != null ? Number(r.NoRator) : null,
    total: Number(r.Total) || 0,
    totalItems: Number(r.TotalItems) || 0,
    totalKgs: Math.round(Number(r.TotalKgs) * 100) / 100,
    totalBags: Number(r.TotalBags) || 0,
  }));
}

/**
 * Menghasilkan file Buffer template Excel untuk import Retur Produksi.
 */
export async function generateReturExcelTemplate(): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Form Input
  const rows: any[][] = [
    ["TEMPLATE IMPORT RETUR PRODUKSI (PENGEMBALIAN BAHAN)", "", "", ""],
    ["", "", "", ""],
    ["Tanggal (YYYY-MM-DD)", new Date().toISOString().slice(0, 10), "<- Format: YYYY-MM-DD, kosongkan jika sesuai hari ini", ""],
    ["Gudang Penerima", "GUDMO", "<- Kode Gudang (lihat Sheet MASTER_GUDANG), contoh: GUDMO, GUDIN, GUDAS", ""],
    ["Hitung Harga HPP (Y/N)", "N", "<- 'Y' jika ingin menghitung HPP, 'N' jika tanpa perhitungan HPP", ""],
    ["No. Rator", "", "<- Nomor Operator / Rator (angka bulat), opsional", ""],
    ["Catatan / Remark", "RETUR DARI AREA PRODUKSI", "<- Catatan / alasan pengembalian", ""],
    ["", "", "", ""],
    [
      "Kode Barang *",
      "Bags",
      "Qty (Kgs) *",
      "Keterangan / Notes",
    ],
    ["BEAR011", 0, 6, "Retur Molding"],
    ["SPRI020", 0, 4, "Sisa produksi"],
    ["", "", "", ""],
    ["PETUNJUK PENGISIAN:", "", "", ""],
    ["1. Template ini terdiri dari 2 sheet: 'FORM_RETUR' dan 'MASTER_GUDANG'.", "", "", ""],
    ["2. Gudang Penerima wajib diisi sesuai kode resmi pada Sheet MASTER_GUDANG.", "", "", ""],
    ["3. Kolom Kode Barang: Wajib sesuai kode di master taGoods.", "", "", ""],
    ["4. Kolom Bags & Qty (Kgs): Masukkan angka positif.", "", "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "FORM_RETUR");

  // Sheet 2: Master Gudang
  const locRes = await runQuery(
    `SELECT LocID, LocName FROM [cp].[dbo].[taLocation] ORDER BY LocID ASC`
  );
  const locRows = [
    ["Kode Gudang (LocID)", "Nama Gudang"],
    ...locRes.recordset.map((l: any) => [String(l.LocID), String(l.LocName)]),
  ];
  const wsLoc = XLSX.utils.aoa_to_sheet(locRows);
  wsLoc["!cols"] = [{ wch: 22 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsLoc, "MASTER_GUDANG");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Membaca dan memvalidasi file Excel import Retur Produksi.
 */
export async function parseReturExcelImport(buffer: Buffer): Promise<ParseReturImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("File Excel tidak memiliki worksheet yang valid.");

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rawRows.length < 5) throw new Error("File Excel tidak berisi data yang lengkap.");

  // Baca metadata header
  let moveDate = new Date().toISOString().slice(0, 10);
  let locId = "GUDMO";
  let hargaHpp = false;
  let noRator: number | null = null;
  let remark = "RETUR DARI AREA PRODUKSI";

  for (let i = 0; i < Math.min(rawRows.length, 12); i++) {
    const label = String(rawRows[i]?.[0] || "").toLowerCase().trim();
    const val = String(rawRows[i]?.[1] || "").trim();

    if (label.includes("tanggal")) {
      if (val) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) moveDate = val;
        else {
          const parsedD = new Date(val);
          if (!isNaN(parsedD.getTime())) moveDate = parsedD.toISOString().slice(0, 10);
        }
      }
    } else if (label.includes("gudang")) {
      if (val) locId = val.toUpperCase();
    } else if (label.includes("hpp")) {
      hargaHpp = val.toUpperCase().startsWith("Y") || val === "1" || val.toUpperCase() === "TRUE";
    } else if (label.includes("rator")) {
      if (val && !isNaN(parseInt(val, 10))) noRator = parseInt(val, 10);
    } else if (label.includes("catatan") || label.includes("remark")) {
      if (val) remark = val.slice(0, 50);
    }
  }

  // Validasi LocID
  const locCheck = await runQuery(
    `SELECT TOP 1 LocID FROM [cp].[dbo].[taLocation] WHERE LocID = @LocID`,
    [{ name: "LocID", type: sql.VarChar(6), value: locId }]
  );
  const isLocValid = locCheck.recordset.length > 0;

  // Temukan baris header tabel detail
  let headerRowIndex = -1;
  for (let i = 0; i < rawRows.length; i++) {
    const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(" ");
    if (rowStr.includes("kode") && (rowStr.includes("qty") || rowStr.includes("kgs") || rowStr.includes("barang"))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error("Header tabel data (Kode Barang, Qty/Kgs) tidak ditemukan.");
  }

  const header = rawRows[headerRowIndex].map((c) => String(c).trim().toLowerCase());
  const colMap = {
    itemId: header.findIndex((h) => h.includes("kode") || h.includes("item")),
    bags: header.findIndex((h) => h.includes("bag")),
    kgs: header.findIndex((h) => h.includes("qty") || h.includes("kg")),
    notes: header.findIndex((h) => h.includes("note") || h.includes("ket")),
  };

  if (colMap.itemId === -1) colMap.itemId = 0;
  if (colMap.kgs === -1) colMap.kgs = 2;

  const dataRows = rawRows.slice(headerRowIndex + 1);
  const candidateItems: { rowNum: number; rawId: string; bags: number; kgs: number; notes?: string }[] = [];
  const itemIdsToVerify: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    if (!r || r.length === 0) continue;
    const rawId = String(r[colMap.itemId] ?? "").trim();
    if (!rawId) continue;
    if (rawId.toLowerCase().includes("petunjuk") || rawId.toLowerCase().includes("catatan")) break;

    const bags = colMap.bags !== -1 ? parseInt(String(r[colMap.bags] ?? "0").replace(/[^0-9]/g, ""), 10) || 0 : 0;
    const kgs = parseFloat(String(r[colMap.kgs] ?? "0").replace(/[^0-9.]/g, "")) || 0;
    const notes = colMap.notes !== -1 ? String(r[colMap.notes] ?? "").trim() : undefined;

    candidateItems.push({
      rowNum: headerRowIndex + 1 + i + 1,
      rawId,
      bags,
      kgs,
      notes,
    });
    itemIdsToVerify.push(rawId.toUpperCase());
  }

  if (candidateItems.length === 0) {
    throw new Error("Tidak ditemukan baris item barang pada template Excel.");
  }

  // Verifikasi ItemID di taGoods
  const uniqueIds = [...new Set(itemIdsToVerify)];
  const itemMap = new Map<string, { itemName: string; satuan: string }>();

  for (let i = 0; i < uniqueIds.length; i += 400) {
    const chunk = uniqueIds.slice(i, i + 400);
    const ph = chunk.map((_, idx) => `@id${idx}`).join(", ");
    const inputs = chunk.map((id, idx) => ({ name: `id${idx}`, type: sql.VarChar(50), value: id }));

    const res = await runQuery(
      `SELECT ItemID, ItemName, SatuanKecil FROM [cp].[dbo].[taGoods] WHERE ItemID IN (${ph})`,
      inputs as never
    );

    for (const r of res.recordset) {
      itemMap.set(String(r.ItemID).toUpperCase(), {
        itemName: String(r.ItemName || r.ItemID),
        satuan: String(r.SatuanKecil || "Pcs"),
      });
    }
  }

  const hppMap = await getHppBatch(uniqueIds);
  const parsedItems: ParsedReturImportItem[] = [];
  let totalKgs = 0;
  let totalBags = 0;
  let invalidCount = 0;

  for (const c of candidateItems) {
    const cleanId = c.rawId.toUpperCase();
    const goodsInfo = itemMap.get(cleanId);
    const isValid = Boolean(goodsInfo) && c.kgs > 0;
    let errorMessage = "";

    if (!goodsInfo) {
      errorMessage = `Kode '${c.rawId}' tidak terdaftar di master taGoods.`;
      invalidCount++;
    } else if (c.kgs <= 0) {
      errorMessage = "Qty (Kgs) wajib bernilai lebih dari 0.";
      invalidCount++;
    }

    const itemKgs = Math.max(0, c.kgs);
    const itemBags = Math.max(0, c.bags);
    totalKgs += itemKgs;
    totalBags += itemBags;

    parsedItems.push({
      rowNumber: c.rowNum,
      itemId: cleanId,
      itemName: goodsInfo?.itemName || c.rawId,
      satuan: goodsInfo?.satuan || "Pcs",
      bags: itemBags,
      kgs: itemKgs,
      price: 1,
      hppPrice: hppMap.get(cleanId) || 0,
      notes: c.notes,
      isValid,
      errorMessage: errorMessage || undefined,
    });
  }

  return {
    header: {
      moveDate,
      locId,
      noRator,
      remark,
      hargaHpp,
      isLocValid,
      locError: isLocValid ? undefined : `Kode gudang '${locId}' tidak terdaftar di taLocation.`,
    },
    items: parsedItems,
    summary: {
      totalRows: parsedItems.length,
      totalKgs: Math.round(totalKgs * 100) / 100,
      totalBags,
      invalidCount,
    },
  };
}
