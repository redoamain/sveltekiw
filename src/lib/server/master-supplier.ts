import { runQuery, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface MasterSupplier {
	CompanyID: string;
	CompanyName1: string;
	CompanyName2: string | null;
	Address1: string | null;
	Address2: string | null;
	City: string | null;
	Provinsi: string | null;
	Negara: string | null;
	PostalCode: string | null;
	Phone1: string | null;
	Phone2: string | null;
	Fax1: string | null;
	Email: string | null;
	Contact1: string | null;
	Job1: string | null;
	TaxID: string | null;
	Curr: string | null;
	Status: string | null;
	Import: boolean;
	NonLokal: boolean;
	Bank: string | null;
	NoRek: string | null;
	NamaRek: string | null;
	NotePurchasing: string | null;
	Username: string | null;
	Userdatetime: string | null;
	UserUpdateName: string | null;
	UserUpdateTime: string | null;
}

export interface CreateSupplierPayload {
	CompanyID?: string;
	CompanyName1: string;
	CompanyName2?: string | null;
	Address1?: string | null;
	Address2?: string | null;
	City?: string | null;
	Provinsi?: string | null;
	Negara?: string | null;
	PostalCode?: string | null;
	Phone1?: string | null;
	Phone2?: string | null;
	Fax1?: string | null;
	Email?: string | null;
	Contact1?: string | null;
	Job1?: string | null;
	TaxID?: string | null;
	Curr?: string | null;
	Status?: string | null;
	Import?: boolean;
	NonLokal?: boolean;
	Bank?: string | null;
	NoRek?: string | null;
	NamaRek?: string | null;
	NotePurchasing?: string | null;
}

export interface SupplierSummaryStats {
	total: number;
	totalLokal: number;
	totalImport: number;
	totalIDR: number;
	totalValas: number;
}

export interface SupplierPagedResult {
	rows: MasterSupplier[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	stats: SupplierSummaryStats;
}

function mapSupplierRow(r: any): MasterSupplier {
	return {
		CompanyID: String(r.CompanyID || '').trim(),
		CompanyName1: String(r.CompanyName1 || '').trim(),
		CompanyName2: r.CompanyName2 != null ? String(r.CompanyName2).trim() : null,
		Address1: r.Address1 != null ? String(r.Address1).trim() : null,
		Address2: r.Address2 != null ? String(r.Address2).trim() : null,
		City: r.City != null ? String(r.City).trim() : null,
		Provinsi: r.Provinsi != null ? String(r.Provinsi).trim() : null,
		Negara: r.Negara != null ? String(r.Negara).trim() : 'INDONESIA',
		PostalCode: r.PostalCode != null ? String(r.PostalCode).trim() : null,
		Phone1: r.Phone1 != null ? String(r.Phone1).trim() : null,
		Phone2: r.Phone2 != null ? String(r.Phone2).trim() : null,
		Fax1: r.Fax1 != null ? String(r.Fax1).trim() : null,
		Email: r.Email != null ? String(r.Email).trim() : null,
		Contact1: r.Contact1 != null ? String(r.Contact1).trim() : null,
		Job1: r.Job1 != null ? String(r.Job1).trim() : null,
		TaxID: r.TaxID != null ? String(r.TaxID).trim() : null,
		Curr: r.Curr != null ? String(r.Curr).trim() : 'IDR',
		Status: r.Status != null ? String(r.Status).trim() : null,
		Import: Boolean(r.Import),
		NonLokal: Boolean(r.NonLokal),
		Bank: r.Bank != null ? String(r.Bank).trim() : null,
		NoRek: r.NoRek != null ? String(r.NoRek).trim() : null,
		NamaRek: r.NamaRek != null ? String(r.NamaRek).trim() : null,
		NotePurchasing: r.NotePurchasing != null ? String(r.NotePurchasing).trim() : null,
		Username: r.Username != null ? String(r.Username).trim() : null,
		Userdatetime: r.Userdatetime instanceof Date ? r.Userdatetime.toISOString() : r.Userdatetime != null ? String(r.Userdatetime) : null,
		UserUpdateName: r.UserUpdateName != null ? String(r.UserUpdateName).trim() : null,
		UserUpdateTime: r.UserUpdateTime instanceof Date ? r.UserUpdateTime.toISOString() : r.UserUpdateTime != null ? String(r.UserUpdateTime) : null
	};
}

/**
 * Ambil CompanyID terakhir dan buat CompanyID otomatis berikutnya berdasarkan pola S0000xxx
 */
export async function getLastSupplierId(): Promise<{ lastId: string | null; nextId: string }> {
	try {
		const q = `
			SELECT TOP 1
				CompanyID,
				TRY_CAST(SUBSTRING(CompanyID, 2, 10) AS INT) AS num
			FROM [cp].[dbo].[taSupplier]
			WHERE TRY_CAST(SUBSTRING(CompanyID, 2, 10) AS INT) IS NOT NULL
			ORDER BY num DESC
		`;
		const res = await runQuery(q);
		const lastRow = res.recordset[0];
		const lastId = lastRow?.CompanyID ? String(lastRow.CompanyID).trim() : null;
		const lastNum = lastRow?.num;
		const nextNum = (typeof lastNum === 'number' && !isNaN(lastNum) ? lastNum : 0) + 1;
		const nextId = `S${String(nextNum).padStart(7, '0')}`;
		return { lastId, nextId };
	} catch (err) {
		log.warn({ err }, 'Gagal mengambil nomor urut supplier berikutnya, fallback ke S0000001');
		return { lastId: null, nextId: 'S0000001' };
	}
}

/**
 * Generate CompanyID otomatis berikutnya berdasarkan pola S0000xxx
 */
export async function getNextSupplierId(): Promise<string> {
	const info = await getLastSupplierId();
	return info.nextId;
}

/**
 * Cek apakah CompanyID sudah terdaftar
 */
export async function supplierExists(companyId: string): Promise<boolean> {
	const clean = companyId.trim().toUpperCase();
	const q = `SELECT TOP 1 1 FROM [cp].[dbo].[taSupplier] WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID`;
	const res = await runQuery(q, [{ name: 'CompanyID', type: sql.VarChar(8), value: clean }]);
	return (res.recordset.length || 0) > 0;
}

/**
 * Ambil data 1 Supplier berdasarkan CompanyID
 */
export async function getSupplierById(companyId: string): Promise<MasterSupplier | null> {
	const clean = companyId.trim().toUpperCase();
	const q = `
		SELECT TOP 1
			CompanyID, CompanyName1, CompanyName2, Address1, Address2,
			City, Provinsi, Negara, PostalCode, Phone1, Phone2, Fax1,
			Email, Contact1, Job1, TaxID, Curr, Status, Import, NonLokal,
			Bank, NoRek, NamaRek, NotePurchasing,
			Username, Userdatetime, UserUpdateName, UserUpdateTime
		FROM [cp].[dbo].[taSupplier]
		WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID
	`;
	const res = await runQuery(q, [{ name: 'CompanyID', type: sql.VarChar(8), value: clean }]);
	if (!res.recordset || res.recordset.length === 0) return null;
	return mapSupplierRow(res.recordset[0]);
}

/**
 * Ambil daftar ringkasan statistik supplier untuk card metric
 */
export async function getSupplierStats(): Promise<SupplierSummaryStats> {
	try {
		const q = `
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN Import = 1 OR Status LIKE '%Luar Negeri%' OR Status LIKE '%LDP%' THEN 1 ELSE 0 END) as totalImport,
				SUM(CASE WHEN (Import = 0 OR Import IS NULL) AND (Status IS NULL OR Status NOT LIKE '%Luar Negeri%') THEN 1 ELSE 0 END) as totalLokal,
				SUM(CASE WHEN Curr = 'IDR' OR Curr IS NULL THEN 1 ELSE 0 END) as totalIDR,
				SUM(CASE WHEN Curr IS NOT NULL AND Curr <> 'IDR' THEN 1 ELSE 0 END) as totalValas
			FROM [cp].[dbo].[taSupplier]
		`;
		const res = await runQuery(q);
		const r = res.recordset[0] || {};
		return {
			total: Number(r.total || 0),
			totalImport: Number(r.totalImport || 0),
			totalLokal: Number(r.totalLokal || 0),
			totalIDR: Number(r.totalIDR || 0),
			totalValas: Number(r.totalValas || 0)
		};
	} catch (err) {
		log.error({ err }, 'Gagal menghitung statistik master supplier');
		return { total: 0, totalLokal: 0, totalImport: 0, totalIDR: 0, totalValas: 0 };
	}
}

/**
 * Mengambil daftar master supplier dengan pagination, search, dan filter
 */
export async function getMasterSuppliersPaged(params: {
	q?: string;
	status?: string;
	curr?: string;
	page?: number;
	pageSize?: number;
}): Promise<SupplierPagedResult> {
	const page = Math.max(1, params.page || 1);
	const pageSize = Math.max(10, Math.min(200, params.pageSize || 50));
	const offset = (page - 1) * pageSize;

	const search = (params.q || '').trim();
	const statusFilter = (params.status || '').trim();
	const currFilter = (params.curr || '').trim().toUpperCase();

	const conditions: string[] = ['1=1'];
	const inputs: { name: string; type: any; value: any }[] = [];

	if (search) {
		conditions.push(`(
			s.CompanyID LIKE @search OR
			s.CompanyName1 LIKE @search OR
			s.City LIKE @search OR
			s.Contact1 LIKE @search OR
			s.Phone1 LIKE @search OR
			s.TaxID LIKE @search OR
			s.Email LIKE @search
		)`);
		inputs.push({ name: 'search', type: sql.NVarChar(120), value: `%${search}%` });
	}

	if (statusFilter) {
		if (statusFilter === 'IMPORT') {
			conditions.push(`(s.Import = 1 OR s.Status LIKE '%Luar Negeri%' OR s.Status LIKE '%LDP%')`);
		} else if (statusFilter === 'LOKAL') {
			conditions.push(`((s.Import = 0 OR s.Import IS NULL) AND (s.Status IS NULL OR s.Status NOT LIKE '%Luar Negeri%'))`);
		} else {
			conditions.push(`s.Status = @statusFilter`);
			inputs.push({ name: 'statusFilter', type: sql.VarChar(20), value: statusFilter });
		}
	}

	if (currFilter) {
		conditions.push(`s.Curr = @currFilter`);
		inputs.push({ name: 'currFilter', type: sql.VarChar(3), value: currFilter });
	}

	const whereClause = conditions.join(' AND ');

	const countQ = `
		SELECT COUNT(*) as total
		FROM [cp].[dbo].[taSupplier] s
		WHERE ${whereClause}
	`;

	const dataQ = `
		SELECT 
			s.CompanyID, s.CompanyName1, s.CompanyName2, s.Address1, s.Address2,
			s.City, s.Provinsi, s.Negara, s.PostalCode, s.Phone1, s.Phone2, s.Fax1,
			s.Email, s.Contact1, s.Job1, s.TaxID, s.Curr, s.Status, s.Import, s.NonLokal,
			s.Bank, s.NoRek, s.NamaRek, s.NotePurchasing,
			s.Username, s.Userdatetime, s.UserUpdateName, s.UserUpdateTime
		FROM [cp].[dbo].[taSupplier] s
		WHERE ${whereClause}
		ORDER BY s.CompanyID DESC
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
		getSupplierStats()
	]);

	const total = countRes.recordset[0]?.total || 0;
	const rows = (dataRes.recordset || []).map(mapSupplierRow);
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
 * Tambah Supplier Baru (Create)
 */
export async function createSupplier(
	payload: CreateSupplierPayload,
	username: string = 'system'
): Promise<MasterSupplier> {
	let companyId = (payload.CompanyID || '').trim().toUpperCase();
	if (!companyId) {
		companyId = await getNextSupplierId();
	}

	if (companyId.length > 8) {
		throw new Error('Kode Supplier (CompanyID) maksimal 8 karakter');
	}

	const companyName = (payload.CompanyName1 || '').trim();
	if (!companyName) {
		throw new Error('Nama Perusahaan / Supplier wajib diisi');
	}

	const exists = await supplierExists(companyId);
	if (exists) {
		throw new Error(`Kode Supplier "${companyId}" sudah ada dalam database. Gunakan kode lain.`);
	}

	const companyName2 = payload.CompanyName2?.trim().slice(0, 5) || null;
	const address1 = payload.Address1?.trim().slice(0, 255) || null;
	const address2 = payload.Address2?.trim().slice(0, 255) || null;
	const city = payload.City?.trim().slice(0, 100) || null;
	const provinsi = payload.Provinsi?.trim().slice(0, 100) || null;
	const negara = payload.Negara?.trim().slice(0, 100) || 'INDONESIA';
	const postalCode = payload.PostalCode?.trim().slice(0, 5) || null;
	const phone1 = payload.Phone1?.trim().slice(0, 15) || null;
	const phone2 = payload.Phone2?.trim().slice(0, 15) || null;
	const fax1 = payload.Fax1?.trim().slice(0, 15) || null;
	const email = payload.Email?.trim().slice(0, 40) || null;
	const contact1 = payload.Contact1?.trim().slice(0, 15) || null;
	const job1 = payload.Job1?.trim().slice(0, 15) || null;
	const taxId = payload.TaxID?.trim().slice(0, 25) || null;
	const curr = (payload.Curr || 'IDR').trim().toUpperCase().slice(0, 3);
	const status = payload.Status?.trim().slice(0, 20) || (payload.Import ? 'LDP/Luar Negeri' : 'TLDDP/Lokal');
	const isImport = Boolean(payload.Import);
	const isNonLokal = Boolean(payload.NonLokal || payload.Import);
	const bank = payload.Bank?.trim().slice(0, 20) || null;
	const noRek = payload.NoRek?.trim().slice(0, 30) || null;
	const namaRek = payload.NamaRek?.trim().slice(0, 50) || null;
	const notePurchasing = payload.NotePurchasing?.trim() || null;
	const user = (username || 'system').slice(0, 50);

	const insertQ = `
		INSERT INTO [cp].[dbo].[taSupplier] (
			CompanyID, CompanyName1, CompanyName2, Address1, Address2,
			City, Provinsi, Negara, PostalCode, Phone1, Phone2, Fax1,
			Email, Contact1, Job1, TaxID, Curr, Status, Import, NonLokal,
			Bank, NoRek, NamaRek, NotePurchasing,
			Username, Userdatetime
		) VALUES (
			@CompanyID, @CompanyName1, @CompanyName2, @Address1, @Address2,
			@City, @Provinsi, @Negara, @PostalCode, @Phone1, @Phone2, @Fax1,
			@Email, @Contact1, @Job1, @TaxID, @Curr, @Status, @Import, @NonLokal,
			@Bank, @NoRek, @NamaRek, @NotePurchasing,
			@Username, GETDATE()
		)
	`;

	await runQuery(insertQ, [
		{ name: 'CompanyID', type: sql.VarChar(8), value: companyId },
		{ name: 'CompanyName1', type: sql.VarChar(100), value: companyName },
		{ name: 'CompanyName2', type: sql.VarChar(5), value: companyName2 },
		{ name: 'Address1', type: sql.VarChar(255), value: address1 },
		{ name: 'Address2', type: sql.VarChar(255), value: address2 },
		{ name: 'City', type: sql.VarChar(100), value: city },
		{ name: 'Provinsi', type: sql.VarChar(100), value: provinsi },
		{ name: 'Negara', type: sql.VarChar(100), value: negara },
		{ name: 'PostalCode', type: sql.VarChar(5), value: postalCode },
		{ name: 'Phone1', type: sql.VarChar(15), value: phone1 },
		{ name: 'Phone2', type: sql.VarChar(15), value: phone2 },
		{ name: 'Fax1', type: sql.VarChar(15), value: fax1 },
		{ name: 'Email', type: sql.VarChar(40), value: email },
		{ name: 'Contact1', type: sql.VarChar(15), value: contact1 },
		{ name: 'Job1', type: sql.VarChar(15), value: job1 },
		{ name: 'TaxID', type: sql.VarChar(25), value: taxId },
		{ name: 'Curr', type: sql.VarChar(3), value: curr },
		{ name: 'Status', type: sql.VarChar(20), value: status },
		{ name: 'Import', type: sql.Bit, value: isImport ? 1 : 0 },
		{ name: 'NonLokal', type: sql.Bit, value: isNonLokal ? 1 : 0 },
		{ name: 'Bank', type: sql.VarChar(20), value: bank },
		{ name: 'NoRek', type: sql.VarChar(30), value: noRek },
		{ name: 'NamaRek', type: sql.VarChar(50), value: namaRek },
		{ name: 'NotePurchasing', type: sql.NVarChar(sql.MAX), value: notePurchasing },
		{ name: 'Username', type: sql.VarChar(50), value: user }
	]);

	const created = await getSupplierById(companyId);
	if (!created) throw new Error('Gagal memuat supplier setelah disimpan');
	return created;
}

/**
 * Perbarui Data Supplier (Update)
 */
export async function updateSupplier(
	companyId: string,
	payload: Partial<CreateSupplierPayload>,
	username: string = 'system'
): Promise<MasterSupplier> {
	const cleanId = companyId.trim().toUpperCase();
	const existing = await getSupplierById(cleanId);
	if (!existing) {
		throw new Error(`Supplier dengan kode "${cleanId}" tidak ditemukan`);
	}

	const companyName = payload.CompanyName1 !== undefined ? payload.CompanyName1.trim() : existing.CompanyName1;
	if (!companyName) {
		throw new Error('Nama Perusahaan / Supplier tidak boleh kosong');
	}

	const companyName2 = payload.CompanyName2 !== undefined ? (payload.CompanyName2?.trim().slice(0, 5) || null) : existing.CompanyName2;
	const address1 = payload.Address1 !== undefined ? (payload.Address1?.trim().slice(0, 255) || null) : existing.Address1;
	const address2 = payload.Address2 !== undefined ? (payload.Address2?.trim().slice(0, 255) || null) : existing.Address2;
	const city = payload.City !== undefined ? (payload.City?.trim().slice(0, 100) || null) : existing.City;
	const provinsi = payload.Provinsi !== undefined ? (payload.Provinsi?.trim().slice(0, 100) || null) : existing.Provinsi;
	const negara = payload.Negara !== undefined ? (payload.Negara?.trim().slice(0, 100) || 'INDONESIA') : existing.Negara;
	const postalCode = payload.PostalCode !== undefined ? (payload.PostalCode?.trim().slice(0, 5) || null) : existing.PostalCode;
	const phone1 = payload.Phone1 !== undefined ? (payload.Phone1?.trim().slice(0, 15) || null) : existing.Phone1;
	const phone2 = payload.Phone2 !== undefined ? (payload.Phone2?.trim().slice(0, 15) || null) : existing.Phone2;
	const fax1 = payload.Fax1 !== undefined ? (payload.Fax1?.trim().slice(0, 15) || null) : existing.Fax1;
	const email = payload.Email !== undefined ? (payload.Email?.trim().slice(0, 40) || null) : existing.Email;
	const contact1 = payload.Contact1 !== undefined ? (payload.Contact1?.trim().slice(0, 15) || null) : existing.Contact1;
	const job1 = payload.Job1 !== undefined ? (payload.Job1?.trim().slice(0, 15) || null) : existing.Job1;
	const taxId = payload.TaxID !== undefined ? (payload.TaxID?.trim().slice(0, 25) || null) : existing.TaxID;
	const curr = payload.Curr !== undefined ? (payload.Curr?.trim().toUpperCase().slice(0, 3) || 'IDR') : existing.Curr;
	const status = payload.Status !== undefined ? (payload.Status?.trim().slice(0, 20) || null) : existing.Status;
	const isImport = payload.Import !== undefined ? Boolean(payload.Import) : existing.Import;
	const isNonLokal = payload.NonLokal !== undefined ? Boolean(payload.NonLokal) : existing.NonLokal;
	const bank = payload.Bank !== undefined ? (payload.Bank?.trim().slice(0, 20) || null) : existing.Bank;
	const noRek = payload.NoRek !== undefined ? (payload.NoRek?.trim().slice(0, 30) || null) : existing.NoRek;
	const namaRek = payload.NamaRek !== undefined ? (payload.NamaRek?.trim().slice(0, 50) || null) : existing.NamaRek;
	const notePurchasing = payload.NotePurchasing !== undefined ? (payload.NotePurchasing?.trim() || null) : existing.NotePurchasing;
	const user = (username || 'system').slice(0, 50);

	const updateQ = `
		UPDATE [cp].[dbo].[taSupplier]
		SET
			CompanyName1 = @CompanyName1,
			CompanyName2 = @CompanyName2,
			Address1 = @Address1,
			Address2 = @Address2,
			City = @City,
			Provinsi = @Provinsi,
			Negara = @Negara,
			PostalCode = @PostalCode,
			Phone1 = @Phone1,
			Phone2 = @Phone2,
			Fax1 = @Fax1,
			Email = @Email,
			Contact1 = @Contact1,
			Job1 = @Job1,
			TaxID = @TaxID,
			Curr = @Curr,
			Status = @Status,
			Import = @Import,
			NonLokal = @NonLokal,
			Bank = @Bank,
			NoRek = @NoRek,
			NamaRek = @NamaRek,
			NotePurchasing = @NotePurchasing,
			UserUpdateName = @UserUpdateName,
			UserUpdateTime = GETDATE()
		WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID
	`;

	await runQuery(updateQ, [
		{ name: 'CompanyID', type: sql.VarChar(8), value: cleanId },
		{ name: 'CompanyName1', type: sql.VarChar(100), value: companyName },
		{ name: 'CompanyName2', type: sql.VarChar(5), value: companyName2 },
		{ name: 'Address1', type: sql.VarChar(255), value: address1 },
		{ name: 'Address2', type: sql.VarChar(255), value: address2 },
		{ name: 'City', type: sql.VarChar(100), value: city },
		{ name: 'Provinsi', type: sql.VarChar(100), value: provinsi },
		{ name: 'Negara', type: sql.VarChar(100), value: negara },
		{ name: 'PostalCode', type: sql.VarChar(5), value: postalCode },
		{ name: 'Phone1', type: sql.VarChar(15), value: phone1 },
		{ name: 'Phone2', type: sql.VarChar(15), value: phone2 },
		{ name: 'Fax1', type: sql.VarChar(15), value: fax1 },
		{ name: 'Email', type: sql.VarChar(40), value: email },
		{ name: 'Contact1', type: sql.VarChar(15), value: contact1 },
		{ name: 'Job1', type: sql.VarChar(15), value: job1 },
		{ name: 'TaxID', type: sql.VarChar(25), value: taxId },
		{ name: 'Curr', type: sql.VarChar(3), value: curr },
		{ name: 'Status', type: sql.VarChar(20), value: status },
		{ name: 'Import', type: sql.Bit, value: isImport ? 1 : 0 },
		{ name: 'NonLokal', type: sql.Bit, value: isNonLokal ? 1 : 0 },
		{ name: 'Bank', type: sql.VarChar(20), value: bank },
		{ name: 'NoRek', type: sql.VarChar(30), value: noRek },
		{ name: 'NamaRek', type: sql.VarChar(50), value: namaRek },
		{ name: 'NotePurchasing', type: sql.NVarChar(sql.MAX), value: notePurchasing },
		{ name: 'UserUpdateName', type: sql.VarChar(50), value: user }
	]);

	const updated = await getSupplierById(cleanId);
	if (!updated) throw new Error('Gagal memuat supplier setelah diperbarui');
	return updated;
}

/**
 * Hapus Supplier (Delete) dengan pengecekan integritas referensi transaksi
 */
export async function deleteSupplier(companyId: string): Promise<{ success: boolean; message: string }> {
	const cleanId = companyId.trim().toUpperCase();
	const existing = await getSupplierById(cleanId);
	if (!existing) {
		throw new Error(`Supplier dengan kode "${cleanId}" tidak ditemukan`);
	}

	// Pengecekan tabel transaksi yang menggunakan CompanyID
	const checkQ = `
		SELECT
			(SELECT COUNT(*) FROM [cp].[dbo].[taPOHd] WHERE CompanyID = @CompanyID) AS poCount,
			(SELECT COUNT(*) FROM [cp].[dbo].[taTransIHD2] WHERE CompanyID = @CompanyID) AS penerimaanCount,
			(SELECT COUNT(*) FROM [cp].[dbo].[taTransIHD] WHERE CompanyID = @CompanyID) AS penerimaanLamaCount,
			(SELECT COUNT(*) FROM [cp].[dbo].[taGLPayDT] WHERE CompanyID = @CompanyID) AS paymentCount,
			(SELECT COUNT(*) FROM [cp].[dbo].[taReturOHD2] WHERE CompanyID = @CompanyID) AS returCount
	`;

	const checkRes = await runQuery(checkQ, [{ name: 'CompanyID', type: sql.VarChar(8), value: cleanId }]);
	const counts = checkRes.recordset[0] || {};
	const reasons: string[] = [];

	if (counts.poCount > 0) reasons.push(`${counts.poCount} Purchase Order (taPOHd)`);
	if (counts.penerimaanCount > 0) reasons.push(`${counts.penerimaanCount} Penerimaan Barang (taTransIHD2)`);
	if (counts.penerimaanLamaCount > 0) reasons.push(`${counts.penerimaanLamaCount} Penerimaan Arsip (taTransIHD)`);
	if (counts.paymentCount > 0) reasons.push(`${counts.paymentCount} Transaksi Pembayaran (taGLPayDT)`);
	if (counts.returCount > 0) reasons.push(`${counts.returCount} Retur Pembelian (taReturOHD2)`);

	if (reasons.length > 0) {
		throw new Error(
			`Supplier "${existing.CompanyName1}" (${cleanId}) tidak dapat dihapus karena telah tercatat dalam riwayat transaksi ERP: ${reasons.join(', ')}. Demi integritas data akuntansi, supplier ini tidak boleh dihapus.`
		);
	}

	const deleteQ = `DELETE FROM [cp].[dbo].[taSupplier] WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID`;
	await runQuery(deleteQ, [{ name: 'CompanyID', type: sql.VarChar(8), value: cleanId }]);

	return {
		success: true,
		message: `Supplier "${existing.CompanyName1}" (${cleanId}) berhasil dihapus dari Master Data.`
	};
}

/**
 * Export data master supplier ke format Excel Buffer
 */
export async function generateSuppliersExcel(params: {
	q?: string;
	status?: string;
	curr?: string;
}): Promise<Buffer> {
	// Ambil semua data sesuai filter (maksimum 5000)
	const result = await getMasterSuppliersPaged({
		...params,
		page: 1,
		pageSize: 5000
	});

	const wb = XLSX.utils.book_new();

	const aoa: any[][] = [
		['MASTER DATA SUPPLIER / PEMASOK'],
		[`Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`],
		[`Total Data: ${result.rows.length} Supplier`],
		[],
		[
			'No',
			'Kode Supplier',
			'Nama Perusahaan / Supplier',
			'Singkatan',
			'Mata Uang',
			'Status Pasar',
			'Impor?',
			'PIC / Kontak',
			'Jabatan',
			'No. Telepon',
			'No. Fax',
			'Email',
			'Alamat Utama',
			'Kota',
			'Provinsi',
			'Negara',
			'Kode Pos',
			'NPWP',
			'Bank',
			'No. Rekening',
			'Atas Nama Rekening',
			'Catatan Purchasing',
			'User Pembuat',
			'Waktu Dibuat',
			'User Pengubah',
			'Waktu Diubah'
		]
	];

	result.rows.forEach((s, idx) => {
		aoa.push([
			idx + 1,
			s.CompanyID,
			s.CompanyName1,
			s.CompanyName2 || '-',
			s.Curr || 'IDR',
			s.Status || (s.Import ? 'LDP/Luar Negeri' : 'TLDDP/Lokal'),
			s.Import ? 'YA' : 'TIDAK',
			s.Contact1 || '-',
			s.Job1 || '-',
			s.Phone1 || '-',
			s.Fax1 || '-',
			s.Email || '-',
			s.Address1 || '-',
			s.City || '-',
			s.Provinsi || '-',
			s.Negara || 'INDONESIA',
			s.PostalCode || '-',
			s.TaxID || '-',
			s.Bank || '-',
			s.NoRek || '-',
			s.NamaRek || '-',
			s.NotePurchasing || '-',
			s.Username || '-',
			s.Userdatetime ? s.Userdatetime.replace('T', ' ').slice(0, 19) : '-',
			s.UserUpdateName || '-',
			s.UserUpdateTime ? s.UserUpdateTime.replace('T', ' ').slice(0, 19) : '-'
		]);
	});

	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws['!cols'] = [
		{ wch: 6 },  // No
		{ wch: 14 }, // Kode
		{ wch: 38 }, // Nama
		{ wch: 10 }, // Singkatan
		{ wch: 10 }, // Curr
		{ wch: 18 }, // Status
		{ wch: 10 }, // Impor
		{ wch: 18 }, // Contact
		{ wch: 16 }, // Jabatan
		{ wch: 18 }, // Phone
		{ wch: 16 }, // Fax
		{ wch: 28 }, // Email
		{ wch: 40 }, // Alamat
		{ wch: 18 }, // Kota
		{ wch: 18 }, // Provinsi
		{ wch: 16 }, // Negara
		{ wch: 10 }, // Pos
		{ wch: 22 }, // NPWP
		{ wch: 16 }, // Bank
		{ wch: 22 }, // No Rek
		{ wch: 28 }, // Nama Rek
		{ wch: 30 }, // Note
		{ wch: 16 }, // User
		{ wch: 20 }, // Userdatetime
		{ wch: 16 }, // UserUpdate
		{ wch: 20 }  // UserUpdateTime
	];

	XLSX.utils.book_append_sheet(wb, ws, 'Master Supplier');
	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
