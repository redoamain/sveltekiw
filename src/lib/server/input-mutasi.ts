import { runQuery, withTransaction, log } from "@/lib/db";
import sql from "mssql";
import * as XLSX from "xlsx";
import { searchGoods, getGoodsBatch } from "$lib/server/input-produksi";

export interface MutasiDetailInput {
  itemId: string;
  itemName?: string;
  satuan?: string;
  bags?: number;
  kgs: number;
  notes?: string;
}

export interface CreateMutasiPayload {
  moveId?: string;
  moveType: "R" | "M";
  moveDate: string; // YYYY-MM-DD
  locSrc: string;   // e.g. GUDUT
  locDest: string;  // e.g. GUDIN
  prodType?: string | null; // e.g. IN, SP, PL, MO, AS
  remark?: string;  // e.g. Mutasi Bahan Baku
  noRator?: number | null;
  notes?: string;
  details: MutasiDetailInput[];
}

export interface ParsedMutasiImportItem {
  itemId: string;
  itemName: string;
  satuan: string;
  bags: number;
  kgs: number;
  notes: string;
  isValid: boolean;
  error?: string;
}

export interface ParsedMutasiImport {
  header: {
    moveType?: "R" | "M";
    moveDate?: string;
    locSrc?: string;
    locDest?: string;
    prodType?: string | null;
    noRator?: number | null;
    remark?: string;
    isLocValid?: boolean;
    locError?: string;
  };
  items: ParsedMutasiImportItem[];
  summary: {
    totalRows: number;
    totalKgs: number;
    totalBags: number;
    invalidCount: number;
  };
}

/**
 * Menghitung nomor mutasi berikutnya berdasarkan MoveType ('R' / 'M') dan Tanggal.
 * Format nomor: YY (2 digit tahun) + 5 digit urutan (contoh: 2600088).
 */
