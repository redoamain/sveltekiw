import { runQuery, log } from "@/lib/db";
import sql from "mssql";
import * as XLSX from "xlsx";

export interface MasterItem {
  ItemID: string;
  ItemName: string;
  namebc: string;
  /** alias dari ItemName2 — tetap sediakan ItemName2 untuk kompatibilitas */
  namecina: string;
  ItemName2: string;
  warna: string;
  /** alias */
  warnac: string;
  Departemen: string;
  /** alias dari Mark */
  Mark: string;
  KodeJenis: string;
  Satuan: string;
  /** alias dari SatuanKecil */
  SatuanKecil: string;
  Spec: string;
  bahan: string;
  NamaJenis: string;
}

// ============ DB ROW TYPE ============
interface DbRow {
  ItemID: string;
  ItemName: string;
  namebc: string;
  namecina?: string;
  ItemName2?: string;
  warna?: string;
  warnac?: string;
  Mark?: string;
  Departemen?: string;
  KodeJenis: string;
  Satuan?: string;
  SatuanKecil?: string;
  Spec: string;
  bahan: string;
  NamaJenis: string;
}

// ============ CONSTANTS ============
// ✅ FIX: ORDER BY a.[userdatetime] DESC (terbaru dulu)
// SELECT dipisah dari ORDER BY agar WHERE bisa diletakkan SEBELUM ORDER BY
// (urutan klausa T-SQL: WHERE dulu, baru ORDER BY + OFFSET/FETCH).
const BASE_SELECT = `
  SELECT
    a.[ItemID],
    a.[ItemName],
    a.[namebc],
    a.[ItemName2] AS namecina,
    a.[warnac] AS warna,
    a.[Mark] AS Departemen,
    a.[KodeJenis],
    a.[SatuanKecil] AS Satuan,
    a.[Spec],
    a.[bahan],
    b.[NamaJenis]
  FROM [cp].[dbo].[taGoods] AS a
  INNER JOIN [cp].[dbo].[taKindofGoods] AS b 
    ON a.[KodeJenis] = b.[KodeJenis]
`;

const ORDER_BY_DESC = `ORDER BY a.[userdatetime] DESC`;

const CHUNK_SIZE = 400;

// ============ HELPERS ============
const normalizeId = (id: string): string => id.trim().toUpperCase();

const createSqlParam = (name: string, value: string) => ({
  name,
  type: sql.VarChar(50),
  value,
});

// ============ MAPPING ============
const mapRow = (row: DbRow): MasterItem => {
  const namecina = row.namecina ?? row.ItemName2 ?? "";
  const warna = row.warna ?? row.warnac ?? "";
  const satuan = row.Satuan ?? row.SatuanKecil ?? "";
  const departemen = row.Departemen ?? row.Mark ?? "";

  return {
    ItemID: row.ItemID,
    ItemName: row.ItemName,
    namebc: row.namebc,
    namecina,
    ItemName2: namecina,
    warna,
    warnac: warna,
    Departemen: departemen,
    Mark: departemen,
    KodeJenis: row.KodeJenis,
    Satuan: satuan,
    SatuanKecil: satuan,
    Spec: row.Spec,
    bahan: row.bahan,
    NamaJenis: row.NamaJenis,
  };
};

// ============ MAIN FUNCTIONS ============

/**
 * Get multiple master items by IDs (with chunking for SQL Server 2016-)
 */
export async function getMasterItems(ids: string[]): Promise<MasterItem[]> {
  const cleanIds = [...new Set(ids.map(normalizeId).filter(Boolean))];

  if (cleanIds.length === 0) {
    return [];
  }

  const allRows: DbRow[] = [];

  for (let i = 0; i < cleanIds.length; i += CHUNK_SIZE) {
    const chunk = cleanIds.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map((_, j) => `@id${j}`).join(", ");

    const params = chunk.map((id, j) => ({
      name: `id${j}`,
      type: sql.VarChar(50),
      value: id,
    }));

    // ✅ WHERE dulu, lalu ORDER BY DESC (terbaru dulu)
    const query = `${BASE_SELECT} WHERE a.[ItemID] IN (${placeholders}) ${ORDER_BY_DESC}`;
    const result = await runQuery(query, params);

    allRows.push(...(result.recordset as DbRow[]));
  }

  return allRows.map(mapRow);
}

