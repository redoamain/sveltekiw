import { runQuery } from "@/lib/db";
import sql from "mssql";

export interface TaLogRow {
  Username: string;
  UserDateTime: string | null;
  UserDate: string | null;
  UserTime: string | null;
  TransTime: string | null;
  Kgs: number | null;
  Remark: string | null;
  TransNo: string | null;
  ItemID: string | null;
  TransDateTime: string | null;
  TransDate: string | null;
  IpAddr: string | null;
}

export interface TaLogPagedResult {
  rows: TaLogRow[];
  total: number;
}

export const TA_LOG_PAGE_SIZES = [100, 1000, 10000] as const;

function mapRow(r: Record<string, unknown>): TaLogRow {
  const userDT = r.UserDateTime ? new Date(r.UserDateTime as string | Date) : null;
  const transDT = r.TransDateTime ? new Date(r.TransDateTime as string | Date) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  // Driver mssql mengembalikan kolom SQL `time` sebagai objek Date (mis. Thu Jan 01 1970...),
  // jadi harus diformat via getter, bukan String().slice()
  const clockOfDate = (d: Date | null): string | null =>
    d && !isNaN(d.getTime())
      ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      : null;
  const clockOf = (v: unknown): string | null => {
    if (v instanceof Date) return clockOfDate(v);
    if (v != null && String(v).trim() !== "") {
      const m = String(v).trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (m) return `${pad(Number(m[1]))}:${m[2]}:${m[3] ?? "00"}`;
    }
    return null;
  };
  return {
    Username: String(r.Username ?? ""),
    UserDateTime: userDT ? userDT.toISOString().replace("T", " ").slice(0, 19) : null,
    UserDate: userDT ? userDT.toISOString().slice(0, 10) : null,
    UserTime: clockOf(r.UserTime) ?? clockOfDate(userDT),
    TransTime: clockOf(r.TransTime) ?? clockOfDate(transDT),
    Kgs: r.Kgs != null && r.Kgs !== "" ? Number(r.Kgs) : null,
    Remark: r.Remark != null ? String(r.Remark) : null,
    TransNo: r.TransNo != null ? String(r.TransNo) : null,
    ItemID: r.ItemID != null ? String(r.ItemID) : null,
    TransDateTime: transDT ? transDT.toISOString().replace("T", " ").slice(0, 19) : null,
    TransDate: r.TransDate
      ? new Date(r.TransDate as string | Date).toISOString().slice(0, 10)
      : transDT
        ? transDT.toISOString().slice(0, 10)
        : null,
    IpAddr: r.IpAddr != null ? String(r.IpAddr) : null,
  };
}

const baseSelect = `
  SELECT
    [Username],
    [UserDateTime],
    CONVERT(time, [UserDateTime]) AS [UserTime],
    [Kgs],
    [Remark],
    [TransNo],
    [ItemID],
    [TransDateTime],
    CONVERT(time, [TransDateTime]) AS [TransTime],
    CONVERT(date, [TransDateTime]) AS [TransDate],
    [IpAddr]
  FROM [cp].[dbo].[taLogNew]
`;

function buildWhere(q: string, tgl1?: string, tgl2?: string): {
  clause: string;
  inputs: Array<{ name: string; type: any; value: any }>;
} {
  const wh: string[] = [];
  const inputs: Array<{ name: string; type: any; value: any }> = [];
  const keyword = (q ?? "").trim();
  if (keyword) {
    wh.push(
      "([Username] LIKE @q OR [Remark] LIKE @q OR [TransNo] LIKE @q OR [ItemID] LIKE @q OR [IpAddr] LIKE @q)",
    );
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${keyword}%` });
  }
  if (tgl1 && tgl2) {
    wh.push("[UserDateTime] >= @Tgl1 AND [UserDateTime] <= @Tgl2");
    inputs.push({ name: "Tgl1", type: sql.VarChar, value: `${tgl1} 00:00:00` });
    inputs.push({ name: "Tgl2", type: sql.VarChar, value: `${tgl2} 23:59:59` });
  }
  return { clause: wh.length ? "WHERE " + wh.join(" AND ") : "", inputs };
}

export async function getTaLogPaged(opts: {
  q?: string;
  tgl1?: string;
  tgl2?: string;
  page: number;
  pageSize: number;
}): Promise<TaLogPagedResult> {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.max(1, opts.pageSize || 100);
  const offset = (page - 1) * pageSize;
  const { clause, inputs } = buildWhere(opts.q ?? "", opts.tgl1, opts.tgl2);

  const countQuery = `SELECT COUNT(*) AS tot FROM [cp].[dbo].[taLogNew] ${clause}`;
  const dataQuery = `${baseSelect} ${clause} ORDER BY [UserDateTime] DESC OFFSET @Off ROWS FETCH NEXT @Lim ROWS ONLY`;
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

export async function getTaLogForExport(opts: {
  q?: string;
  tgl1?: string;
  tgl2?: string;
  ids?: string[];
}): Promise<TaLogRow[]> {
  if (opts.ids && opts.ids.length > 0) {
    const clean = opts.ids.map((s) => s.trim()).filter(Boolean);
    if (!clean.length) return [];
    const CHUNK = 400;
    const out: TaLogRow[] = [];
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK);
      const ph = chunk.map((_, j) => `@id${j}`).join(", ");
      const chunkInputs = chunk.map((id, j) => ({ name: `id${j}`, type: sql.VarChar(50), value: id }));
      const res = await runQuery(
        `${baseSelect} WHERE [TransNo] IN (${ph}) ORDER BY [UserDateTime] DESC`,
        chunkInputs as never,
      );
      out.push(...res.recordset.map(mapRow));
    }
    return out;
  }
  const { clause, inputs } = buildWhere(opts.q ?? "", opts.tgl1, opts.tgl2);
  const res = await runQuery(
    `${baseSelect} ${clause} ORDER BY [UserDateTime] DESC`,
    inputs as never,
  );
  return res.recordset.map(mapRow);
}