export async function getNextMutasiId(moveType: "R" | "M" = "R", dateStr?: string): Promise<string> {
  const d = dateStr ? new Date(dateStr) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const prefix = `${yy}`;

  const res = await runQuery(
    `SELECT MAX(MoveID) as maxId
     FROM [cp].[dbo].[taMoveHD]
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
 * Mengambil master data awal untuk halaman formulir Input Mutasi Gudang.
 */
export async function getMutasiInitialData() {
  // 1. Gudang dari taLocation
  const locRes = await runQuery(
    `SELECT LocID, LocName, [virtual] 
     FROM [cp].[dbo].[taLocation] 
     ORDER BY LocID ASC`
  );

  // 2. Departemen dari taDeptPROrder
  const deptRes = await runQuery(
    `SELECT PRDeptID, PRDeptName 
     FROM [cp].[dbo].[taDeptPROrder] 
     ORDER BY PRDeptID ASC`
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMoveId = await getNextMutasiId("R", todayStr);

  // 3. Transaksi mutasi terakhir
  const recentRes = await runQuery(
    `SELECT TOP 20
       hd.MoveID, hd.MoveType, hd.MoveDate, hd.LocIDSrc, hd.LocIDDest,
       hd.Remark, hd.NoRator, hd.ProdType,
       (SELECT COUNT(*) FROM [cp].[dbo].[taMoveDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalItems,
       (SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taMoveDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalKgs,
       (SELECT ISNULL(SUM(dt.Bags), 0) FROM [cp].[dbo].[taMoveDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalBags
     FROM [cp].[dbo].[taMoveHD] hd
     WHERE hd.MoveType IN ('R', 'M')
     ORDER BY hd.MoveDate DESC, hd.MoveID DESC`
  );

  return {
    warehouses: locRes.recordset as Array<{ LocID: string; LocName: string; virtual: string }>,
    departments: deptRes.recordset as Array<{ PRDeptID: string; PRDeptName: string }>,
    defaultDate: todayStr,
    nextMoveId,
    recentTransactions: recentRes.recordset.map((r: any) => ({
      moveId: String(r.MoveID),
      moveType: String(r.MoveType),
      moveDate: r.MoveDate ? new Date(r.MoveDate).toISOString().slice(0, 10) : "",
      locSrc: String(r.LocIDSrc || "-"),
      locDest: String(r.LocIDDest || "-"),
      remark: String(r.Remark || ""),
      noRator: r.NoRator != null ? Number(r.NoRator) : null,
      prodType: r.ProdType ? String(r.ProdType) : null,
      totalItems: Number(r.TotalItems) || 0,
      totalKgs: Math.round(Number(r.TotalKgs) * 100) / 100,
      totalBags: Number(r.TotalBags) || 0,
    })),
  };
}

/**
 * Menyimpan transaksi Mutasi Gudang baru ke taMoveHD & taMoveDT dalam transaksi atomic.
 */
export async function createMutasiTransaction(
  payload: CreateMutasiPayload,
  username: string
): Promise<{ success: boolean; moveId: string; message: string }> {
  const moveType = payload.moveType === "M" ? "M" : "R";
  const locSrc = (payload.locSrc ?? "").trim().toUpperCase();
  const locDest = (payload.locDest ?? "").trim().toUpperCase();

  if (!locSrc) throw new Error("Gudang Asal (LocIDSrc) wajib dipilih.");
  if (!locDest) throw new Error("Gudang Tujuan (LocIDDest) wajib dipilih.");
  if (locSrc === locDest) throw new Error("Gudang Asal dan Gudang Tujuan tidak boleh sama.");

  const details = payload.details || [];
  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) {
    throw new Error("Rincian mutasi minimal harus memiliki 1 barang.");
  }

  for (const d of validDetails) {
    if (d.kgs <= 0) {
      throw new Error(`Kuantiti barang '${d.itemId}' harus lebih dari 0.`);
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
      finalMoveId = await getNextMutasiId(moveType, moveDateStr);
    }

    // Periksa jika MoveID sudah ada
    const existCheck = await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .input("MoveType", sql.Char(1), moveType)
      .query(`SELECT TOP 1 MoveID FROM [cp].[dbo].[taMoveHD] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    if (existCheck.recordset.length > 0) {
      finalMoveId = await getNextMutasiId(moveType, moveDateStr);
    }

    // 2. Insert Header taMoveHD (Trigger TtaMoveHDI otomatis mengisi taOpNameIHD & taOpNameOHD)
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), finalMoveId)
      .input("MoveType", sql.Char(1), moveType)
      .input("MoveDate", sql.DateTime, moveDateTime)
      .input("LocIDSrc", sql.VarChar(6), locSrc)
      .input("LocIDDest", sql.VarChar(6), locDest)
      .input("Remark", sql.VarChar(50), payload.remark ? payload.remark.slice(0, 50) : null)
      .input("printed", sql.TinyInt, 0)
      .input("DocIDIn", sql.VarChar(7), "")
      .input("DocIDOut", sql.VarChar(7), null)
      .input("ProdType", sql.VarChar(2), payload.prodType ? payload.prodType.slice(0, 2) : null)
      .input("Notes", sql.VarChar(250), payload.notes ? payload.notes.slice(0, 250) : null)
      .input("NoRator", sql.Int, payload.noRator ? parseInt(String(payload.noRator), 10) : null)
      .query(`
        INSERT INTO [cp].[dbo].[taMoveHD] (
          MoveID, MoveType, MoveDate, LocIDSrc, LocIDDest,
          Remark, printed, DocIDIn, DocIDOut, ProdType, Notes, NoRator
        ) VALUES (
          @MoveID, @MoveType, @MoveDate, @LocIDSrc, @LocIDDest,
          @Remark, @printed, @DocIDIn, @DocIDOut, @ProdType, @Notes, @NoRator
        )
      `);

    // 3. Insert Detail taMoveDT (Trigger TtaMoveDTI otomatis mengisi taOpNameIDT & taOpNameODT)
    for (const d of validDetails) {
      const cleanItemId = d.itemId.trim().toUpperCase();
      const bags = Math.max(0, parseInt(String(d.bags ?? 0), 10) || 0);
      const kgs = Math.max(0, parseInt(String(d.kgs ?? 0), 10) || 0);
      const notes = d.notes ? d.notes.slice(0, 255) : null;

      await tx
        .request()
        .input("MoveID", sql.VarChar(9), finalMoveId)
        .input("MoveType", sql.Char(1), moveType)
        .input("MoveDate", sql.DateTime, moveDateTime)
        .input("ItemID", sql.VarChar(25), cleanItemId)
        .input("Bags", sql.Int, bags)
        .input("Kgs", sql.Float, kgs)
        .input("HPPPrice", sql.Float, 0)
        .input("username", sql.VarChar(50), cleanUser)
        .input("userdatetime", sql.DateTime, currentDateTime)
        .input("notes", sql.VarChar(255), notes)
        .query(`
          INSERT INTO [cp].[dbo].[taMoveDT] (
            MoveID, MoveType, MoveDate, ItemID, Bags, Kgs, HPPPrice,
            username, userdatetime, notes
          ) VALUES (
            @MoveID, @MoveType, @MoveDate, @ItemID, @Bags, @Kgs, @HPPPrice,
            @username, @userdatetime, @notes
          )
        `);
    }

    // 4. Update taNumber counter agar sinkron
    try {
      const counterCol = moveType === "M" ? "Mutation" : "MutationProd";
      await tx
        .request()
        .input("CounterVal", sql.VarChar(9), `20${finalMoveId}`)
        .query(`UPDATE [cp].[dbo].[taNumber] SET ${counterCol} = @CounterVal`);
    } catch (e) {
      log.warn({ e }, "Gagal sinkronisasi counter taNumber");
    }

    return {
      success: true,
      moveId: finalMoveId,
      message: `Transaksi Mutasi Gudang #${finalMoveId} (${moveType === "R" ? "Produksi/Departemen" : "Antar Gudang"}) berhasil disimpan.`
    };
  });
}

/**
 * Mengambil detail transaksi mutasi yang sudah ada untuk mode edit atau pratinjau.
 */
export async function getMutasiTransaction(moveId: string, moveType = "R") {
  const cleanId = (moveId ?? "").trim();
  if (!cleanId) return null;

  const hdResult = await runQuery(
    `SELECT TOP 1
       h.MoveID, h.MoveType, h.MoveDate, h.LocIDSrc, h.LocIDDest,
       h.Remark, h.printed, h.ProdType, h.Notes, h.NoRator,
       ls.LocName AS LocSrcName, ld.LocName AS LocDestName
     FROM [cp].[dbo].[taMoveHD] h
     LEFT JOIN [cp].[dbo].[taLocation] ls ON h.LocIDSrc = ls.LocID
     LEFT JOIN [cp].[dbo].[taLocation] ld ON h.LocIDDest = ld.LocID
     WHERE RTRIM(LTRIM(h.MoveID)) = RTRIM(LTRIM(@MoveID)) AND h.MoveType = @MoveType`,
    [
      { name: "MoveID", type: sql.VarChar(9), value: cleanId },
      { name: "MoveType", type: sql.Char(1), value: moveType },
    ]
  );

  if (!hdResult.recordset || hdResult.recordset.length === 0) {
    return null;
  }

  const hd = hdResult.recordset[0];
  const dtResult = await runQuery(
    `SELECT
       dt.MoveID, dt.MoveType, dt.ItemID, dt.Bags, dt.Kgs, dt.notes,
       g.ItemName, ISNULL(g.SatuanKecil, 'Pcs') AS Satuan
     FROM [cp].[dbo].[taMoveDT] dt
     LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
     WHERE RTRIM(LTRIM(dt.MoveID)) = RTRIM(LTRIM(@MoveID)) AND dt.MoveType = @MoveType
     ORDER BY dt.rjn ASC`,
    [
      { name: "MoveID", type: sql.VarChar(9), value: cleanId },
      { name: "MoveType", type: sql.Char(1), value: moveType },
    ]
  );

  return {
    header: {
      moveId: String(hd.MoveID).trim(),
      moveType: String(hd.MoveType).trim() as "R" | "M",
      moveDate: hd.MoveDate ? new Date(hd.MoveDate).toISOString().slice(0, 10) : "",
      locSrc: String(hd.LocIDSrc || "").trim(),
      locDest: String(hd.LocIDDest || "").trim(),
      locSrcName: String(hd.LocSrcName || ""),
      locDestName: String(hd.LocDestName || ""),
      prodType: hd.ProdType ? String(hd.ProdType).trim() : null,
      remark: hd.Remark ? String(hd.Remark).trim() : "",
      notes: hd.Notes ? String(hd.Notes).trim() : "",
      noRator: hd.NoRator != null ? Number(hd.NoRator) : null,
    },
    details: dtResult.recordset.map((r: any) => ({
      itemId: String(r.ItemID).trim(),
      itemName: String(r.ItemName || "-"),
      satuan: String(r.Satuan || "Pcs"),
      bags: Number(r.Bags) || 0,
      kgs: Number(r.Kgs) || 0,
      notes: r.notes ? String(r.notes).trim() : "",
    })),
  };
}

/**
 * Memperbarui transaksi Mutasi Gudang yang sudah ada (Header + Detail).
 */
export async function updateMutasiTransaction(
  payload: CreateMutasiPayload,
  username: string
): Promise<{ success: boolean; moveId: string; message: string }> {
  const moveId = (payload.moveId ?? "").trim();
  const moveType = payload.moveType === "M" ? "M" : "R";
  if (!moveId) throw new Error("Nomor Mutasi (MoveID) wajib diisi untuk pembaruan.");

  const locSrc = (payload.locSrc ?? "").trim().toUpperCase();
  const locDest = (payload.locDest ?? "").trim().toUpperCase();
  if (!locSrc || !locDest) throw new Error("Gudang Asal dan Gudang Tujuan wajib diisi.");
  if (locSrc === locDest) throw new Error("Gudang Asal dan Gudang Tujuan tidak boleh sama.");

  const details = payload.details || [];
  const validDetails = details.filter((d) => d.itemId && d.itemId.trim());
  if (validDetails.length === 0) throw new Error("Rincian mutasi minimal harus memiliki 1 barang.");

  for (const d of validDetails) {
    if (d.kgs <= 0) throw new Error(`Kuantiti barang '${d.itemId}' harus lebih dari 0.`);
  }

  const moveDateStr = payload.moveDate ? payload.moveDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const moveDateTime = new Date(`${moveDateStr}T00:00:00.000Z`);
  const currentDateTime = new Date();
  const cleanUser = (username || "OPERATOR").slice(0, 50);

  return await withTransaction(async (tx) => {
    // 1. Cek keberadaan transaksi
    const chk = await tx
      .request()
      .input("MoveID", sql.VarChar(9), moveId)
      .input("MoveType", sql.Char(1), moveType)
      .query(`SELECT TOP 1 MoveID FROM [cp].[dbo].[taMoveHD] WHERE MoveID = @MoveID AND MoveType = @MoveType`);
    if (chk.recordset.length === 0) {
      throw new Error(`Transaksi Mutasi #${moveId} (${moveType}) tidak ditemukan.`);
    }

    // 2. Update Header
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), moveId)
      .input("MoveType", sql.Char(1), moveType)
      .input("MoveDate", sql.DateTime, moveDateTime)
      .input("LocIDSrc", sql.VarChar(6), locSrc)
      .input("LocIDDest", sql.VarChar(6), locDest)
      .input("Remark", sql.VarChar(50), payload.remark ? payload.remark.slice(0, 50) : null)
      .input("ProdType", sql.VarChar(2), payload.prodType ? payload.prodType.slice(0, 2) : null)
      .input("Notes", sql.VarChar(250), payload.notes ? payload.notes.slice(0, 250) : null)
      .input("NoRator", sql.Int, payload.noRator ? parseInt(String(payload.noRator), 10) : null)
      .query(`
        UPDATE [cp].[dbo].[taMoveHD] SET
          MoveDate = @MoveDate,
          LocIDSrc = @LocIDSrc,
          LocIDDest = @LocIDDest,
          Remark = @Remark,
          ProdType = @ProdType,
          Notes = @Notes,
          NoRator = @NoRator
        WHERE MoveID = @MoveID AND MoveType = @MoveType
      `);

    // 3. Hapus detail lama (Trigger TtaMoveDTD otomatis membersihkan taOpNameIDT/ODT)
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), moveId)
      .input("MoveType", sql.Char(1), moveType)
      .query(`DELETE FROM [cp].[dbo].[taMoveDT] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    // 4. Masukkan detail baru (Trigger TtaMoveDTI otomatis mengisi taOpNameIDT/ODT)
    for (const d of validDetails) {
      const cleanItemId = d.itemId.trim().toUpperCase();
      const bags = Math.max(0, parseInt(String(d.bags ?? 0), 10) || 0);
      const kgs = Math.max(0, parseInt(String(d.kgs ?? 0), 10) || 0);
      const notes = d.notes ? d.notes.slice(0, 255) : null;

      await tx
        .request()
        .input("MoveID", sql.VarChar(9), moveId)
        .input("MoveType", sql.Char(1), moveType)
        .input("MoveDate", sql.DateTime, moveDateTime)
        .input("ItemID", sql.VarChar(25), cleanItemId)
        .input("Bags", sql.Int, bags)
        .input("Kgs", sql.Float, kgs)
        .input("HPPPrice", sql.Float, 0)
        .input("username", sql.VarChar(50), cleanUser)
        .input("userdatetime", sql.DateTime, currentDateTime)
        .input("notes", sql.VarChar(255), notes)
        .query(`
          INSERT INTO [cp].[dbo].[taMoveDT] (
            MoveID, MoveType, MoveDate, ItemID, Bags, Kgs, HPPPrice,
            username, userdatetime, notes
          ) VALUES (
            @MoveID, @MoveType, @MoveDate, @ItemID, @Bags, @Kgs, @HPPPrice,
            @username, @userdatetime, @notes
          )
        `);
    }

    return {
      success: true,
      moveId,
      message: `Transaksi Mutasi Gudang #${moveId} berhasil diperbarui.`
    };
  });
}