/**
 * Get a single master item by ID
 */
export async function getMasterItem(
  itemId: string,
): Promise<MasterItem | null> {
  const clean = normalizeId(itemId);
  if (!clean) return null;

  // ✅ WHERE dulu, lalu ORDER BY DESC (terbaru dulu)
  const query = `${BASE_SELECT} WHERE a.[ItemID] = @ItemID ${ORDER_BY_DESC}`;
  const params = [createSqlParam("ItemID", clean)];

  const result = await runQuery(query, params);
  const row = result.recordset[0] as DbRow | undefined;

  return row ? mapRow(row) : null;
}

/**
 * Check if an item exists (more efficient than getMasterItem)
 */
export async function masterItemExists(itemId: string): Promise<boolean> {
  const clean = normalizeId(itemId);
  if (!clean) return false;

  const result = await runQuery(
    `SELECT 1 FROM [cp].[dbo].[taGoods] WHERE [ItemID] = @ItemID`,
    [createSqlParam("ItemID", clean)],
  );

  return result.recordset.length > 0;
}

// ============ PAGINATION ============

export interface MasterPagedResult {
  rows: MasterItem[];
  total: number;
}

/**
 * Get paginated master goods with search
 */
export async function getMasterGoodsPaged(
  q: string | undefined,
  page: number,
  pageSize: number,
): Promise<MasterPagedResult> {
  const keyword = (q ?? "").trim();
  const hasSearch = keyword.length > 0;
  const like = `%${keyword}%`;

  const pageNum = Math.max(1, page);
  const limit = Math.max(1, pageSize);
  const offset = (pageNum - 1) * limit;

  // Search columns
  const searchColumns = [
    "a.[ItemID]",
    "a.[ItemName]",
    "a.[namebc]",
    "a.[ItemName2]",
    "a.[Mark]",
    "b.[NamaJenis]",
  ];

  const whereClause = hasSearch
    ? `WHERE (${searchColumns.map((col) => `${col} LIKE @q`).join(" OR ")})`
    : "";

  // ✅ Fix: NVarChar dengan length
  const searchParams = hasSearch
    ? [{ name: "q", type: sql.NVarChar(255), value: like }]
    : [];

  // Get total count
  const countQuery = hasSearch
    ? `
    SELECT COUNT(*) AS total 
    FROM [cp].[dbo].[taGoods] a 
    INNER JOIN [cp].[dbo].[taKindofGoods] b 
      ON a.[KodeJenis] = b.[KodeJenis]
    ${whereClause}
  `
    : `SELECT COUNT(*) AS total FROM [cp].[dbo].[taGoods] a`;

  // ✅ Get paginated data — urutan klausa benar: WHERE → ORDER BY DESC → OFFSET/FETCH.
  //    (Sebelumnya ORDER BY berada SEBELUM WHERE sehingga query error saat pencarian/q terisi.)
  const dataQuery = `
    ${BASE_SELECT}
    ${whereClause}
    ${ORDER_BY_DESC}
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
  `;

  const params = [
    ...searchParams,
    { name: "Offset", type: sql.Int, value: offset },
    { name: "Limit", type: sql.Int, value: limit },
  ];

  const [countResult, dataResult] = await Promise.all([
    runQuery(countQuery, searchParams),
    runQuery(dataQuery, params),
  ]);

  const total = Number(countResult.recordset[0]?.total) || 0;

  return {
    rows: (dataResult.recordset as DbRow[]).map(mapRow),
    total,
  };
}

// ============ API HELPER ============

export interface MasterApiParams {
  ids?: string;
  itemId?: string;
}

export type MasterApiResponse =
  | { success: true; data: MasterItem[] }
  | { success: true; exists: boolean; data: MasterItem | null }
  | { success: false; error: string };

/**
 * Unified API handler for master data
 */
