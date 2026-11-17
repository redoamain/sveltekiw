import { runQuery, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface MasterCOA {
	Acc: string;
	AccGroup: string | null;
	GroupName?: string | null;
	AccName: string;
	AccName2: string | null;
	AccLevel: number | null;
	AccType: string | null;
	AccPos: string | null;
	AccParent: string | null;
	AccCurr: string | null;
	SAmountRp: number;
	AmountRp: number;
	SAmount: number;
	Amount: number;
	Delisted: boolean;
	AccountBank: string | null;
	Remark: string | null;
	UserName: string | null;
	UserDateTime: string | null;
	rjn: number;
}

export interface CreateCOAPayload {
	Acc: string;
	AccGroup?: string | null;
	AccName: string;
	AccName2?: string | null;
	AccLevel?: number | null;
	AccType?: string | null;
	AccPos?: string | null;
	AccParent?: string | null;
	AccCurr?: string | null;
	AccountBank?: string | null;
	Remark?: string | null;
	Delisted?: boolean;
}

export interface COASummaryStats {
	total: number;
	totalAktiva: number;
	totalHutang: number;
	totalModal: number;
	totalPendapatan: number;
	totalBiaya: number;
	totalKasBank: number;
	totalActive: number;
	totalDelisted: number;
}

export interface GLGroupOption {
	GroupID: string;
	GroupName: string;
}

export interface COAPagedResult {
	rows: MasterCOA[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	stats: COASummaryStats;
}

function mapCOARow(r: any): MasterCOA {
	return {
		Acc: String(r.Acc || '').trim(),
		AccGroup: r.AccGroup != null ? String(r.AccGroup).trim() : null,
		GroupName: r.GroupName != null ? String(r.GroupName).trim() : null,
		AccName: String(r.AccName || '').trim(),
		AccName2: r.AccName2 != null ? String(r.AccName2).trim() : null,
		AccLevel: r.AccLevel != null ? Number(r.AccLevel) : null,
		AccType: r.AccType != null ? String(r.AccType).trim() : '2',
		AccPos: r.AccPos != null ? String(r.AccPos).trim().toUpperCase() : 'D',
		AccParent: r.AccParent != null ? String(r.AccParent).trim() : null,
		AccCurr: r.AccCurr != null ? String(r.AccCurr).trim().toUpperCase() : 'IDR',
		SAmountRp: Number(r.SAmountRp || 0),
		AmountRp: Number(r.AmountRp || 0),
		SAmount: Number(r.SAmount || 0),
		Amount: Number(r.Amount || 0),
		Delisted: Boolean(r.Delisted),
		AccountBank: r.AccountBank != null ? String(r.AccountBank).trim() : null,
		Remark: r.Remark != null ? String(r.Remark).trim() : null,
		UserName: r.UserName != null ? String(r.UserName).trim() : null,
		UserDateTime:
			r.UserDateTime instanceof Date
				? r.UserDateTime.toISOString()
				: r.UserDateTime != null
					? String(r.UserDateTime)
					: null,
		rjn: Number(r.rjn || 0)
	};
}

/**
 * Ambil daftar ringkasan statistik COA (taGLAcc)
 */
export async function getCOAStats(): Promise<COASummaryStats> {
	try {
		const q = `
			SELECT
				COUNT(*) AS total,
				SUM(CASE WHEN AccGroup = '1' THEN 1 ELSE 0 END) AS totalAktiva,
				SUM(CASE WHEN AccGroup = '2' THEN 1 ELSE 0 END) AS totalHutang,
				SUM(CASE WHEN AccGroup = '3' THEN 1 ELSE 0 END) AS totalModal,
				SUM(CASE WHEN AccGroup = '4' THEN 1 ELSE 0 END) AS totalPendapatan,
				SUM(CASE WHEN AccGroup IN ('5', '6') THEN 1 ELSE 0 END) AS totalBiaya,
				SUM(CASE WHEN AccType IN ('3', '4') THEN 1 ELSE 0 END) AS totalKasBank,
				SUM(CASE WHEN Delisted = 1 THEN 1 ELSE 0 END) AS totalDelisted,
				SUM(CASE WHEN Delisted = 0 OR Delisted IS NULL THEN 1 ELSE 0 END) AS totalActive
			FROM [cp].[dbo].[taGLAcc]
		`;
		const res = await runQuery(q);
		const r = res.recordset[0] || {};
		return {
			total: Number(r.total || 0),
			totalAktiva: Number(r.totalAktiva || 0),
			totalHutang: Number(r.totalHutang || 0),
			totalModal: Number(r.totalModal || 0),
			totalPendapatan: Number(r.totalPendapatan || 0),
			totalBiaya: Number(r.totalBiaya || 0),
			totalKasBank: Number(r.totalKasBank || 0),
			totalActive: Number(r.totalActive || 0),
			totalDelisted: Number(r.totalDelisted || 0)
		};
	} catch (err) {
		log.error({ err }, 'Gagal menghitung statistik COA');
		return {
			total: 0,
			totalAktiva: 0,
			totalHutang: 0,
			totalModal: 0,
			totalPendapatan: 0,
			totalBiaya: 0,
			totalKasBank: 0,
			totalActive: 0,
			totalDelisted: 0
		};
	}
}

/**
 * Cek apakah kode akun sudah terdaftar
 */
export async function coaExists(acc: string): Promise<boolean> {
	const clean = acc.trim();
	const q = `SELECT TOP 1 1 FROM [cp].[dbo].[taGLAcc] WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc`;
	const res = await runQuery(q, [{ name: 'Acc', type: sql.VarChar(15), value: clean.toUpperCase() }]);
	return (res.recordset?.length || 0) > 0;
}

/**
 * Ambil data 1 Akun berdasarkan Acc
 */
export async function getCOAById(acc: string): Promise<MasterCOA | null> {
	const clean = acc.trim().toUpperCase();
	const q = `
		SELECT TOP 1
			a.Acc,
			a.AccGroup,
			g.GroupName,
			a.AccName,
			a.AccName2,
			a.AccLevel,
			a.AccType,
			a.AccPos,
			a.AccParent,
			a.AccCurr,
			a.SAmountRp,
			a.AmountRp,
			a.SAmount,
			a.Amount,
			a.Delisted,
			a.AccountBank,
			a.Remark,
			a.UserName,
			a.UserDateTime,
			a.rjn
		FROM [cp].[dbo].[taGLAcc] a
		LEFT JOIN [cp].[dbo].[taGLGroup] g ON a.AccGroup = g.GroupID
		WHERE UPPER(RTRIM(LTRIM(a.Acc))) = @Acc
	`;
	const res = await runQuery(q, [{ name: 'Acc', type: sql.VarChar(15), value: clean }]);
	if (!res.recordset || res.recordset.length === 0) return null;
	return mapCOARow(res.recordset[0]);
}

/**
 * Ambil daftar kelompok akun taGLGroup
 */
export async function getAllGLGroups(): Promise<GLGroupOption[]> {
	try {
		const q = `
			SELECT GroupID, GroupName
			FROM [cp].[dbo].[taGLGroup]
			ORDER BY GroupID ASC
		`;
		const res = await runQuery(q);
		return (res.recordset || []).map((r: any) => ({
			GroupID: String(r.GroupID || '').trim(),
			GroupName: String(r.GroupName || '').trim()
		}));
	} catch (err) {
		log.error({ err }, 'Gagal mengambil daftar taGLGroup');
		return [];
	}
}

/**
 * Ambil daftar seluruh akun induk / Header untuk pilihan Parent
 */
export async function getAllParentAccounts(): Promise<{ Acc: string; AccName: string }[]> {
	try {
		const q = `
			SELECT Acc, AccName
			FROM [cp].[dbo].[taGLAcc]
			WHERE AccType = '1' OR AccLevel < 3 OR AccParent IS NULL OR Acc = AccParent
			ORDER BY Acc ASC
		`;
		const res = await runQuery(q);
		return (res.recordset || []).map((r: any) => ({
			Acc: String(r.Acc || '').trim(),
			AccName: String(r.AccName || '').trim()
		}));
	} catch (err) {
		log.error({ err }, 'Gagal mengambil akun parent');
		return [];
	}
}

/**
 * Ambil daftar COA dengan pagination, filter & pencarian
 */
export async function getCOAPaged(params: {
	q?: string;
	group?: string;
	type?: string;
	pos?: string;
	curr?: string;
	status?: string;
	page?: number;
	pageSize?: number;
}): Promise<COAPagedResult> {
	const page = Math.max(1, params.page || 1);
	const pageSize = Math.max(10, Math.min(500, params.pageSize || 50));
	const offset = (page - 1) * pageSize;

	const search = (params.q || '').trim();
	const groupFilter = (params.group || '').trim();
	const typeFilter = (params.type || '').trim();
	const posFilter = (params.pos || '').trim().toUpperCase();
	const currFilter = (params.curr || '').trim().toUpperCase();
	const statusFilter = (params.status || '').trim().toLowerCase();

	const conditions: string[] = ['1=1'];
	const inputs: { name: string; type: any; value: any }[] = [];

	if (search) {
		conditions.push(`(
			a.Acc LIKE @search OR
			a.AccName LIKE @search OR
			a.AccName2 LIKE @search OR
			a.AccountBank LIKE @search OR
			a.Remark LIKE @search OR
			g.GroupName LIKE @search
		)`);
		inputs.push({ name: 'search', type: sql.NVarChar(120), value: `%${search}%` });
	}

	if (groupFilter) {
		conditions.push(`a.AccGroup = @groupFilter`);
		inputs.push({ name: 'groupFilter', type: sql.VarChar(2), value: groupFilter });
	}

	if (typeFilter) {
		conditions.push(`a.AccType = @typeFilter`);
		inputs.push({ name: 'typeFilter', type: sql.VarChar(1), value: typeFilter });
	}

	if (posFilter) {
		conditions.push(`a.AccPos = @posFilter`);
		inputs.push({ name: 'posFilter', type: sql.VarChar(1), value: posFilter });
	}

	if (currFilter) {
		conditions.push(`a.AccCurr = @currFilter`);
		inputs.push({ name: 'currFilter', type: sql.VarChar(3), value: currFilter });
	}

	if (statusFilter === 'active') {
		conditions.push(`(a.Delisted = 0 OR a.Delisted IS NULL)`);
	} else if (statusFilter === 'delisted') {
		conditions.push(`a.Delisted = 1`);
	}

	const whereClause = conditions.join(' AND ');

	const countQ = `
		SELECT COUNT(*) AS total
		FROM [cp].[dbo].[taGLAcc] a
		LEFT JOIN [cp].[dbo].[taGLGroup] g ON a.AccGroup = g.GroupID
		WHERE ${whereClause}
	`;

	const dataQ = `
		SELECT
			a.Acc,
			a.AccGroup,
			g.GroupName,
			a.AccName,
			a.AccName2,
			a.AccLevel,
			a.AccType,
			a.AccPos,
			a.AccParent,
			a.AccCurr,
			a.SAmountRp,
			a.AmountRp,
			a.SAmount,
			a.Amount,
			a.Delisted,
			a.AccountBank,
			a.Remark,
			a.UserName,
			a.UserDateTime,
			a.rjn
		FROM [cp].[dbo].[taGLAcc] a
		LEFT JOIN [cp].[dbo].[taGLGroup] g ON a.AccGroup = g.GroupID
		WHERE ${whereClause}
		ORDER BY a.Acc ASC
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
		getCOAStats()
	]);

	const total = countRes.recordset[0]?.total || 0;
	const rows = (dataRes.recordset || []).map(mapCOARow);
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
 * Tambah Akun Perkiraan Baru (Create)
 */
export async function createCOA(
	payload: CreateCOAPayload,
	username: string = 'system'
): Promise<MasterCOA> {
	const acc = (payload.Acc || '').trim();
	const accName = (payload.AccName || '').trim();

	if (!acc) throw new Error('Kode Perkiraan (Acc) wajib diisi.');
	if (acc.length > 15) throw new Error('Kode Perkiraan (Acc) maksimal 15 karakter.');
	if (!accName) throw new Error('Nama Perkiraan (AccName) wajib diisi.');
	if (accName.length > 100) throw new Error('Nama Perkiraan maksimal 100 karakter.');

	const exists = await coaExists(acc);
	if (exists) {
		throw new Error(`Kode Perkiraan "${acc}" sudah terdaftar. Gunakan kode lain.`);
	}

	const accGroup = payload.AccGroup?.trim().slice(0, 1) || acc[0] || '1';
	const accName2 = payload.AccName2?.trim().slice(0, 50) || null;
	const accLevel = payload.AccLevel != null ? Number(payload.AccLevel) : 3;
	const accType = payload.AccType?.trim().slice(0, 1) || '2';
	const accPos = (payload.AccPos || (['1', '5', '6'].includes(accGroup) ? 'D' : 'K'))
		.trim()
		.toUpperCase()
		.slice(0, 1);
	const accParent = payload.AccParent?.trim().slice(0, 9) || null;
	const accCurr = (payload.AccCurr || 'IDR').trim().toUpperCase().slice(0, 3);
	const accountBank = payload.AccountBank?.trim().slice(0, 25) || null;
	const remark = payload.Remark?.trim().slice(0, 20) || null;
	const delisted = Boolean(payload.Delisted);
	const user = (username || 'system').slice(0, 10);

	const insertQ = `
		INSERT INTO [cp].[dbo].[taGLAcc] (
			Acc, AccGroup, AccName, AccName2, AccLevel, AccType, AccPos,
			AccParent, AccCurr, SAmount, Amount, SAmountRp, AmountRp,
			Delisted, AccountBank, Remark, UserName, UserDateTime
		) VALUES (
			@Acc, @AccGroup, @AccName, @AccName2, @AccLevel, @AccType, @AccPos,
			@AccParent, @AccCurr, 0, 0, 0, 0,
			@Delisted, @AccountBank, @Remark, @UserName, GETDATE()
		)
	`;

	await runQuery(insertQ, [
		{ name: 'Acc', type: sql.VarChar(15), value: acc },
		{ name: 'AccGroup', type: sql.VarChar(1), value: accGroup },
		{ name: 'AccName', type: sql.VarChar(100), value: accName },
		{ name: 'AccName2', type: sql.VarChar(50), value: accName2 },
		{ name: 'AccLevel', type: sql.TinyInt, value: accLevel },
		{ name: 'AccType', type: sql.VarChar(1), value: accType },
		{ name: 'AccPos', type: sql.VarChar(1), value: accPos },
		{ name: 'AccParent', type: sql.VarChar(9), value: accParent },
		{ name: 'AccCurr', type: sql.VarChar(3), value: accCurr },
		{ name: 'Delisted', type: sql.Bit, value: delisted ? 1 : 0 },
		{ name: 'AccountBank', type: sql.VarChar(25), value: accountBank },
		{ name: 'Remark', type: sql.VarChar(20), value: remark },
		{ name: 'UserName', type: sql.VarChar(10), value: user }
	]);

	const created = await getCOAById(acc);
	if (!created) throw new Error('Gagal memuat akun setelah disimpan');
	return created;
}

/**
 * Perbarui Akun Perkiraan (Update)
 */
export async function updateCOA(
	acc: string,
	payload: Partial<CreateCOAPayload>,
	username: string = 'system'
): Promise<MasterCOA> {
	const cleanAcc = acc.trim();
	const existing = await getCOAById(cleanAcc);
	if (!existing) {
		throw new Error(`Akun dengan kode "${cleanAcc}" tidak ditemukan`);
	}

	const accName = payload.AccName !== undefined ? payload.AccName.trim() : existing.AccName;
	if (!accName) throw new Error('Nama Perkiraan tidak boleh kosong');

	const accGroup =
		payload.AccGroup !== undefined
			? payload.AccGroup?.trim().slice(0, 1) || existing.AccGroup
			: existing.AccGroup;
	const accName2 =
		payload.AccName2 !== undefined
			? payload.AccName2?.trim().slice(0, 50) || null
			: existing.AccName2;
	const accLevel =
		payload.AccLevel !== undefined ? Number(payload.AccLevel) : existing.AccLevel;
	const accType =
		payload.AccType !== undefined
			? payload.AccType?.trim().slice(0, 1) || existing.AccType
			: existing.AccType;
	const accPos =
		payload.AccPos !== undefined
			? payload.AccPos?.trim().toUpperCase().slice(0, 1) || existing.AccPos
			: existing.AccPos;
	const accParent =
		payload.AccParent !== undefined
			? payload.AccParent?.trim().slice(0, 9) || null
			: existing.AccParent;
	const accCurr =
		payload.AccCurr !== undefined
			? payload.AccCurr?.trim().toUpperCase().slice(0, 3) || existing.AccCurr
			: existing.AccCurr;
	const accountBank =
		payload.AccountBank !== undefined
			? payload.AccountBank?.trim().slice(0, 25) || null
			: existing.AccountBank;
	const remark =
		payload.Remark !== undefined
			? payload.Remark?.trim().slice(0, 20) || null
			: existing.Remark;
	const delisted =
		payload.Delisted !== undefined ? Boolean(payload.Delisted) : existing.Delisted;
	const user = (username || 'system').slice(0, 10);

	const updateQ = `
		UPDATE [cp].[dbo].[taGLAcc]
		SET
			AccGroup = @AccGroup,
			AccName = @AccName,
			AccName2 = @AccName2,
			AccLevel = @AccLevel,
			AccType = @AccType,
			AccPos = @AccPos,
			AccParent = @AccParent,
			AccCurr = @AccCurr,
			Delisted = @Delisted,
			AccountBank = @AccountBank,
			Remark = @Remark,
			UserName = @UserName,
			UserDateTime = GETDATE()
		WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc
	`;

	await runQuery(updateQ, [
		{ name: 'Acc', type: sql.VarChar(15), value: cleanAcc.toUpperCase() },
		{ name: 'AccGroup', type: sql.VarChar(1), value: accGroup },
		{ name: 'AccName', type: sql.VarChar(100), value: accName },
		{ name: 'AccName2', type: sql.VarChar(50), value: accName2 },
		{ name: 'AccLevel', type: sql.TinyInt, value: accLevel },
		{ name: 'AccType', type: sql.VarChar(1), value: accType },
		{ name: 'AccPos', type: sql.VarChar(1), value: accPos },
		{ name: 'AccParent', type: sql.VarChar(9), value: accParent },
		{ name: 'AccCurr', type: sql.VarChar(3), value: accCurr },
		{ name: 'Delisted', type: sql.Bit, value: delisted ? 1 : 0 },
		{ name: 'AccountBank', type: sql.VarChar(25), value: accountBank },
		{ name: 'Remark', type: sql.VarChar(20), value: remark },
		{ name: 'UserName', type: sql.VarChar(10), value: user }
	]);

	const updated = await getCOAById(cleanAcc);
	if (!updated) throw new Error('Gagal memuat akun setelah diperbarui');
	return updated;
}

/**
 * Toggle status Delisted (Aktif / Nonaktif)
 */
export async function toggleDelistedCOA(
	acc: string,
	delisted: boolean
): Promise<{ success: boolean; delisted: boolean }> {
	const cleanAcc = acc.trim();
	const updateQ = `
		UPDATE [cp].[dbo].[taGLAcc]
		SET Delisted = @Delisted, UserDateTime = GETDATE()
		WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc
	`;
	await runQuery(updateQ, [
		{ name: 'Acc', type: sql.VarChar(15), value: cleanAcc.toUpperCase() },
		{ name: 'Delisted', type: sql.Bit, value: delisted ? 1 : 0 }
	]);
	return { success: true, delisted };
}

/**
 * Hapus Akun Perkiraan (Delete) dengan pengecekan integritas tabel transaksi
 */
export async function deleteCOA(
	acc: string
): Promise<{ success: boolean; message: string }> {
	const cleanAcc = acc.trim();
	const existing = await getCOAById(cleanAcc);
	if (!existing) {
		throw new Error(`Akun dengan kode "${cleanAcc}" tidak ditemukan`);
	}

	// Pengecekan tabel transaksi yang menggunakan Acc
	const checkQ = `
		SELECT
			(SELECT COUNT(*) FROM [cp].[dbo].[taGLJnlDT] WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc) AS countJurnal,
			(SELECT COUNT(*) FROM [cp].[dbo].[taGLSaldo] WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc) AS countSaldo,
			(SELECT COUNT(*) FROM [cp].[dbo].[taBankInvoice] WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc) AS countBankInv,
			(SELECT COUNT(*) FROM [cp].[dbo].[taGiro] WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc) AS countGiro,
			(SELECT COUNT(*) FROM [cp].[dbo].[taGLPayHD2] WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc) AS countPay,
			(SELECT COUNT(*) FROM [cp].[dbo].[taGLRecHD2] WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc) AS countRec,
			(SELECT COUNT(*) FROM [cp].[dbo].[taGLAcc] WHERE UPPER(RTRIM(LTRIM(AccParent))) = @Acc AND UPPER(RTRIM(LTRIM(Acc))) <> @Acc) AS countChild
	`;

	const res = await runQuery(checkQ, [{ name: 'Acc', type: sql.VarChar(15), value: cleanAcc.toUpperCase() }]);
	const r = res.recordset[0] || {};
	const conflicts: string[] = [];

	if (Number(r.countJurnal || 0) > 0) conflicts.push(`${r.countJurnal} Baris Jurnal Akuntansi (taGLJnlDT)`);
	if (Number(r.countSaldo || 0) > 0) conflicts.push(`${r.countSaldo} Catatan Saldo Akun (taGLSaldo)`);
	if (Number(r.countBankInv || 0) > 0) conflicts.push(`${r.countBankInv} Transaksi Bank/Invoice (taBankInvoice)`);
	if (Number(r.countGiro || 0) > 0) conflicts.push(`${r.countGiro} Transaksi Giro (taGiro)`);
	if (Number(r.countPay || 0) > 0) conflicts.push(`${r.countPay} Pembayaran Kas/Bank (taGLPayHD2)`);
	if (Number(r.countRec || 0) > 0) conflicts.push(`${r.countRec} Penerimaan Kas/Bank (taGLRecHD2)`);
	if (Number(r.countChild || 0) > 0) conflicts.push(`${r.countChild} Sub-Akun / Akun Anak (sebagai Parent)`);

	if (conflicts.length > 0) {
		throw new Error(
			`Akun "${existing.AccName}" (${cleanAcc}) tidak dapat dihapus karena memiliki riwayat: ${conflicts.join(', ')}. Anda dapat mengubah statusnya menjadi "Nonaktif/Delisted".`
		);
	}

	const deleteQ = `DELETE FROM [cp].[dbo].[taGLAcc] WHERE UPPER(RTRIM(LTRIM(Acc))) = @Acc`;
	await runQuery(deleteQ, [{ name: 'Acc', type: sql.VarChar(15), value: cleanAcc.toUpperCase() }]);

	return {
		success: true,
		message: `Akun "${existing.AccName}" (${cleanAcc}) berhasil dihapus.`
	};
}

/**
 * Generate file Excel (.xlsx) untuk Bagan Akun (COA)
 */
export async function generateCOAExcel(params: {
	q?: string;
	group?: string;
	type?: string;
	pos?: string;
	curr?: string;
	status?: string;
}): Promise<Buffer> {
	const result = await getCOAPaged({
		...params,
		page: 1,
		pageSize: 10000
	});

	const wb = XLSX.utils.book_new();

	const aoa: any[][] = [
		['BAGAN AKUN / CHART OF ACCOUNTS (taGLAcc)'],
		[`Waktu Unduh: ${new Date().toLocaleString('id-ID')}`],
		[`Total Akun: ${result.total} Akun`],
		[],
		[
			'No',
			'Kode Perkiraan (Acc)',
			'Nama Perkiraan',
			'Nama Alias / Inggris',
			'Kelompok (Group)',
			'Tipe Akun',
			'Posisi Normal',
			'Akun Induk (Parent)',
			'Valuta',
			'Saldo Berjalan (IDR)',
			'Saldo Awal (IDR)',
			'No. Rekening Bank',
			'Status',
			'Catatan / Remark'
		]
	];

	const typeLabels: Record<string, string> = {
		'1': 'Header',
		'2': 'Detail',
		'3': 'Kas',
		'4': 'Bank'
	};

	result.rows.forEach((item, idx) => {
		aoa.push([
			idx + 1,
			item.Acc,
			item.AccName,
			item.AccName2 || '-',
			item.GroupName ? `${item.AccGroup} - ${item.GroupName}` : (item.AccGroup || '-'),
			typeLabels[item.AccType || '2'] || item.AccType || '-',
			item.AccPos === 'D' ? 'Debit (D)' : 'Kredit (K)',
			item.AccParent || '-',
			item.AccCurr || 'IDR',
			item.AmountRp,
			item.SAmountRp,
			item.AccountBank || '-',
			item.Delisted ? 'NONAKTIF' : 'AKTIF',
			item.Remark || '-'
		]);
	});

	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws['!cols'] = [
		{ wch: 6 }, // No
		{ wch: 18 }, // Acc
		{ wch: 38 }, // AccName
		{ wch: 30 }, // AccName2
		{ wch: 20 }, // Kelompok
		{ wch: 14 }, // Tipe
		{ wch: 16 }, // Pos
		{ wch: 16 }, // Parent
		{ wch: 10 }, // Valuta
		{ wch: 22 }, // Saldo Berjalan
		{ wch: 22 }, // Saldo Awal
		{ wch: 25 }, // No Rekening
		{ wch: 14 }, // Status
		{ wch: 25 } // Remark
	];

	XLSX.utils.book_append_sheet(wb, ws, 'Bagan Akun COA');
	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