/**
 * Menghapus transaksi Mutasi Gudang (Header + Detail).
 */
export async function deleteMutasiTransaction(
  moveId: string,
  moveType = "R",
  username: string
): Promise<{ success: boolean; moveId: string; message: string }> {
  const cleanId = (moveId ?? "").trim();
  if (!cleanId) throw new Error("Nomor Mutasi (MoveID) wajib diisi untuk menghapus.");

  return await withTransaction(async (tx) => {
    // 1. Cek keberadaan
    const chk = await tx
      .request()
      .input("MoveID", sql.VarChar(9), cleanId)
      .input("MoveType", sql.Char(1), moveType)
      .query(`SELECT TOP 1 MoveID FROM [cp].[dbo].[taMoveHD] WHERE MoveID = @MoveID AND MoveType = @MoveType`);
    if (chk.recordset.length === 0) {
      throw new Error(`Transaksi Mutasi #${cleanId} tidak ditemukan.`);
    }

    // 2. Hapus detail (Trigger TtaMoveDTD membersihkan detail OpName)
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), cleanId)
      .input("MoveType", sql.Char(1), moveType)
      .query(`DELETE FROM [cp].[dbo].[taMoveDT] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    // 3. Hapus header (Trigger TtaMoveHDD membersihkan header OpName)
    await tx
      .request()
      .input("MoveID", sql.VarChar(9), cleanId)
      .input("MoveType", sql.Char(1), moveType)
      .query(`DELETE FROM [cp].[dbo].[taMoveHD] WHERE MoveID = @MoveID AND MoveType = @MoveType`);

    log.info({ user: username, moveId: cleanId, moveType }, "Transaksi Mutasi Gudang berhasil dihapus");
    return {
      success: true,
      moveId: cleanId,
      message: `Transaksi Mutasi Gudang #${cleanId} berhasil dihapus.`
    };
  });
}

