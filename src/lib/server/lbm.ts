import { runQuery } from "@/lib/db";
import sql from "mssql";

export interface LBMRow {
  No_Transaksi: string;
  Tanggal: string | null;
  Gudang: string | null;
  NoRator: string | null;
  Keterangan: string | null;
  ItemID: string;
  Bags: number | null;
  Kgs: number | null;
  HPPPrice: number | null;
  Kategori: string | null;
  username: string | null;
}

const baseSelect = `
    SELECT
      hd.[MoveID] AS No_Transaksi,
      hd.[MoveDate] AS Tanggal,
      g.[LocName] AS Gudang,
      hd.[NoRator],
      hd.[Remark] AS Keterangan,
      dt.[ItemID],
      dt.[Bags],
      dt.[Kgs],
      dt.[HPPPrice],
      kr.[NamaJenis] AS Kategori,
      dt.[username]
    FROM [cp].[dbo].[taOpNameIHD] AS hd
    INNER JOIN [cp].[dbo].[taOpNameIDT] AS dt ON hd.[MoveID] = dt.[MoveID] AND hd.[MoveType] = dt.[MoveType]
    INNER JOIN [cp].[dbo].[taLocation] AS g ON hd.[LocID] = g.[LocID]
    INNER JOIN [cp].[dbo].[taGoods] AS i ON dt.[ItemID] = i.[ItemID]
    INNER JOIN [cp].[dbo].[taKindofGoods] AS kr ON kr.[KodeJenis] = i.[KodeJenis]
`;

function buildWhere(q: string, tgl1?: string, tgl2?: string) {
  const wh: string[] = ["hd.[MoveType] in ('A','P')"];
  const inputs: Array<{ name: string; type: any; value: any }> = [];
  if (tgl1 && tgl2) {
    wh.push("hd.[MoveDate] >= @Tgl1 AND hd.[MoveDate] <= @Tgl2");
    inputs.push({ name: "Tgl1", type: sql.VarChar, value: `${tgl1} 00:00:00` });
    inputs.push({ name: "Tgl2", type: sql.VarChar, value: `${tgl2} 23:59:59` });
  }
  const kw = (q ?? "").trim();
  if (kw) {
    wh.push("(hd.[MoveID] LIKE @q OR g.[LocName] LIKE @q OR dt.[ItemID] LIKE @q OR kr.[NamaJenis] LIKE @q OR hd.[Remark] LIKE @q)");
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${kw}%` });
  }
  return { clause: wh.length ? "WHERE " + wh.join(" AND ") : "", inputs };
}

function mapRow(r: Record<string, unknown>): LBMRow {
  return {
    No_Transaksi: String(r.No_Transaksi ?? r.MoveID ?? ""),
    Tanggal: r.Tanggal ? new Date(r.Tanggal as string | Date).toISOString().slice(0, 10) : null,
    Gudang: r.Gudang != null ? String(r.Gudang) : null,
    NoRator: r.NoRator != null ? String(r.NoRator) : null,
    Keterangan: r.Keterangan != null ? String(r.Keterangan) : null,
    ItemID: String(r.ItemID ?? ""),
    Bags: r.Bags != null ? Number(r.Bags) : null,
    Kgs: r.Kgs != null ? Number(r.Kgs) : null,
    HPPPrice: r.HPPPrice != null ? Number(r.HPPPrice) : null,
    Kategori: r.Kategori != null ? String(r.Kategori) : null,
    username: (r.username as string) != null ? String(r.username) : null,
  };
}

export async function getLBMPaged(opts: { q?: string; tgl1?: string; tgl2?: string; page: number; pageSize: number }) {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.max(1, opts.pageSize || 100);
  const offset = (page - 1) * pageSize;
  const { clause, inputs } = buildWhere(opts.q ?? "", opts.tgl1, opts.tgl2);
  const hasKeyword = Boolean((opts.q ?? "").trim());

  const countFrom = hasKeyword
    ? `[cp].[dbo].[taOpNameIHD] hd INNER JOIN [cp].[dbo].[taOpNameIDT] dt ON hd.[MoveID]=dt.[MoveID] AND hd.[MoveType]=dt.[MoveType] INNER JOIN [cp].[dbo].[taLocation] g ON hd.[LocID]=g.[LocID] INNER JOIN [cp].[dbo].[taGoods] i ON dt.[ItemID]=i.[ItemID] INNER JOIN [cp].[dbo].[taKindofGoods] kr ON kr.[KodeJenis]=i.[KodeJenis]`
    : `[cp].[dbo].[taOpNameIHD] hd INNER JOIN [cp].[dbo].[taOpNameIDT] dt ON hd.[MoveID]=dt.[MoveID] AND hd.[MoveType]=dt.[MoveType]`;

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

export async function getLBMForExport(opts: { q?: string; tgl1?: string; tgl2?: string; ids?: string[] }) {
  if (opts.ids?.length) {
    const clean = opts.ids.map((s) => s.trim()).filter(Boolean);
    const CHUNK = 400;
    const out: LBMRow[] = [];
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK);
      const ph = chunk.map((_, j) => `@id${j}`).join(", ");
      const chunkInputs = chunk.map((id, j) => ({ name: `id${j}`, type: sql.Int as unknown as sql.ISqlType, value: Number(id) || id }));
      const res = await runQuery(`${baseSelect} WHERE hd.[MoveID] IN (${ph}) ORDER BY hd.[MoveID] DESC`, chunkInputs as never);
      out.push(...res.recordset.map(mapRow));
    }
    return out;
  }
  const { clause, inputs } = buildWhere(opts.q ?? "", opts.tgl1, opts.tgl2);
  const res = await runQuery(`${baseSelect} ${clause} ORDER BY hd.[MoveID] DESC`, inputs as never);
  return res.recordset.map(mapRow);
}
