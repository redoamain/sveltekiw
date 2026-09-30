import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { runQuery } from "@/lib/db";
import sql from "mssql";

export const GET: RequestHandler = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim();

  try {
    const where = q ? "WHERE h.ProdID LIKE @q OR h.OrderID LIKE @q OR h.Remark LIKE @q" : "";
    const params = q ? [{ name: "q", type: sql.NVarChar as unknown as sql.ISqlType, value: `%${q}%` }] : [];

    const res = await runQuery(
      `SELECT TOP 25
        h.ProdID, h.ProdType, h.ProdDate, h.OrderID, h.LocID, h.Remark,
        (SELECT COUNT(*) FROM [cp].[dbo].[taPRProdDt] dt WHERE RTRIM(LTRIM(dt.ProdID)) = RTRIM(LTRIM(h.ProdID)) AND dt.ItemType = 'B') AS TotalBahan,
        (SELECT COUNT(*) FROM [cp].[dbo].[taPRProdDt] dt WHERE RTRIM(LTRIM(dt.ProdID)) = RTRIM(LTRIM(h.ProdID)) AND dt.ItemType = 'H') AS TotalHasil
       FROM [cp].[dbo].[taPRProdHd] h
       ${where}
       ORDER BY h.ProdDate DESC, h.ProdID DESC`,
      params
    );

    const transactions = res.recordset.map((r: any) => ({
      prodId: String(r.ProdID).trim(),
      prodType: String(r.ProdType || "").trim(),
      prodDate: r.ProdDate ? new Date(r.ProdDate).toISOString().slice(0, 10) : "",
      orderId: String(r.OrderID || "-").trim(),
      locId: String(r.LocID || "-").trim(),
      remark: String(r.Remark || "").trim(),
      totalBahan: Number(r.TotalBahan) || 0,
      totalHasil: Number(r.TotalHasil) || 0,
    }));

    return json({ transactions });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mencari transaksi produksi." }, { status: 500 });
  }
};
