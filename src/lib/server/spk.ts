import { runQuery, withTransaction, log } from "@/lib/db";
import sql from "mssql";

export interface SPKRow {
  OrderID: string;
  OrderDate: string | null;
  OrderType: string | null;
  Remark: string | null;
  Completed: boolean;
  FinishedDate: string | null;
  UserName?: string | null;
}

export interface SPKPagedResult {
  rows: SPKRow[];
  total: number;
}

function mapRow(r: Record<string, unknown>): SPKRow {
  const raw = r.Completed;
  const completed =
    raw === true ||
    raw === 1 ||
    raw === "1" ||
    String(raw).trim().toLowerCase() === "true" ||
    String(raw).trim() === "1";
  // Jika raw adalah '0' string, Boolean('0') === true (bug) — harus cek eksplisit
  const isCompleted = raw != null && raw !== "" && raw !== 0 && raw !== "0" && raw !== false ? completed : false;
  // Lebih sederhana: hanya true jika raw === '1' / 1 / true
  const finalCompleted = raw === 1 || raw === true || String(raw) === "1" || String(raw).toLowerCase() === "true";

  return {
    OrderID: String(r.OrderID ?? ""),
    OrderDate: r.OrderDate ? new Date(r.OrderDate as string | Date).toISOString().slice(0, 10) : null,
    OrderType: r.OrderType != null ? String(r.OrderType) : null,
    Remark: r.Remark != null ? String(r.Remark) : null,
    Completed: finalCompleted,
    FinishedDate: r.FinishedDate ? new Date(r.FinishedDate as string | Date).toISOString().slice(0, 10) : null,
  };
}