/**
 * Mencari transaksi mutasi untuk modal Buka/Cari Transaksi.
 */
export async function searchMutasiTransactions(q: string, limit = 25) {
  const kw = (q ?? "").trim();
  const where: string[] = ["hd.MoveType IN ('R', 'M')"];
  const inputs: Array<{ name: string; type: any; value: any }> = [
    { name: "Lim", type: sql.Int, value: limit }
  ];

  if (kw) {
    where.push("(hd.MoveID LIKE @q OR hd.LocIDSrc LIKE @q OR hd.LocIDDest LIKE @q OR hd.Remark LIKE @q OR CAST(hd.NoRator AS VARCHAR) LIKE @q)");
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${kw}%` });
  }

  const clause = "WHERE " + where.join(" AND ");
  const res = await runQuery(
    `SELECT TOP (@Lim)
       hd.MoveID, hd.MoveType, hd.MoveDate, hd.LocIDSrc, hd.LocIDDest,
       hd.Remark, hd.NoRator, hd.ProdType,
       (SELECT COUNT(*) FROM [cp].[dbo].[taMoveDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalItems,
       (SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taMoveDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalKgs,
       (SELECT ISNULL(SUM(dt.Bags), 0) FROM [cp].[dbo].[taMoveDT] dt WHERE dt.MoveID = hd.MoveID AND dt.MoveType = hd.MoveType) AS TotalBags
     FROM [cp].[dbo].[taMoveHD] hd
     ${clause}
     ORDER BY hd.MoveDate DESC, hd.MoveID DESC`,
    inputs as never
  );

  return res.recordset.map((r: any) => ({
    moveId: String(r.MoveID),
    moveType: String(r.MoveType),
    moveDate: r.MoveDate ? new Date(r.MoveDate).toISOString().slice(0, 10) : "",
    locSrc: String(r.LocIDSrc || "-"),
    locDest: String(r.LocIDDest || "-"),
    remark: String(r.Remark || ""),
    noRator: r.NoRator != null ? Number(r.NoRator) : null,
    prodType: r.ProdType ? String(r.ProdType) : null,
    totalItems: Number(r.TotalItems) || 0,
    totalKgs: Math.round(Number(r.TotalKgs) * 100) / 100,
    totalBags: Number(r.TotalBags) || 0,
  }));
}

/**
 * Menghasilkan file Buffer template Excel untuk import Mutasi Gudang.
 * Sheet 1: FORM_MUTASI (Data input tanpa kolom opsional nama/satuan)
 * Sheet 2: MASTER_GUDANG (Daftar kode & nama gudang sebagai referensi)
 */
export async function generateMutasiExcelTemplate(): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Form Input
  const rows: any[][] = [
    ["TEMPLATE IMPORT MUTASI GUDANG KIW", "", "", ""],
    ["", "", "", ""],
    ["Tipe Mutasi (R/M)", "R", "<- 'R' untuk Mutasi Produksi/Departemen, 'M' untuk Mutasi Antar Gudang", ""],
    ["Tanggal (YYYY-MM-DD)", new Date().toISOString().slice(0, 10), "<- Format: YYYY-MM-DD, kosongkan jika sesuai hari ini", ""],
    ["Gudang Asal", "GUDUT", "<- Kode Gudang Asal (lihat Sheet MASTER_GUDANG), contoh: GUDUT, GUDLOC", ""],
    ["Gudang Tujuan", "GUDIN", "<- Kode Gudang Tujuan (lihat Sheet MASTER_GUDANG), contoh: GUDIN, GUDSP, GUDPL", ""],
    ["Departemen", "IN", "<- Departemen (opsional): IN, SP, PL, MO, AS", ""],
    ["No. Rator", "", "<- Nomor Operator / Rator (angka bulat, contoh: 1026901), opsional", ""],
    ["Catatan / Remark", "Mutasi Bahan Baku", "<- Catatan / keterangan mutasi", ""],
    ["", "", "", ""],
    [
      "Kode Barang *",
      "Bags",
      "Qty (Kgs) *",
      "Keterangan (Opsional)",
    ],
    ["ABS200", 40, 1000, "Bahan Utama"],
    ["IMABS121H", 20, 500, "Bahan Tambahan"],
    ["", "", "", ""],
    ["PETUNJUK PENGISIAN:", "", "", ""],
    ["1. Template ini terdiri dari 2 sheet: 'FORM_MUTASI' (input data) dan 'MASTER_GUDANG' (referensi kode gudang).", "", "", ""],
    ["2. Tipe Mutasi: 'R' untuk Mutasi Produksi / Departemen, 'M' untuk Mutasi Antar Gudang.", "", "", ""],
    ["3. Gudang Asal & Tujuan wajib diisi sesuai kode resmi pada Sheet MASTER_GUDANG dan tidak boleh sama.", "", "", ""],
    ["4. Kolom Kode Barang: Wajib sesuai kode di master taGoods.", "", "", ""],
    ["5. Kolom Bags & Qty (Kgs): Masukkan bilangan bulat (integer tanpa desimal/koma).", "", "", ""],
    ["6. Kolom Nama Barang & Satuan otomatis ditarik dari database taGoods.", "", "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 22 }, // Label Header / Kode Barang *
    { wch: 14 }, // Bags
    { wch: 18 }, // Qty (Kgs) *
    { wch: 30 }, // Keterangan
  ];

  XLSX.utils.book_append_sheet(wb, ws, "FORM_MUTASI");

  // Sheet 2: Master Data Gudang
  let locRows: Array<{ LocID: string; LocName: string }> = [];
  try {
    const res = await runQuery(`SELECT LocID, LocName FROM [cp].[dbo].[taLocation] ORDER BY LocID ASC`);
    if (res?.recordset) locRows = res.recordset;
  } catch (err) {
    log.warn({ err }, "Gagal mengambil daftar gudang untuk template mutasi");
  }

  const locSheetData: any[][] = [
    ["MASTER DATA GUDANG (REFERENSI)", "", ""],
    ["Gunakan kode gudang berikut pada baris Gudang Asal dan Gudang Tujuan di Sheet FORM_MUTASI.", "", ""],
    ["", "", ""],
    ["Kode Gudang (LocID)", "Nama Gudang", "Keterangan"],
  ];

  if (locRows.length > 0) {
    for (const l of locRows) {
      locSheetData.push([l.LocID, l.LocName, "-"]);
    }
  } else {
    locSheetData.push(
      ["GUDUT", "GUDANG UTAMA", "-"],
      ["GUDLOC", "GUDANG LOKAL", "-"],
      ["GUDIN", "GUDANG INJEKSI", "-"],
      ["GUDSP", "GUDANG SPRAY", "-"],
      ["GUDPL", "GUDANG PLATING", "-"]
    );
  }

  const wsLoc = XLSX.utils.aoa_to_sheet(locSheetData);
  wsLoc["!cols"] = [
    { wch: 22 }, // Kode Gudang
    { wch: 35 }, // Nama Gudang
    { wch: 15 }, // Keterangan
  ];

  XLSX.utils.book_append_sheet(wb, wsLoc, "MASTER_GUDANG");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Membaca dan memvalidasi file Excel yang diunggah untuk import mutasi gudang.
 */
export async function parseMutasiExcelImport(buffer: Buffer): Promise<ParsedMutasiImport> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = wb.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error("File Excel kosong atau format tidak valid.");
  }

  const formSheetName =
    sheetNames.find(
      (s) =>
        s.toUpperCase().includes("MUTASI") ||
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
  let colNotesIdx = -1;

  for (let r = 0; r < Math.min(30, allRows.length); r++) {
    const row = allRows[r].map((c) => String(c).trim().toUpperCase());
    if (row.length === 0 || row[0].includes("TEMPLATE")) continue;

    let tempCode = -1;
    let tempBags = -1;
    let tempQty = -1;
    let tempNotes = -1;

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
      if (val.includes("KET") || val.includes("REMARK") || val.includes("NOTE")) tempNotes = c;
    }

    if (tempCode !== -1 && tempQty !== -1 && tempCode !== tempQty) {
      headerRowIdx = r;
      colCodeIdx = tempCode;
      colBagsIdx = tempBags;
      colQtyIdx = tempQty;
      colNotesIdx = tempNotes;
      break;
    }
  }

  if (headerRowIdx === -1 || colCodeIdx === -1 || colQtyIdx === -1) {
    throw new Error(
      "Format tabel tidak dikenali. Pastikan file memiliki baris judul kolom dengan 'Kode Barang' dan 'Qty' (atau unduh template resmi)."
    );
  }

  // Parse Header Transaksi
  const headerData: ParsedMutasiImport["header"] = {};

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
      if (t.startsWith("M")) headerData.moveType = "M";
      else if (t.startsWith("R")) headerData.moveType = "R";
    } else if (label.includes("TANGGAL") || label.includes("DATE")) {
      const dStr = String(valRaw ?? "").trim();
      const match = dStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match) {
        headerData.moveDate = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
      }
    } else if (label.includes("ASAL") || label.includes("SRC")) {
      if (isCleanVal(valStr)) headerData.locSrc = valStr.toUpperCase();
    } else if (label.includes("TUJUAN") || label.includes("DEST")) {
      if (isCleanVal(valStr)) headerData.locDest = valStr.toUpperCase();
    } else if (label.includes("DEPARTEMEN") || label.includes("DEPT")) {
      if (isCleanVal(valStr)) headerData.prodType = valStr.toUpperCase();
    } else if (label.includes("RATOR") || label.includes("OPERATOR")) {
      if (isCleanVal(valStr)) {
        const num = parseInt(valStr.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(num) && num > 0) headerData.noRator = num;
      }
    } else if (label.includes("CATATAN") || label.includes("REMARK") || label.includes("KET")) {
      if (isCleanVal(valStr)) headerData.remark = valStr;
    }
  }

  // Validasi Gudang Asal & Tujuan jika diisi
  if (headerData.locSrc && headerData.locDest) {
    if (headerData.locSrc === headerData.locDest) {
      headerData.isLocValid = false;
      headerData.locError = "Gudang Asal dan Gudang Tujuan tidak boleh sama.";
    } else {
      try {
        const locCheck = await runQuery(
          `SELECT LocID FROM [cp].[dbo].[taLocation] WHERE LocID IN (@LocSrc, @LocDest)`,
          [
            { name: "LocSrc", type: sql.VarChar(6), value: headerData.locSrc },
            { name: "LocDest", type: sql.VarChar(6), value: headerData.locDest },
          ]
        );
        if (locCheck.recordset && locCheck.recordset.length >= 2) {
          headerData.isLocValid = true;
        } else {
          headerData.isLocValid = false;
          headerData.locError = "Salah satu kode gudang tidak terdaftar di taLocation.";
        }
      } catch (err: any) {
        headerData.isLocValid = false;
        headerData.locError = err?.message || "Gagal memverifikasi gudang di database.";
      }
    }
  }

  // Kumpulkan baris barang
  const rawItemEntries: Array<{
    itemId: string;
    bags: number;
    kgs: number;
    notes: string;
    rowNumber: number;
  }> = [];

  for (let r = headerRowIdx + 1; r < allRows.length; r++) {
    const row = allRows[r];
    if (!row || row.length === 0) continue;

    const rawCode = String(row[colCodeIdx] ?? "").trim();
    if (!rawCode) continue;
    if (rawCode.toUpperCase().includes("PETUNJUK") || rawCode.toUpperCase().includes("CATATAN")) break;

    const bags =
      colBagsIdx !== -1
        ? Math.max(0, parseInt(String(row[colBagsIdx] ?? "0").replace(/[^0-9-]/g, "") || "0", 10))
        : 0;
    const kgs = Math.max(0, parseInt(String(row[colQtyIdx] ?? "0").replace(/[^0-9]/g, "") || "0", 10));
    const notes = colNotesIdx !== -1 ? String(row[colNotesIdx] ?? "").trim() : "";

    rawItemEntries.push({
      itemId: rawCode,
      bags,
      kgs,
      notes,
      rowNumber: r + 1,
    });
  }

  if (rawItemEntries.length === 0) {
    throw new Error("Tidak ditemukan baris barang di dalam file Excel.");
  }

  // Batch query ke taGoods untuk verifikasi & ambil nama/satuan
  const allCodes = rawItemEntries.map((e) => e.itemId);
  const goodsMap = await getGoodsBatch(allCodes);

  const items: ParsedMutasiImportItem[] = [];
  let invalidCount = 0;

  for (const entry of rawItemEntries) {
    const matched = goodsMap.get(entry.itemId.toUpperCase());
    let isValid = Boolean(matched);
    let error: string | undefined;

    if (!matched) {
      error = `Kode '${entry.itemId}' tidak terdaftar di master taGoods`;
      isValid = false;
    } else if (entry.kgs <= 0) {
      error = `Kuantiti untuk '${entry.itemId}' harus lebih dari 0`;
      isValid = false;
    }

    if (!isValid) invalidCount++;

    items.push({
      itemId: matched ? matched.itemId : entry.itemId,
      itemName: matched ? matched.itemName : "-",
      satuan: matched ? matched.satuan : "Pcs",
      bags: entry.bags,
      kgs: entry.kgs,
      notes: entry.notes,
      isValid,
      error,
    });
  }

  const totalKgs = items.reduce((acc, it) => acc + it.kgs, 0);
  const totalBags = items.reduce((acc, it) => acc + it.bags, 0);

  return {
    header: headerData,
    items,
    summary: {
      totalRows: items.length,
      totalKgs: Math.round(totalKgs * 100) / 100,
      totalBags,
      invalidCount,
    },
  };
}
