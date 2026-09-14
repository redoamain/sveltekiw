import { runQuery, log } from "@/lib/db";
import sql from "mssql";

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

// ============ EXPORT DEFAULT ============
export default {
  getMasterItems,
  getMasterItem,
  masterItemExists,
  getMasterGoodsPaged,
  getMasterForApi,
};