export async function getMasterForApi(
  params: MasterApiParams,
): Promise<MasterApiResponse> {
  try {
    if (params.ids) {
      const ids = params.ids.split(",").map(normalizeId).filter(Boolean);
      const data = await getMasterItems(ids);
      return { success: true, data };
    }

    if (params.itemId) {
      const item = await getMasterItem(params.itemId);
      return {
        success: true,
        exists: item !== null,
        data: item,
      };
    }

    return { success: true, data: [] };
  } catch (error) {
    log.error({ err: error }, "Failed to fetch master items");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// ============ CRUD & REFERENCE DATA ============

export interface CreateMasterItemPayload {
  ItemID: string;
  ItemName: string;
  namebc?: string;
  ItemName2?: string;
  KodeJenis: string;
  Mark?: string;
  SatuanKecil?: string;
  Spec?: string;
  bahan?: string;
  warnac?: string;
}

export interface KindOfGoods {
  KodeJenis: string;
  NamaJenis: string;
  Status: boolean;
}

export async function getKindofGoods(): Promise<KindOfGoods[]> {
  const q = `SELECT KodeJenis, NamaJenis, Status FROM [cp].[dbo].[taKindofGoods] ORDER BY KodeJenis`;
  const res = await runQuery(q);
  return (res.recordset ?? []) as KindOfGoods[];
}

export async function getMasterReferenceData() {
  const [kindsRes, marksRes, unitsRes] = await Promise.all([
    runQuery(`SELECT KodeJenis, NamaJenis, Status FROM [cp].[dbo].[taKindofGoods] ORDER BY KodeJenis`),
    runQuery(`SELECT DISTINCT Mark FROM [cp].[dbo].[taGoods] WHERE Mark IS NOT NULL AND LTRIM(RTRIM(Mark)) <> '' ORDER BY Mark`),
    runQuery(`SELECT DISTINCT SatuanKecil FROM [cp].[dbo].[taGoods] WHERE SatuanKecil IS NOT NULL AND LTRIM(RTRIM(SatuanKecil)) <> '' ORDER BY SatuanKecil`)
  ]);

  return {
    kinds: (kindsRes.recordset ?? []) as KindOfGoods[],
    departments: (marksRes.recordset ?? []).map((r: any) => String(r.Mark).trim()).filter(Boolean),
    units: (unitsRes.recordset ?? []).map((r: any) => String(r.SatuanKecil).trim()).filter(Boolean)
  };
}

export async function createMasterItem(
  payload: CreateMasterItemPayload,
  username: string = 'system'
): Promise<MasterItem> {
  const cleanId = normalizeId(payload.ItemID);
  if (!cleanId) throw new Error('Kode Barang (ItemID) wajib diisi');
  if (cleanId.length > 40) throw new Error('Kode Barang (ItemID) maksimal 40 karakter');

  const itemName = (payload.ItemName ?? '').trim();
  if (!itemName) throw new Error('Nama Barang (ItemName) wajib diisi');

  const kodeJenis = (payload.KodeJenis ?? '').trim();
  if (!kodeJenis) throw new Error('Jenis Barang (KodeJenis) wajib dipilih');

  const exists = await masterItemExists(cleanId);
  if (exists) {
    throw new Error(`Kode Barang "${cleanId}" sudah terdaftar di Master Barang`);
  }

  const mark = (payload.Mark ?? '').trim() || null;
  const satuanKecil = (payload.SatuanKecil ?? 'PCS').trim() || 'PCS';
  const namebc = (payload.namebc ?? '').trim() || null;
  const itemName2 = (payload.ItemName2 ?? '').trim() || null;
  const spec = (payload.Spec ?? '').trim() || null;
  const bahan = (payload.bahan ?? '').trim() || '';
  const warnac = (payload.warnac ?? '').trim() || '';
  const user = (username || 'system').slice(0, 50);

  const insertQ = `
    INSERT INTO [cp].[dbo].[taGoods] (
      ItemID, ItemName, ItemNameBuy, ItemName2, namebc,
      KodeJenis, Mark, SatuanKecil, Spec, bahan, warnac,
      UserName, UserDateTime, Delisted
    ) VALUES (
      @ItemID, @ItemName, @ItemName, @ItemName2, @namebc,
      @KodeJenis, @Mark, @SatuanKecil, @Spec, @bahan, @warnac,
      @UserName, GETDATE(), 0
    )
  `;

  await runQuery(insertQ, [
    { name: 'ItemID', type: sql.VarChar(40), value: cleanId },
    { name: 'ItemName', type: sql.VarChar(200), value: itemName },
    { name: 'ItemName2', type: sql.NVarChar(800), value: itemName2 },
    { name: 'namebc', type: sql.NVarChar(800), value: namebc },
    { name: 'KodeJenis', type: sql.VarChar(5), value: kodeJenis },
    { name: 'Mark', type: sql.VarChar(30), value: mark },
    { name: 'SatuanKecil', type: sql.VarChar(15), value: satuanKecil },
    { name: 'Spec', type: sql.NVarChar(400), value: spec },
    { name: 'bahan', type: sql.NVarChar(150), value: bahan },
    { name: 'warnac', type: sql.NVarChar(150), value: warnac },
    { name: 'UserName', type: sql.VarChar(50), value: user },
  ]);

  const created = await getMasterItem(cleanId);
  if (!created) throw new Error('Gagal memuat barang setelah disimpan');
  return created;
}

export async function updateMasterItem(
  itemId: string,
  payload: Partial<CreateMasterItemPayload>,
  username: string = 'system'
): Promise<MasterItem> {
  const cleanId = normalizeId(itemId);
  if (!cleanId) throw new Error('Kode Barang (ItemID) wajib diisi');

  const existing = await getMasterItem(cleanId);
  if (!existing) throw new Error(`Kode Barang "${cleanId}" tidak ditemukan`);

  const itemName = payload.ItemName !== undefined ? payload.ItemName.trim() : existing.ItemName;
  if (!itemName) throw new Error('Nama Barang (ItemName) tidak boleh kosong');

  const kodeJenis = payload.KodeJenis !== undefined ? payload.KodeJenis.trim() : existing.KodeJenis;
  const mark = payload.Mark !== undefined ? (payload.Mark.trim() || null) : existing.Mark;
  const satuanKecil = payload.SatuanKecil !== undefined ? (payload.SatuanKecil.trim() || 'PCS') : existing.Satuan;
  const namebc = payload.namebc !== undefined ? (payload.namebc.trim() || null) : existing.namebc;
  const itemName2 = payload.ItemName2 !== undefined ? (payload.ItemName2.trim() || null) : existing.ItemName2;
  const spec = payload.Spec !== undefined ? (payload.Spec.trim() || null) : existing.Spec;
  const bahan = payload.bahan !== undefined ? payload.bahan.trim() : existing.bahan;
  const warnac = payload.warnac !== undefined ? payload.warnac.trim() : existing.warna;
  const user = (username || 'system').slice(0, 50);

  const updateQ = `
    UPDATE [cp].[dbo].[taGoods]
    SET
      ItemName = @ItemName,
      ItemNameBuy = @ItemName,
      ItemName2 = @ItemName2,
      namebc = @namebc,
      KodeJenis = @KodeJenis,
      Mark = @Mark,
      SatuanKecil = @SatuanKecil,
      Spec = @Spec,
      bahan = @bahan,
      warnac = @warnac,
      UserUpdateName = @UserUpdateName,
      UserUpdateTime = GETDATE()
    WHERE ItemID = @ItemID
  `;

  await runQuery(updateQ, [
    { name: 'ItemID', type: sql.VarChar(40), value: cleanId },
    { name: 'ItemName', type: sql.VarChar(200), value: itemName },
    { name: 'ItemName2', type: sql.NVarChar(800), value: itemName2 },
    { name: 'namebc', type: sql.NVarChar(800), value: namebc },
    { name: 'KodeJenis', type: sql.VarChar(5), value: kodeJenis },
    { name: 'Mark', type: sql.VarChar(30), value: mark },
    { name: 'SatuanKecil', type: sql.VarChar(15), value: satuanKecil },
    { name: 'Spec', type: sql.NVarChar(400), value: spec },
    { name: 'bahan', type: sql.NVarChar(150), value: bahan },
    { name: 'warnac', type: sql.NVarChar(150), value: warnac },
    { name: 'UserUpdateName', type: sql.VarChar(50), value: user },
  ]);

  const updated = await getMasterItem(cleanId);
  if (!updated) throw new Error('Gagal memuat barang setelah diperbarui');
  return updated;
}

export async function deleteMasterItem(
  itemId: string,
  username: string = 'system'
): Promise<{ action: 'deleted' | 'delisted'; message: string }> {
  const cleanId = normalizeId(itemId);
  if (!cleanId) throw new Error('Kode Barang (ItemID) wajib diisi');

  const existing = await getMasterItem(cleanId);
  if (!existing) throw new Error(`Barang dengan ID "${cleanId}" tidak ditemukan`);

  const checkQ = `
    SELECT
      (SELECT COUNT(*) FROM [cp].[dbo].[taPROrderDt] WHERE itemID = @ItemID) AS spkCount,
      (SELECT COUNT(*) FROM [cp].[dbo].[taSodt] WHERE itemID = @ItemID) AS soCount,
      (SELECT COUNT(*) FROM [cp].[dbo].[taBOMTree] WHERE ParentID = @ItemID OR ChildID = @ItemID) AS bomCount,
      (SELECT COUNT(*) FROM [cp].[dbo].[taStock] WHERE ItemID = @ItemID AND (Bags > 0 OR Kgs > 0)) AS stockCount
  `;
  const checkRes = await runQuery(checkQ, [{ name: 'ItemID', type: sql.VarChar(40), value: cleanId }]);
  const counts = checkRes.recordset[0] ?? { spkCount: 0, soCount: 0, bomCount: 0, stockCount: 0 };
  const hasReferences = (counts.spkCount > 0 || counts.soCount > 0 || counts.bomCount > 0 || counts.stockCount > 0);

  if (hasReferences) {
    await runQuery(
      `UPDATE [cp].[dbo].[taGoods] SET Delisted = 1, UserUpdateName = @User, UserUpdateTime = GETDATE() WHERE ItemID = @ItemID`,
      [
        { name: 'ItemID', type: sql.VarChar(40), value: cleanId },
        { name: 'User', type: sql.VarChar(50), value: username.slice(0, 50) }
      ]
    );
    return {
      action: 'delisted',
      message: `Barang "${cleanId}" memiliki referensi riwayat transaksi/stok sehingga dinonaktifkan (Delisted).`
    };
  }

  await runQuery(
    `DELETE FROM [cp].[dbo].[taGoods] WHERE ItemID = @ItemID`,
    [{ name: 'ItemID', type: sql.VarChar(40), value: cleanId }]
  );

  return {
    action: 'deleted',
    message: `Barang "${cleanId}" berhasil dihapus dari Master Barang.`
  };
}

// ============ EXCEL TEMPLATE & IMPORT ============

export async function generateMasterGoodsExcelTemplate(): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: FORM INPUT
  const rows: any[][] = [
    [
      "Kode Barang (ItemID) *",
      "Nama Barang (ItemName) *",
      "Kode Jenis *",
      "Nama Bea Cukai (namebc)",
      "Nama Mandarin (ItemName2)",
      "Departemen (Mark)",
      "Satuan (SatuanKecil)",
      "Spesifikasi (Spec)",
      "Bahan (bahan)",
      "Warna (warnac)"
    ],
    [
      "CONTOH-BB-001",
      "BIJI PLASTIK PP HITAM",
      "K01",
      "BIJI PLASTIK PP",
      "PP 塑料颗粒 黑色",
      "INJEKSI",
      "KG",
      "MFI 12",
      "POLYPROPYLENE",
      "HITAM"
    ],
    [
      "CONTOH-FG-001",
      "BODY KRAN AIR CHROME",
      "K02",
      "FAUCET BODY",
      "龙头主体 镀铬",
      "ASSEMBLY",
      "PCS",
      "STANDARD 1/2 INCH",
      "ZINC / BRASS",
      "CHROME"
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 25 },
    { wch: 35 },
    { wch: 15 },
    { wch: 25 },
    { wch: 25 },
    { wch: 20 },
    { wch: 15 },
    { wch: 25 },
    { wch: 20 },
    { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, "FORM_MASTER_BARANG");

  // Sheet 2: REFERENSI KODE JENIS
  const refData = await getMasterReferenceData();
  const kindRows: any[][] = [
    ["Kode Jenis", "Nama Jenis Barang", "Status Aktif"],
    ...refData.kinds.map(k => [k.KodeJenis, k.NamaJenis, k.Status ? 'AKTIF' : 'NONAKTIF'])
  ];
  const wsKinds = XLSX.utils.aoa_to_sheet(kindRows);
  wsKinds["!cols"] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsKinds, "REFERENSI_JENIS");

  // Sheet 3: REFERENSI DEPARTEMEN & SATUAN
  const maxLen = Math.max(refData.departments.length, refData.units.length);
  const deptRows: any[][] = [
    ["Daftar Departemen (Mark)", "", "Daftar Satuan Umum"],
    ...Array.from({ length: maxLen }, (_, i) => [
      refData.departments[i] || "",
      "",
      refData.units[i] || ""
    ])
  ];
  const wsDepts = XLSX.utils.aoa_to_sheet(deptRows);
  wsDepts["!cols"] = [{ wch: 30 }, { wch: 5 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsDepts, "REFERENSI_DEPT_SATUAN");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export interface ParsedMasterItemRow {
  rowNumber: number;
  ItemID: string;
  ItemName: string;
  KodeJenis: string;
  namebc?: string;
  ItemName2?: string;
  Mark?: string;
  SatuanKecil?: string;
  Spec?: string;
  bahan?: string;
  warnac?: string;
  status: 'NEW' | 'EXISTS' | 'INVALID';
  errorMessage?: string;
}

export interface ParseMasterGoodsResult {
  items: ParsedMasterItemRow[];
  summary: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    newCount: number;
    existingCount: number;
  };
}

export async function parseMasterGoodsExcelImport(buffer: Buffer): Promise<ParseMasterGoodsResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('File Excel tidak memiliki sheet yang valid');

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rawRows.length < 2) throw new Error('File Excel tidak berisi baris data.');

  let headerIdx = 0;
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(" ");
    if (rowStr.includes("kode") || rowStr.includes("itemid")) {
      headerIdx = i;
      break;
    }
  }

  const header = rawRows[headerIdx].map((c) => String(c).trim().toLowerCase());
  const colMap = {
    itemId: header.findIndex(h => h.includes("itemid") || h.includes("kode barang") || h.includes("kode")),
    itemName: header.findIndex(h => h.includes("itemname") || h.includes("nama barang")),
    kodeJenis: header.findIndex(h => h.includes("kode jenis") || h.includes("jenis")),
    namebc: header.findIndex(h => h.includes("namebc") || h.includes("bea cukai") || h.includes("bc")),
    itemName2: header.findIndex(h => h.includes("itemname2") || h.includes("mandarin") || h.includes("cina")),
    mark: header.findIndex(h => h.includes("departemen") || h.includes("mark") || h.includes("dept")),
    satuan: header.findIndex(h => h.includes("satuan") || h.includes("unit")),
    spec: header.findIndex(h => h.includes("spec") || h.includes("spesifikasi")),
    bahan: header.findIndex(h => h.includes("bahan")),
    warnac: header.findIndex(h => h.includes("warna"))
  };

  if (colMap.itemId === -1) colMap.itemId = 0;
  if (colMap.itemName === -1) colMap.itemName = 1;
  if (colMap.kodeJenis === -1) colMap.kodeJenis = 2;

  const dataRows = rawRows.slice(headerIdx + 1);
  const candidateIds: string[] = [];
  const parsedItems: Omit<ParsedMasterItemRow, 'status' | 'errorMessage'>[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    if (!r || r.length === 0) continue;
    const rawId = String(r[colMap.itemId] ?? "").trim();
    const rawName = String(r[colMap.itemName] ?? "").trim();
    if (!rawId && !rawName) continue;

    const cleanId = rawId.toUpperCase();
    candidateIds.push(cleanId);

    parsedItems.push({
      rowNumber: headerIdx + i + 2,
      ItemID: cleanId,
      ItemName: rawName,
      KodeJenis: String(r[colMap.kodeJenis] ?? "").trim().toUpperCase() || 'K01',
      namebc: colMap.namebc >= 0 ? String(r[colMap.namebc] ?? "").trim() || undefined : undefined,
      ItemName2: colMap.itemName2 >= 0 ? String(r[colMap.itemName2] ?? "").trim() || undefined : undefined,
      Mark: colMap.mark >= 0 ? String(r[colMap.mark] ?? "").trim() || undefined : undefined,
      SatuanKecil: colMap.satuan >= 0 ? String(r[colMap.satuan] ?? "").trim().toUpperCase() || 'PCS' : 'PCS',
      Spec: colMap.spec >= 0 ? String(r[colMap.spec] ?? "").trim() || undefined : undefined,
      bahan: colMap.bahan >= 0 ? String(r[colMap.bahan] ?? "").trim() || undefined : undefined,
      warnac: colMap.warnac >= 0 ? String(r[colMap.warnac] ?? "").trim() || undefined : undefined,
    });
  }

  if (parsedItems.length === 0) {
    throw new Error('Tidak ada data barang yang dapat dibaca di file Excel.');
  }

  const existingItems = await getMasterItems(candidateIds);
  const existingSet = new Set(existingItems.map(x => x.ItemID.toUpperCase()));

  const refData = await getMasterReferenceData();
  const validKinds = new Set(refData.kinds.map(k => k.KodeJenis.toUpperCase()));

  const resultItems: ParsedMasterItemRow[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let newCount = 0;
  let existingCount = 0;

  for (const item of parsedItems) {
    const errors: string[] = [];

    if (!item.ItemID) {
      errors.push('Kode Barang wajib diisi');
    } else if (item.ItemID.length > 40) {
      errors.push('Kode Barang maksimal 40 karakter');
    }

    if (!item.ItemName) {
      errors.push('Nama Barang wajib diisi');
    }

    if (item.KodeJenis && !validKinds.has(item.KodeJenis)) {
      errors.push(`Kode Jenis "${item.KodeJenis}" tidak valid`);
    }

    if (errors.length > 0) {
      invalidCount++;
      resultItems.push({
        ...item,
        status: 'INVALID',
        errorMessage: errors.join(', ')
      });
    } else {
      validCount++;
      const isExists = existingSet.has(item.ItemID);
      if (isExists) {
        existingCount++;
        resultItems.push({ ...item, status: 'EXISTS' });
      } else {
        newCount++;
        resultItems.push({ ...item, status: 'NEW' });
      }
    }
  }

  return {
    items: resultItems,
    summary: {
      totalRows: resultItems.length,
      validCount,
      invalidCount,
      newCount,
      existingCount
    }
  };
}

