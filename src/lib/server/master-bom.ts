import { runQuery, runProcedure, withTransaction, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface MasterBomHeader {
	TransID: string;
	Transdate: string | null;
	ItemID: string;
	ItemName: string;
	ItemName2: string | null;
	Departemen: string | null;
	Satuan: string;
	HasilPackQty: number;
	HasilPackSatuan: string;
	LocIDSource: string | null;
	LocIDSourceName: string | null;
	LocID: string | null;
	LocIDName: string | null;
	Remark: string | null;
	Username: string | null;
	UserDatetime: string | null;
	componentCount: number;
}

export interface MasterBomDetailItem {
	TransID: string;
	ItemID: string;
	ItemName: string;
	ItemName2: string | null;
	BahanQty: number;
	BahanPackSatuan: string;
	Departemen: string | null;
	KodeJenis: string | null;
	NamaJenis: string | null;
	Spec: string | null;
	rjn?: number;
}

export interface BomTreeNode {
	TransID: string;
	Level: number;
	ParentItemID: string | null;
	ParentItemName: string | null;
	ItemID: string;
	ItemName: string;
	ItemName2: string | null;
	Qty: number;
	CumulativeQty: number;
	Departemen: string;
	NamaJenis: string;
	ItemPath: string;
	SortPath: string;
}

export interface MasterBomStats {
	totalBom: number;
	totalDetails: number;
	totalFinishedGoods: number;
	totalAssembly: number;
	totalInjeksi: number;
}

export interface BomPagedResult {
	rows: MasterBomHeader[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	stats: MasterBomStats;
}

export interface WarehouseLocation {
	LocID: string;
	LocName: string;
}

export interface CreateBomPayload {
	TransID?: string;
	Transdate?: string;
	ItemID: string;
	HasilPackQty?: number;
	HasilPackSatuan?: string;
	LocIDSource?: string | null;
	LocID?: string | null;
	Remark?: string | null;
	details: Array<{
		ItemID: string;
		BahanQty: number;
		BahanPackSatuan: string;
	}>;
}

export interface UpdateBomPayload {
	Transdate?: string;
	HasilPackQty?: number;
	HasilPackSatuan?: string;
	LocIDSource?: string | null;
	LocID?: string | null;
	Remark?: string | null;
	details: Array<{
		ItemID: string;
		BahanQty: number;
		BahanPackSatuan: string;
	}>;
}

/**
 * Mengambil ringkasan statistik Master BOM
 */
export async function getMasterBomStats(): Promise<MasterBomStats> {
	try {
		const res = await runQuery(`
			SELECT 
				COUNT(DISTINCT hd.TransID) AS totalBom,
				COUNT(dt.TransID) AS totalDetails,
				COUNT(DISTINCT CASE WHEN UPPER(g.KodeJenis) = 'FG' OR UPPER(ISNULL(g.Mark, '')) = 'WAREHOUSE' THEN hd.ItemID END) AS totalFinishedGoods,
				COUNT(DISTINCT CASE WHEN hd.LocIDSource = 'GUDAS' OR UPPER(ISNULL(g.Mark, '')) LIKE '%ASS%' THEN hd.ItemID END) AS totalAssembly,
				COUNT(DISTINCT CASE WHEN hd.LocIDSource = 'GUDIN' OR UPPER(ISNULL(g.Mark, '')) LIKE '%INJ%' THEN hd.ItemID END) AS totalInjeksi
			FROM [cp].[dbo].[taPackingHD] hd
			LEFT JOIN [cp].[dbo].[taPackingDT] dt ON hd.TransID = dt.TransID
			LEFT JOIN [cp].[dbo].[taGoods] g ON hd.ItemID = g.ItemID
		`);
		const r = res.recordset[0] || {};
		return {
			totalBom: Number(r.totalBom || 0),
			totalDetails: Number(r.totalDetails || 0),
			totalFinishedGoods: Number(r.totalFinishedGoods || 0),
			totalAssembly: Number(r.totalAssembly || 0),
			totalInjeksi: Number(r.totalInjeksi || 0)
		};
	} catch (err) {
		log.error({ err }, 'Gagal menghitung statistik Master BOM');
		return {
			totalBom: 0,
			totalDetails: 0,
			totalFinishedGoods: 0,
			totalAssembly: 0,
			totalInjeksi: 0
		};
	}
}

/**
 * Mengambil seluruh daftar lokasi gudang dari taLocation
 */
export async function getAllBomLocations(): Promise<WarehouseLocation[]> {
	try {
		const res = await runQuery(`
			SELECT 
				RTRIM(LTRIM(LocID)) AS LocID,
				RTRIM(LTRIM(LocName)) AS LocName
			FROM [cp].[dbo].[taLocation]
			ORDER BY LocID ASC
		`);
		return (res.recordset || []).map((r: any) => ({
			LocID: String(r.LocID || '').trim(),
			LocName: String(r.LocName || '').trim()
		}));
	} catch (err) {
		log.error({ err }, 'Gagal mengambil data taLocation');
		return [];
	}
}

/**
 * Menghasilkan TransID BOM berikutnya untuk tahun berjalan (format: YY + 5 digit nomor urut, e.g. 2600271)
 */
export async function getNextBomTransId(): Promise<string> {
	const now = new Date();
	const year2 = String(now.getFullYear()).slice(-2);

	const res = await runQuery(
		`SELECT TOP 1 TransID 
		 FROM [cp].[dbo].[taPackingHD] 
		 WHERE TransID LIKE @prefix + '%' AND LEN(TransID) = 7 
		 ORDER BY TransID DESC`,
		[{ name: 'prefix', type: sql.VarChar(2), value: year2 }]
	);

	const lastId = res.recordset[0]?.TransID;
	let nextSeq = 1;
	if (lastId && lastId.length === 7) {
		const parsed = parseInt(lastId.slice(2), 10);
		if (!Number.isNaN(parsed)) {
			nextSeq = parsed + 1;
		}
	}

	return `${year2}${String(nextSeq).padStart(5, '0')}`;
}

/**
 * Ambil daftar Master BOM dengan filter, pencarian, dan pagination
 */
export async function getMasterBomPaged(params: {
	q?: string;
	locIdSource?: string;
	locId?: string;
	page?: number;
	pageSize?: number;
}): Promise<BomPagedResult> {
	const page = Math.max(1, params.page || 1);
	const pageSize = Math.max(10, Math.min(200, params.pageSize || 25));
	const offset = (page - 1) * pageSize;

	const search = (params.q || '').trim();
	const locSourceFilter = (params.locIdSource || '').trim().toUpperCase();
	const locDestFilter = (params.locId || '').trim().toUpperCase();

	const conditions: string[] = ['1=1'];
	const inputs: { name: string; type: any; value: any }[] = [];

	if (search) {
		conditions.push(`(
			hd.TransID LIKE @search OR
			hd.ItemID LIKE @search OR
			g.ItemName LIKE @search OR
			g.ItemName2 LIKE @search OR
			g.Mark LIKE @search OR
			hd.Remark LIKE @search
		)`);
		inputs.push({ name: 'search', type: sql.NVarChar(120), value: `%${search}%` });
	}

	if (locSourceFilter) {
		conditions.push(`hd.LocIDSource = @locSourceFilter`);
		inputs.push({ name: 'locSourceFilter', type: sql.VarChar(6), value: locSourceFilter });
	}

	if (locDestFilter) {
		conditions.push(`hd.LocID = @locDestFilter`);
		inputs.push({ name: 'locDestFilter', type: sql.VarChar(6), value: locDestFilter });
	}

	const whereClause = conditions.join(' AND ');

	const countQ = `
		SELECT COUNT(*) AS total
		FROM [cp].[dbo].[taPackingHD] hd
		LEFT JOIN [cp].[dbo].[taGoods] g ON hd.ItemID = g.ItemID
		WHERE ${whereClause}
	`;

	const dataQ = `
		SELECT 
			hd.TransID,
			hd.Transdate,
			hd.ItemID,
			ISNULL(g.ItemName, '') AS ItemName,
			g.ItemName2,
			ISNULL(g.Mark, '') AS Departemen,
			ISNULL(g.SatuanKecil, 'Pcs') AS Satuan,
			ISNULL(hd.HasilPackQty, 1) AS HasilPackQty,
			ISNULL(hd.HasilPackSatuan, 'PCS') AS HasilPackSatuan,
			hd.LocIDSource,
			locSrc.LocName AS LocIDSourceName,
			hd.LocID,
			locDst.LocName AS LocIDName,
			hd.Remark,
			hd.Username,
			hd.UserDatetime,
			(SELECT COUNT(*) FROM [cp].[dbo].[taPackingDT] dt WHERE dt.TransID = hd.TransID) AS componentCount
		FROM [cp].[dbo].[taPackingHD] hd
		LEFT JOIN [cp].[dbo].[taGoods] g ON hd.ItemID = g.ItemID
		LEFT JOIN [cp].[dbo].[taLocation] locSrc ON hd.LocIDSource = locSrc.LocID
		LEFT JOIN [cp].[dbo].[taLocation] locDst ON hd.LocID = locDst.LocID
		WHERE ${whereClause}
		ORDER BY hd.TransID DESC
		OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
	`;

	const dataInputs = [
		...inputs,
		{ name: 'offset', type: sql.Int, value: offset },
		{ name: 'pageSize', type: sql.Int, value: pageSize }
	];

	const [countRes, dataRes, stats] = await Promise.all([
		runQuery(countQ, inputs),
		runQuery(dataQ, dataInputs),
		getMasterBomStats()
	]);

	const total = countRes.recordset[0]?.total || 0;
	const rows: MasterBomHeader[] = (dataRes.recordset || []).map((r: any) => ({
		TransID: String(r.TransID).trim(),
		Transdate: r.Transdate ? new Date(r.Transdate).toISOString() : null,
		ItemID: String(r.ItemID).trim(),
		ItemName: String(r.ItemName || '').trim(),
		ItemName2: r.ItemName2 ? String(r.ItemName2).trim() : null,
		Departemen: r.Departemen ? String(r.Departemen).trim() : null,
		Satuan: String(r.Satuan || 'Pcs').trim(),
		HasilPackQty: Number(r.HasilPackQty || 1),
		HasilPackSatuan: String(r.HasilPackSatuan || 'PCS').trim(),
		LocIDSource: r.LocIDSource ? String(r.LocIDSource).trim() : null,
		LocIDSourceName: r.LocIDSourceName ? String(r.LocIDSourceName).trim() : null,
		LocID: r.LocID ? String(r.LocID).trim() : null,
		LocIDName: r.LocIDName ? String(r.LocIDName).trim() : null,
		Remark: r.Remark ? String(r.Remark).trim() : null,
		Username: r.Username ? String(r.Username).trim() : null,
		UserDatetime: r.UserDatetime ? new Date(r.UserDatetime).toISOString() : null,
		componentCount: Number(r.componentCount || 0)
	}));

	const totalPages = Math.ceil(total / pageSize);

	return {
		rows,
		total,
		page,
		pageSize,
		totalPages,
		stats
	};
}

/**
 * Mengambil detail lengkap 1 BOM berdasarkan TransID
 */
export async function getBomDetailByTransId(transId: string): Promise<{
	header: MasterBomHeader;
	details: MasterBomDetailItem[];
} | null> {
	const cleanId = transId.trim();

	const headerRes = await runQuery(
		`SELECT TOP 1
			hd.TransID,
			hd.Transdate,
			hd.ItemID,
			ISNULL(g.ItemName, '') AS ItemName,
			g.ItemName2,
			ISNULL(g.Mark, '') AS Departemen,
			ISNULL(g.SatuanKecil, 'Pcs') AS Satuan,
			ISNULL(hd.HasilPackQty, 1) AS HasilPackQty,
			ISNULL(hd.HasilPackSatuan, 'PCS') AS HasilPackSatuan,
			hd.LocIDSource,
			locSrc.LocName AS LocIDSourceName,
			hd.LocID,
			locDst.LocName AS LocIDName,
			hd.Remark,
			hd.Username,
			hd.UserDatetime,
			(SELECT COUNT(*) FROM [cp].[dbo].[taPackingDT] dt WHERE dt.TransID = hd.TransID) AS componentCount
		FROM [cp].[dbo].[taPackingHD] hd
		LEFT JOIN [cp].[dbo].[taGoods] g ON hd.ItemID = g.ItemID
		LEFT JOIN [cp].[dbo].[taLocation] locSrc ON hd.LocIDSource = locSrc.LocID
		LEFT JOIN [cp].[dbo].[taLocation] locDst ON hd.LocID = locDst.LocID
		WHERE hd.TransID = @transId`,
		[{ name: 'transId', type: sql.VarChar(7), value: cleanId }]
	);

	if (!headerRes.recordset || headerRes.recordset.length === 0) {
		return null;
	}

	const r = headerRes.recordset[0];
	const header: MasterBomHeader = {
		TransID: String(r.TransID).trim(),
		Transdate: r.Transdate ? new Date(r.Transdate).toISOString() : null,
		ItemID: String(r.ItemID).trim(),
		ItemName: String(r.ItemName || '').trim(),
		ItemName2: r.ItemName2 ? String(r.ItemName2).trim() : null,
		Departemen: r.Departemen ? String(r.Departemen).trim() : null,
		Satuan: String(r.Satuan || 'Pcs').trim(),
		HasilPackQty: Number(r.HasilPackQty || 1),
		HasilPackSatuan: String(r.HasilPackSatuan || 'PCS').trim(),
		LocIDSource: r.LocIDSource ? String(r.LocIDSource).trim() : null,
		LocIDSourceName: r.LocIDSourceName ? String(r.LocIDSourceName).trim() : null,
		LocID: r.LocID ? String(r.LocID).trim() : null,
		LocIDName: r.LocIDName ? String(r.LocIDName).trim() : null,
		Remark: r.Remark ? String(r.Remark).trim() : null,
		Username: r.Username ? String(r.Username).trim() : null,
		UserDatetime: r.UserDatetime ? new Date(r.UserDatetime).toISOString() : null,
		componentCount: Number(r.componentCount || 0)
	};

	const detailsRes = await runQuery(
		`SELECT 
			dt.TransID,
			dt.ItemID,
			ISNULL(g.ItemName, '') AS ItemName,
			g.ItemName2,
			dt.BahanQty,
			ISNULL(dt.BahanPackSatuan, 'PCS') AS BahanPackSatuan,
			g.Mark AS Departemen,
			g.KodeJenis,
			ISNULL(kjg.NamaJenis, '') AS NamaJenis,
			g.Spec,
			dt.rjn
		FROM [cp].[dbo].[taPackingDT] dt
		LEFT JOIN [cp].[dbo].[taGoods] g ON dt.ItemID = g.ItemID
		LEFT JOIN [cp].[dbo].[taKindofGoods] kjg ON g.KodeJenis = kjg.KodeJenis
		WHERE dt.TransID = @transId
		ORDER BY dt.rjn ASC`,
		[{ name: 'transId', type: sql.VarChar(7), value: cleanId }]
	);

	const details: MasterBomDetailItem[] = (detailsRes.recordset || []).map((d: any) => ({
		TransID: String(d.TransID).trim(),
		ItemID: String(d.ItemID).trim(),
		ItemName: String(d.ItemName || '').trim(),
		ItemName2: d.ItemName2 ? String(d.ItemName2).trim() : null,
		BahanQty: Number(d.BahanQty || 0),
		BahanPackSatuan: String(d.BahanPackSatuan || 'PCS').trim(),
		Departemen: d.Departemen ? String(d.Departemen).trim() : null,
		KodeJenis: d.KodeJenis ? String(d.KodeJenis).trim() : null,
		NamaJenis: d.NamaJenis ? String(d.NamaJenis).trim() : null,
		Spec: d.Spec ? String(d.Spec).trim() : null,
		rjn: d.rjn != null ? Number(d.rjn) : undefined
	}));

	return { header, details };
}

/**
 * Mengambil struktur hierarki multi-level (BOM Tree) menggunakan stored procedure rpBOMTree
 */
export async function getBomTreeByItemId(itemId: string, maxLevel = 10): Promise<BomTreeNode[]> {
	const cleanItemId = itemId.trim();
	try {
		const res = await runProcedure('dbo.rpBOMTree', [
			{ name: 'itemid', type: sql.VarChar(50), value: cleanItemId },
			{ name: 'maxLevel', type: sql.Int, value: maxLevel }
		]);

		return (res.recordset || []).map((node: any) => ({
			TransID: String(node.TransID || '').trim(),
			Level: Number(node.Level || 0),
			ParentItemID: node.ParentItemID ? String(node.ParentItemID).trim() : null,
			ParentItemName: node.ParentItemName ? String(node.ParentItemName).trim() : null,
			ItemID: String(node.ItemID || '').trim(),
			ItemName: String(node.ItemName || '').trim(),
			ItemName2: node.ItemName2 ? String(node.ItemName2).trim() : null,
			Qty: Number(node.Qty || 0),
			CumulativeQty: Number(node.CumulativeQty || 0),
			Departemen: String(node.Departemen || '').trim(),
			NamaJenis: String(node.NamaJenis || '').trim(),
			ItemPath: String(node.ItemPath || '').trim(),
			SortPath: String(node.SortPath || '').trim()
		}));
	} catch (err) {
		log.error({ err, itemId: cleanItemId }, 'Gagal menjalankan dbo.rpBOMTree');
		return [];
	}
}

/**
 * Tambah Master BOM Baru (Create)
 */
export async function createBom(
	payload: CreateBomPayload,
	operator: string
): Promise<{ TransID: string; message: string }> {
	const itemId = payload.ItemID.trim();
	if (!itemId) {
		throw new Error('Kode Produk Hasil (ItemID) wajib dipilih.');
	}

	// Validasi barang di taGoods
	const checkItem = await runQuery(
		`SELECT TOP 1 ItemID, ItemName, SatuanKecil FROM [cp].[dbo].[taGoods] WHERE ItemID = @itemId`,
		[{ name: 'itemId', type: sql.VarChar(25), value: itemId }]
	);
	if (!checkItem.recordset || checkItem.recordset.length === 0) {
		throw new Error(`Produk dengan kode "${itemId}" tidak ditemukan di Master Barang (taGoods).`);
	}

	// Validasi apakah produk sudah memiliki BOM di taPackingHD
	const existingBom = await runQuery(
		`SELECT TOP 1 TransID FROM [cp].[dbo].[taPackingHD] WHERE ItemID = @itemId`,
		[{ name: 'itemId', type: sql.VarChar(25), value: itemId }]
	);
	if (existingBom.recordset && existingBom.recordset.length > 0) {
		throw new Error(
			`Produk "${itemId}" sudah memiliki Master BOM dengan TransID "${existingBom.recordset[0].TransID}". Satu produk hanya boleh memiliki satu Master BOM aktif.`
		);
	}

	if (!payload.details || payload.details.length === 0) {
		throw new Error('BOM harus memiliki minimal 1 (satu) komponen/bahan baku.');
	}

	const transId = payload.TransID?.trim() || (await getNextBomTransId());
	const hasilQty = Math.max(1, payload.HasilPackQty || 1);
	const hasilSatuan = payload.HasilPackSatuan?.trim().slice(0, 10) || checkItem.recordset[0].SatuanKecil || 'PCS';
	const locSource = payload.LocIDSource?.trim().slice(0, 6) || null;
	const locDest = payload.LocID?.trim().slice(0, 6) || null;
	const remark = payload.Remark?.trim().slice(0, 50) || null;
	const transDate = payload.Transdate ? new Date(payload.Transdate) : new Date();

	return await withTransaction(async (tx) => {
		// 1. Insert Header
		await tx
			.request()
			.input('TransID', sql.VarChar(7), transId)
			.input('Transdate', sql.SmallDateTime, transDate)
			.input('ItemID', sql.VarChar(25), itemId)
			.input('HasilPackQty', sql.Int, hasilQty)
			.input('HasilPackSatuan', sql.VarChar(10), hasilSatuan)
			.input('LocIDSource', sql.VarChar(6), locSource)
			.input('LocID', sql.VarChar(6), locDest)
			.input('Remark', sql.VarChar(50), remark)
			.input('Username', sql.VarChar(50), operator)
			.query(`
				INSERT INTO [cp].[dbo].[taPackingHD] (
					TransID, Transdate, ItemID, HasilPackQty, HasilPackSatuan,
					LocIDSource, LocID, Remark, Username, UserDatetime
				) VALUES (
					@TransID, @Transdate, @ItemID, @HasilPackQty, @HasilPackSatuan,
					@LocIDSource, @LocID, @Remark, @Username, GETDATE()
				)
			`);

		// 2. Insert Details
		for (const dt of payload.details) {
			const bItemId = dt.ItemID.trim();
			const bQty = Number(dt.BahanQty || 0);
			const bSatuan = dt.BahanPackSatuan?.trim().slice(0, 10) || 'PCS';

			if (!bItemId || bQty <= 0) continue;

			await tx
				.request()
				.input('TransID', sql.VarChar(7), transId)
				.input('ItemID', sql.VarChar(25), bItemId)
				.input('BahanQty', sql.Decimal(18, 4), bQty)
				.input('BahanPackSatuan', sql.VarChar(10), bSatuan)
				.query(`
					INSERT INTO [cp].[dbo].[taPackingDT] (
						TransID, ItemID, BahanQty, BahanPackSatuan
					) VALUES (
						@TransID, @ItemID, @BahanQty, @BahanPackSatuan
					)
				`);
		}

		return {
			TransID: transId,
			message: `Master BOM "${transId}" untuk produk "${itemId}" berhasil dibuat.`
		};
	});
}

/**
 * Ubah Master BOM (Update)
 */
export async function updateBom(
	transId: string,
	payload: UpdateBomPayload,
	operator: string
): Promise<{ TransID: string; message: string }> {
	const cleanId = transId.trim();

	const check = await runQuery(
		`SELECT TOP 1 TransID, ItemID FROM [cp].[dbo].[taPackingHD] WHERE TransID = @transId`,
		[{ name: 'transId', type: sql.VarChar(7), value: cleanId }]
	);
	if (!check.recordset || check.recordset.length === 0) {
		throw new Error(`Master BOM dengan TransID "${cleanId}" tidak ditemukan.`);
	}

	if (!payload.details || payload.details.length === 0) {
		throw new Error('BOM harus memiliki minimal 1 (satu) komponen/bahan baku.');
	}

	const hasilQty = Math.max(1, payload.HasilPackQty || 1);
	const hasilSatuan = payload.HasilPackSatuan?.trim().slice(0, 10) || 'PCS';
	const locSource = payload.LocIDSource?.trim().slice(0, 6) || null;
	const locDest = payload.LocID?.trim().slice(0, 6) || null;
	const remark = payload.Remark?.trim().slice(0, 50) || null;
	const transDate = payload.Transdate ? new Date(payload.Transdate) : new Date();

	return await withTransaction(async (tx) => {
		// 1. Update Header
		await tx
			.request()
			.input('TransID', sql.VarChar(7), cleanId)
			.input('Transdate', sql.SmallDateTime, transDate)
			.input('HasilPackQty', sql.Int, hasilQty)
			.input('HasilPackSatuan', sql.VarChar(10), hasilSatuan)
			.input('LocIDSource', sql.VarChar(6), locSource)
			.input('LocID', sql.VarChar(6), locDest)
			.input('Remark', sql.VarChar(50), remark)
			.input('Username', sql.VarChar(50), operator)
			.query(`
				UPDATE [cp].[dbo].[taPackingHD]
				SET
					Transdate = @Transdate,
					HasilPackQty = @HasilPackQty,
					HasilPackSatuan = @HasilPackSatuan,
					LocIDSource = @LocIDSource,
					LocID = @LocID,
					Remark = @Remark,
					Username = @Username,
					UserDatetime = GETDATE()
				WHERE TransID = @TransID
			`);

		// 2. Hapus detail lama
		await tx
			.request()
			.input('TransID', sql.VarChar(7), cleanId)
			.query(`DELETE FROM [cp].[dbo].[taPackingDT] WHERE TransID = @TransID`);

		// 3. Masukkan detail baru
		for (const dt of payload.details) {
			const bItemId = dt.ItemID.trim();
			const bQty = Number(dt.BahanQty || 0);
			const bSatuan = dt.BahanPackSatuan?.trim().slice(0, 10) || 'PCS';

			if (!bItemId || bQty <= 0) continue;

			await tx
				.request()
				.input('TransID', sql.VarChar(7), cleanId)
				.input('ItemID', sql.VarChar(25), bItemId)
				.input('BahanQty', sql.Decimal(18, 4), bQty)
				.input('BahanPackSatuan', sql.VarChar(10), bSatuan)
				.query(`
					INSERT INTO [cp].[dbo].[taPackingDT] (
						TransID, ItemID, BahanQty, BahanPackSatuan
					) VALUES (
						@TransID, @ItemID, @BahanQty, @BahanPackSatuan
					)
				`);
		}

		return {
			TransID: cleanId,
			message: `Master BOM "${cleanId}" berhasil diperbarui.`
		};
	});
}

/**
 * Hapus Master BOM
 */
export async function deleteBom(transId: string): Promise<{ success: boolean; message: string }> {
	const cleanId = transId.trim();

	const check = await runQuery(
		`SELECT TOP 1 TransID, ItemID FROM [cp].[dbo].[taPackingHD] WHERE TransID = @transId`,
		[{ name: 'transId', type: sql.VarChar(7), value: cleanId }]
	);
	if (!check.recordset || check.recordset.length === 0) {
		throw new Error(`Master BOM dengan TransID "${cleanId}" tidak ditemukan.`);
	}

	const itemId = check.recordset[0].ItemID;

	// Cek apakah produk sedang digunakan dalam SPK aktif
	const checkSpk = await runQuery(
		`SELECT TOP 1 SPKNo FROM [cp].[dbo].[taSPKDT] WHERE ItemID = @itemId`,
		[{ name: 'itemId', type: sql.VarChar(25), value: itemId }]
	);
	if (checkSpk.recordset && checkSpk.recordset.length > 0) {
		throw new Error(
			`BOM "${cleanId}" untuk produk "${itemId}" tidak dapat dihapus karena tercatat pada dokumen SPK "${checkSpk.recordset[0].SPKNo}".`
		);
	}

	return await withTransaction(async (tx) => {
		await tx
			.request()
			.input('TransID', sql.VarChar(7), cleanId)
			.query(`DELETE FROM [cp].[dbo].[taPackingDT] WHERE TransID = @TransID`);

		await tx
			.request()
			.input('TransID', sql.VarChar(7), cleanId)
			.query(`DELETE FROM [cp].[dbo].[taPackingHD] WHERE TransID = @TransID`);

		return {
			success: true,
			message: `Master BOM "${cleanId}" untuk produk "${itemId}" berhasil dihapus.`
		};
	});
}

/**
 * Export daftar Master BOM ke Excel
 */
export async function generateBomListExcel(params: {
	q?: string;
	locIdSource?: string;
	locId?: string;
}): Promise<Buffer> {
	const result = await getMasterBomPaged({
		...params,
		page: 1,
		pageSize: 5000
	});

	const wb = XLSX.utils.book_new();

	const aoa: any[][] = [
		['MASTER DATA BILL OF MATERIALS (BOM)'],
		[`Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`],
		[`Total Data: ${result.rows.length} BOM Produk`],
		[],
		[
			'No',
			'Trans ID',
			'Tanggal',
			'Kode Produk Hasil',
			'Nama Produk Hasil',
			'Departemen',
			'Qty Hasil',
			'Satuan Hasil',
			'Gudang Asal',
			'Gudang Tujuan',
			'Jml Komponen Bahan',
			'Catatan / Remark',
			'Operator'
		]
	];

	result.rows.forEach((r, idx) => {
		aoa.push([
			idx + 1,
			r.TransID,
			r.Transdate ? r.Transdate.slice(0, 10) : '-',
			r.ItemID,
			r.ItemName,
			r.Departemen || '-',
			r.HasilPackQty,
			r.HasilPackSatuan,
			r.LocIDSource ? `${r.LocIDSource} (${r.LocIDSourceName || ''})` : '-',
			r.LocID ? `${r.LocID} (${r.LocIDName || ''})` : '-',
			r.componentCount,
			r.Remark || '-',
			r.Username || '-'
		]);
	});

	const ws = XLSX.utils.aoa_to_sheet(aoa);
	ws['!cols'] = [
		{ wch: 6 },
		{ wch: 12 },
		{ wch: 14 },
		{ wch: 22 },
		{ wch: 35 },
		{ wch: 18 },
		{ wch: 10 },
		{ wch: 12 },
		{ wch: 20 },
		{ wch: 20 },
		{ wch: 18 },
		{ wch: 30 },
		{ wch: 16 }
	];

	XLSX.utils.book_append_sheet(wb, ws, 'Daftar Master BOM');
	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Export struktur hierarki satu BOM ke Excel
 */
export async function generateSingleBomExcel(transId: string): Promise<Buffer> {
	const bom = await getBomDetailByTransId(transId);
	if (!bom) {
		throw new Error(`Master BOM "${transId}" tidak ditemukan.`);
	}

	const tree = await getBomTreeByItemId(bom.header.ItemID);

	const wb = XLSX.utils.book_new();

	// Sheet 1: Komponen Langsung (Level 1)
	const aoaDetail: any[][] = [
		[`STRUKTUR MATERIAL / RESEP BOM : ${bom.header.ItemID} - ${bom.header.ItemName}`],
		[`TransID: ${bom.header.TransID} | Tanggal: ${bom.header.Transdate?.slice(0, 10) || '-'} | Qty Hasil: ${bom.header.HasilPackQty} ${bom.header.HasilPackSatuan}`],
		[`Gudang Asal: ${bom.header.LocIDSource || '-'} | Gudang Tujuan: ${bom.header.LocID || '-'} | Remark: ${bom.header.Remark || '-'}`],
		[],
		['No', 'Kode Bahan / Komponen', 'Nama Bahan', 'Kebutuhan Qty', 'Satuan', 'Departemen', 'Jenis Barang', 'Spesifikasi']
	];

	bom.details.forEach((d, idx) => {
		aoaDetail.push([
			idx + 1,
			d.ItemID,
			d.ItemName,
			d.BahanQty,
			d.BahanPackSatuan,
			d.Departemen || '-',
			d.NamaJenis || '-',
			d.Spec || '-'
		]);
	});

	const wsDetail = XLSX.utils.aoa_to_sheet(aoaDetail);
	wsDetail['!cols'] = [
		{ wch: 6 },
		{ wch: 22 },
		{ wch: 35 },
		{ wch: 14 },
		{ wch: 10 },
		{ wch: 16 },
		{ wch: 18 },
		{ wch: 25 }
	];
	XLSX.utils.book_append_sheet(wb, wsDetail, 'Komponen Level 1');

	// Sheet 2: Hierarki Multi-Level (BOM Tree)
	if (tree.length > 0) {
		const aoaTree: any[][] = [
			[`HIERARKI REKURSIF MULTI-LEVEL BOM TREE : ${bom.header.ItemID}`],
			[`Total Node: ${tree.length} Item / Komponen / Bahan`],
			[],
			['Level', 'Kode Komponen', 'Nama Komponen / Bahan', 'Qty Induk', 'Cumulative Qty', 'Departemen', 'Jenis', 'Item Tree Path']
		];

		tree.forEach((t) => {
			const indent = '  '.repeat(t.Level);
			aoaTree.push([
				t.Level,
				t.ItemID,
				`${indent}${t.ItemName}`,
				t.Qty,
				t.CumulativeQty,
				t.Departemen || '-',
				t.NamaJenis || '-',
				t.ItemPath
			]);
		});

		const wsTree = XLSX.utils.aoa_to_sheet(aoaTree);
		wsTree['!cols'] = [
			{ wch: 8 },
			{ wch: 22 },
			{ wch: 45 },
			{ wch: 12 },
			{ wch: 16 },
			{ wch: 16 },
			{ wch: 18 },
			{ wch: 50 }
		];
		XLSX.utils.book_append_sheet(wb, wsTree, 'Multi-Level Tree');
	}

	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
