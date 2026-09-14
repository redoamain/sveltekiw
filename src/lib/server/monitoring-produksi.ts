import { runQuery, log } from "@/lib/db";
import sql from "mssql";

export interface MonitoringProduksiRow {
  No_Produksi: string;
  Tanggal: string | null;
  Departemen: string;
  Tipe_Produksi: string;
  SPK: string;
  NoRator: string | null;
  Nama_PO: string | null;
  Gudang: string | null;
  Remark: string | null;
  ItemID: string;
  Bags: number | null;
  Kgs: number | null;
  Kategori: string | null;
  UserName: string | null;
}

export const DEPARTEMEN_OPTIONS = [
  { value: "", label: "Semua Departemen" },
  { value: "IN", label: "IN — INJEKSI" },
  { value: "SP", label: "SP — SPRAY" },
  { value: "MO", label: "MO — MOULDING" },
  { value: "PL", label: "PL — PLATING" },
  { value: "AS", label: "AS — ASSEMBLY" },
] as const;

export const TIPE_OPTIONS = [
  { value: "", label: "Semua Tipe" },
  { value: "B", label: "B — BAHAN" },
  { value: "H", label: "H — HASIL" },
] as const;

export const PAGE_SIZE_OPTIONS = [100, 1000, 10000] as const;

const baseSelect = `
    SELECT
      hd.[ProdID] AS No_Produksi,
      hd.[ProdDate] AS Tanggal,
      d.[PRDeptName] AS Departemen,
      dt.[ItemType] AS Tipe_Produksi,
      hd.[OrderID] AS SPK,
      hd.[NoRator],
      sp.[Remark] AS Nama_PO,
      g.[LocName] AS Gudang,
      hd.[Remark] AS RemarkHD,
      dt.[ItemID],
      dt.[Bags],
      dt.[Kgs],
      kt.[NamaJenis] AS Kategori,
      dt.[UserName]
    FROM [cp].[dbo].[taPRProdHd] AS hd
    INNER JOIN [cp].[dbo].[taPRProdDt] AS dt
      ON hd.[ProdID] = dt.[ProdID] AND hd.[ProdType] = dt.[ProdType]
    INNER JOIN [cp].[dbo].[taPROrder] AS sp
      ON hd.[OrderID] = sp.[OrderID]
    INNER JOIN [cp].[dbo].[taLocation] AS g
      ON hd.[LocID] = g.[LocID]
    INNER JOIN [cp].[dbo].[taDeptPROrder] AS d
      ON hd.[DeptID] = d.[PRDeptID]
    INNER JOIN [cp].[dbo].[taGoods] AS k
      ON dt.[ItemID] = k.[ItemID]
    INNER JOIN [cp].[dbo].[taKindofGoods] AS kt
      ON k.[KodeJenis] = kt.[KodeJenis]
`;