export async function importMasterGoods(
  items: CreateMasterItemPayload[],
  updateExisting: boolean = true,
  username: string = 'system'
): Promise<{ total: number; inserted: number; updated: number; skipped: number; errors: string[] }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const cleanId = normalizeId(item.ItemID);
      if (!cleanId || !item.ItemName) {
        skipped++;
        continue;
      }

      const exists = await masterItemExists(cleanId);
      if (exists) {
        if (updateExisting) {
          await updateMasterItem(cleanId, item, username);
          updated++;
        } else {
          skipped++;
        }
      } else {
        await createMasterItem(item, username);
        inserted++;
      }
    } catch (err: any) {
      errors.push(`[${item.ItemID}]: ${err?.message || 'Gagal menyimpan'}`);
    }
  }

  return {
    total: items.length,
    inserted,
    updated,
    skipped,
    errors
  };
}

// ============ EXPORT DEFAULT ============
export default {
  getMasterItems,
  getMasterItem,
  masterItemExists,
  getMasterGoodsPaged,
  getMasterForApi,
  getKindofGoods,
  getMasterReferenceData,
  createMasterItem,
  updateMasterItem,
  deleteMasterItem,
  generateMasterGoodsExcelTemplate,
  parseMasterGoodsExcelImport,
  importMasterGoods,
};

