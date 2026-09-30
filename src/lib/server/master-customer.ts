import { runQuery, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface MasterCustomer {
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
	Export: boolean;
	Consigne: boolean;
	Delisted: boolean;
	Plafon: number | null;
	Due: number | null;
	NoteMarketing: string | null;
	NoteFinance: string | null;
	UserName: string | null;
	UserDatetime: string | null;
	UserUpdateName: string | null;
	UserUpdateTime: string | null;
}

export interface CreateCustomerPayload {
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
	Export?: boolean;
	Consigne?: boolean;
	Delisted?: boolean;
	Plafon?: number | null;
	Due?: number | null;
	NoteMarketing?: string | null;
	NoteFinance?: string | null;
}

export interface CustomerSummaryStats {
	total: number;
	totalLokal: number;
	totalExport: number;
	totalConsigne: number;
	totalActive: number;
	totalDelisted: number;
	totalIDR: number;
	totalValas: number;
}

export interface CustomerPagedResult {
	rows: MasterCustomer[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	stats: CustomerSummaryStats;
}

export interface MasterConsigne {
	Consigne: string;
	ConsigneID: string | null;
	TargetHari: number | null;
}

function mapCustomerRow(r: any): MasterCustomer {
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
		Export: Boolean(r.Export),
		Consigne: Boolean(r.Consigne),
		Delisted: Boolean(r.Delisted),
		Plafon: r.Plafon != null ? Number(r.Plafon) : null,
		Due: r.Due != null ? Number(r.Due) : null,
		NoteMarketing: r.NoteMarketing != null ? String(r.NoteMarketing).trim() : null,
		NoteFinance: r.NoteFinance != null ? String(r.NoteFinance).trim() : null,
		UserName: r.UserName != null ? String(r.UserName).trim() : null,
		UserDatetime: r.UserDatetime instanceof Date ? r.UserDatetime.toISOString() : r.UserDatetime != null ? String(r.UserDatetime) : null,
		UserUpdateName: r.UserUpdateName != null ? String(r.UserUpdateName).trim() : null,
		UserUpdateTime: r.UserUpdateTime instanceof Date ? r.UserUpdateTime.toISOString() : r.UserUpdateTime != null ? String(r.UserUpdateTime) : null
	};
}

/**
 * Ambil CompanyID terakhir dan buat CompanyID otomatis berikutnya berdasarkan pola P0001 - P9999
 */
export async function getLastCustomerId(): Promise<{ lastId: string | null; nextId: string }> {
	try {
		const q = `
			SELECT TOP 1
				CompanyID,
				TRY_CAST(SUBSTRING(CompanyID, 2, 10) AS INT) AS num
			FROM [cp].[dbo].[taCustomer]
			WHERE CompanyID LIKE 'P[0-9][0-9][0-9][0-9]'
			ORDER BY TRY_CAST(SUBSTRING(CompanyID, 2, 10) AS INT) DESC
		`;
		const res = await runQuery(q);
		const lastRow = res.recordset[0];
		const lastId = lastRow?.CompanyID ? String(lastRow.CompanyID).trim() : null;
		const lastNum = lastRow?.num;
		const nextNum = (typeof lastNum === 'number' && !isNaN(lastNum) ? lastNum : 0) + 1;
		const nextId = `P${String(nextNum).padStart(4, '0')}`;
		return { lastId, nextId };
	} catch (err) {
		log.warn({ err }, 'Gagal mengambil nomor urut customer berikutnya, fallback ke P0001');
		return { lastId: null, nextId: 'P0001' };
	}
}

/**
 * Generate CompanyID otomatis berikutnya berdasarkan pola P0001
 */
export async function getNextCustomerId(): Promise<string> {
	const info = await getLastCustomerId();
	return info.nextId;
}

/**
 * Cek apakah CompanyID customer sudah terdaftar
 */
export async function customerExists(companyId: string): Promise<boolean> {
	const clean = companyId.trim().toUpperCase();
	const q = `SELECT TOP 1 1 FROM [cp].[dbo].[taCustomer] WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID`;
	const res = await runQuery(q, [{ name: 'CompanyID', type: sql.VarChar(8), value: clean }]);
	return (res.recordset.length || 0) > 0;
}

/**
 * Ambil data 1 Customer berdasarkan CompanyID
 */
export async function getCustomerById(companyId: string): Promise<MasterCustomer | null> {
	const clean = companyId.trim().toUpperCase();
	const q = `
		SELECT TOP 1
			CompanyID, CompanyName1, CompanyName2, Address1, Address2,
			City, Provinsi, Negara, PostalCode, Phone1, Phone2, Fax1,
			Email, Contact1, Job1, TaxID, Curr, Status, Export, Consigne, Delisted,
			Plafon, Due, NoteMarketing, NoteFinance,
			UserName, UserDatetime, UserUpdateName, UserUpdateTime
		FROM [cp].[dbo].[taCustomer]
		WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID
	`;
	const res = await runQuery(q, [{ name: 'CompanyID', type: sql.VarChar(8), value: clean }]);
	if (!res.recordset || res.recordset.length === 0) return null;
	return mapCustomerRow(res.recordset[0]);
}

/**
 * Ambil daftar ringkasan statistik customer untuk card metrics
 */
export async function getCustomerStats(): Promise<CustomerSummaryStats> {
	try {
		const q = `
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN Export = 1 THEN 1 ELSE 0 END) as totalExport,
				SUM(CASE WHEN Export = 0 OR Export IS NULL THEN 1 ELSE 0 END) as totalLokal,
				SUM(CASE WHEN Consigne = 1 THEN 1 ELSE 0 END) as totalConsigne,
				SUM(CASE WHEN Delisted = 0 OR Delisted IS NULL THEN 1 ELSE 0 END) as totalActive,
				SUM(CASE WHEN Delisted = 1 THEN 1 ELSE 0 END) as totalDelisted,
				SUM(CASE WHEN Curr = 'IDR' OR Curr IS NULL THEN 1 ELSE 0 END) as totalIDR,
				SUM(CASE WHEN Curr IS NOT NULL AND Curr <> 'IDR' THEN 1 ELSE 0 END) as totalValas
			FROM [cp].[dbo].[taCustomer]
		`;
		const res = await runQuery(q);
		const r = res.recordset[0] || {};
		return {
			total: Number(r.total || 0),
			totalExport: Number(r.totalExport || 0),
			totalLokal: Number(r.totalLokal || 0),
			totalConsigne: Number(r.totalConsigne || 0),
			totalActive: Number(r.totalActive || 0),
			totalDelisted: Number(r.totalDelisted || 0),
			totalIDR: Number(r.totalIDR || 0),
			totalValas: Number(r.totalValas || 0)
		};
	} catch (err) {
		log.error({ err }, 'Gagal menghitung statistik master customer');
		return {
			total: 0,
			totalExport: 0,
			totalLokal: 0,
			totalConsigne: 0,
			totalActive: 0,
			totalDelisted: 0,
			totalIDR: 0,
			totalValas: 0
		};
	}
}

/**
 * Mengambil daftar master customer dengan pagination, search, dan filter
 */
export async function getMasterCustomersPaged(params: {
	q?: string;
	status?: string;
	curr?: string;
	page?: number;
	pageSize?: number;
}): Promise<CustomerPagedResult> {
	const page = Math.max(1, params.page || 1);
	const pageSize = Math.max(10, Math.min(200, params.pageSize || 50));
	const offset = (page - 1) * pageSize;

	const search = (params.q || '').trim();
	const statusFilter = (params.status || '').trim().toUpperCase();
	const currFilter = (params.curr || '').trim().toUpperCase();

	const conditions: string[] = ['1=1'];
	const inputs: { name: string; type: any; value: any }[] = [];

	if (search) {
		conditions.push(`(
			c.CompanyID LIKE @search OR
			c.CompanyName1 LIKE @search OR
			c.CompanyName2 LIKE @search OR
			c.City LIKE @search OR
			c.Contact1 LIKE @search OR
			c.Phone1 LIKE @search OR
			c.TaxID LIKE @search OR
			c.Email LIKE @search
		)`);
		inputs.push({ name: 'search', type: sql.NVarChar(120), value: `%${search}%` });
	}

	if (statusFilter) {
		if (statusFilter === 'EKSPOR') {
			conditions.push(`c.Export = 1`);
		} else if (statusFilter === 'LOKAL') {
			conditions.push(`(c.Export = 0 OR c.Export IS NULL)`);
		} else if (statusFilter === 'CONSIGNE') {
			conditions.push(`c.Consigne = 1`);
		} else if (statusFilter === 'DELISTED') {
			conditions.push(`c.Delisted = 1`);
		} else if (statusFilter === 'AKTIF') {
			conditions.push(`(c.Delisted = 0 OR c.Delisted IS NULL)`);
		} else {
			conditions.push(`c.Status = @statusFilter`);
			inputs.push({ name: 'statusFilter', type: sql.VarChar(20), value: statusFilter });
		}
	}

	if (currFilter) {
		conditions.push(`c.Curr = @currFilter`);
		inputs.push({ name: 'currFilter', type: sql.VarChar(3), value: currFilter });
	}

	const whereClause = conditions.join(' AND ');

	const countQ = `
		SELECT COUNT(*) as total
		FROM [cp].[dbo].[taCustomer] c
		WHERE ${whereClause}
	`;

	const dataQ = `
		SELECT 
			c.CompanyID, c.CompanyName1, c.CompanyName2, c.Address1, c.Address2,
			c.City, c.Provinsi, c.Negara, c.PostalCode, c.Phone1, c.Phone2, c.Fax1,
			c.Email, c.Contact1, c.Job1, c.TaxID, c.Curr, c.Status, c.Export, c.Consigne, c.Delisted,
			c.Plafon, c.Due, c.NoteMarketing, c.NoteFinance,
			c.UserName, c.UserDatetime, c.UserUpdateName, c.UserUpdateTime
		FROM [cp].[dbo].[taCustomer] c
		WHERE ${whereClause}
		ORDER BY c.CompanyID DESC
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
		getCustomerStats()
	]);

	const total = countRes.recordset[0]?.total || 0;
	const rows = (dataRes.recordset || []).map(mapCustomerRow);
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
 * Tambah Customer Baru (Create)
 */
export async function createCustomer(
	payload: CreateCustomerPayload,
	username: string = 'system'
): Promise<MasterCustomer> {
	let companyId = (payload.CompanyID || '').trim().toUpperCase();
	if (!companyId) {
		companyId = await getNextCustomerId();
	}

	if (companyId.length > 8) {
		throw new Error('Kode Customer (CompanyID) maksimal 8 karakter');
	}

	const companyName = (payload.CompanyName1 || '').trim();
	if (!companyName) {
		throw new Error('Nama Perusahaan Customer (CompanyName1) wajib diisi');
	}

	const exists = await customerExists(companyId);
	if (exists) {
		throw new Error(`Kode Customer "${companyId}" sudah ada dalam database. Gunakan kode lain.`);
	}

	const companyName2 = payload.CompanyName2?.trim().slice(0, 10) || null;
	const address1 = payload.Address1?.trim().slice(0, 150) || null;
	const address2 = payload.Address2?.trim().slice(0, 70) || null;
	const city = payload.City?.trim().slice(0, 20) || null;
	const provinsi = payload.Provinsi?.trim().slice(0, 100) || null;
	const negara = payload.Negara?.trim().slice(0, 20) || 'INDONESIA';
	const postalCode = payload.PostalCode?.trim().slice(0, 5) || null;
	const phone1 = payload.Phone1?.trim().slice(0, 15) || null;
	const phone2 = payload.Phone2?.trim().slice(0, 15) || null;
	const fax1 = payload.Fax1?.trim().slice(0, 15) || null;
	const email = payload.Email?.trim().slice(0, 40) || null;
	const contact1 = payload.Contact1?.trim().slice(0, 15) || null;
	const job1 = payload.Job1?.trim().slice(0, 15) || null;
	const taxId = payload.TaxID?.trim().slice(0, 25) || null;
	const curr = (payload.Curr || 'IDR').trim().toUpperCase().slice(0, 3);
	const status = payload.Status?.trim().slice(0, 20) || (payload.Export ? 'Ekspor' : 'Lokal');
	const isExport = Boolean(payload.Export);
	const isConsigne = Boolean(payload.Consigne);
	const isDelisted = Boolean(payload.Delisted);
	const plafon = typeof payload.Plafon === 'number' && !isNaN(payload.Plafon) ? payload.Plafon : null;
	const due = typeof payload.Due === 'number' && !isNaN(payload.Due) ? payload.Due : null;
	const noteMarketing = payload.NoteMarketing?.trim() || null;
	const noteFinance = payload.NoteFinance?.trim() || null;
	const user = (username || 'system').slice(0, 50);

	const insertQ = `
		INSERT INTO [cp].[dbo].[taCustomer] (
			CompanyID, CompanyName1, CompanyName2, Address1, Address2,
			City, Provinsi, Negara, PostalCode, Phone1, Phone2, Fax1,
			Email, Contact1, Job1, TaxID, Curr, Status, Export, Consigne, Delisted,
			Plafon, Due, NoteMarketing, NoteFinance,
			UserName, UserDatetime
		) VALUES (
			@CompanyID, @CompanyName1, @CompanyName2, @Address1, @Address2,
			@City, @Provinsi, @Negara, @PostalCode, @Phone1, @Phone2, @Fax1,
			@Email, @Contact1, @Job1, @TaxID, @Curr, @Status, @Export, @Consigne, @Delisted,
			@Plafon, @Due, @NoteMarketing, @NoteFinance,
			@UserName, GETDATE()
		)
	`;

	await runQuery(insertQ, [
		{ name: 'CompanyID', type: sql.VarChar(8), value: companyId },
		{ name: 'CompanyName1', type: sql.VarChar(100), value: companyName },
		{ name: 'CompanyName2', type: sql.VarChar(10), value: companyName2 },
		{ name: 'Address1', type: sql.VarChar(150), value: address1 },
		{ name: 'Address2', type: sql.VarChar(70), value: address2 },
		{ name: 'City', type: sql.VarChar(20), value: city },
		{ name: 'Provinsi', type: sql.VarChar(100), value: provinsi },
		{ name: 'Negara', type: sql.VarChar(20), value: negara },
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
		{ name: 'Export', type: sql.Bit, value: isExport ? 1 : 0 },
		{ name: 'Consigne', type: sql.Bit, value: isConsigne ? 1 : 0 },
		{ name: 'Delisted', type: sql.Bit, value: isDelisted ? 1 : 0 },
		{ name: 'Plafon', type: sql.Money, value: plafon },
		{ name: 'Due', type: sql.SmallInt, value: due },
		{ name: 'NoteMarketing', type: sql.NVarChar(sql.MAX), value: noteMarketing },
		{ name: 'NoteFinance', type: sql.NVarChar(sql.MAX), value: noteFinance },
		{ name: 'UserName', type: sql.VarChar(50), value: user }
	]);

	const created = await getCustomerById(companyId);
	if (!created) throw new Error('Gagal memuat customer setelah disimpan');
	return created;
}

/**
 * Perbarui Data Customer (Update)
 */
export async function updateCustomer(
	companyId: string,
	payload: Partial<CreateCustomerPayload>,
	username: string = 'system'
): Promise<MasterCustomer> {
	const cleanId = companyId.trim().toUpperCase();
	const existing = await getCustomerById(cleanId);
	if (!existing) {
		throw new Error(`Customer dengan kode "${cleanId}" tidak ditemukan`);
	}

	const companyName = payload.CompanyName1 !== undefined ? payload.CompanyName1.trim() : existing.CompanyName1;
	if (!companyName) {
		throw new Error('Nama Perusahaan Customer tidak boleh kosong');
	}

	const companyName2 = payload.CompanyName2 !== undefined ? (payload.CompanyName2?.trim().slice(0, 10) || null) : existing.CompanyName2;
	const address1 = payload.Address1 !== undefined ? (payload.Address1?.trim().slice(0, 150) || null) : existing.Address1;
	const address2 = payload.Address2 !== undefined ? (payload.Address2?.trim().slice(0, 70) || null) : existing.Address2;
	const city = payload.City !== undefined ? (payload.City?.trim().slice(0, 20) || null) : existing.City;
	const provinsi = payload.Provinsi !== undefined ? (payload.Provinsi?.trim().slice(0, 100) || null) : existing.Provinsi;
	const negara = payload.Negara !== undefined ? (payload.Negara?.trim().slice(0, 20) || 'INDONESIA') : existing.Negara;
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
	const isExport = payload.Export !== undefined ? Boolean(payload.Export) : existing.Export;
	const isConsigne = payload.Consigne !== undefined ? Boolean(payload.Consigne) : existing.Consigne;
	const isDelisted = payload.Delisted !== undefined ? Boolean(payload.Delisted) : existing.Delisted;
	const plafon = payload.Plafon !== undefined ? (typeof payload.Plafon === 'number' && !isNaN(payload.Plafon) ? payload.Plafon : null) : existing.Plafon;
	const due = payload.Due !== undefined ? (typeof payload.Due === 'number' && !isNaN(payload.Due) ? payload.Due : null) : existing.Due;
	const noteMarketing = payload.NoteMarketing !== undefined ? (payload.NoteMarketing?.trim() || null) : existing.NoteMarketing;
	const noteFinance = payload.NoteFinance !== undefined ? (payload.NoteFinance?.trim() || null) : existing.NoteFinance;
	const user = (username || 'system').slice(0, 50);

	const updateQ = `
		UPDATE [cp].[dbo].[taCustomer]
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
			Export = @Export,
			Consigne = @Consigne,
			Delisted = @Delisted,
			Plafon = @Plafon,
			Due = @Due,
			NoteMarketing = @NoteMarketing,
			NoteFinance = @NoteFinance,
			UserUpdateName = @UserUpdateName,
			UserUpdateTime = GETDATE()
		WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID
	`;

	await runQuery(updateQ, [
		{ name: 'CompanyID', type: sql.VarChar(8), value: cleanId },
		{ name: 'CompanyName1', type: sql.VarChar(100), value: companyName },
		{ name: 'CompanyName2', type: sql.VarChar(10), value: companyName2 },
		{ name: 'Address1', type: sql.VarChar(150), value: address1 },
		{ name: 'Address2', type: sql.VarChar(70), value: address2 },
		{ name: 'City', type: sql.VarChar(20), value: city },
		{ name: 'Provinsi', type: sql.VarChar(100), value: provinsi },
		{ name: 'Negara', type: sql.VarChar(20), value: negara },
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
		{ name: 'Export', type: sql.Bit, value: isExport ? 1 : 0 },
		{ name: 'Consigne', type: sql.Bit, value: isConsigne ? 1 : 0 },
		{ name: 'Delisted', type: sql.Bit, value: isDelisted ? 1 : 0 },
		{ name: 'Plafon', type: sql.Money, value: plafon },
		{ name: 'Due', type: sql.SmallInt, value: due },
		{ name: 'NoteMarketing', type: sql.NVarChar(sql.MAX), value: noteMarketing },
		{ name: 'NoteFinance', type: sql.NVarChar(sql.MAX), value: noteFinance },
		{ name: 'UserUpdateName', type: sql.VarChar(50), value: user }
	]);

	const updated = await getCustomerById(cleanId);
	if (!updated) throw new Error('Gagal memuat customer setelah diperbarui');
	return updated;
}

/**
 * Hapus Customer (Delete) dengan pengecekan integritas transaksi
 */
export async function deleteCustomer(companyId: string): Promise<{ success: boolean; message: string }> {
	const cleanId = companyId.trim().toUpperCase();
	const existing = await getCustomerById(cleanId);
	if (!existing) {
		throw new Error(`Customer dengan kode "${cleanId}" tidak ditemukan`);
	}

	// Pengecekan tabel transaksi penjualan yang menggunakan CompanyID
	const checkQ = `
		SELECT
			(SELECT COUNT(*) FROM [cp].[dbo].[taTransOHD] WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID) AS invoiceCount,
			(SELECT COUNT(*) FROM [cp].[dbo].[taTransOHD2] WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID) AS sjCount,
			(SELECT COUNT(*) FROM [cp].[dbo].[taTransOHD_PI] WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID) AS piCount,
			(SELECT COUNT(*) FROM [cp].[dbo].[taTTFHD] WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID) AS ttfCount
	`;

	const checkRes = await runQuery(checkQ, [{ name: 'CompanyID', type: sql.VarChar(8), value: cleanId }]);
	const counts = checkRes.recordset[0] || {};
	const reasons: string[] = [];

	if (counts.invoiceCount > 0) reasons.push(`${counts.invoiceCount} Faktur Penjualan (taTransOHD)`);
	if (counts.sjCount > 0) reasons.push(`${counts.sjCount} Surat Jalan Pengiriman (taTransOHD2)`);
	if (counts.piCount > 0) reasons.push(`${counts.piCount} Proforma Invoice (taTransOHD_PI)`);
	if (counts.ttfCount > 0) reasons.push(`${counts.ttfCount} Tanda Terima Faktur (taTTFHD)`);

	if (reasons.length > 0) {
		throw new Error(
			`Customer "${existing.CompanyName1}" (${cleanId}) tidak dapat dihapus karena telah tercatat dalam riwayat transaksi ERP: ${reasons.join(', ')}. Demi integritas data akuntansi, customer ini tidak boleh dihapus. Anda dapat mengubah statusnya menjadi "Delisted" (Non-aktif).`
		);
	}

	const deleteQ = `DELETE FROM [cp].[dbo].[taCustomer] WHERE UPPER(RTRIM(LTRIM(CompanyID))) = @CompanyID`;
	await runQuery(deleteQ, [{ name: 'CompanyID', type: sql.VarChar(8), value: cleanId }]);

	return {
		success: true,
		message: `Customer "${existing.CompanyName1}" (${cleanId}) berhasil dihapus dari Master Data.`
	};
}

/**
 * Export data master customer ke format Excel Buffer (.xlsx)
 */
export async function generateCustomersExcel(params: {
	q?: string;
	status?: string;
	curr?: string;
}): Promise<Buffer> {
	const result = await getMasterCustomersPaged({
		...params,
		page: 1,
		pageSize: 5000
	});

	const wb = XLSX.utils.book_new();

	const aoa: any[][] = [
		['MASTER DATA CUSTOMER / PELANGGAN'],
		[`Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`],
		[`Total Data: ${result.rows.length} Rekanan Pelanggan`],
		[],
		[
			'No',
			'Kode Customer',
			'Nama Perusahaan Customer',
			'Inisial / Singkatan',
			'Mata Uang',
			'Tipe Pasar',
			'Customer Consignee?',
			'Status Aktif',
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
			'Plafon Kredit (IDR/Valas)',
			'TOP (Hari)',
			'Catatan Marketing',
			'Catatan Finance',
			'User Pembuat',
			'Waktu Dibuat',
			'User Pengubah',
			'Waktu Diubah'
		]
	];

	result.rows.forEach((c, idx) => {
		aoa.push([
			idx + 1,
			c.CompanyID,
			c.CompanyName1,
			c.CompanyName2 || '-',
			c.Curr || 'IDR',
			c.Export ? 'EKSPOR' : 'LOKAL',
			c.Consigne ? 'YA' : 'TIDAK',
			c.Delisted ? 'DELISTED / NON-AKTIF' : 'AKTIF',
			c.Contact1 || '-',
			c.Job1 || '-',
			c.Phone1 || '-',
			c.Fax1 || '-',
			c.Email || '-',
			c.Address1 || '-',
			c.City || '-',
			c.Provinsi || '-',
			c.Negara || 'INDONESIA',
			c.PostalCode || '-',
			c.TaxID || '-',
			c.Plafon != null ? c.Plafon : 0,
			c.Due != null ? c.Due : 0,
			c.NoteMarketing || '-',
			c.NoteFinance || '-',
			c.UserName || '-',
			c.UserDatetime ? c.UserDatetime.replace('T', ' ').slice(0, 19) : '-',
			c.UserUpdateName || '-',
			c.UserUpdateTime ? c.UserUpdateTime.replace('T', ' ').slice(0, 19) : '-'
		]);
	});

	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws['!cols'] = [
		{ wch: 6 },  // No
		{ wch: 14 }, // Kode
		{ wch: 38 }, // Nama
		{ wch: 12 }, // Inisial
		{ wch: 10 }, // Curr
		{ wch: 12 }, // Pasar
		{ wch: 12 }, // Consignee
		{ wch: 16 }, // Status Aktif
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
		{ wch: 20 }, // Plafon
		{ wch: 12 }, // Due
		{ wch: 30 }, // NoteMarketing
		{ wch: 30 }, // NoteFinance
		{ wch: 16 }, // User
		{ wch: 20 }, // Userdatetime
		{ wch: 16 }, // UserUpdate
		{ wch: 20 }  // UserUpdateTime
	];

	XLSX.utils.book_append_sheet(wb, ws, 'Master Customer');
	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// =========================================================================
// OPERASI TABEL taConsigne (MASTER CONSIGNEE)
// =========================================================================

/**
 * Ambil seluruh daftar Consignee dari taConsigne
 */
export async function getAllConsigne(): Promise<MasterConsigne[]> {
	try {
		const res = await runQuery(`
			SELECT 
				RTRIM(LTRIM(Consigne)) AS Consigne,
				RTRIM(LTRIM(ConsigneID)) AS ConsigneID,
				TargetHari
			FROM [cp].[dbo].[taConsigne]
			ORDER BY ConsigneID ASC, Consigne ASC
		`);
		return (res.recordset || [])
			.filter((r: any) => (r.Consigne && r.Consigne !== '') || (r.ConsigneID && r.ConsigneID !== '000'))
			.map((r: any) => ({
				Consigne: String(r.Consigne || '').trim(),
				ConsigneID: r.ConsigneID != null ? String(r.ConsigneID).trim() : null,
				TargetHari: r.TargetHari != null ? Number(r.TargetHari) : null
			}));
	} catch (err) {
		log.error({ err }, 'Gagal mengambil data taConsigne');
		return [];
	}
}

/**
 * Generate nomor ConsigneID 3 digit otomatis berikutnya (contoh: 005)
 */
export async function getNextConsigneId(): Promise<string> {
	try {
		const res = await runQuery(`
			SELECT TOP 1
				ConsigneID,
				TRY_CAST(ConsigneID AS INT) AS num
			FROM [cp].[dbo].[taConsigne]
			WHERE TRY_CAST(ConsigneID AS INT) IS NOT NULL
			ORDER BY num DESC
		`);
		const lastNum = res.recordset[0]?.num;
		const nextNum = (typeof lastNum === 'number' && !isNaN(lastNum) ? lastNum : 0) + 1;
		return String(nextNum).padStart(3, '0');
	} catch (err) {
		log.warn({ err }, 'Gagal generate ConsigneID');
		return '001';
	}
}

/**
 * Cek apakah nama Consigne sudah terdaftar di taConsigne
 */
export async function consigneExists(consigne: string): Promise<boolean> {
	const clean = consigne.trim().toUpperCase();
	const res = await runQuery(
		`SELECT TOP 1 1 FROM [cp].[dbo].[taConsigne] WHERE UPPER(RTRIM(LTRIM(Consigne))) = @Consigne`,
		[{ name: 'Consigne', type: sql.VarChar(25), value: clean }]
	);
	return (res.recordset.length || 0) > 0;
}

/**
 * Tambah Consignee baru ke taConsigne
 */
export async function createConsigne(payload: MasterConsigne): Promise<MasterConsigne> {
	const consigne = (payload.Consigne || '').trim();
	if (!consigne) {
		throw new Error('Nama / Rekanan Consignee wajib diisi');
	}
	if (consigne.length > 25) {
		throw new Error('Nama Consignee maksimal 25 karakter');
	}

	const exists = await consigneExists(consigne);
	if (exists) {
		throw new Error(`Consignee "${consigne}" sudah terdaftar dalam tabel taConsigne.`);
	}

	let consigneId = (payload.ConsigneID || '').trim();
	if (!consigneId) {
		consigneId = await getNextConsigneId();
	}
	consigneId = consigneId.slice(0, 3);

	const targetHari = typeof payload.TargetHari === 'number' && !isNaN(payload.TargetHari) ? payload.TargetHari : 14;

	await runQuery(
		`INSERT INTO [cp].[dbo].[taConsigne] (Consigne, ConsigneID, TargetHari) VALUES (@Consigne, @ConsigneID, @TargetHari)`,
		[
			{ name: 'Consigne', type: sql.VarChar(25), value: consigne },
			{ name: 'ConsigneID', type: sql.VarChar(3), value: consigneId },
			{ name: 'TargetHari', type: sql.SmallInt, value: targetHari }
		]
	);

	return {
		Consigne: consigne,
		ConsigneID: consigneId,
		TargetHari: targetHari
	};
}

/**
 * Perbarui Consignee di taConsigne
 */
export async function updateConsigne(oldConsigne: string, payload: MasterConsigne): Promise<MasterConsigne> {
	const cleanOld = oldConsigne.trim();
	const newConsigne = (payload.Consigne || '').trim();
	if (!newConsigne) {
		throw new Error('Nama / Rekanan Consignee wajib diisi');
	}

	const consigneId = (payload.ConsigneID || '').trim().slice(0, 3) || null;
	const targetHari = typeof payload.TargetHari === 'number' && !isNaN(payload.TargetHari) ? payload.TargetHari : null;

	await runQuery(
		`UPDATE [cp].[dbo].[taConsigne]
		 SET Consigne = @NewConsigne, ConsigneID = @ConsigneID, TargetHari = @TargetHari
		 WHERE RTRIM(LTRIM(Consigne)) = @OldConsigne`,
		[
			{ name: 'OldConsigne', type: sql.VarChar(25), value: cleanOld },
			{ name: 'NewConsigne', type: sql.VarChar(25), value: newConsigne },
			{ name: 'ConsigneID', type: sql.VarChar(3), value: consigneId },
			{ name: 'TargetHari', type: sql.SmallInt, value: targetHari }
		]
	);

	return {
		Consigne: newConsigne,
		ConsigneID: consigneId,
		TargetHari: targetHari
	};
}

/**
 * Hapus Consignee dari taConsigne dengan pengecekan relasi
 */
export async function deleteConsigne(consigne: string): Promise<{ success: boolean; message: string }> {
	const clean = consigne.trim();
	const checkRes = await runQuery(
		`SELECT
			(SELECT COUNT(*) FROM [cp].[dbo].[taImportHD] WHERE RTRIM(LTRIM(Consignee)) = @Consigne) AS importCount,
			(SELECT COUNT(*) FROM [cp].[dbo].[taImportDT4] WHERE RTRIM(LTRIM(Consignee)) = @Consigne) AS importDtCount,
			(SELECT COUNT(*) FROM [cp].[dbo].[taSOHd] WHERE RTRIM(LTRIM(Consigne)) = @Consigne) AS soCount`,
		[{ name: 'Consigne', type: sql.VarChar(25), value: clean }]
	);

	const counts = checkRes.recordset[0] || {};
	const reasons: string[] = [];
	if (counts.importCount > 0) reasons.push(`${counts.importCount} Dokumen Impor (taImportHD)`);
	if (counts.importDtCount > 0) reasons.push(`${counts.importDtCount} Detail Impor (taImportDT4)`);
	if (counts.soCount > 0) reasons.push(`${counts.soCount} Sales Order (taSOHd)`);

	if (reasons.length > 0) {
		throw new Error(
			`Consignee "${clean}" tidak dapat dihapus karena digunakan dalam transaksi: ${reasons.join(', ')}.`
		);
	}

	await runQuery(
		`DELETE FROM [cp].[dbo].[taConsigne] WHERE RTRIM(LTRIM(Consigne)) = @Consigne`,
		[{ name: 'Consigne', type: sql.VarChar(25), value: clean }]
	);

	return {
		success: true,
		message: `Consignee "${clean}" berhasil dihapus dari taConsigne.`
	};
}
