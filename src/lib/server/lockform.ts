import { runQuery, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface LockFormItem {
	Form_Name: string;
	Form_Alias: string;
	Form_Tipe: number; // 0: Operasional/Logistik, 1: Finance/GL, 2: Produksi/PPIC
	LockDate: string | null; // YYYY-MM-DD
	LockDateTime: string | null; // ISO string
	isLocked: boolean;
	CategoryLabel: string;
}

export interface LockFormStats {
	totalForms: number;
	totalOperasional: number;
	totalFinance: number;
	totalProduksi: number;
	totalLocked: number;
	totalUnlocked: number;
	latestLockDate: string | null;
}

export function getCategoryLabel(tipe: number): string {
	switch (tipe) {
		case 0:
			return 'Operasional & Logistik';
		case 1:
			return 'Finance & Akuntansi';
		case 2:
			return 'Produksi & PPIC';
		default:
			return 'Lainnya';
	}
}

/**
 * Mengambil seluruh daftar taLockform dengan statistik ringkasan
 */
export async function getAllLockforms(filter?: {
	q?: string;
	tipe?: number | 'all';
	status?: 'all' | 'locked' | 'unlocked';
}): Promise<{ items: LockFormItem[]; stats: LockFormStats }> {
	try {
		const res = await runQuery(`
			SELECT 
				RTRIM(LTRIM(Form_Name)) AS Form_Name,
				LockDate,
				ISNULL(Form_Tipe, 0) AS Form_Tipe,
				RTRIM(LTRIM(ISNULL(Form_Alias, ''))) AS Form_Alias
			FROM [cp].[dbo].[taLockform]
			ORDER BY Form_Tipe ASC, Form_Alias ASC, Form_Name ASC
		`);

		const rawRows = res.recordset || [];

		let totalOperasional = 0;
		let totalFinance = 0;
		let totalProduksi = 0;
		let totalLocked = 0;
		let totalUnlocked = 0;
		let maxDate: Date | null = null;

		const items: LockFormItem[] = rawRows.map((r: any) => {
			const formName = String(r.Form_Name || '').trim();
			const formAlias = String(r.Form_Alias || formName).trim();
			const formTipe = Number(r.Form_Tipe ?? 0);
			const lockDateObj = r.LockDate ? new Date(r.LockDate) : null;
			const isLocked = lockDateObj !== null;

			if (formTipe === 0) totalOperasional++;
			else if (formTipe === 1) totalFinance++;
			else if (formTipe === 2) totalProduksi++;

			if (isLocked) {
				totalLocked++;
				if (!maxDate || (lockDateObj && lockDateObj > maxDate)) {
					maxDate = lockDateObj;
				}
			} else {
				totalUnlocked++;
			}

			const lockDate = lockDateObj
				? lockDateObj.toISOString().slice(0, 10)
				: null;

			return {
				Form_Name: formName,
				Form_Alias: formAlias,
				Form_Tipe: formTipe,
				LockDate: lockDate,
				LockDateTime: lockDateObj ? lockDateObj.toISOString() : null,
				isLocked,
				CategoryLabel: getCategoryLabel(formTipe)
			};
		});

		const stats: LockFormStats = {
			totalForms: items.length,
			totalOperasional,
			totalFinance,
			totalProduksi,
			totalLocked,
			totalUnlocked,
			latestLockDate: maxDate ? (maxDate as Date).toISOString().slice(0, 10) : null
		};

		// Filter di memory jika diberikan kriteria pencarian
		let filteredItems = items;

		if (filter?.q) {
			const q = filter.q.trim().toLowerCase();
			filteredItems = filteredItems.filter(
				(i) =>
					i.Form_Name.toLowerCase().includes(q) ||
					i.Form_Alias.toLowerCase().includes(q)
			);
		}

		if (filter?.tipe !== undefined && filter?.tipe !== 'all') {
			filteredItems = filteredItems.filter((i) => i.Form_Tipe === Number(filter.tipe));
		}

		if (filter?.status === 'locked') {
			filteredItems = filteredItems.filter((i) => i.isLocked);
		} else if (filter?.status === 'unlocked') {
			filteredItems = filteredItems.filter((i) => !i.isLocked);
		}

		return { items: filteredItems, stats };
	} catch (err: any) {
		log.error({ err }, 'Gagal mengambil data taLockform');
		throw new Error(err?.message || 'Gagal memuat data taLockform');
	}
}

/**
 * Update tanggal kunci (LockDate) untuk 1 form
 */
export async function updateSingleLockDate(
	formName: string,
	lockDateStr: string | null,
	operator = 'SYSTEM'
): Promise<{ success: boolean; message: string }> {
	const cleanName = formName.trim();
	if (!cleanName) throw new Error('Nama form wajib disertakan');

	const dateVal = lockDateStr ? new Date(`${lockDateStr}T00:00:00Z`) : null;

	await runQuery(
		`UPDATE [cp].[dbo].[taLockform]
		 SET LockDate = @lockDate
		 WHERE Form_Name = @formName`,
		[
			{ name: 'lockDate', type: sql.DateTime, value: dateVal },
			{ name: 'formName', type: sql.VarChar(50), value: cleanName }
		]
	);

	log.info(
		{ formName: cleanName, lockDate: lockDateStr, operator },
		'taLockform: Berhasil memperbarui tanggal kunci form'
	);

	return {
		success: true,
		message: lockDateStr
			? `Form "${cleanName}" berhasil dikunci hingga ${lockDateStr}.`
			: `Kunci form "${cleanName}" berhasil dibuka (LockDate = NULL).`
	};
}

/**
 * Update massal tanggal kunci (Batch Update) untuk beberapa form terpilih
 */
export async function batchUpdateLockDates(
	formNames: string[],
	lockDateStr: string | null,
	operator = 'SYSTEM'
): Promise<{ success: boolean; count: number; message: string }> {
	if (!Array.isArray(formNames) || formNames.length === 0) {
		throw new Error('Pilih minimal satu form untuk diperbarui');
	}

	const cleanNames = formNames.map((n) => n.trim()).filter(Boolean);
	if (cleanNames.length === 0) throw new Error('Daftar form tidak valid');

	const dateVal = lockDateStr ? new Date(`${lockDateStr}T00:00:00Z`) : null;

	// Bangun parameter dinamis untuk query IN (...)
	const params: { name: string; type: any; value: any }[] = [
		{ name: 'lockDate', type: sql.DateTime, value: dateVal }
	];

	const placeholders = cleanNames.map((name, idx) => {
		const paramName = `fn_${idx}`;
		params.push({ name: paramName, type: sql.VarChar(50), value: name });
		return `@${paramName}`;
	});

	await runQuery(
		`UPDATE [cp].[dbo].[taLockform]
		 SET LockDate = @lockDate
		 WHERE Form_Name IN (${placeholders.join(', ')})`,
		params
	);

	log.info(
		{ count: cleanNames.length, lockDate: lockDateStr, operator },
		'taLockform: Berhasil batch update tanggal kunci'
	);

	return {
		success: true,
		count: cleanNames.length,
		message: lockDateStr
			? `Berhasil mengunci ${cleanNames.length} form hingga tanggal ${lockDateStr}.`
			: `Berhasil membuka kunci ${cleanNames.length} form.`
	};
}

/**
 * Simpan Form Baru atau Perbarui Metadata Form
 */
export async function saveLockform(
	data: {
		formName: string;
		formAlias: string;
		formTipe: number;
		lockDate?: string | null;
		isEdit: boolean;
	},
	operator = 'SYSTEM'
): Promise<{ success: boolean; message: string }> {
	const cleanName = data.formName.trim();
	const cleanAlias = data.formAlias.trim() || cleanName;
	const formTipe = Number(data.formTipe ?? 0);
	const dateVal = data.lockDate ? new Date(`${data.lockDate}T00:00:00Z`) : null;

	if (!cleanName) throw new Error('Nama Form (Form_Name) wajib diisi');

	if (data.isEdit) {
		await runQuery(
			`UPDATE [cp].[dbo].[taLockform]
			 SET Form_Alias = @formAlias,
			     Form_Tipe = @formTipe,
			     LockDate = @lockDate
			 WHERE Form_Name = @formName`,
			[
				{ name: 'formAlias', type: sql.VarChar(50), value: cleanAlias },
				{ name: 'formTipe', type: sql.TinyInt, value: formTipe },
				{ name: 'lockDate', type: sql.DateTime, value: dateVal },
				{ name: 'formName', type: sql.VarChar(50), value: cleanName }
			]
		);

		log.info({ formName: cleanName, operator }, 'taLockform: Berhasil mengubah metadata form');
		return { success: true, message: `Form "${cleanName}" berhasil diperbarui.` };
	} else {
		// Cek duplikasi
		const check = await runQuery(
			`SELECT COUNT(*) AS cnt FROM [cp].[dbo].[taLockform] WHERE Form_Name = @formName`,
			[{ name: 'formName', type: sql.VarChar(50), value: cleanName }]
		);

		if (check.recordset[0]?.cnt > 0) {
			throw new Error(`Form dengan nama "${cleanName}" sudah terdaftar di taLockform.`);
		}

		await runQuery(
			`INSERT INTO [cp].[dbo].[taLockform] (Form_Name, Form_Alias, Form_Tipe, LockDate)
			 VALUES (@formName, @formAlias, @formTipe, @lockDate)`,
			[
				{ name: 'formName', type: sql.VarChar(50), value: cleanName },
				{ name: 'formAlias', type: sql.VarChar(50), value: cleanAlias },
				{ name: 'formTipe', type: sql.TinyInt, value: formTipe },
				{ name: 'lockDate', type: sql.DateTime, value: dateVal }
			]
		);

		log.info({ formName: cleanName, operator }, 'taLockform: Berhasil mendaftarkan form baru');
		return { success: true, message: `Form baru "${cleanName}" berhasil didaftarkan.` };
	}
}

/**
 * Hapus Form dari taLockform
 */
export async function deleteLockform(
	formName: string,
	operator = 'SYSTEM'
): Promise<{ success: boolean; message: string }> {
	const cleanName = formName.trim();
	if (!cleanName) throw new Error('Nama form wajib disertakan');

	await runQuery(
		`DELETE FROM [cp].[dbo].[taLockform] WHERE Form_Name = @formName`,
		[{ name: 'formName', type: sql.VarChar(50), value: cleanName }]
	);

	log.info({ formName: cleanName, operator }, 'taLockform: Berhasil menghapus form');
	return { success: true, message: `Form "${cleanName}" berhasil dihapus dari daftar kunci.` };
}

/**
 * Export daftar taLockform ke berkas Excel
 */
export async function exportLockformsToExcel(): Promise<Buffer> {
	const { items } = await getAllLockforms();

	const rows = items.map((item, idx) => ({
		No: idx + 1,
		'Nama Form (Internal)': item.Form_Name,
		'Alias / Nama Tampilan Form': item.Form_Alias,
		'Kategori / Tipe': item.CategoryLabel,
		'Status Penguncian': item.isLocked ? 'TERKUNCI' : 'TERBUKA',
		'Tanggal Kunci (LockDate)': item.LockDate || '-'
	}));

	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.json_to_sheet(rows);

	ws['!cols'] = [
		{ wch: 6 },
		{ wch: 25 },
		{ wch: 35 },
		{ wch: 25 },
		{ wch: 18 },
		{ wch: 20 }
	];

	XLSX.utils.book_append_sheet(wb, ws, 'Status Kunci Form');
	const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
	return buf as Buffer;
}

/**
 * Helper utilitas untuk mengecek apakah transaksi pada form tertentu terkunci
 * Mengembalikan true jika targetDate <= LockDate
 */
export async function isFormTransactionLocked(
	formName: string,
	targetDate: string | Date
): Promise<{ isLocked: boolean; lockDate: string | null }> {
	try {
		const res = await runQuery(
			`SELECT TOP 1 LockDate 
			 FROM [cp].[dbo].[taLockform] 
			 WHERE Form_Name = @formName`,
			[{ name: 'formName', type: sql.VarChar(50), value: formName.trim() }]
		);

		const r = res.recordset[0];
		if (!r || !r.LockDate) {
			return { isLocked: false, lockDate: null };
		}

		const lockDate = new Date(r.LockDate);
		const checkDate = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;

		const isLocked = checkDate.getTime() <= lockDate.getTime();
		return {
			isLocked,
			lockDate: lockDate.toISOString().slice(0, 10)
		};
	} catch (err) {
		log.error({ err, formName }, 'Gagal memeriksa status lock form');
		return { isLocked: false, lockDate: null };
	}
}