function buildWhere(
  dept: string,
  tipe: string,
  q: string,
  tgl1?: string,
  tgl2?: string,
): { clause: string; inputs: Array<{ name: string; type: any; value: any }> } {
  const wh: string[] = [];
  const inputs: Array<{ name: string; type: any; value: any }> = [];

  // Departemen = ProdType
  const d = (dept ?? "").trim().toUpperCase();
  if (d && ["IN", "SP", "MO", "PL", "AS"].includes(d)) {
    wh.push("hd.[ProdType] = @Dept");
    inputs.push({ name: "Dept", type: sql.VarChar(2), value: d });
  } else {
    wh.push("hd.[ProdType] IN ('IN','SP','MO','PL','AS')");
  }

  // Tipe B/H
  const t = (tipe ?? "").trim().toUpperCase();
  if (t === "B" || t === "H") {
    wh.push("dt.[ItemType] = @Tipe");
    inputs.push({ name: "Tipe", type: sql.VarChar(1), value: t });
  } else {
    wh.push("dt.[ItemType] IN ('B','H')");
  }

  // Tanggal produksi (hd.ProdDate) — dipakai untuk pencarian by tanggal
  const hasTgl = Boolean(tgl1 && tgl2);
  if (hasTgl) {
    wh.push("hd.[ProdDate] >= @Tgl1 AND hd.[ProdDate] <= @Tgl2");
    inputs.push({ name: "Tgl1", type: sql.VarChar, value: `${tgl1!} 00:00:00` });
    inputs.push({ name: "Tgl2", type: sql.VarChar, value: `${tgl2!} 23:59:59` });
  }

  // Search global
  const keyword = (q ?? "").trim();
  if (keyword) {
    wh.push(
      "(hd.[ProdID] LIKE @q OR hd.[OrderID] LIKE @q OR dt.[ItemID] LIKE @q OR k.[ItemName] LIKE @q OR kt.[NamaJenis] LIKE @q OR sp.[Remark] LIKE @q OR d.[PRDeptName] LIKE @q)",
    );
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${keyword}%` });
  }

  return { clause: wh.length ? "WHERE " + wh.join(" AND ") : "", inputs };
}

function mapRow(r: Record<string, unknown>): MonitoringProduksiRow {
  return {
    No_Produksi: String(r.No_Produksi ?? ""),
    Tanggal: r.Tanggal ? new Date(r.Tanggal as string | Date).toISOString().slice(0, 10) : null,
    Departemen: String(r.Departemen ?? ""),
    Tipe_Produksi: String(r.Tipe_Produksi ?? ""),
    SPK: String(r.SPK ?? ""),
    NoRator: r.NoRator != null ? String(r.NoRator) : null,
    Nama_PO: r.Nama_PO != null ? String(r.Nama_PO) : null,
    Gudang: r.Gudang != null ? String(r.Gudang) : null,
    Remark: (r.RemarkHD ?? r.Remark) != null ? String((r.RemarkHD ?? r.Remark) as string) : null,
    ItemID: String(r.ItemID ?? ""),
    Bags: r.Bags != null ? Number(r.Bags) : null,
    Kgs: r.Kgs != null ? Number(r.Kgs) : null,
    Kategori: r.Kategori != null ? String(r.Kategori) : null,
    UserName: r.UserName != null ? String(r.UserName) : null,
  };
}

export interface MonitoringPagedResult {
  rows: MonitoringProduksiRow[];
  total: number;
}

export async function getMonitoringProduksiPaged(
  opts: { dept?: string; tipe?: string; q?: string; tgl1?: string; tgl2?: string; page: number; pageSize: number },
): Promise<MonitoringPagedResult> {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.max(1, opts.pageSize || 100);
  const offset = (page - 1) * pageSize;
  const { clause, inputs } = buildWhere(opts.dept ?? "", opts.tipe ?? "", opts.q ?? "", opts.tgl1, opts.tgl2);

  const countQuery = opts.q
    ? `SELECT COUNT(*) AS tot FROM [cp].[dbo].[taPRProdHd] hd
       INNER JOIN [cp].[dbo].[taPRProdDt] dt ON hd.[ProdID]=dt.[ProdID] AND hd.[ProdType]=dt.[ProdType]
       INNER JOIN [cp].[dbo].[taPROrder] sp ON hd.[OrderID]=sp.[OrderID]
       INNER JOIN [cp].[dbo].[taLocation] g ON hd.[LocID]=g.[LocID]
       INNER JOIN [cp].[dbo].[taDeptPROrder] d ON hd.[DeptID]=d.[PRDeptID]
       INNER JOIN [cp].[dbo].[taGoods] k ON dt.[ItemID]=k.[ItemID]
       INNER JOIN [cp].[dbo].[taKindofGoods] kt ON k.[KodeJenis]=kt.[KodeJenis]
       ${clause}`
    : `SELECT COUNT(*) AS tot FROM [cp].[dbo].[taPRProdHd] hd
       INNER JOIN [cp].[dbo].[taPRProdDt] dt ON hd.[ProdID]=dt.[ProdID] AND hd.[ProdType]=dt.[ProdType]
       ${clause}`;

  const dataQuery = `${baseSelect} ${clause} ORDER BY hd.[ProdDate] DESC, hd.[ProdID] DESC OFFSET @Off ROWS FETCH NEXT @Lim ROWS ONLY`;
  const dataInputs = [...(inputs as never[]), { name: "Off", type: sql.Int, value: offset }, { name: "Lim", type: sql.Int, value: pageSize }];

  // Eksekusi paralel query count dan data untuk memangkas latency separuh
  const [countRes, dataRes] = await Promise.all([
    runQuery(countQuery, inputs as never),
    runQuery(dataQuery, dataInputs as never),
  ]);

  const total = Number(countRes.recordset[0]?.tot) || 0;
  return { rows: dataRes.recordset.map(mapRow), total };
}

export async function getMonitoringProduksiForExport(
  opts: { dept?: string; tipe?: string; q?: string; tgl1?: string; tgl2?: string; ids?: string[] },
): Promise<MonitoringProduksiRow[]> {
  if (opts.ids && opts.ids.length > 0) {
    // Export yang dipilih (checkbox) — ambil hanya No_Produksi yang dipilih
    const clean = opts.ids.map((s) => s.trim()).filter(Boolean);
    if (clean.length === 0) return [];
    const CHUNK = 400;
    const out: MonitoringProduksiRow[] = [];
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK);
      const ph = chunk.map((_, j) => `@id${j}`).join(", ");
      const chunkInputs = chunk.map((id, j) => ({ name: `id${j}`, type: sql.VarChar(30), value: id }));
      const res = await runQuery(
        `${baseSelect} WHERE hd.[ProdID] IN (${ph}) ORDER BY hd.[ProdDate] DESC`,
        chunkInputs as never,
      );
      out.push(...res.recordset.map(mapRow));
    }
    return out;
  }

  // Export sesuai filter (semua yang match filter)
  const { clause, inputs } = buildWhere(opts.dept ?? "", opts.tipe ?? "", opts.q ?? "", opts.tgl1, opts.tgl2);
  const res = await runQuery(
    `${baseSelect} ${clause} ORDER BY hd.[ProdDate] DESC, hd.[ProdID] DESC`,
    inputs as never,
  );
  return res.recordset.map(mapRow);
}
