import { json, type RequestHandler } from '@sveltejs/kit';
import { runQuery } from '$lib/db';
import sql from 'mssql';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	const q = (url.searchParams.get('q') || '').trim();
	const deptId = (url.searchParams.get('dept') || '').trim().toUpperCase();

	try {
		let query = `
			SELECT TOP 25
				hd.OrderID, hd.OrderType, hd.OrderDate, hd.PlanDate, hd.PRDeptID,
				hd.Remark, hd.NoSO, hd.Completed, hd.FinishedDate, hd.ItemID, hd.Kgs, hd.Bags,
				(SELECT COUNT(*) FROM [cp].[dbo].[taPROrderDT] dt WHERE dt.OrderID = hd.OrderID) AS TotalItems,
				(SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taPROrderDT] dt WHERE dt.OrderID = hd.OrderID) AS TotalKgsDT,
				(SELECT ISNULL(SUM(dt.Bags), 0) FROM [cp].[dbo].[taPROrderDT] dt WHERE dt.OrderID = hd.OrderID) AS TotalBagsDT
			FROM [cp].[dbo].[taPROrder] hd
			WHERE 1=1
		`;

		const inputs: Array<{ name: string; type: any; value: any }> = [];

		if (q) {
			query += ` AND (hd.OrderID LIKE @q OR hd.Remark LIKE @q OR hd.ItemID LIKE @q OR hd.NoSO LIKE @q)`;
			inputs.push({ name: 'q', type: sql.VarChar(50), value: `%${q}%` });
		}

		if (deptId) {
			query += ` AND hd.PRDeptID = @deptId`;
			inputs.push({ name: 'deptId', type: sql.VarChar(2), value: deptId });
		}

		query += ` ORDER BY hd.OrderDate DESC, hd.OrderID DESC`;

		const res = await runQuery(query, inputs);

		const spks = res.recordset.map((r: any) => ({
			orderId: String(r.OrderID),
			orderType: String(r.OrderType || 'OI'),
			deptId: String(r.PRDeptID || '-'),
			orderDate: r.OrderDate ? new Date(r.OrderDate).toISOString().slice(0, 10) : '',
			planDate: r.PlanDate ? new Date(r.PlanDate).toISOString().slice(0, 10) : '',
			remark: String(r.Remark || ''),
			noSo: r.NoSO ? String(r.NoSO) : null,
			completed: Boolean(r.Completed),
			finishedDate: r.FinishedDate ? new Date(r.FinishedDate).toISOString().slice(0, 10) : null,
			itemId: r.ItemID ? String(r.ItemID) : '-',
			totalItems: Number(r.TotalItems) || (r.ItemID ? 1 : 0),
			totalKgs: Math.max(0, parseInt(String(r.TotalKgsDT || r.Kgs || 0), 10) || 0),
			totalBags: Math.max(0, parseInt(String(r.TotalBagsDT || r.Bags || 0), 10) || 0)
		}));

		return json({ success: true, spks });
	} catch (e: any) {
		return json({ success: false, message: e?.message || 'Gagal mencari SPK' }, { status: 500 });
	}
};
