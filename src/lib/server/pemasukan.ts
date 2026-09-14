import { runQuery } from "@/lib/db";
import sql from "mssql";

export interface PemasukanRow {
  No_Transaksi: string;
  Tanggal: string | null;
  Gudang: string | null;
  Supplier: string | null;
  Nopol: string | null;
  Nopen: string | null;
  TipeDok: string | null;
  ItemID: string;
  Bags: number | null;
  Kgs: number | null;
  satuan: string | null;
  Kategori: string | null;
  username: string | null;
}

const baseSelect = `
    SELECT
      hd.[MoveID] AS No_Transaksi,
      hd.[MoveDate] AS Tanggal,
      g.[LocName] AS Gudang,
      c.[CompanyName1] AS Supplier,
      hd.[Nopol],
      hd.[Nopen],
      e.[TipeDok],
      dt.[ItemID],
      dt.[Bags],
      dt.[Kgs],
      dt.[satuan],
      k.[NamaJenis] AS Kategori,
      dt.[username]
    FROM [cp].[dbo].[taTransIHD2] AS hd
    INNER JOIN [cp].[dbo].[taTransIDT2] AS dt ON hd.[MoveID] = dt.[MoveID] AND hd.[MoveType] = dt.[MoveType] AND hd.[TransID] = dt.[TransID]
    INNER JOIN [cp].[dbo].[taSupplier] AS c ON hd.[CompanyID] = c.[CompanyID]
    INNER JOIN [cp].[dbo].[taLocation] AS g ON hd.[LocID] = g.[LocID]
    INNER JOIN [cp].[dbo].[taPOHd] AS e ON hd.[OrderID] = e.[OrderID]
    INNER JOIN [CP].[dbo].[taGoods] AS br ON dt.[ItemID] = br.[ItemID]
    INNER JOIN [cp].[dbo].[taKindofGoods] AS k ON br.[KodeJenis] = k.[KodeJenis]
`;

function buildWhere(q: string, tgl1?: string, tgl2?: string) {
  const wh: string[] = [];
  const inputs: Array<{ name: string; type: any; value: any }> = [];
  if (tgl1 && tgl2) {
    wh.push("hd.[MoveDate] >= @Tgl1 AND hd.[MoveDate] <= @Tgl2");
    inputs.push({ name: "Tgl1", type: sql.VarChar, value: `${tgl1} 00:00:00` });
    inputs.push({ name: "Tgl2", type: sql.VarChar, value: `${tgl2} 23:59:59` });
  }
  const kw = (q ?? "").trim();
  if (kw) {
    wh.push("(hd.[MoveID] LIKE @q OR c.[CompanyName1] LIKE @q OR dt.[ItemID] LIKE @q OR k.[NamaJenis] LIKE @q OR hd.[Nopol] LIKE @q OR hd.[Nopen] LIKE @q OR g.[LocName] LIKE @q)");
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${kw}%` });
  }
  return { clause: wh.length ? "WHERE " + wh.join(" AND ") : "", inputs };
}

function mapRow(r: Record<string, unknown>): PemasukanRow {
  return {
    No_Transaksi: String(r.No_Transaksi ?? r.MoveID ?? ""),
    Tanggal: r.Tanggal ? new Date(r.Tanggal as string | Date).toISOString().slice(0, 10) : null,
    Gudang: r.Gudang != null ? String(r.Gudang) : null,
    Supplier: r.Supplier != null ? String(r.Supplier) : null,
    Nopol: r.Nopol != null ? String(r.Nopol) : null,
    Nopen: r.Nopen != null ? String(r.Nopen) : null,
    TipeDok: r.TipeDok != null ? String(r.TipeDok) : null,
    ItemID: String(r.ItemID ?? ""),
    Bags: r.Bags != null ? Number(r.Bags) : null,
    Kgs: r.Kgs != null ? Number(r.Kgs) : null,
    satuan: r.satuan != null ? String(r.satuan) : null,
    Kategori: r.Kategori != null ? String(r.Kategori) : null,
    username: (r.username as string) != null ? String(r.username) : null,
  };
}

export async function getPemasukanPaged(opts: { q?: string; tgl1?: string; tgl2?: string; page: number; pageSize: number }) {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.max(1, opts.pageSize || 100);
  const offset = (page - 1) * pageSize;
  const { clause, inputs } = buildWhere(opts.q ?? "", opts.tgl1, opts.tgl2);
  const hasKeyword = Boolean((opts.q ?? "").trim());

  const countFrom = hasKeyword
    ? `[cp].[dbo].[taTransIHD2] hd INNER JOIN [cp].[dbo].[taTransIDT2] dt ON hd.[MoveID]=dt.[MoveID] AND hd.[MoveType]=dt.[MoveType] AND hd.[TransID]=dt.[TransID] INNER JOIN [cp].[dbo].[taSupplier] c ON hd.[CompanyID]=c.[CompanyID] INNER JOIN [cp].[dbo].[taLocation] g ON hd.[LocID]=g.[LocID] INNER JOIN [cp].[dbo].[taPOHd] e ON hd.[OrderID]=e.[OrderID] INNER JOIN [CP].[dbo].[taGoods] br ON dt.[ItemID]=br.[ItemID] INNER JOIN [cp].[dbo].[taKindofGoods] k ON br.[KodeJenis]=k.[KodeJenis]`
    : `[cp].[dbo].[taTransIHD2] hd INNER JOIN [cp].[dbo].[taTransIDT2] dt ON hd.[MoveID]=dt.[MoveID] AND hd.[MoveType]=dt.[MoveType] AND hd.[TransID]=dt.[TransID]`;

  const countQuery = `SELECT COUNT(*) AS tot FROM ${countFrom} ${clause}`;
  const dataQuery = `${baseSelect} ${clause} ORDER BY hd.[MoveID] DESC OFFSET @Off ROWS FETCH NEXT @Lim ROWS ONLY`;
  const dataInputs = [
    ...(inputs as never[]),
    { name: "Off", type: sql.Int, value: offset },
    { name: "Lim", type: sql.Int, value: pageSize }
  ];

  const [countRes, dataRes] = await Promise.all([
    runQuery(countQuery, inputs as never),
    runQuery(dataQuery, dataInputs as never)
  ]);

  const total = Number(countRes.recordset[0]?.tot) || 0;
  return { rows: dataRes.recordset.map(mapRow), total };
}

export async function getPemasukanForExport(opts: { q?: string; tgl1?: string; tgl2?: string; ids?: string[] }) {
  if (opts.ids?.length) {
    const clean = opts.ids.map((s) => s.trim()).filter(Boolean);
    const CHUNK = 400;
    const out: PemasukanRow[] = [];
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK);
      const ph = chunk.map((_, j) => `@id${j}`).join(", ");
      const chunkInputs = chunk.map((id, j) => ({ name: `id${j}`, type: sql.VarChar(30), value: id }));
      const res = await runQuery(`${baseSelect} WHERE hd.[MoveID] IN (${ph}) ORDER BY hd.[MoveID] DESC`, chunkInputs as never);
      out.push(...res.recordset.map(mapRow));
    }
    return out;
  }
  const { clause, inputs } = buildWhere(opts.q ?? "", opts.tgl1, opts.tgl2);
  const res = await runQuery(`${baseSelect} ${clause} ORDER BY hd.[MoveID] DESC`, inputs as never);
  return res.recordset.map(mapRow);
}
