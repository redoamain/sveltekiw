import { runQuery, withTransaction, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export const COMPANY_INFO = {
	name: 'PT. CITI PLUMB',
	business: 'MANUFACTURER OF SANITARY WARE, FAUCETS & PLUMBING ACCESSORIES',
	address: 'Jl. Raya Plosowahyu, Desa Plosowahyu, Kec. Lamongan, Kab. Lamongan, Jawa Timur 62218',
	phone: '(0322) 8802014, (0322) 3326577',
	fax: '(0322) 8802015',
	email: 'sales@citiplumb.id / info@citiplumb.id',
	website: 'www.citiplumb.id',
	deliveryAddress: 'Gudang & Pabrik PT. CITI PLUMB, Jl. Raya Plosowahyu, Lamongan, Jawa Timur 62218'
};

import { terbilang } from '$lib/terbilang';
import type {
	PurchaseOrderItemInput,
	PurchaseOrderItemDetail,
	PurchaseOrderHeader,
	CreatePurchaseOrderPayload,
	UpdatePurchaseOrderPayload,
	PurchaseOrderFilter
} from '$lib/types/purchase-order';

export * from '$lib/types/purchase-order';
export { terbilang } from '$lib/terbilang';

/**
 * Cek tanggal kunci form (taLockform) untuk 'optrPO'
 */
export async function getPOLockDate(): Promise<Date | null> {
	try {
		const res = await runQuery(
			`SELECT LockDate FROM [cp].[dbo].[taLockform] WHERE Form_Name = 'optrPO'`,
			[]
		);
		if (res.recordset.length > 0 && res.recordset[0].LockDate) {
			return new Date(res.recordset[0].LockDate);
		}
	} catch (e) {
		log.warn({ err: e }, 'Gagal memeriksa lockDate untuk optrPO');
	}
	return null;
}

/**
 * Generate nomor Purchase Order berikutnya secara otomatis
 * Format: YY + 5 digit nomor urut (contoh: 2600212)
 */
export async function getNextPurchaseOrderId(orderDateStr?: string): Promise<string> {
	const dateObj = orderDateStr ? new Date(orderDateStr) : new Date();
	const yy = String(dateObj.getFullYear()).slice(-2);
	const prefix = yy;

	const res = await runQuery(
		`SELECT TOP 1 OrderID 
		 FROM [cp].[dbo].[taPOHd] 
		 WHERE OrderID LIKE @Prefix AND LEN(OrderID) = 7
		 ORDER BY OrderID DESC`,
		[{ name: 'Prefix', type: sql.VarChar(10), value: `${prefix}%` }]
	);

	const currentMax = res.recordset[0]?.OrderID;
	if (currentMax && String(currentMax).startsWith(prefix)) {
		const seqPart = String(currentMax).slice(prefix.length);
		const numPart = parseInt(seqPart, 10);
		const nextNum = isNaN(numPart) ? 1 : numPart + 1;
		return `${prefix}${String(nextNum).padStart(5, '0')}`;
	}

	return `${prefix}00001`;
}

/**
 * Mengambil data awal untuk form input Purchase Order (Supplier, Item, Dokumen Pabean, Next ID)
 */
export async function getPurchaseOrderInitialData() {
	const today = new Date().toISOString().slice(0, 10);
	const [nextId, suppliersRes, goodsRes, lockDate] = await Promise.all([
		getNextPurchaseOrderId(today),
		runQuery(
			`SELECT TOP 150 
				CompanyID, 
				CompanyName1, 
				ISNULL(Address1, '') AS Address1, 
				ISNULL(City, '') AS City, 
				ISNULL(Phone1, '') AS Phone1, 
				ISNULL(TaxID, '') AS TaxID,
				ISNULL(Curr, 'IDR') AS Curr
			 FROM [cp].[dbo].[taSupplier]
			 WHERE (Delisted IS NULL OR Delisted = 0)
			 ORDER BY CompanyName1 ASC`,
			[]
		),
		runQuery(
			`SELECT TOP 100 
				ItemID, 
				ItemName, 
				ISNULL(SatuanKecil, 'Pcs') AS SatuanKecil
			 FROM [cp].[dbo].[taGoods]
			 WHERE ItemID IS NOT NULL AND LTRIM(RTRIM(ItemID)) <> ''
			 ORDER BY ItemID ASC`,
			[]
		),
		getPOLockDate()
	]);

	const lockDateStr = lockDate ? lockDate.toISOString().slice(0, 10) : null;

	return {
		today,
		nextOrderId: nextId,
		lockDate: lockDateStr,
		companyInfo: COMPANY_INFO,
		documentTypes: ['BC 4.0', 'BC 2.0', 'BC 2.7', 'LOKAL', 'IMPORT', 'NON-FASILITAS'],
		invoiceTypes: ['070', '010', '080', '040'],
		taxRates: [
			{ label: 'PPN 11%', value: 11 },
			{ label: 'PPN 12%', value: 12 },
			{ label: 'Non-PPN / 0%', value: 0 }
		],
		currencies: ['IDR', 'USD', 'SGD', 'EUR', 'CNY'],
		suppliers: suppliersRes.recordset.map((r: any) => ({
			companyId: String(r.CompanyID),
			companyName: String(r.CompanyName1),
			address: String(r.Address1 || ''),
			city: String(r.City || ''),
			phone: String(r.Phone1 || ''),
			taxId: String(r.TaxID || ''),
			curr: String(r.Curr || 'IDR')
		})),
		commonGoods: goodsRes.recordset.map((r: any) => ({
			itemId: String(r.ItemID),
			itemName: String(r.ItemName || r.ItemID),
			satuan: String(r.SatuanKecil || 'Pcs')
		}))
	};
}

/**
 * Autocomplete / Pencarian Supplier
 */
export async function searchSuppliers(keyword: string, limit = 25) {
	const kw = keyword.trim();
	const query = kw
		? `SELECT TOP (@limit) 
				CompanyID, CompanyName1, ISNULL(Address1, '') AS Address1, 
				ISNULL(City, '') AS City, ISNULL(Phone1, '') AS Phone1, 
				ISNULL(TaxID, '') AS TaxID, ISNULL(Curr, 'IDR') AS Curr
		   FROM [cp].[dbo].[taSupplier]
		   WHERE (Delisted IS NULL OR Delisted = 0)
		     AND (CompanyID LIKE @kw OR CompanyName1 LIKE @kw OR City LIKE @kw)
		   ORDER BY CompanyName1 ASC`
		: `SELECT TOP (@limit) 
				CompanyID, CompanyName1, ISNULL(Address1, '') AS Address1, 
				ISNULL(City, '') AS City, ISNULL(Phone1, '') AS Phone1, 
				ISNULL(TaxID, '') AS TaxID, ISNULL(Curr, 'IDR') AS Curr
		   FROM [cp].[dbo].[taSupplier]
		   WHERE (Delisted IS NULL OR Delisted = 0)
		   ORDER BY CompanyName1 ASC`;

	const res = await runQuery(query, [
		{ name: 'limit', type: sql.Int, value: limit },
		...(kw ? [{ name: 'kw', type: sql.VarChar(100), value: `%${kw}%` }] : [])
	]);

	return res.recordset.map((r: any) => ({
		companyId: String(r.CompanyID),
		companyName: String(r.CompanyName1),
		address: String(r.Address1 || ''),
		city: String(r.City || ''),
		phone: String(r.Phone1 || ''),
		taxId: String(r.TaxID || ''),
		curr: String(r.Curr || 'IDR')
	}));
}

/**
 * Autocomplete / Pencarian Barang taGoods
 */
export async function searchGoods(keyword: string, limit = 25) {
	const kw = keyword.trim();
	const query = kw
		? `SELECT TOP (@limit) 
				ItemID, ItemName, ISNULL(SatuanKecil, 'Pcs') AS SatuanKecil
		   FROM [cp].[dbo].[taGoods]
		   WHERE ItemID IS NOT NULL 
		     AND (ItemID LIKE @kw OR ItemName LIKE @kw)
		   ORDER BY ItemID ASC`
		: `SELECT TOP (@limit) 
				ItemID, ItemName, ISNULL(SatuanKecil, 'Pcs') AS SatuanKecil
		   FROM [cp].[dbo].[taGoods]
		   WHERE ItemID IS NOT NULL
		   ORDER BY ItemID ASC`;

	const res = await runQuery(query, [
		{ name: 'limit', type: sql.Int, value: limit },
		...(kw ? [{ name: 'kw', type: sql.VarChar(100), value: `%${kw}%` }] : [])
	]);

	return res.recordset.map((r: any) => ({
		itemId: String(r.ItemID),
		itemName: String(r.ItemName || r.ItemID),
		satuan: String(r.SatuanKecil || 'Pcs')
	}));
}

/**
 * Mengambil daftar Purchase Order (CRUDS - Read & Search) dengan filter lengkap dan ringkasan metrik
 */
export async function getPurchaseOrders(filter: PurchaseOrderFilter = {}) {
	const {
		q = '',
		tgl1 = '',
		tgl2 = '',
		status = 'all',
		companyId = '',
		page = 1,
		pageSize = 20
	} = filter;

	const whereClauses: string[] = ['1=1'];
	const inputs: Array<{ name: string; type: any; value: any }> = [];

	if (q.trim()) {
		whereClauses.push(
			`(po.OrderID LIKE @q OR s.CompanyName1 LIKE @q OR po.Remark LIKE @q OR EXISTS (
				SELECT 1 FROM [cp].[dbo].[taPODt] dt 
				WHERE dt.OrderID = po.OrderID AND (dt.ItemID LIKE @q OR dt.OGReason LIKE @q)
			))`
		);
		inputs.push({ name: 'q', type: sql.VarChar(100), value: `%${q.trim()}%` });
	}

	if (tgl1) {
		whereClauses.push(`po.OrderDate >= @tgl1`);
		inputs.push({ name: 'tgl1', type: sql.DateTime, value: new Date(`${tgl1}T00:00:00.000Z`) });
	}

	if (tgl2) {
		whereClauses.push(`po.OrderDate <= @tgl2`);
		inputs.push({ name: 'tgl2', type: sql.DateTime, value: new Date(`${tgl2}T23:59:59.999Z`) });
	}

	if (companyId.trim()) {
		whereClauses.push(`po.CompanyID = @companyId`);
		inputs.push({ name: 'companyId', type: sql.VarChar(10), value: companyId.trim() });
	}

	if (status === 'open') {
		whereClauses.push(`po.Canceled = 0 AND po.Completed = 0`);
	} else if (status === 'completed') {
		whereClauses.push(`po.Completed = 1 AND po.Canceled = 0`);
	} else if (status === 'canceled') {
		whereClauses.push(`po.Canceled = 1`);
	}

	const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

	// Total count & stats
	const countQuery = `
		SELECT 
			COUNT(*) AS totalRows,
			ISNULL(SUM(po.DPP), 0) AS totalDpp,
			ISNULL(SUM(po.Total), 0) AS totalAmount,
			SUM(CASE WHEN po.Canceled = 0 AND po.Completed = 0 THEN 1 ELSE 0 END) AS totalOpen,
			SUM(CASE WHEN po.Completed = 1 AND po.Canceled = 0 THEN 1 ELSE 0 END) AS totalCompleted,
			SUM(CASE WHEN po.Canceled = 1 THEN 1 ELSE 0 END) AS totalCanceled
		FROM [cp].[dbo].[taPOHd] po
		LEFT JOIN [cp].[dbo].[taSupplier] s ON po.CompanyID = s.CompanyID
		${whereStr}
	`;
	const countRes = await runQuery(countQuery, inputs);
	const stats = countRes.recordset[0] || {};
	const totalRows = Number(stats.totalRows) || 0;
	const totalPages = Math.ceil(totalRows / pageSize) || 1;
	const safePage = Math.max(1, Math.min(page, totalPages));
	const offset = (safePage - 1) * pageSize;

	// Query Data Paginated
	const dataQuery = `
		SELECT 
			po.OrderID, po.OrderType, po.OrderDate, po.DueDate, po.DeliveryDate,
			po.ContractNo, po.CompanyID, ISNULL(s.CompanyName1, '-') AS SupplierName,
			ISNULL(s.Address1, '') AS SupplierAddress, ISNULL(s.City, '') AS SupplierCity,
			ISNULL(s.Phone1, '') AS SupplierPhone, ISNULL(s.TaxID, '') AS SupplierTaxId,
			po.Total, po.Tax, po.Curr, po.Rate, po.TotalRp, po.Completed, po.Canceled,
			po.CancelReason, po.Printed, po.Remark, po.TipeDok, po.tipefaktur, po.DPP,
			(SELECT COUNT(*) FROM [cp].[dbo].[taPODt] dt WHERE dt.OrderID = po.OrderID) AS ItemCount,
			(SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taPODt] dt WHERE dt.OrderID = po.OrderID) AS TotalKgs,
			(SELECT ISNULL(SUM(dt.KgsL), 0) FROM [cp].[dbo].[taPODt] dt WHERE dt.OrderID = po.OrderID) AS TotalKgsL
		FROM [cp].[dbo].[taPOHd] po
		LEFT JOIN [cp].[dbo].[taSupplier] s ON po.CompanyID = s.CompanyID
		${whereStr}
		ORDER BY po.OrderDate DESC, po.OrderID DESC
		OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
	`;

	const paginatedInputs = [
		...inputs,
		{ name: 'offset', type: sql.Int, value: offset },
		{ name: 'pageSize', type: sql.Int, value: pageSize }
	];

	const dataRes = await runQuery(dataQuery, paginatedInputs);
	const lockDate = await getPOLockDate();

	const items: PurchaseOrderHeader[] = dataRes.recordset.map((r: any) => {
		const orderDate = r.OrderDate ? new Date(r.OrderDate) : new Date();
		const orderDateStr = orderDate.toISOString().slice(0, 10);
		const dpp = Number(r.DPP) || Number(r.Total) || 0;
		const tax = Number(r.Tax) || 0;
		const taxAmount = Math.round((dpp * tax) / 100);
		const total = Number(r.Total) || dpp + taxAmount;
		const totalKgs = Number(r.TotalKgs) || 0;
		const totalKgsL = Number(r.TotalKgsL) || 0;
		const totalReceivedKgs = Math.max(0, totalKgs - totalKgsL);

		const isLocked = Boolean(lockDate && orderDate <= lockDate);

		return {
			orderId: String(r.OrderID),
			orderType: String(r.OrderType || 'P'),
			orderDate: orderDateStr,
			dueDate: r.DueDate ? new Date(r.DueDate).toISOString().slice(0, 10) : null,
			deliveryDate: r.DeliveryDate ? new Date(r.DeliveryDate).toISOString().slice(0, 10) : null,
			contractNo: r.ContractNo ? String(r.ContractNo) : null,
			companyId: String(r.CompanyID),
			supplierName: String(r.SupplierName),
			supplierAddress: String(r.SupplierAddress || ''),
			supplierCity: String(r.SupplierCity || ''),
			supplierPhone: String(r.SupplierPhone || ''),
			supplierTaxId: String(r.SupplierTaxId || ''),
			supplierEmail: '',
			total,
			tax,
			taxAmount,
			dpp,
			curr: String(r.Curr || 'IDR'),
			rate: Number(r.Rate) || 1,
			totalRp: Number(r.TotalRp) || total,
			completed: Boolean(r.Completed),
			canceled: Boolean(r.Canceled),
			cancelReason: String(r.CancelReason || ''),
			printed: Number(r.Printed) || 0,
			remark: String(r.Remark || ''),
			tipeDok: String(r.TipeDok || 'LOKAL'),
			tipefaktur: String(r.tipefaktur || '070'),
			itemCount: Number(r.ItemCount) || 0,
			totalKgs,
			totalKgsL,
			totalReceivedKgs,
			isLocked,
			terbilang: terbilang(total)
		};
	});

	return {
		items,
		totalRows,
		totalPages,
		currentPage: safePage,
		pageSize,
		summary: {
			totalDpp: Number(stats.totalDpp) || 0,
			totalAmount: Number(stats.totalAmount) || 0,
			totalOpen: Number(stats.totalOpen) || 0,
			totalCompleted: Number(stats.totalCompleted) || 0,
			totalCanceled: Number(stats.totalCanceled) || 0
		}
	};
}

/**
 * Mengambil rincian 1 Purchase Order lengkap beserta seluruh item detail (taPODt)
 */
export async function getPurchaseOrderDetail(orderId: string): Promise<{
	header: PurchaseOrderHeader;
	items: PurchaseOrderItemDetail[];
	companyInfo: typeof COMPANY_INFO;
}> {
	const cleanId = orderId.trim();
	if (!cleanId) throw new Error('Nomor PO wajib diisi.');

	// 1. Ambil Header PO
	const hdRes = await runQuery(
		`SELECT 
			po.OrderID, po.OrderType, po.OrderDate, po.DueDate, po.DeliveryDate,
			po.ContractNo, po.CompanyID, ISNULL(s.CompanyName1, '-') AS SupplierName,
			ISNULL(s.Address1, '') AS SupplierAddress, ISNULL(s.City, '') AS SupplierCity,
			ISNULL(s.Phone1, '') AS SupplierPhone, ISNULL(s.TaxID, '') AS SupplierTaxId,
			ISNULL(s.Email, '') AS SupplierEmail,
			po.Total, po.Tax, po.Curr, po.Rate, po.TotalRp, po.Completed, po.Canceled,
			po.CancelReason, po.Printed, po.Remark, po.TipeDok, po.tipefaktur, po.DPP,
			(SELECT COUNT(*) FROM [cp].[dbo].[taPODt] dt WHERE dt.OrderID = po.OrderID) AS ItemCount,
			(SELECT ISNULL(SUM(dt.Kgs), 0) FROM [cp].[dbo].[taPODt] dt WHERE dt.OrderID = po.OrderID) AS TotalKgs,
			(SELECT ISNULL(SUM(dt.KgsL), 0) FROM [cp].[dbo].[taPODt] dt WHERE dt.OrderID = po.OrderID) AS TotalKgsL
		 FROM [cp].[dbo].[taPOHd] po
		 LEFT JOIN [cp].[dbo].[taSupplier] s ON po.CompanyID = s.CompanyID
		 WHERE po.OrderID = @orderId`,
		[{ name: 'orderId', type: sql.VarChar(10), value: cleanId }]
	);

	if (hdRes.recordset.length === 0) {
		throw new Error(`Purchase Order #${cleanId} tidak ditemukan di database.`);
	}

	const r = hdRes.recordset[0];
	const orderDate = r.OrderDate ? new Date(r.OrderDate) : new Date();
	const orderDateStr = orderDate.toISOString().slice(0, 10);
	const dpp = Number(r.DPP) || Number(r.Total) || 0;
	const tax = Number(r.Tax) || 0;
	const taxAmount = Math.round((dpp * tax) / 100);
	const total = Number(r.Total) || dpp + taxAmount;
	const totalKgs = Number(r.TotalKgs) || 0;
	const totalKgsL = Number(r.TotalKgsL) || 0;
	const totalReceivedKgs = Math.max(0, totalKgs - totalKgsL);

	const lockDate = await getPOLockDate();
	const isLocked = Boolean(lockDate && orderDate <= lockDate);

	const header: PurchaseOrderHeader = {
		orderId: String(r.OrderID),
		orderType: String(r.OrderType || 'P'),
		orderDate: orderDateStr,
		dueDate: r.DueDate ? new Date(r.DueDate).toISOString().slice(0, 10) : null,
		deliveryDate: r.DeliveryDate ? new Date(r.DeliveryDate).toISOString().slice(0, 10) : null,
		contractNo: r.ContractNo ? String(r.ContractNo) : null,
		companyId: String(r.CompanyID),
		supplierName: String(r.SupplierName),
		supplierAddress: String(r.SupplierAddress || ''),
		supplierCity: String(r.SupplierCity || ''),
		supplierPhone: String(r.SupplierPhone || ''),
		supplierTaxId: String(r.SupplierTaxId || ''),
		supplierEmail: String(r.SupplierEmail || ''),
		total,
		tax,
		taxAmount,
		dpp,
		curr: String(r.Curr || 'IDR'),
		rate: Number(r.Rate) || 1,
		totalRp: Number(r.TotalRp) || total,
		completed: Boolean(r.Completed),
		canceled: Boolean(r.Canceled),
		cancelReason: String(r.CancelReason || ''),
		printed: Number(r.Printed) || 0,
		remark: String(r.Remark || ''),
		tipeDok: String(r.TipeDok || 'LOKAL'),
		tipefaktur: String(r.tipefaktur || '070'),
		itemCount: Number(r.ItemCount) || 0,
		totalKgs,
		totalKgsL,
		totalReceivedKgs,
		isLocked,
		terbilang: terbilang(total)
	};

	// 2. Ambil Items taPODt
	const dtRes = await runQuery(
		`SELECT 
			dt.RJN, dt.OrderID, dt.OrderType, dt.OrderDate, dt.ItemID,
			ISNULL(g.ItemName, dt.ItemID) AS ItemName,
			dt.Bags, dt.Kgs, dt.KgsL, dt.Price, dt.Total, dt.recno,
			dt.UserName, dt.UserDateTime, dt.BagMarking, dt.OGReason,
			dt.MaxETA, ISNULL(dt.Satuan, ISNULL(g.SatuanKecil, 'Pcs')) AS Satuan
		 FROM [cp].[dbo].[taPODt] dt
		 LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
		 WHERE dt.OrderID = @orderId
		 ORDER BY dt.recno ASC, dt.RJN ASC`,
		[{ name: 'orderId', type: sql.VarChar(10), value: cleanId }]
	);

	const items: PurchaseOrderItemDetail[] = dtRes.recordset.map((item: any) => {
		const kgs = Number(item.Kgs) || 0;
		const kgsL = Number(item.KgsL) || 0;
		const qtyReceived = Math.max(0, kgs - kgsL);
		const receivedPercent = kgs > 0 ? Math.round((qtyReceived / kgs) * 100) : 0;

		return {
			rjn: Number(item.RJN),
			orderId: String(item.OrderID),
			orderType: String(item.OrderType || 'P'),
			orderDate: item.OrderDate ? new Date(item.OrderDate).toISOString().slice(0, 10) : header.orderDate,
			itemId: String(item.ItemID),
			itemName: String(item.ItemName || item.ItemID),
			bags: Number(item.Bags) || 1,
			kgs,
			kgsL,
			qtyReceived,
			receivedPercent,
			satuan: String(item.Satuan || 'Pcs'),
			price: Number(item.Price) || 0,
			total: Number(item.Total) || 0,
			recno: Number(item.recno) || 0,
			userName: String(item.UserName || ''),
			userDateTime: item.UserDateTime ? new Date(item.UserDateTime).toISOString() : '',
			bagMarking: item.BagMarking ? String(item.BagMarking) : null,
			ogReason: item.OGReason ? String(item.OGReason) : null,
			maxEta: item.MaxETA ? new Date(item.MaxETA).toISOString().slice(0, 10) : null
		};
	});

	return {
		header,
		items,
		companyInfo: COMPANY_INFO
	};
}

/**
 * Validasi apakah tanggal form terkunci
 */
async function checkLockform(dateStr: string, isSuperAdmin = false) {
	if (isSuperAdmin) return;
	const lockDate = await getPOLockDate();
	if (lockDate) {
		const orderDate = new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
		if (orderDate <= lockDate) {
			const lockDateStr = lockDate.toISOString().slice(0, 10);
			throw new Error(
				`Form Purchase Order untuk tanggal ${dateStr} telah dikunci (Batas Kunci: ${lockDateStr}). Hubungi SuperAdmin/IT.`
			);
		}
	}
}

/**
 * Menyimpan Purchase Order Baru (CRUDS - Create)
 */
export async function createPurchaseOrder(
	payload: CreatePurchaseOrderPayload,
	username: string,
	isSuperAdmin = false
): Promise<{ success: boolean; orderId: string; message: string }> {
	const companyId = (payload.companyId || '').trim();
	if (!companyId) throw new Error('Supplier wajib dipilih.');

	const orderDateStr = payload.orderDate ? payload.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
	await checkLockform(orderDateStr, isSuperAdmin);

	const details = payload.details || [];
	const validItems = details.filter((d) => d.itemId && d.itemId.trim());
	if (validItems.length === 0) {
		throw new Error('Daftar barang PO minimal harus memiliki 1 item barang yang valid.');
	}

	for (const it of validItems) {
		if (it.kgs <= 0) {
			throw new Error(`Jumlah order (Qty) untuk barang '${it.itemId}' harus lebih dari 0.`);
		}
		if (it.price < 0) {
			throw new Error(`Harga satuan barang '${it.itemId}' tidak boleh negatif.`);
		}
	}

	const orderDateTime = new Date(`${orderDateStr}T10:00:00.000Z`);
	const dueDateTime = payload.dueDate ? new Date(`${payload.dueDate.slice(0, 10)}T10:00:00.000Z`) : orderDateTime;
	const deliveryDateTime = payload.deliveryDate
		? new Date(`${payload.deliveryDate.slice(0, 10)}T10:00:00.000Z`)
		: null;

	const cleanUser = (username || 'OPERATOR').slice(0, 50);
	const curr = (payload.curr || 'IDR').toUpperCase();
	const rate = payload.rate && payload.rate > 0 ? payload.rate : 1;
	const taxPercent = Number(payload.tax) || 0;

	// Hitung DPP, Tax, dan Total
	let dpp = 0;
	const itemRows = validItems.map((item, idx) => {
		const itemQty = Number(item.kgs) || 0;
		const itemPrice = Number(item.price) || 0;
		const lineTotal = Math.round(itemQty * itemPrice * 100) / 100;
		dpp += lineTotal;
		return {
			...item,
			recno: idx,
			lineTotal
		};
	});

	const taxAmount = Math.round((dpp * taxPercent) / 100);
	const grandTotal = dpp + taxAmount;
	const grandTotalRp = Math.round(grandTotal * rate);

	return await withTransaction(async (tx) => {
		// 1. Nomor OrderID dibuat otomatis oleh sistem dan tidak dapat diedit manual
		let finalOrderId = await getNextPurchaseOrderId(orderDateStr);
		let checkDup = await tx
			.request()
			.input('orderId', sql.VarChar(10), finalOrderId)
			.query(`SELECT TOP 1 OrderID FROM [cp].[dbo].[taPOHd] WHERE OrderID = @orderId`);

		while (checkDup.recordset.length > 0) {
			const yy = String(new Date(orderDateStr).getFullYear()).slice(-2);
			const currentSeq = parseInt(finalOrderId.slice(2), 10) || 1;
			finalOrderId = `${yy}${String(currentSeq + 1).padStart(5, '0')}`;
			checkDup = await tx
				.request()
				.input('orderId', sql.VarChar(10), finalOrderId)
				.query(`SELECT TOP 1 OrderID FROM [cp].[dbo].[taPOHd] WHERE OrderID = @orderId`);
		}

		// 2. Insert Header taPOHd
		await tx
			.request()
			.input('OrderID', sql.VarChar(7), finalOrderId)
			.input('OrderType', sql.VarChar(1), 'P')
			.input('OrderDate', sql.DateTime, orderDateTime)
			.input('ContractNo', sql.VarChar(30), payload.contractNo ? payload.contractNo.slice(0, 30) : null)
			.input('CompanyID', sql.VarChar(10), companyId)
			.input('Total', sql.Money, grandTotal)
			.input('Tax', sql.Decimal(18, 4), taxPercent)
			.input('Curr', sql.VarChar(3), curr)
			.input('Rate', sql.Decimal(18, 4), rate)
			.input('TotalRp', sql.Money, grandTotalRp)
			.input('Completed', sql.Bit, 0)
			.input('Canceled', sql.Bit, 0)
			.input('CancelReason', sql.VarChar(50), '')
			.input('Printed', sql.SmallInt, 0)
			.input('DueDate', sql.DateTime, dueDateTime)
			.input('DeliveryDate', sql.DateTime, deliveryDateTime)
			.input('Remark', sql.VarChar(200), payload.remark ? payload.remark.slice(0, 200) : null)
			.input('TipeDok', sql.VarChar(6), payload.tipeDok ? payload.tipeDok.slice(0, 6) : 'LOKAL')
			.input('tipefaktur', sql.VarChar(3), payload.tipefaktur ? payload.tipefaktur.slice(0, 3) : '070')
			.input('DPP', sql.Decimal(18, 4), dpp)
			.query(`
				INSERT INTO [cp].[dbo].[taPOHd] (
					OrderID, OrderType, OrderDate, ContractNo, CompanyID,
					Total, Tax, Curr, Rate, TotalRp,
					Completed, Canceled, CancelReason, Printed,
					DueDate, DeliveryDate, Remark, TipeDok, tipefaktur, DPP
				) VALUES (
					@OrderID, @OrderType, @OrderDate, @ContractNo, @CompanyID,
					@Total, @Tax, @Curr, @Rate, @TotalRp,
					@Completed, @Canceled, @CancelReason, @Printed,
					@DueDate, @DeliveryDate, @Remark, @TipeDok, @tipefaktur, @DPP
				)
			`);

		// 3. Insert Detail taPODt (RJN adalah IDENTITY jadi biarkan auto-generated)
		for (const it of itemRows) {
			const bags = it.bags && it.bags > 0 ? it.bags : 1;
			const maxEtaDate = it.maxEta ? new Date(`${it.maxEta.slice(0, 10)}T00:00:00.000Z`) : null;

			await tx
				.request()
				.input('OrderID', sql.VarChar(7), finalOrderId)
				.input('OrderType', sql.VarChar(1), 'P')
				.input('OrderDate', sql.DateTime, orderDateTime)
				.input('ItemID', sql.VarChar(40), it.itemId.trim())
				.input('Bags', sql.Int, bags)
				.input('Kgs', sql.Float, it.kgs)
				.input('KgsL', sql.Float, it.kgs) // Sisa mula-mula sama dengan Kgs
				.input('Price', sql.Decimal(18, 4), it.price)
				.input('Total', sql.Money, it.lineTotal)
				.input('recno', sql.SmallInt, it.recno)
				.input('UserName', sql.VarChar(200), cleanUser)
				.input('UserDateTime', sql.DateTime, new Date())
				.input('BagMarking', sql.VarChar(50), it.bagMarking ? it.bagMarking.slice(0, 50) : null)
				.input('OGReason', sql.VarChar(50), it.ogReason ? it.ogReason.slice(0, 50) : null)
				.input('Curr', sql.VarChar(3), curr)
				.input('Rate', sql.Decimal(18, 4), rate)
				.input('MaxETA', sql.SmallDateTime, maxEtaDate)
				.input('Satuan', sql.VarChar(10), it.satuan ? it.satuan.slice(0, 10) : 'PCS')
				.query(`
					INSERT INTO [cp].[dbo].[taPODt] (
						OrderID, OrderType, OrderDate, ItemID, Bags,
						Kgs, KgsL, Price, Total, recno,
						UserName, UserDateTime, BagMarking, OGReason,
						Curr, Rate, MaxETA, Satuan
					) VALUES (
						@OrderID, @OrderType, @OrderDate, @ItemID, @Bags,
						@Kgs, @KgsL, @Price, @Total, @recno,
						@UserName, @UserDateTime, @BagMarking, @OGReason,
						@Curr, @Rate, @MaxETA, @Satuan
					)
				`);
		}

		return {
			success: true,
			orderId: finalOrderId,
			message: `Purchase Order #${finalOrderId} berhasil dibuat dengan ${itemRows.length} item barang.`
		};
	});
}

/**
 * Memperbarui data Purchase Order yang ada (CRUDS - Update)
 */
export async function updatePurchaseOrder(
	payload: UpdatePurchaseOrderPayload,
	username: string,
	isSuperAdmin = false
): Promise<{ success: boolean; orderId: string; message: string }> {
	const orderId = (payload.orderId || '').trim();
	if (!orderId) throw new Error('Nomor PO wajib diisi.');

	const orderDateStr = payload.orderDate ? payload.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
	await checkLockform(orderDateStr, isSuperAdmin);

	const existing = await getPurchaseOrderDetail(orderId);
	if (existing.header.canceled) {
		throw new Error(`PO #${orderId} telah dibatalkan dan tidak dapat diedit kembali.`);
	}

	const companyId = (payload.companyId || existing.header.companyId).trim();
	const validItems = (payload.details || []).filter((d) => d.itemId && d.itemId.trim());
	if (validItems.length === 0) {
		throw new Error('Daftar barang PO minimal harus memiliki 1 item.');
	}

	// Validasi sisa penerimaan jika barang sudah sebagian diterima
	for (const it of validItems) {
		if (it.kgs <= 0) throw new Error(`Qty untuk barang '${it.itemId}' harus lebih dari 0.`);
		if (it.price < 0) throw new Error(`Harga barang '${it.itemId}' tidak boleh negatif.`);

		const prevItem = existing.items.find((prev) => prev.itemId === it.itemId);
		if (prevItem && prevItem.qtyReceived > 0) {
			if (it.kgs < prevItem.qtyReceived) {
				throw new Error(
					`Barang '${it.itemId}' telah diterima sebanyak ${prevItem.qtyReceived} ${prevItem.satuan}. Kuantitas PO tidak boleh lebih kecil dari jumlah yang sudah diterima.`
				);
			}
		}
	}

	const orderDateTime = new Date(`${orderDateStr}T10:00:00.000Z`);
	const dueDateTime = payload.dueDate ? new Date(`${payload.dueDate.slice(0, 10)}T10:00:00.000Z`) : orderDateTime;
	const deliveryDateTime = payload.deliveryDate
		? new Date(`${payload.deliveryDate.slice(0, 10)}T10:00:00.000Z`)
		: null;

	const cleanUser = (username || 'OPERATOR').slice(0, 50);
	const curr = (payload.curr || existing.header.curr || 'IDR').toUpperCase();
	const rate = payload.rate && payload.rate > 0 ? payload.rate : existing.header.rate || 1;
	const taxPercent = Number(payload.tax !== undefined ? payload.tax : existing.header.tax) || 0;

	let dpp = 0;
	const itemRows = validItems.map((item, idx) => {
		const itemQty = Number(item.kgs) || 0;
		const itemPrice = Number(item.price) || 0;
		const lineTotal = Math.round(itemQty * itemPrice * 100) / 100;
		dpp += lineTotal;
		return {
			...item,
			recno: idx,
			lineTotal
		};
	});

	const taxAmount = Math.round((dpp * taxPercent) / 100);
	const grandTotal = dpp + taxAmount;
	const grandTotalRp = Math.round(grandTotal * rate);

	return await withTransaction(async (tx) => {
		// 1. Update Header
		await tx
			.request()
			.input('OrderID', sql.VarChar(7), orderId)
			.input('OrderDate', sql.DateTime, orderDateTime)
			.input('ContractNo', sql.VarChar(30), payload.contractNo ? payload.contractNo.slice(0, 30) : null)
			.input('CompanyID', sql.VarChar(10), companyId)
			.input('Total', sql.Money, grandTotal)
			.input('Tax', sql.Decimal(18, 4), taxPercent)
			.input('Curr', sql.VarChar(3), curr)
			.input('Rate', sql.Decimal(18, 4), rate)
			.input('TotalRp', sql.Money, grandTotalRp)
			.input('DueDate', sql.DateTime, dueDateTime)
			.input('DeliveryDate', sql.DateTime, deliveryDateTime)
			.input('Remark', sql.VarChar(200), payload.remark ? payload.remark.slice(0, 200) : null)
			.input('TipeDok', sql.VarChar(6), payload.tipeDok ? payload.tipeDok.slice(0, 6) : 'LOKAL')
			.input('tipefaktur', sql.VarChar(3), payload.tipefaktur ? payload.tipefaktur.slice(0, 3) : '070')
			.input('DPP', sql.Decimal(18, 4), dpp)
			.query(`
				UPDATE [cp].[dbo].[taPOHd] SET
					OrderDate = @OrderDate,
					ContractNo = @ContractNo,
					CompanyID = @CompanyID,
					Total = @Total,
					Tax = @Tax,
					Curr = @Curr,
					Rate = @Rate,
					TotalRp = @TotalRp,
					DueDate = @DueDate,
					DeliveryDate = @DeliveryDate,
					Remark = @Remark,
					TipeDok = @TipeDok,
					tipefaktur = @tipefaktur,
					DPP = @DPP
				WHERE OrderID = @OrderID
			`);

		// 2. Refresh Details: Hapus detail lama yang belum pernah ada penerimaan, atau update
		// Untuk amannya, hitung sisa KgsL berdasarkan penerimaan sebelumnya
		const prevReceivedMap: Record<string, number> = {};
		for (const prev of existing.items) {
			prevReceivedMap[prev.itemId] = prev.qtyReceived;
		}

		await tx
			.request()
			.input('OrderID', sql.VarChar(7), orderId)
			.query(`DELETE FROM [cp].[dbo].[taPODt] WHERE OrderID = @OrderID`);

		for (const it of itemRows) {
			const bags = it.bags && it.bags > 0 ? it.bags : 1;
			const maxEtaDate = it.maxEta ? new Date(`${it.maxEta.slice(0, 10)}T00:00:00.000Z`) : null;
			const alreadyReceived = prevReceivedMap[it.itemId] || 0;
			const newKgsL = Math.max(0, it.kgs - alreadyReceived);

			await tx
				.request()
				.input('OrderID', sql.VarChar(7), orderId)
				.input('OrderType', sql.VarChar(1), 'P')
				.input('OrderDate', sql.DateTime, orderDateTime)
				.input('ItemID', sql.VarChar(40), it.itemId.trim())
				.input('Bags', sql.Int, bags)
				.input('Kgs', sql.Float, it.kgs)
				.input('KgsL', sql.Float, newKgsL)
				.input('Price', sql.Decimal(18, 4), it.price)
				.input('Total', sql.Money, it.lineTotal)
				.input('recno', sql.SmallInt, it.recno)
				.input('UserName', sql.VarChar(200), cleanUser)
				.input('UserDateTime', sql.DateTime, new Date())
				.input('BagMarking', sql.VarChar(50), it.bagMarking ? it.bagMarking.slice(0, 50) : null)
				.input('OGReason', sql.VarChar(50), it.ogReason ? it.ogReason.slice(0, 50) : null)
				.input('Curr', sql.VarChar(3), curr)
				.input('Rate', sql.Decimal(18, 4), rate)
				.input('MaxETA', sql.SmallDateTime, maxEtaDate)
				.input('Satuan', sql.VarChar(10), it.satuan ? it.satuan.slice(0, 10) : 'PCS')
				.query(`
					INSERT INTO [cp].[dbo].[taPODt] (
						OrderID, OrderType, OrderDate, ItemID, Bags,
						Kgs, KgsL, Price, Total, recno,
						UserName, UserDateTime, BagMarking, OGReason,
						Curr, Rate, MaxETA, Satuan
					) VALUES (
						@OrderID, @OrderType, @OrderDate, @ItemID, @Bags,
						@Kgs, @KgsL, @Price, @Total, @recno,
						@UserName, @UserDateTime, @BagMarking, @OGReason,
						@Curr, @Rate, @MaxETA, @Satuan
					)
				`);
		}

		return {
			success: true,
			orderId,
			message: `Purchase Order #${orderId} berhasil diperbarui.`
		};
	});
}

/**
 * Membatalkan Purchase Order (CRUDS - Cancel)
 */
export async function cancelPurchaseOrder(
	orderId: string,
	reason: string,
	username: string,
	isSuperAdmin = false
): Promise<{ success: boolean; message: string }> {
	const cleanId = orderId.trim();
	if (!cleanId) throw new Error('Nomor PO wajib diisi.');

	const po = await getPurchaseOrderDetail(cleanId);
	await checkLockform(po.header.orderDate, isSuperAdmin);

	if (po.header.totalReceivedKgs > 0) {
		throw new Error(
			`PO #${cleanId} tidak dapat dibatalkan karena barang sudah diterima di gudang sebanyak ${po.header.totalReceivedKgs} unit.`
		);
	}

	const cleanReason = (reason || 'Dibatalkan oleh pengguna').trim().slice(0, 50);

	await runQuery(
		`UPDATE [cp].[dbo].[taPOHd] SET
			Canceled = 1,
			CancelReason = @reason
		 WHERE OrderID = @orderId`,
		[
			{ name: 'reason', type: sql.VarChar(50), value: cleanReason },
			{ name: 'orderId', type: sql.VarChar(10), value: cleanId }
		]
	);

	return {
		success: true,
		message: `Purchase Order #${cleanId} berhasil dibatalkan.`
	};
}

/**
 * Toggle Status Completed PO (CRUDS - Complete / Reopen)
 */
export async function toggleCompletePurchaseOrder(
	orderId: string,
	completed: boolean,
	username: string
): Promise<{ success: boolean; message: string }> {
	const cleanId = orderId.trim();
	await runQuery(
		`UPDATE [cp].[dbo].[taPOHd] SET Completed = @completed WHERE OrderID = @orderId`,
		[
			{ name: 'completed', type: sql.Bit, value: completed ? 1 : 0 },
			{ name: 'orderId', type: sql.VarChar(10), value: cleanId }
		]
	);

	return {
		success: true,
		message: `Status PO #${cleanId} berhasil diubah menjadi ${completed ? 'Selesai (Completed)' : 'Aktif (Open)'}.`
	};
}

/**
 * Menghapus Purchase Order fisik secara permanen (Hanya jika belum ada transaksi penerimaan)
 */
export async function deletePurchaseOrder(
	orderId: string,
	username: string,
	isSuperAdmin = false
): Promise<{ success: boolean; message: string }> {
	const cleanId = orderId.trim();
	const po = await getPurchaseOrderDetail(cleanId);
	await checkLockform(po.header.orderDate, isSuperAdmin);

	if (po.header.totalReceivedKgs > 0) {
		throw new Error(
			`PO #${cleanId} tidak dapat dihapus karena sudah ada riwayat penerimaan barang di gudang.`
		);
	}

	return await withTransaction(async (tx) => {
		await tx
			.request()
			.input('orderId', sql.VarChar(10), cleanId)
			.query(`DELETE FROM [cp].[dbo].[taPODt] WHERE OrderID = @orderId`);

		await tx
			.request()
			.input('orderId', sql.VarChar(10), cleanId)
			.query(`DELETE FROM [cp].[dbo].[taPOHd] WHERE OrderID = @orderId`);

		return {
			success: true,
			message: `Purchase Order #${cleanId} berhasil dihapus dari sistem.`
		};
	});
}

/**
 * Export Dokumen Purchase Order Tunggal ke Excel (.xlsx) dengan Kop Resmi PT. CITI PLUMB
 */
export async function exportSinglePurchaseOrderExcel(orderId: string): Promise<Buffer> {
	const data = await getPurchaseOrderDetail(orderId);
	const { header, items, companyInfo } = data;

	const aoa: any[][] = [];

	// 1. Kop Surat Resmi PT. CITI PLUMB
	aoa.push([companyInfo.name]);
	aoa.push([companyInfo.business]);
	aoa.push([companyInfo.address]);
	aoa.push([`Telp: ${companyInfo.phone} | Fax: ${companyInfo.fax} | Email: ${companyInfo.email}`]);
	aoa.push([]);

	// 2. Judul Dokumen
	aoa.push(['PURCHASE ORDER (SURAT PESANAN PEMBELIAN)']);
	aoa.push([]);

	// 3. Metadata PO & Supplier
	aoa.push(['Nomor PO', `: ${header.orderId}`, '', 'Nama Pemasok', `: ${header.supplierName}`]);
	aoa.push(['Tanggal PO', `: ${header.orderDate}`, '', 'Alamat Pemasok', `: ${header.supplierAddress || '-'}`]);
	aoa.push(['Jatuh Tempo', `: ${header.dueDate || '-'}`, '', 'Kota', `: ${header.supplierCity || '-'}`]);
	aoa.push([
		'Estimasi Kirim',
		`: ${header.deliveryDate || '-'}`,
		'',
		'Telepon / NPWP',
		`: ${header.supplierPhone || '-'} / ${header.supplierTaxId || '-'}`
	]);
	aoa.push([
		'Dokumen Pabean',
		`: ${header.tipeDok}`,
		'',
		'Mata Uang / Kurs',
		`: ${header.curr} (Kurs: ${header.rate})`
	]);
	aoa.push(['Alamat Kirim', `: ${companyInfo.deliveryAddress}`]);
	aoa.push(['Catatan / Remark', `: ${header.remark || '-'}`]);
	aoa.push([]);

	// 4. Tabel Rincian Barang
	aoa.push([
		'NO',
		'KODE BARANG',
		'NAMA BARANG & SPESIFIKASI',
		'KUANTITAS',
		'SATUAN',
		'KEMASAN',
		'HARGA SATUAN',
		'TOTAL (SUBTOTAL)',
		'CATATAN BARIS'
	]);

	items.forEach((item, index) => {
		aoa.push([
			index + 1,
			item.itemId,
			item.itemName,
			item.kgs,
			item.satuan,
			item.bags,
			item.price,
			item.total,
			item.ogReason || item.bagMarking || ''
		]);
	});

	aoa.push([]);

	// 5. Total dan Kalkulasi Pajak
	aoa.push(['', '', '', '', '', '', 'SUBTOTAL (DPP)', header.dpp]);
	aoa.push(['', '', '', '', '', '', `PPN (${header.tax}%)`, header.taxAmount]);
	aoa.push(['', '', '', '', '', '', 'GRAND TOTAL', header.total]);
	aoa.push(['Terbilang:', header.terbilang]);
	aoa.push([]);

	// 6. Kolom Tanda Tangan Resmi (3 Pihak)
	aoa.push([
		'Dibuat Oleh (Purchasing):',
		'',
		'Disetujui Oleh (Direktur / Manager):',
		'',
		'Diterima & Disetujui (Pemasok):'
	]);
	aoa.push([]);
	aoa.push([]);
	aoa.push(['( _______________________ )', '', '( _______________________ )', '', '( _______________________ )']);
	aoa.push(['Tanggal: _______________', '', 'Tanggal: _______________', '', 'Tanggal: _______________']);

	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws['!cols'] = [
		{ wch: 6 },
		{ wch: 22 },
		{ wch: 40 },
		{ wch: 12 },
		{ wch: 10 },
		{ wch: 10 },
		{ wch: 16 },
		{ wch: 18 },
		{ wch: 25 }
	];

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, `PO_${header.orderId}`);
	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Export Daftar Purchase Order ke Excel (.xlsx) dengan Kop Resmi PT. CITI PLUMB
 */
export async function exportPurchaseOrderListExcel(filter: PurchaseOrderFilter = {}): Promise<Buffer> {
	// Ambil semua data tanpa batas halaman
	const res = await getPurchaseOrders({ ...filter, page: 1, pageSize: 5000 });
	const { items, summary } = res;

	const aoa: any[][] = [];

	// Kop Surat PT. CITI PLUMB
	aoa.push([COMPANY_INFO.name]);
	aoa.push([COMPANY_INFO.business]);
	aoa.push([COMPANY_INFO.address]);
	aoa.push([`Telp: ${COMPANY_INFO.phone} | Fax: ${COMPANY_INFO.fax} | Email: ${COMPANY_INFO.email}`]);
	aoa.push([]);
	aoa.push(['LAPORAN DAFTAR PURCHASE ORDER (PEMBELIAN)']);
	if (filter.tgl1 || filter.tgl2) {
		aoa.push([`Periode: ${filter.tgl1 || 'Awal'} s/d ${filter.tgl2 || 'Sekarang'}`]);
	}
	aoa.push([]);

	// Tabel Data
	aoa.push([
		'NO',
		'NO. PO',
		'TANGGAL',
		'PEMASOK (SUPPLIER)',
		'DOKUMEN',
		'TOTAL QTY',
		'SISA QTY',
		'VALAS',
		'SUBTOTAL (DPP)',
		'PPN (%)',
		'TOTAL (RP)',
		'STATUS',
		'KETERANGAN'
	]);

	items.forEach((po, idx) => {
		const statusText = po.canceled ? 'BATAL' : po.completed ? 'SELESAI' : 'AKTIF';
		aoa.push([
			idx + 1,
			po.orderId,
			po.orderDate,
			po.supplierName,
			po.tipeDok,
			po.totalKgs,
			po.totalKgsL,
			po.curr,
			po.dpp,
			po.tax,
			po.totalRp,
			statusText,
			po.remark
		]);
	});

	aoa.push([]);
	aoa.push(['RINGKASAN:']);
	aoa.push(['Total Dokumen PO', items.length]);
	aoa.push(['Total Nilai Pembelian (DPP)', summary.totalDpp]);
	aoa.push(['Total Grand Total PO', summary.totalAmount]);
	aoa.push(['PO Aktif (Open)', summary.totalOpen]);
	aoa.push(['PO Selesai (Completed)', summary.totalCompleted]);
	aoa.push(['PO Dibatalkan (Canceled)', summary.totalCanceled]);

	const ws = XLSX.utils.aoa_to_sheet(aoa);
	ws['!cols'] = [
		{ wch: 6 },
		{ wch: 12 },
		{ wch: 14 },
		{ wch: 32 },
		{ wch: 10 },
		{ wch: 12 },
		{ wch: 12 },
		{ wch: 8 },
		{ wch: 16 },
		{ wch: 8 },
		{ wch: 18 },
		{ wch: 12 },
		{ wch: 30 }
	];

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Daftar_PO');
	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
