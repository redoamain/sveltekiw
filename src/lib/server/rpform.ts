import { runQuery, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface RpFormItem {
	rjn: number;
	GroupName: string;
	ProgName: string;
	DisplayName: string | null;
	Remark: string | null;
	Indeks: number | null;
	FormName?: string | null;
	FormDisplayName?: string | null;
	isStoredProcedure: boolean;
}

export interface RpFormStats {
	total: number;
	totalGroups: number;
	totalPrograms: number;
	totalStoredProcedures: number;
	totalWithRemark: number;
}

export interface GroupOption {
	GroupName: string;
	count: number;
	sampleRemark: string | null;
}

export interface RpFormPagedResult {
	rows: RpFormItem[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	stats: RpFormStats;
}

function mapRpFormRow(r: any): RpFormItem {
	return {
		rjn: Number(r.rjn || 0),
		GroupName: String(r.GroupName || '').trim(),
		ProgName: String(r.ProgName || '').trim(),
		DisplayName: r.DisplayName != null ? String(r.DisplayName).trim() : null,
		Remark: r.Remark != null ? String(r.Remark).trim() : null,
		Indeks: r.Indeks != null ? Number(r.Indeks) : null,
		FormName: r.FormName != null ? String(r.FormName).trim() : null,
		FormDisplayName: r.FormDisplayName != null ? String(r.FormDisplayName).trim() : null,
		isStoredProcedure: Boolean(r.isStoredProcedure)
	};
}

/**
 * Ambil daftar ringkasan statistik taRpForm
 */
export async function getRpFormStats(): Promise<RpFormStats> {
	try {
		const q = `
			SELECT
				COUNT(*) AS total,
				COUNT(DISTINCT rp.GroupName) AS totalGroups,
				COUNT(DISTINCT rp.ProgName) AS totalPrograms,
				SUM(CASE WHEN NULLIF(RTRIM(LTRIM(rp.Remark)), '') IS NOT NULL THEN 1 ELSE 0 END) AS totalWithRemark,
				SUM(CASE WHEN sp.ROUTINE_NAME IS NOT NULL THEN 1 ELSE 0 END) AS totalStoredProcedures
			FROM [cp].[dbo].[taRpForm] rp
			LEFT JOIN (
				SELECT DISTINCT ROUTINE_NAME 
				FROM INFORMATION_SCHEMA.ROUTINES 
				WHERE ROUTINE_TYPE = 'PROCEDURE'
			) sp ON rp.ProgName = sp.ROUTINE_NAME
		`;
		const res = await runQuery(q);
		const r = res.recordset[0] || {};
		return {
			total: Number(r.total || 0),
			totalGroups: Number(r.totalGroups || 0),
			totalPrograms: Number(r.totalPrograms || 0),
			totalStoredProcedures: Number(r.totalStoredProcedures || 0),
			totalWithRemark: Number(r.totalWithRemark || 0)
		};
	} catch (err) {
		log.error({ err }, 'Gagal menghitung statistik taRpForm');
		return {
			total: 0,
			totalGroups: 0,
			totalPrograms: 0,
			totalStoredProcedures: 0,
			totalWithRemark: 0
		};
	}
}

/**
 * Ambil daftar semua GroupName unik untuk filter dropdown
 */
export async function getRpFormGroups(): Promise<GroupOption[]> {
	try {
		const q = `
			SELECT 
				GroupName, 
				COUNT(*) AS count,
				MAX(Remark) AS sampleRemark
			FROM [cp].[dbo].[taRpForm]
			WHERE GroupName IS NOT NULL
			GROUP BY GroupName
			ORDER BY GroupName ASC
		`;
		const res = await runQuery(q);
		return (res.recordset || []).map((r: any) => ({
			GroupName: String(r.GroupName || '').trim(),
			count: Number(r.count || 0),
			sampleRemark: r.sampleRemark != null ? String(r.sampleRemark).trim() : null
		}));
	} catch (err) {
		log.error({ err }, 'Gagal mengambil daftar group taRpForm');
		return [];
	}
}

/**
 * Mengambil data pemetaan taRpForm dengan pagination, filter, dan join ke taFormReport & SP
 */
export async function getRpFormPaged(params: {
	q?: string;
	group?: string;
	progType?: string;
	page?: number;
	pageSize?: number;
}): Promise<RpFormPagedResult> {
	const page = Math.max(1, params.page || 1);
	const pageSize = Math.max(10, Math.min(500, params.pageSize || 50));
	const offset = (page - 1) * pageSize;

	const search = (params.q || '').trim();
	const groupFilter = (params.group || '').trim().toUpperCase();
	const progType = (params.progType || '').trim().toLowerCase();

	const conditions: string[] = ['1=1'];
	const inputs: { name: string; type: any; value: any }[] = [];

	if (search) {
		conditions.push(`(
			rp.GroupName LIKE @search OR
			rp.ProgName LIKE @search OR
			rp.DisplayName LIKE @search OR
			rp.Remark LIKE @search OR
			fr.FormName LIKE @search OR
			fr.DisplayName LIKE @search
		)`);
		inputs.push({ name: 'search', type: sql.NVarChar(120), value: `%${search}%` });
	}

	if (groupFilter) {
		conditions.push(`UPPER(RTRIM(LTRIM(rp.GroupName))) = @groupFilter`);
		inputs.push({ name: 'groupFilter', type: sql.VarChar(10), value: groupFilter });
	}

	if (progType === 'sp') {
		conditions.push(`sp.ROUTINE_NAME IS NOT NULL`);
	} else if (progType === 'report') {
		conditions.push(`sp.ROUTINE_NAME IS NULL`);
	}

	const whereClause = conditions.join(' AND ');

	const baseQuery = `
		FROM [cp].[dbo].[taRpForm] rp
		OUTER APPLY (
			SELECT TOP 1 FormName, DisplayName
			FROM [cp].[dbo].[taFormReport]
			WHERE GroupName = rp.GroupName
			ORDER BY FormName
		) fr
		LEFT JOIN (
			SELECT DISTINCT ROUTINE_NAME 
			FROM INFORMATION_SCHEMA.ROUTINES 
			WHERE ROUTINE_TYPE = 'PROCEDURE'
		) sp ON rp.ProgName = sp.ROUTINE_NAME
	`;

	const countQ = `
		SELECT COUNT(*) AS total
		${baseQuery}
		WHERE ${whereClause}
	`;

	const dataQ = `
		SELECT
			rp.rjn,
			rp.GroupName,
			rp.ProgName,
			rp.DisplayName,
			rp.Remark,
			rp.Indeks,
			fr.FormName,
			fr.DisplayName AS FormDisplayName,
			CASE WHEN sp.ROUTINE_NAME IS NOT NULL THEN 1 ELSE 0 END AS isStoredProcedure
		${baseQuery}
		WHERE ${whereClause}
		ORDER BY rp.GroupName ASC, rp.Indeks ASC, rp.rjn ASC
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
		getRpFormStats()
	]);

	const total = countRes.recordset[0]?.total || 0;
	const rows = (dataRes.recordset || []).map(mapRpFormRow);
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
 * Mengambil isi kode definisi Stored Procedure SQL jika ada
 */
export async function getProgramDefinition(
	progName: string
): Promise<{ exists: boolean; definition: string | null }> {
	const clean = progName.trim();
	try {
		const q = `
			SELECT OBJECT_DEFINITION(OBJECT_ID(@progName)) AS def
		`;
		const res = await runQuery(q, [{ name: 'progName', type: sql.VarChar(100), value: clean }]);
		const def = res.recordset?.[0]?.def ? String(res.recordset[0].def) : null;
		return {
			exists: Boolean(def),
			definition: def
		};
	} catch (err) {
		log.warn({ err, progName }, 'Gagal mengambil definisi program SQL');
		return { exists: false, definition: null };
	}
}

/**
 * Generate file Excel (.xlsx) untuk laporan pemetaan taRpForm
 */
export async function generateRpFormExcel(params: {
	q?: string;
	group?: string;
	progType?: string;
}): Promise<Buffer> {
	const result = await getRpFormPaged({
		...params,
		page: 1,
		pageSize: 10000
	});

	const wb = XLSX.utils.book_new();

	const aoa: any[][] = [
		['LAPORAN PEMETAAN PROGRAM FORM (taRpForm)'],
		[`Waktu Unduh: ${new Date().toLocaleString('id-ID')}`],
		[`Total Data: ${result.total} Pemetaan Program`],
		[],
		[
			'No',
			'Group / Fitur',
			'Kode Form (taFormReport)',
			'Nama Form UI',
			'Nama Program / File (.rpt / SP)',
			'Tipe Program',
			'Label Tab / Display',
			'Keterangan / Fungsi',
			'Urutan (Indeks)',
			'ID Baris (rjn)'
		]
	];

	result.rows.forEach((item, idx) => {
		aoa.push([
			idx + 1,
			item.GroupName,
			item.FormName || '-',
			item.FormDisplayName || '-',
			item.ProgName,
			item.isStoredProcedure ? 'SQL Stored Procedure' : 'Crystal Report / Program Client',
			item.DisplayName || '-',
			item.Remark || '-',
			item.Indeks !== null ? item.Indeks : '-',
			item.rjn
		]);
	});

	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws['!cols'] = [
		{ wch: 6 }, // No
		{ wch: 14 }, // Group
		{ wch: 18 }, // FormName
		{ wch: 30 }, // FormDisplayName
		{ wch: 32 }, // ProgName
		{ wch: 28 }, // Tipe Program
		{ wch: 22 }, // DisplayName
		{ wch: 40 }, // Remark
		{ wch: 16 }, // Indeks
		{ wch: 12 } // rjn
	];

	XLSX.utils.book_append_sheet(wb, ws, 'Mapping taRpForm');
	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