export async function getSPKPaged(opts: {
  q?: string;
  status?: string; // "", "completed", "active"
  page: number;
  pageSize: number;
  orderIdPrefix?: string; // default AS%
}): Promise<SPKPagedResult> {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.max(1, opts.pageSize || 100);
  const offset = (page - 1) * pageSize;
  const q = (opts.q ?? "").trim();
  const status = (opts.status ?? "").trim().toLowerCase();
  const prefix = opts.orderIdPrefix ?? "AS%";

  const where: string[] = [];
  const inputs: Array<{ name: string; type: any; value: any }> = [];

  if (prefix) {
    where.push("OrderID LIKE @Prefix");
    inputs.push({ name: "Prefix", type: sql.VarChar(20), value: prefix });
  }
  if (q) {
    where.push("(OrderID LIKE @q OR Remark LIKE @q)");
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${q}%` });
  }
  if (status === "completed") where.push("Completed = 1");
  else if (status === "active") where.push("Completed = 0");

  const clause = where.length ? "WHERE " + where.join(" AND ") : "";

  const countRes = await runQuery(
    `SELECT COUNT(*) AS tot FROM [cp].[dbo].[taPROrder] ${clause}`,
    inputs as never,
  );
  const total = Number(countRes.recordset[0]?.tot) || 0;
  if (total === 0) return { rows: [], total: 0 };

  const dataRes = await runQuery(
    `SELECT OrderID, OrderDate, OrderType, Remark, Completed, FinishedDate
     FROM [cp].[dbo].[taPROrder] ${clause}
     ORDER BY OrderDate DESC, OrderID DESC OFFSET @Off ROWS FETCH NEXT @Lim ROWS ONLY`,
    [...(inputs as never[]), { name: "Off", type: sql.Int, value: offset }, { name: "Lim", type: sql.Int, value: pageSize }] as never,
  );
  return { rows: dataRes.recordset.map(mapRow), total };
}

// Bulk update — port dari snippet user (transaction + Promise.all)
export async function bulkUpdateSPK(
  spkList: Array<{ OrderID: string; Completed: boolean }>,
): Promise<number> {
  if (!spkList.length) return 0;

  // Normalisasi
  const clean = spkList
    .map((s) => ({
      OrderID: String(s.OrderID ?? "").trim(),
      Completed: Boolean(s.Completed),
    }))
    .filter((s) => s.OrderID);

  if (!clean.length) return 0;

  return withTransaction(async (tx) => {
    const now = new Date();
    let actuallyChanged = 0;
    // Cek dulu status saat ini agar pesan lebih akurat & hindari update sia-sia
    // Ambil Completed saat ini untuk semua OrderID yang dipilih
    const ids = clean.map((c) => c.OrderID);
    const placeholders: string[] = [];
    const checkInputs: Array<{ name: string; type: any; value: any }> = [];
    // Chunk check jika banyak
    const statusMap = new Map<string, boolean>();
    const CHK = 400;
    for (let i = 0; i < ids.length; i += CHK) {
      const chunk = ids.slice(i, i + CHK);
      const ph = chunk.map((_, j) => `@chk${j}`).join(", ");
      const chunkReq = new sql.Request(tx);
      // tx.request() tidak bisa dipakai untuk SELECT di dalam transaction yang sama dengan UPDATE? pakai new Request(tx) tetap dalam transaction
      chunk.forEach((id, j) => chunkReq.input(`chk${j}`, sql.VarChar(50), id));
      const chkRes = await chunkReq.query(`SELECT OrderID, Completed FROM [cp].[dbo].[taPROrder] WHERE OrderID IN (${ph})`);
      for (const r of chkRes.recordset as Array<{ OrderID: string; Completed: unknown }>) {
        const raw = r.Completed;
        const isComp = raw === 1 || raw === true || String(raw) === "1";
        statusMap.set(String(r.OrderID).trim().toUpperCase(), isComp);
      }
    }

    for (const { OrderID, Completed } of clean) {
      const key = OrderID.trim().toUpperCase();
      const current = statusMap.get(key);
      // Jika sudah dalam status yang diinginkan, tetap update FinishedDate jika Completed=true (biar tanggal update), tapi hitung sebagai tidak berubah untuk pesan
      const needsUpdate = current === undefined || current !== Completed;
      const req = new sql.Request(tx);
      req.input("OrderID", sql.VarChar(50), OrderID);
      req.input("Completed", sql.Bit, Completed ? 1 : 0);
      if (Completed) {
        req.input("FinishedDate", sql.DateTime, now);
      } else {
        req.input("FinishedDate", sql.DateTime, null);
      }
      const res = await req.query(`
        UPDATE [cp].[dbo].[taPROrder]
        SET
          Completed = @Completed,
          FinishedDate = @FinishedDate
        WHERE OrderID = @OrderID
      `);
      const affected = (res.rowsAffected?.[0] ?? 0) as number;
      if (affected > 0 && needsUpdate) actuallyChanged++;
      else if (affected > 0 && !needsUpdate) {
        // Sudah dalam status yang sama, tetap hitung sebagai berhasil tapi bedakan pesan nanti
        actuallyChanged++;
      }
    }
    return actuallyChanged;
  });
}

export async function getSPKForExport(opts: { q?: string; status?: string; ids?: string[] }): Promise<SPKRow[]> {
  if (opts.ids && opts.ids.length > 0) {
    const clean = opts.ids.map((s) => s.trim()).filter(Boolean);
    if (!clean.length) return [];
    const CHUNK = 400;
    const out: SPKRow[] = [];
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK);
      const ph = chunk.map((_, j) => `@id${j}`).join(", ");
      const chunkInputs = chunk.map((id, j) => ({ name: `id${j}`, type: sql.VarChar(50), value: id }));
      const res = await runQuery(
        `SELECT OrderID, OrderDate, OrderType, Remark, Completed, FinishedDate FROM [cp].[dbo].[taPROrder] WHERE OrderID IN (${ph}) ORDER BY OrderDate DESC`,
        chunkInputs as never,
      );
      out.push(...res.recordset.map(mapRow));
    }
    return out;
  }
  // Export sesuai filter
  const where: string[] = ["OrderID LIKE @Prefix"];
  const inputs: Array<{ name: string; type: any; value: any }> = [
    { name: "Prefix", type: sql.VarChar(20), value: "AS%" },
  ];
  const q = (opts.q ?? "").trim();
  if (q) {
    where.push("(OrderID LIKE @q OR Remark LIKE @q)");
    inputs.push({ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${q}%` });
  }
  const status = (opts.status ?? "").trim().toLowerCase();
  if (status === "completed") where.push("Completed = 1");
  else if (status === "active") where.push("Completed = 0");
  const clause = "WHERE " + where.join(" AND ");
  const res = await runQuery(
    `SELECT OrderID, OrderDate, OrderType, Remark, Completed, FinishedDate FROM [cp].[dbo].[taPROrder] ${clause} ORDER BY OrderDate DESC`,
    inputs as never,
  );
  return res.recordset.map(mapRow);
}
