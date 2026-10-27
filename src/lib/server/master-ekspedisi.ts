import { runQuery, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface MasterEkspedisi {
	ekspedisiID: string;
	Nama: string;
	NoNPWP: string | null;
	SupplierID: string | null;
	SupplierName?: string | null;
	UserName: string | null;
	UserDateTime: string | null;
	UserUpdateName: string | null;
	UserUpdateDate: string | null;
}

export interface CreateEkspedisiPayload {
	ekspedisiID?: string;
	Nama: string;
	NoNPWP?: string | null;
	SupplierID?: string | null;
}

export interface EkspedisiSummaryStats {
	total: number;
	totalWithNPWP: number;
	totalWithoutNPWP: number;
	totalWithSupplier: number;
}

export interface EkspedisiPagedResult {
	rows: MasterEkspedisi[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	stats: EkspedisiSummaryStats;
}

export interface SupplierOption {
	CompanyID: string;
	CompanyName1: string;
}

function mapEkspedisiRow(r: any): MasterEkspedisi {
	return {
		ekspedisiID: String(r.ekspedisiID || '').trim(),
		Nama: String(r.Nama || '').trim(),
		NoNPWP: r.NoNPWP != null ? String(r.NoNPWP).trim() : null,
		SupplierID: r.SupplierID != null ? String(r.SupplierID).trim() : null,
		SupplierName: r.SupplierName != null ? String(r.SupplierName).trim() : null,
		UserName: r.UserName != null ? String(r.UserName).trim() : null,
		UserDateTime:
			r.UserDateTime instanceof Date
				? r.UserDateTime.toISOString()
				: r.UserDateTime != null
					? String(r.UserDateTime)
					: null,
		UserUpdateName: r.UserUpdateName != null ? String(r.UserUpdateName).trim() : null,
		UserUpdateDate:
			r.UserUpdateDate instanceof Date
				? r.UserUpdateDate.toISOString()
				: r.UserUpdateDate != null
					? String(r.UserUpdateDate)
					: null
	};
}

/**
 * Generate atau tebak ekspedisiID berikutnya (maksimal 5 karakter)
 * Menggunakan awalan nama atau fallback 'EXP01'
 */
export async function getNextEkspedisiId(
	suggestName?: string
): Promise<{ lastId: string | null; nextId: string }> {
	try {
		let prefix = 'EXP';
		if (suggestName) {
			const cleaned = suggestName
				.toUpperCase()
				.replace(/^PT\.?\s+|^CV\.?\s+|^UD\.?\s+/i, '')
				.replace(/[^A-Z]/g, '');
			if (cleaned.length >= 3) {
				prefix = cleaned.slice(0, 3);
			} else if (cleaned.length >= 2) {
				prefix = cleaned.slice(0, 2);
			}
		}

		const padLen = Math.max(1, 5 - prefix.length);
		const q = `
			SELECT TOP 1 ekspedisiID
			FROM [cp].[dbo].[taEkspedisi]
			WHERE UPPER(RTRIM(LTRIM(ekspedisiID))) LIKE @prefixPattern
			ORDER BY ekspedisiID DESC
		`;
		const res = await runQuery(q, [
			{ name: 'prefixPattern', type: sql.VarChar(10), value: `${prefix}%` }
		]);
		const lastRow = res.recordset?.[0];
		const lastId = lastRow?.ekspedisiID ? String(lastRow.ekspedisiID).trim() : null;

		let nextNum = 1;
		if (lastId) {
			const numPart = parseInt(lastId.slice(prefix.length), 10);
			if (!isNaN(numPart)) {
				nextNum = numPart + 1;
			}
		}

		let nextId = `${prefix}${String(nextNum).padStart(padLen, '0')}`;
		if (nextId.length > 5) {
			nextId = nextId.slice(0, 5);
		}

		// Jika kebetulan sudah terpakai, cari nomor berikutnya yang belum terpakai
		let exists = await ekspedisiExists(nextId);
		while (exists && nextNum < 999) {
			nextNum++;
			nextId = `${prefix}${String(nextNum).padStart(padLen, '0')}`.slice(0, 5);
			exists = await ekspedisiExists(nextId);
		}

		return { lastId, nextId };
	} catch (err) {
		log.warn({ err }, 'Gagal menghitung nomor ekspedisi berikutnya, fallback ke EXP01');
		return { lastId: null, nextId: 'EXP01' };
	}
}

/**
 * Cek apakah ekspedisiID sudah ada di database
 */
export async function ekspedisiExists(ekspedisiId: string): Promise<boolean> {
	const clean = ekspedisiId.trim().toUpperCase();
	const q = `SELECT TOP 1 1 FROM [cp].[dbo].[taEkspedisi] WHERE UPPER(RTRIM(LTRIM(ekspedisiID))) = @ekspedisiID`;
	const res = await runQuery(q, [{ name: 'ekspedisiID', type: sql.VarChar(5), value: clean }]);
	return (res.recordset?.length || 0) > 0;
}

/**
 * Ambil data 1 Ekspedisi berdasarkan ekspedisiID beserta nama supplier terkait
 */
export async function getEkspedisiById(ekspedisiId: string): Promise<MasterEkspedisi | null> {
	const clean = ekspedisiId.trim().toUpperCase();
	const q = `
		SELECT TOP 1
			e.ekspedisiID,
			e.Nama,
			e.NoNPWP,
			e.SupplierID,
			s.CompanyName1 AS SupplierName,
			e.UserName,
			e.UserDateTime,
			e.UserUpdateName,
			e.UserUpdateDate
		FROM [cp].[dbo].[taEkspedisi] e
		LEFT JOIN [cp].[dbo].[taSupplier] s ON UPPER(RTRIM(LTRIM(e.SupplierID))) = UPPER(RTRIM(LTRIM(s.CompanyID)))
		WHERE UPPER(RTRIM(LTRIM(e.ekspedisiID))) = @ekspedisiID
	`;
	const res = await runQuery(q, [{ name: 'ekspedisiID', type: sql.VarChar(5), value: clean }]);
	if (!res.recordset || res.recordset.length === 0) return null;
	return mapEkspedisiRow(res.recordset[0]);
}

/**
 * Ambil daftar ringkasan metrik statistik ekspedisi
 */
export async function getEkspedisiStats(): Promise<EkspedisiSummaryStats> {
	try {
		const q = `
			SELECT
				COUNT(*) as total,
				SUM(CASE WHEN NULLIF(RTRIM(LTRIM(NoNPWP)), '') IS NOT NULL THEN 1 ELSE 0 END) as totalWithNPWP,
				SUM(CASE WHEN NULLIF(RTRIM(LTRIM(NoNPWP)), '') IS NULL THEN 1 ELSE 0 END) as totalWithoutNPWP,
				SUM(CASE WHEN NULLIF(RTRIM(LTRIM(SupplierID)), '') IS NOT NULL THEN 1 ELSE 0 END) as totalWithSupplier
			FROM [cp].[dbo].[taEkspedisi]
		`;
		const res = await runQuery(q);
		const r = res.recordset[0] || {};
		return {
			total: Number(r.total || 0),
			totalWithNPWP: Number(r.totalWithNPWP || 0),
			totalWithoutNPWP: Number(r.totalWithoutNPWP || 0),
			totalWithSupplier: Number(r.totalWithSupplier || 0)
		};
	} catch (err) {
		log.error({ err }, 'Gagal menghitung statistik master ekspedisi');
		return { total: 0, totalWithNPWP: 0, totalWithoutNPWP: 0, totalWithSupplier: 0 };
	}
}

/**
 * Ambil daftar semua supplier aktif untuk opsi pilihan SupplierID
 */
export async function getAllSuppliersForSelect(): Promise<SupplierOption[]> {
	try {
		const q = `
			SELECT CompanyID, CompanyName1
			FROM [cp].[dbo].[taSupplier]
			WHERE CompanyID IS NOT NULL AND CompanyName1 IS NOT NULL
			ORDER BY CompanyName1 ASC
		`;
		const res = await runQuery(q);
		return (res.recordset || []).map((r: any) => ({
			CompanyID: String(r.CompanyID || '').trim(),
			CompanyName1: String(r.CompanyName1 || '').trim()
		}));
	} catch (err) {
		log.error({ err }, 'Gagal mengambil daftar supplier untuk ekspedisi');
		return [];
	}
}

/**
 * Ambil daftar master ekspedisi dengan pagination, pencarian, dan filter
 */
export async function getMasterEkspedisiPaged(params: {
	q?: string;
	hasNpwp?: string;
	hasSupplier?: string;
	page?: number;
	pageSize?: number;
}): Promise<EkspedisiPagedResult> {
	const page = Math.max(1, params.page || 1);
	const pageSize = Math.max(10, Math.min(200, params.pageSize || 25));
	const offset = (page - 1) * pageSize;

	const search = (params.q || '').trim();
	const hasNpwp = (params.hasNpwp || '').trim().toLowerCase();
	const hasSupplier = (params.hasSupplier || '').trim().toLowerCase();

	const conditions: string[] = ['1=1'];
	const inputs: { name: string; type: any; value: any }[] = [];

	if (search) {
		conditions.push(`(
			e.ekspedisiID LIKE @search OR
			e.Nama LIKE @search OR
			e.NoNPWP LIKE @search OR
			e.SupplierID LIKE @search OR
			s.CompanyName1 LIKE @search
		)`);
		inputs.push({ name: 'search', type: sql.NVarChar(120), value: `%${search}%` });
	}

	if (hasNpwp === 'yes') {
		conditions.push(`NULLIF(RTRIM(LTRIM(e.NoNPWP)), '') IS NOT NULL`);
	} else if (hasNpwp === 'no') {
		conditions.push(`NULLIF(RTRIM(LTRIM(e.NoNPWP)), '') IS NULL`);
	}

	if (hasSupplier === 'yes') {
		conditions.push(`NULLIF(RTRIM(LTRIM(e.SupplierID)), '') IS NOT NULL`);
	} else if (hasSupplier === 'no') {
		conditions.push(`NULLIF(RTRIM(LTRIM(e.SupplierID)), '') IS NULL`);
	}

	const whereClause = conditions.join(' AND ');

	const countQ = `
		SELECT COUNT(*) as total
		FROM [cp].[dbo].[taEkspedisi] e
		LEFT JOIN [cp].[dbo].[taSupplier] s ON UPPER(RTRIM(LTRIM(e.SupplierID))) = UPPER(RTRIM(LTRIM(s.CompanyID)))
		WHERE ${whereClause}
	`;

	const dataQ = `
		SELECT
			e.ekspedisiID,
			e.Nama,
			e.NoNPWP,
			e.SupplierID,
			s.CompanyName1 AS SupplierName,
			e.UserName,
			e.UserDateTime,
			e.UserUpdateName,
			e.UserUpdateDate
		FROM [cp].[dbo].[taEkspedisi] e
		LEFT JOIN [cp].[dbo].[taSupplier] s ON UPPER(RTRIM(LTRIM(e.SupplierID))) = UPPER(RTRIM(LTRIM(s.CompanyID)))
		WHERE ${whereClause}
		ORDER BY e.ekspedisiID ASC
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
		getEkspedisiStats()
	]);

	const total = countRes.recordset[0]?.total || 0;
	const rows = (dataRes.recordset || []).map(mapEkspedisiRow);
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
 * Tambah Ekspedisi Baru (Create)
 */
export async function createEkspedisi(
	payload: CreateEkspedisiPayload,
	username: string = 'system'
): Promise<MasterEkspedisi> {
	let ekspedisiID = (payload.ekspedisiID || '').trim().toUpperCase();
	const nama = (payload.Nama || '').trim();

	if (!nama) {
		throw new Error('Nama Ekspedisi wajib diisi');
	}

	if (!ekspedisiID) {
		const next = await getNextEkspedisiId(nama);
		ekspedisiID = next.nextId;
	}

	if (ekspedisiID.length > 5) {
		throw new Error('Kode Ekspedisi (ekspedisiID) maksimal 5 karakter');
	}

	const exists = await ekspedisiExists(ekspedisiID);
	if (exists) {
		throw new Error(`Kode Ekspedisi "${ekspedisiID}" sudah terdaftar. Gunakan kode lain.`);
	}

	const noNPWP = payload.NoNPWP ? payload.NoNPWP.trim().slice(0, 20) : '';
	const supplierID = payload.SupplierID ? payload.SupplierID.trim().slice(0, 8) : '';
	const user = (username || 'system').slice(0, 50);

	const insertQ = `
		INSERT INTO [cp].[dbo].[taEkspedisi] (
			ekspedisiID,
			Nama,
			NoNPWP,
			SupplierID,
			UserName,
			UserDateTime
		) VALUES (
			@ekspedisiID,
			@Nama,
			@NoNPWP,
			@SupplierID,
			@UserName,
			GETDATE()
		)
	`;

	await runQuery(insertQ, [
		{ name: 'ekspedisiID', type: sql.VarChar(5), value: ekspedisiID },
		{ name: 'Nama', type: sql.VarChar(50), value: nama.slice(0, 50) },
		{ name: 'NoNPWP', type: sql.VarChar(20), value: noNPWP },
		{ name: 'SupplierID', type: sql.VarChar(8), value: supplierID },
		{ name: 'UserName', type: sql.VarChar(50), value: user }
	]);

	const created = await getEkspedisiById(ekspedisiID);
	if (!created) throw new Error('Gagal memuat ekspedisi setelah disimpan');
	return created;
}

/**
 * Perbarui Data Ekspedisi (Update)
 */
export async function updateEkspedisi(
	ekspedisiId: string,
	payload: Partial<CreateEkspedisiPayload>,
	username: string = 'system'
): Promise<MasterEkspedisi> {
	const cleanId = ekspedisiId.trim().toUpperCase();
	const existing = await getEkspedisiById(cleanId);
	if (!existing) {
		throw new Error(`Ekspedisi dengan kode "${cleanId}" tidak ditemukan`);
	}

	const nama = payload.Nama !== undefined ? payload.Nama.trim() : existing.Nama;
	if (!nama) {
		throw new Error('Nama Ekspedisi tidak boleh kosong');
	}

	const noNPWP =
		payload.NoNPWP !== undefined
			? payload.NoNPWP
				? payload.NoNPWP.trim().slice(0, 20)
				: ''
			: existing.NoNPWP || '';
	const supplierID =
		payload.SupplierID !== undefined
			? payload.SupplierID
				? payload.SupplierID.trim().slice(0, 8)
				: ''
			: existing.SupplierID || '';
	const user = (username || 'system').slice(0, 50);

	const updateQ = `
		UPDATE [cp].[dbo].[taEkspedisi]
		SET
			Nama = @Nama,
			NoNPWP = @NoNPWP,
			SupplierID = @SupplierID,
			UserUpdateName = @UserUpdateName,
			UserUpdateDate = GETDATE()
		WHERE UPPER(RTRIM(LTRIM(ekspedisiID))) = @ekspedisiID
	`;

	await runQuery(updateQ, [
		{ name: 'ekspedisiID', type: sql.VarChar(5), value: cleanId },
		{ name: 'Nama', type: sql.VarChar(50), value: nama.slice(0, 50) },
		{ name: 'NoNPWP', type: sql.VarChar(20), value: noNPWP },
		{ name: 'SupplierID', type: sql.VarChar(8), value: supplierID },
		{ name: 'UserUpdateName', type: sql.VarChar(50), value: user }
	]);

	const updated = await getEkspedisiById(cleanId);
	if (!updated) throw new Error('Gagal memuat ekspedisi setelah diperbarui');
	return updated;
}

/**
 * Hapus Ekspedisi (Delete) dengan pengecekan integritas tabel transaksi
 */
export async function deleteEkspedisi(
	ekspedisiId: string
): Promise<{ success: boolean; message: string }> {
	const cleanId = ekspedisiId.trim().toUpperCase();
	const existing = await getEkspedisiById(cleanId);
	if (!existing) {
		throw new Error(`Ekspedisi dengan kode "${cleanId}" tidak ditemukan`);
	}

	// Pengecekan tabel transaksi yang menggunakan ekspedisiID
	const checkQ = `
		SELECT
			(SELECT COUNT(*) FROM [cp].[dbo].[taSJEkspedisi] WHERE UPPER(RTRIM(LTRIM(EkspedisiID))) = @ekspedisiID) AS countSJ,
			(SELECT COUNT(*) FROM [cp].[dbo].[taInvoiceEkspedisi] WHERE UPPER(RTRIM(LTRIM(EkspedisiID))) = @ekspedisiID) AS countInv,
			(SELECT COUNT(*) FROM [cp].[dbo].[taMoveHD] WHERE UPPER(RTRIM(LTRIM(ekspedisiID))) = @ekspedisiID) AS countMove,
			(SELECT COUNT(*) FROM [cp].[dbo].[taPriceListEkspedisi] WHERE UPPER(RTRIM(LTRIM(ekspedisiID))) = @ekspedisiID) AS countPrice,
			(SELECT COUNT(*) FROM [cp].[dbo].[taTransOHD2] WHERE UPPER(RTRIM(LTRIM(ekspedisiID))) = @ekspedisiID) AS countTransO,
			(SELECT COUNT(*) FROM [cp].[dbo].[taTransIHD2] WHERE UPPER(RTRIM(LTRIM(ekspedisiID))) = @ekspedisiID) AS countTransI,
			(SELECT COUNT(*) FROM [cp].[dbo].[taOpNameOHD] WHERE UPPER(RTRIM(LTRIM(EkspedisiID))) = @ekspedisiID) AS countOpnameO,
			(SELECT COUNT(*) FROM [cp].[dbo].[taOpNameIHD] WHERE UPPER(RTRIM(LTRIM(ekspedisiID))) = @ekspedisiID) AS countOpnameI
	`;

	const res = await runQuery(checkQ, [{ name: 'ekspedisiID', type: sql.VarChar(5), value: cleanId }]);
	const r = res.recordset[0] || {};
	const conflicts: string[] = [];

	if (Number(r.countSJ || 0) > 0) conflicts.push(`${r.countSJ} Surat Jalan Ekspedisi`);
	if (Number(r.countInv || 0) > 0) conflicts.push(`${r.countInv} Invoice Ekspedisi`);
	if (Number(r.countMove || 0) > 0) conflicts.push(`${r.countMove} Mutasi Gudang`);
	if (Number(r.countPrice || 0) > 0) conflicts.push(`${r.countPrice} Daftar Tarif (Pricelist)`);
	if (Number(r.countTransO || 0) > 0) conflicts.push(`${r.countTransO} Surat Jalan Pengiriman`);
	if (Number(r.countTransI || 0) > 0) conflicts.push(`${r.countTransI} Penerimaan Barang`);
	if (Number(r.countOpnameO || 0) > 0) conflicts.push(`${r.countOpnameO} Memo Pengeluaran`);
	if (Number(r.countOpnameI || 0) > 0) conflicts.push(`${r.countOpnameI} Memo Pemasukan`);

	if (conflicts.length > 0) {
		throw new Error(
			`Ekspedisi "${existing.Nama}" (${cleanId}) tidak dapat dihapus karena masih digunakan dalam riwayat transaksi: ${conflicts.join(', ')}.`
		);
	}

	const deleteQ = `DELETE FROM [cp].[dbo].[taEkspedisi] WHERE UPPER(RTRIM(LTRIM(ekspedisiID))) = @ekspedisiID`;
	await runQuery(deleteQ, [{ name: 'ekspedisiID', type: sql.VarChar(5), value: cleanId }]);

	return {
		success: true,
		message: `Ekspedisi "${existing.Nama}" (${cleanId}) berhasil dihapus.`
	};
}

/**
 * Generate file Excel (.xlsx) untuk daftar Master Ekspedisi
 */
export async function generateEkspedisiExcel(params: {
	q?: string;
	hasNpwp?: string;
	hasSupplier?: string;
}): Promise<Buffer> {
	const result = await getMasterEkspedisiPaged({
		...params,
		page: 1,
		pageSize: 10000
	});

	const wb = XLSX.utils.book_new();

	const aoa: any[][] = [
		['DAFTAR MASTER EKSPEDISI / KARGO PENGIRIMAN'],
		[`Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`],
		[`Total Data: ${result.total} Ekspedisi`],
		[],
		[
			'No',
			'Kode Ekspedisi',
			'Nama Ekspedisi / Kargo',
			'No. NPWP',
			'Kode Rekanan Supplier',
			'Nama Rekanan Supplier',
			'User Pembuat',
			'Waktu Dibuat',
			'User Pengubah',
			'Waktu Diubah'
		]
	];

	result.rows.forEach((e, idx) => {
		aoa.push([
			idx + 1,
			e.ekspedisiID,
			e.Nama,
			e.NoNPWP || '-',
			e.SupplierID || '-',
			e.SupplierName || '-',
			e.UserName || '-',
			e.UserDateTime ? e.UserDateTime.replace('T', ' ').slice(0, 19) : '-',
			e.UserUpdateName || '-',
			e.UserUpdateDate ? e.UserUpdateDate.replace('T', ' ').slice(0, 19) : '-'
		]);
	});

	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws['!cols'] = [
		{ wch: 6 }, // No
		{ wch: 16 }, // Kode Ekspedisi
		{ wch: 38 }, // Nama Ekspedisi
		{ wch: 24 }, // No. NPWP
		{ wch: 22 }, // Kode Supplier
		{ wch: 36 }, // Nama Supplier
		{ wch: 16 }, // User Pembuat
		{ wch: 20 }, // Waktu Dibuat
		{ wch: 16 }, // User Pengubah
		{ wch: 20 } // Waktu Diubah
	];

	XLSX.utils.book_append_sheet(wb, ws, 'Master Ekspedisi');
	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
