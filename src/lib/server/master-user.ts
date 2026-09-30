import { runQuery, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';
import { resolveUserRole } from '$lib/permissions';

export interface MasterUser {
	UserName: string;
	Password?: string;
	Bagian: string;
	GroupID: string;
	GroupName: string | null;
	Aktif: boolean;
	kodeprint: string | null;
	salesID: string | null;
	// Setting MenuCP
	groupInputOS: string | null;
	groupInputMB: string | null;
	groupInputKeluhan: string | null;
	KeluhanCustomer: boolean;
	ApprovedEditRequest: number | null;
	SaldoHarian: number | null;
	MonitoringDoc: number | null;
	ShowKursDBTR: boolean;
	// Role resolution
	role: string;
	roleLabel: string;
	isSuperAdmin: boolean;
}

export interface UserGroup {
	GroupID: string;
	GroupName: string;
}

export interface SetupPrint {
	kode: string;
	txt: string;
	txtP: string;
	userCount?: number;
}

export interface GroupHakAksesItem {
	GroupID: string;
	GroupName: string;
	MenuID: string;
	DeptID: string;
	MenuLevel: string;
	MenuCaption: string;
	IsEnabled: boolean;
	IsVisible: boolean;
	IsAppend: boolean;
	IsEdit: boolean;
	IsDelete: boolean;
	IsAED: boolean;
	isAdmin: boolean | null;
}

export interface CreateUserPayload {
	UserName: string;
	Password?: string;
	Bagian: string;
	GroupID: string;
	Aktif?: boolean;
	kodeprint?: string | null;
	salesID?: string | null;
	// Setting MenuCP
	groupInputOS?: string | null;
	groupInputMB?: string | null;
	groupInputKeluhan?: string | null;
	KeluhanCustomer?: boolean;
	ApprovedEditRequest?: number | null;
	SaldoHarian?: number | null;
	MonitoringDoc?: number | null;
	ShowKursDBTR?: boolean;
}

export interface UserSummaryStats {
	total: number;
	totalAktif: number;
	totalNonAktif: number;
	totalAdmin: number;
}

export interface UserPagedResult {
	rows: MasterUser[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	stats: UserSummaryStats;
	groups: UserGroup[];
	setupPrints: SetupPrint[];
}

function mapUserRow(r: any): MasterUser {
	const rawBagian = String(r.Bagian || '').trim().toUpperCase();
	const rawGroupId = String(r.GroupID || '').trim();
	const rawUserName = String(r.UserName || '').trim();

	const resolved = resolveUserRole({
		UserName: rawUserName,
		Bagian: rawBagian,
		GroupID: rawGroupId
	});

	return {
		UserName: rawUserName,
		Password: r.Password != null ? String(r.Password).trim() : '',
		Bagian: rawBagian,
		GroupID: rawGroupId,
		GroupName: r.GroupName != null ? String(r.GroupName).trim() : null,
		Aktif: r.Aktif !== false && r.Aktif !== 0,
		kodeprint: r.kodeprint != null ? String(r.kodeprint).trim() : null,
		salesID: r.salesID != null ? String(r.salesID).trim() : null,
		groupInputOS: r.groupInputOS != null ? String(r.groupInputOS).trim() : '99',
		groupInputMB: r.groupInputMB != null ? String(r.groupInputMB).trim() : '99',
		groupInputKeluhan: r.groupInputKeluhan != null ? String(r.groupInputKeluhan).trim() : '99',
		KeluhanCustomer: Boolean(r.KeluhanCustomer),
		ApprovedEditRequest: r.ApprovedEditRequest != null ? Number(r.ApprovedEditRequest) : 99,
		SaldoHarian: r.SaldoHarian != null ? Number(r.SaldoHarian) : 99,
		MonitoringDoc: r.MonitoringDoc != null ? Number(r.MonitoringDoc) : 99,
		ShowKursDBTR: r.ShowKursDBTR !== false && r.ShowKursDBTR !== 0,
		role: resolved.role,
		roleLabel: resolved.roleLabel,
		isSuperAdmin: resolved.isSuperAdmin
	};
}

/**
 * Mengambil seluruh daftar group hak akses dari taGroup
 */
export async function getAllUserGroups(): Promise<UserGroup[]> {
	try {
		const res = await runQuery(`
			SELECT 
				RTRIM(LTRIM(GroupID)) AS GroupID,
				RTRIM(LTRIM(GroupName)) AS GroupName
			FROM [MenuCP].[dbo].[taGroup]
			ORDER BY GroupName ASC
		`);
		return (res.recordset || []).map((r: any) => ({
			GroupID: String(r.GroupID || '').trim(),
			GroupName: String(r.GroupName || '').trim()
		}));
	} catch (err) {
		log.error({ err }, 'Gagal mengambil data taGroup');
		return [];
	}
}

/**
 * Mengambil seluruh daftar printer dari [MenuCP].[dbo].[taSetupPrint]
 */
export async function getAllSetupPrint(): Promise<SetupPrint[]> {
	try {
		const res = await runQuery(`
			SELECT 
				RTRIM(LTRIM(p.kode)) AS kode,
				RTRIM(LTRIM(ISNULL(p.txt, ''))) AS txt,
				RTRIM(LTRIM(ISNULL(p.txtP, ''))) AS txtP,
				COUNT(u.UserName) AS userCount
			FROM [MenuCP].[dbo].[taSetupPrint] p
			LEFT JOIN [MenuCP].[dbo].[taUser] u ON RTRIM(LTRIM(u.kodeprint)) = RTRIM(LTRIM(p.kode))
			GROUP BY p.kode, p.txt, p.txtP
			ORDER BY p.kode ASC
		`);
		return (res.recordset || []).map((r: any) => ({
			kode: String(r.kode || '').trim(),
			txt: String(r.txt || '').trim(),
			txtP: String(r.txtP || '').trim(),
			userCount: Number(r.userCount || 0)
		}));
	} catch (err) {
		log.error({ err }, 'Gagal mengambil data taSetupPrint');
		return [];
	}
}

/**
 * Simpan atau perbarui data printer di [MenuCP].[dbo].[taSetupPrint]
 */
export async function saveSetupPrint(payload: { kode: string; txt: string; txtP: string }): Promise<SetupPrint> {
	const kode = payload.kode.trim().toLowerCase().slice(0, 10);
	const txt = (payload.txt || '').trim().slice(0, 50);
	const txtP = (payload.txtP || '').trim().slice(0, 50);

	if (!kode) {
		throw new Error('Kode printer wajib diisi.');
	}

	const check = await runQuery(
		`SELECT TOP 1 1 FROM [MenuCP].[dbo].[taSetupPrint] WHERE LOWER(RTRIM(LTRIM(kode))) = @kode`,
		[{ name: 'kode', type: sql.VarChar(10), value: kode }]
	);

	if ((check.recordset || []).length > 0) {
		await runQuery(
			`UPDATE [MenuCP].[dbo].[taSetupPrint] SET txt = @txt, txtP = @txtP WHERE LOWER(RTRIM(LTRIM(kode))) = @kode`,
			[
				{ name: 'kode', type: sql.VarChar(10), value: kode },
				{ name: 'txt', type: sql.VarChar(50), value: txt },
				{ name: 'txtP', type: sql.VarChar(50), value: txtP }
			]
		);
	} else {
		await runQuery(
			`INSERT INTO [MenuCP].[dbo].[taSetupPrint] (kode, txt, txtP) VALUES (@kode, @txt, @txtP)`,
			[
				{ name: 'kode', type: sql.VarChar(10), value: kode },
				{ name: 'txt', type: sql.VarChar(50), value: txt },
				{ name: 'txtP', type: sql.VarChar(50), value: txtP }
			]
		);
	}

	return { kode, txt, txtP };
}

/**
 * Hapus printer dari [MenuCP].[dbo].[taSetupPrint]
 */
export async function deleteSetupPrint(kode: string): Promise<{ success: boolean; message: string }> {
	const clean = kode.trim().toLowerCase();

	const checkUsage = await runQuery(
		`SELECT COUNT(*) as cnt FROM [MenuCP].[dbo].[taUser] WHERE LOWER(RTRIM(LTRIM(kodeprint))) = @kode`,
		[{ name: 'kode', type: sql.VarChar(10), value: clean }]
	);

	const cnt = checkUsage.recordset[0]?.cnt || 0;
	if (cnt > 0) {
		throw new Error(`Printer "${clean}" tidak dapat dihapus karena masih digunakan oleh ${cnt} pengguna.`);
	}

	await runQuery(
		`DELETE FROM [MenuCP].[dbo].[taSetupPrint] WHERE LOWER(RTRIM(LTRIM(kode))) = @kode`,
		[{ name: 'kode', type: sql.VarChar(10), value: clean }]
	);

	return {
		success: true,
		message: `Printer "${clean}" berhasil dihapus.`
	};
}

/**
 * Ambil daftar Hak Akses Menu untuk Group tertentu dari [MenuCP].[dbo].[taHakAkses]
 */
export async function getGroupHakAkses(groupId: string, deptId?: string): Promise<GroupHakAksesItem[]> {
	const cleanGroupId = groupId.trim();
	const conditions = [`h.GroupID = @groupId`];
	const inputs: { name: string; type: any; value: any }[] = [
		{ name: 'groupId', type: sql.VarChar(2), value: cleanGroupId }
	];

	if (deptId && deptId.trim() && deptId !== 'ALL') {
		conditions.push(`h.DeptID = @deptId`);
		inputs.push({ name: 'deptId', type: sql.VarChar(2), value: deptId.trim().toUpperCase() });
	}

	try {
		const res = await runQuery(
			`
			SELECT 
				h.GroupID,
				g.GroupName,
				RTRIM(LTRIM(h.MenuID)) AS MenuID,
				RTRIM(LTRIM(h.DeptID)) AS DeptID,
				RTRIM(LTRIM(h.MenuLevel)) AS MenuLevel,
				RTRIM(LTRIM(ISNULL(m.MenuCaption, h.MenuID))) AS MenuCaption,
				h.IsEnabled,
				h.IsVisible,
				h.IsAppend,
				h.IsEdit,
				h.IsDelete,
				h.IsAED,
				h.isAdmin
			FROM [MenuCP].[dbo].[taHakAkses] h
			JOIN [MenuCP].[dbo].[taGroup] g ON h.GroupID = g.GroupID
			LEFT JOIN [MenuCP].[dbo].[taMenus] m ON h.MenuID = m.MenuID
			WHERE ${conditions.join(' AND ')}
			ORDER BY h.DeptID ASC, h.MenuLevel ASC
		`,
			inputs
		);

		return (res.recordset || []).map((r: any) => ({
			GroupID: String(r.GroupID || '').trim(),
			GroupName: String(r.GroupName || '').trim(),
			MenuID: String(r.MenuID || '').trim(),
			DeptID: String(r.DeptID || '').trim(),
			MenuLevel: String(r.MenuLevel || '').trim(),
			MenuCaption: String(r.MenuCaption || '').trim(),
			IsEnabled: Boolean(r.IsEnabled),
			IsVisible: Boolean(r.IsVisible),
			IsAppend: Boolean(r.IsAppend),
			IsEdit: Boolean(r.IsEdit),
			IsDelete: Boolean(r.IsDelete),
			IsAED: Boolean(r.IsAED),
			isAdmin: r.isAdmin != null ? Boolean(r.isAdmin) : null
		}));
	} catch (err) {
		log.error({ err, groupId }, 'Gagal mengambil data taHakAkses');
		return [];
	}
}

/**
 * Toggle hak akses spesifik pada taHakAkses
 */
export async function toggleHakAksesField(
	groupId: string,
	menuId: string,
	field: 'IsEnabled' | 'IsVisible' | 'IsAppend' | 'IsEdit' | 'IsDelete',
	val: boolean
): Promise<boolean> {
	const allowedFields = ['IsEnabled', 'IsVisible', 'IsAppend', 'IsEdit', 'IsDelete'];
	if (!allowedFields.includes(field)) {
		throw new Error('Kolom hak akses tidak valid.');
	}

	await runQuery(
		`UPDATE [MenuCP].[dbo].[taHakAkses] 
		 SET ${field} = @val 
		 WHERE GroupID = @groupId AND MenuID = @menuId`,
		[
			{ name: 'groupId', type: sql.VarChar(2), value: groupId.trim() },
			{ name: 'menuId', type: sql.VarChar(20), value: menuId.trim() },
			{ name: 'val', type: sql.Bit, value: val ? 1 : 0 }
		]
	);

	return true;
}

/**
 * Mengambil ringkasan statistik pengguna
 */
export async function getUserStats(): Promise<UserSummaryStats> {
	try {
		const res = await runQuery(`
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN Aktif = 1 OR Aktif IS NULL THEN 1 ELSE 0 END) as totalAktif,
				SUM(CASE WHEN Aktif = 0 THEN 1 ELSE 0 END) as totalNonAktif,
				SUM(CASE WHEN GroupID = '99' OR Bagian = 'IT' OR UserName IN ('it', 'administrator') THEN 1 ELSE 0 END) as totalAdmin
			FROM [MenuCP].[dbo].[taUser]
		`);
		const r = res.recordset[0] || {};
		return {
			total: Number(r.total || 0),
			totalAktif: Number(r.totalAktif || 0),
			totalNonAktif: Number(r.totalNonAktif || 0),
			totalAdmin: Number(r.totalAdmin || 0)
		};
	} catch (err) {
		log.error({ err }, 'Gagal menghitung statistik pengguna');
		return { total: 0, totalAktif: 0, totalNonAktif: 0, totalAdmin: 0 };
	}
}

/**
 * Cek apakah UserName sudah terdaftar
 */
export async function userExists(username: string): Promise<boolean> {
	const clean = username.trim().toLowerCase();
	const res = await runQuery(
		`SELECT TOP 1 1 FROM [MenuCP].[dbo].[taUser] WHERE LOWER(RTRIM(LTRIM(UserName))) = @UserName`,
		[{ name: 'UserName', type: sql.VarChar(50), value: clean }]
	);
	return (res.recordset.length || 0) > 0;
}

/**
 * Ambil 1 User berdasarkan UserName
 */
export async function getUserByName(username: string): Promise<MasterUser | null> {
	const clean = username.trim().toLowerCase();
	const res = await runQuery(
		`SELECT TOP 1
			u.UserName, u.Password, u.Bagian, u.GroupID, g.GroupName,
			u.Aktif, u.kodeprint, u.salesID,
			u.groupInputOS, u.groupInputMB, u.groupInputKeluhan, u.KeluhanCustomer,
			u.ApprovedEditRequest, u.SaldoHarian, u.MonitoringDoc, u.ShowKursDBTR
		FROM [MenuCP].[dbo].[taUser] u
		LEFT JOIN [MenuCP].[dbo].[taGroup] g ON RTRIM(LTRIM(u.GroupID)) = RTRIM(LTRIM(g.GroupID))
		WHERE LOWER(RTRIM(LTRIM(u.UserName))) = @UserName`,
		[{ name: 'UserName', type: sql.VarChar(50), value: clean }]
	);
	if (!res.recordset || res.recordset.length === 0) return null;
	return mapUserRow(res.recordset[0]);
}

/**
 * Ambil daftar Master User dengan pagination, filter, dan pencarian
 */
export async function getMasterUsersPaged(params: {
	q?: string;
	bagian?: string;
	groupId?: string;
	status?: string;
	page?: number;
	pageSize?: number;
}): Promise<UserPagedResult> {
	const page = Math.max(1, params.page || 1);
	const pageSize = Math.max(10, Math.min(200, params.pageSize || 50));
	const offset = (page - 1) * pageSize;

	const search = (params.q || '').trim();
	const bagianFilter = (params.bagian || '').trim().toUpperCase();
	const groupIdFilter = (params.groupId || '').trim();
	const statusFilter = (params.status || '').trim().toUpperCase();

	const conditions: string[] = ['1=1'];
	const inputs: { name: string; type: any; value: any }[] = [];

	if (search) {
		conditions.push(`(
			u.UserName LIKE @search OR
			u.Bagian LIKE @search OR
			g.GroupName LIKE @search OR
			u.kodeprint LIKE @search OR
			u.salesID LIKE @search OR
			u.groupInputOS LIKE @search
		)`);
		inputs.push({ name: 'search', type: sql.NVarChar(120), value: `%${search}%` });
	}

	if (bagianFilter) {
		conditions.push(`UPPER(RTRIM(LTRIM(u.Bagian))) = @bagianFilter`);
		inputs.push({ name: 'bagianFilter', type: sql.VarChar(3), value: bagianFilter });
	}

	if (groupIdFilter) {
		conditions.push(`RTRIM(LTRIM(u.GroupID)) = @groupIdFilter`);
		inputs.push({ name: 'groupIdFilter', type: sql.VarChar(2), value: groupIdFilter });
	}

	if (statusFilter) {
		if (statusFilter === 'AKTIF') {
			conditions.push(`(u.Aktif = 1 OR u.Aktif IS NULL)`);
		} else if (statusFilter === 'NONAKTIF') {
			conditions.push(`u.Aktif = 0`);
		}
	}

	const whereClause = conditions.join(' AND ');

	const countQ = `
		SELECT COUNT(*) as total
		FROM [MenuCP].[dbo].[taUser] u
		LEFT JOIN [MenuCP].[dbo].[taGroup] g ON RTRIM(LTRIM(u.GroupID)) = RTRIM(LTRIM(g.GroupID))
		WHERE ${whereClause}
	`;

	const dataQ = `
		SELECT 
			u.UserName, u.Password, u.Bagian, u.GroupID, g.GroupName,
			u.Aktif, u.kodeprint, u.salesID,
			u.groupInputOS, u.groupInputMB, u.groupInputKeluhan, u.KeluhanCustomer,
			u.ApprovedEditRequest, u.SaldoHarian, u.MonitoringDoc, u.ShowKursDBTR
		FROM [MenuCP].[dbo].[taUser] u
		LEFT JOIN [MenuCP].[dbo].[taGroup] g ON RTRIM(LTRIM(u.GroupID)) = RTRIM(LTRIM(g.GroupID))
		WHERE ${whereClause}
		ORDER BY u.UserName ASC
		OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
	`;

	const dataInputs = [
		...inputs,
		{ name: 'offset', type: sql.Int, value: offset },
		{ name: 'pageSize', type: sql.Int, value: pageSize }
	];

	const [countRes, dataRes, stats, groups, setupPrints] = await Promise.all([
		runQuery(countQ, inputs),
		runQuery(dataQ, dataInputs),
		getUserStats(),
		getAllUserGroups(),
		getAllSetupPrint()
	]);

	const total = countRes.recordset[0]?.total || 0;
	const rows = (dataRes.recordset || []).map(mapUserRow);
	const totalPages = Math.ceil(total / pageSize);

	return {
		rows,
		total,
		page,
		pageSize,
		totalPages,
		stats,
		groups,
		setupPrints
	};
}

/**
 * Tambah User Baru (Create)
 */
export async function createUser(payload: CreateUserPayload): Promise<MasterUser> {
	const username = (payload.UserName || '').trim().toLowerCase();
	const password = (payload.Password || '').trim();

	if (!username) {
		throw new Error('Username wajib diisi.');
	}
	if (!password) {
		throw new Error('Password wajib diisi.');
	}

	const exists = await userExists(username);
	if (exists) {
		throw new Error(`Username "${username}" sudah terdaftar. Gunakan username lain.`);
	}

	const bagian = (payload.Bagian || '').trim().toUpperCase().slice(0, 3) || 'ACC';
	const groupId = (payload.GroupID || '').trim().slice(0, 2) || '70';
	const aktif = payload.Aktif !== false;
	const kodeprint = payload.kodeprint?.trim().slice(0, 10) || 'global';
	const salesID = payload.salesID?.trim().slice(0, 3) || '99';
	const groupInputOS = payload.groupInputOS?.trim().slice(0, 2) || '99';
	const groupInputMB = payload.groupInputMB?.trim().slice(0, 2) || '99';
	const groupInputKeluhan = payload.groupInputKeluhan?.trim().slice(0, 2) || '99';
	const keluhanCustomer = Boolean(payload.KeluhanCustomer);
	const approvedEditRequest = Number(payload.ApprovedEditRequest ?? 99);
	const saldoHarian = Number(payload.SaldoHarian ?? 99);
	const monitoringDoc = Number(payload.MonitoringDoc ?? 99);
	const showKursDBTR = payload.ShowKursDBTR !== false;

	const insertQ = `
		INSERT INTO [MenuCP].[dbo].[taUser] (
			UserName, Password, Bagian, GroupID, Aktif, kodeprint, salesID,
			groupInputOS, groupInputMB, groupInputKeluhan, KeluhanCustomer,
			ApprovedEditRequest, SaldoHarian, MonitoringDoc, ShowKursDBTR
		) VALUES (
			@UserName, @Password, @Bagian, @GroupID, @Aktif, @kodeprint, @salesID,
			@groupInputOS, @groupInputMB, @groupInputKeluhan, @KeluhanCustomer,
			@ApprovedEditRequest, @SaldoHarian, @MonitoringDoc, @ShowKursDBTR
		)
	`;

	await runQuery(insertQ, [
		{ name: 'UserName', type: sql.VarChar(50), value: username },
		{ name: 'Password', type: sql.VarChar(50), value: password },
		{ name: 'Bagian', type: sql.VarChar(3), value: bagian },
		{ name: 'GroupID', type: sql.VarChar(2), value: groupId },
		{ name: 'Aktif', type: sql.Bit, value: aktif ? 1 : 0 },
		{ name: 'kodeprint', type: sql.VarChar(10), value: kodeprint },
		{ name: 'salesID', type: sql.VarChar(3), value: salesID },
		{ name: 'groupInputOS', type: sql.VarChar(2), value: groupInputOS },
		{ name: 'groupInputMB', type: sql.VarChar(2), value: groupInputMB },
		{ name: 'groupInputKeluhan', type: sql.VarChar(2), value: groupInputKeluhan },
		{ name: 'KeluhanCustomer', type: sql.Bit, value: keluhanCustomer ? 1 : 0 },
		{ name: 'ApprovedEditRequest', type: sql.Int, value: approvedEditRequest },
		{ name: 'SaldoHarian', type: sql.SmallInt, value: saldoHarian },
		{ name: 'MonitoringDoc', type: sql.SmallInt, value: monitoringDoc },
		{ name: 'ShowKursDBTR', type: sql.Bit, value: showKursDBTR ? 1 : 0 }
	]);

	const created = await getUserByName(username);
	if (!created) throw new Error('Gagal memuat pengguna setelah disimpan');
	return created;
}

/**
 * Ubah User (Update)
 */
export async function updateUser(
	username: string,
	payload: Partial<CreateUserPayload>
): Promise<MasterUser> {
	const clean = username.trim().toLowerCase();
	const existing = await getUserByName(clean);
	if (!existing) {
		throw new Error(`Pengguna "${clean}" tidak ditemukan.`);
	}

	const bagian = payload.Bagian !== undefined ? payload.Bagian.trim().toUpperCase().slice(0, 3) : existing.Bagian;
	const groupId = payload.GroupID !== undefined ? payload.GroupID.trim().slice(0, 2) : existing.GroupID;
	const aktif = payload.Aktif !== undefined ? Boolean(payload.Aktif) : existing.Aktif;
	const kodeprint = payload.kodeprint !== undefined ? (payload.kodeprint?.trim().slice(0, 10) || null) : existing.kodeprint;
	const salesID = payload.salesID !== undefined ? (payload.salesID?.trim().slice(0, 3) || '99') : existing.salesID;
	const groupInputOS = payload.groupInputOS !== undefined ? (payload.groupInputOS?.trim().slice(0, 2) || '99') : existing.groupInputOS;
	const groupInputMB = payload.groupInputMB !== undefined ? (payload.groupInputMB?.trim().slice(0, 2) || '99') : existing.groupInputMB;
	const groupInputKeluhan = payload.groupInputKeluhan !== undefined ? (payload.groupInputKeluhan?.trim().slice(0, 2) || '99') : existing.groupInputKeluhan;
	const keluhanCustomer = payload.KeluhanCustomer !== undefined ? Boolean(payload.KeluhanCustomer) : existing.KeluhanCustomer;
	const approvedEditRequest = payload.ApprovedEditRequest !== undefined ? Number(payload.ApprovedEditRequest) : existing.ApprovedEditRequest;
	const saldoHarian = payload.SaldoHarian !== undefined ? Number(payload.SaldoHarian) : existing.SaldoHarian;
	const monitoringDoc = payload.MonitoringDoc !== undefined ? Number(payload.MonitoringDoc) : existing.MonitoringDoc;
	const showKursDBTR = payload.ShowKursDBTR !== undefined ? Boolean(payload.ShowKursDBTR) : existing.ShowKursDBTR;

	const hasPasswordChange = payload.Password && payload.Password.trim().length > 0;
	const newPassword = hasPasswordChange ? payload.Password!.trim() : existing.Password;

	const updateQ = `
		UPDATE [MenuCP].[dbo].[taUser]
		SET
			Password = @Password,
			Bagian = @Bagian,
			GroupID = @GroupID,
			Aktif = @Aktif,
			kodeprint = @kodeprint,
			salesID = @salesID,
			groupInputOS = @groupInputOS,
			groupInputMB = @groupInputMB,
			groupInputKeluhan = @groupInputKeluhan,
			KeluhanCustomer = @KeluhanCustomer,
			ApprovedEditRequest = @ApprovedEditRequest,
			SaldoHarian = @SaldoHarian,
			MonitoringDoc = @MonitoringDoc,
			ShowKursDBTR = @ShowKursDBTR
		WHERE LOWER(RTRIM(LTRIM(UserName))) = @UserName
	`;

	await runQuery(updateQ, [
		{ name: 'UserName', type: sql.VarChar(50), value: clean },
		{ name: 'Password', type: sql.VarChar(50), value: newPassword },
		{ name: 'Bagian', type: sql.VarChar(3), value: bagian },
		{ name: 'GroupID', type: sql.VarChar(2), value: groupId },
		{ name: 'Aktif', type: sql.Bit, value: aktif ? 1 : 0 },
		{ name: 'kodeprint', type: sql.VarChar(10), value: kodeprint },
		{ name: 'salesID', type: sql.VarChar(3), value: salesID },
		{ name: 'groupInputOS', type: sql.VarChar(2), value: groupInputOS },
		{ name: 'groupInputMB', type: sql.VarChar(2), value: groupInputMB },
		{ name: 'groupInputKeluhan', type: sql.VarChar(2), value: groupInputKeluhan },
		{ name: 'KeluhanCustomer', type: sql.Bit, value: keluhanCustomer ? 1 : 0 },
		{ name: 'ApprovedEditRequest', type: sql.Int, value: approvedEditRequest },
		{ name: 'SaldoHarian', type: sql.SmallInt, value: saldoHarian },
		{ name: 'MonitoringDoc', type: sql.SmallInt, value: monitoringDoc },
		{ name: 'ShowKursDBTR', type: sql.Bit, value: showKursDBTR ? 1 : 0 }
	]);

	const updated = await getUserByName(clean);
	if (!updated) throw new Error('Gagal memuat pengguna setelah diperbarui');
	return updated;
}

/**
 * Toggle status aktif / blokir user
 */
export async function toggleUserStatus(username: string, aktif: boolean): Promise<MasterUser> {
	const clean = username.trim().toLowerCase();
	const existing = await getUserByName(clean);
	if (!existing) {
		throw new Error(`Pengguna "${clean}" tidak ditemukan.`);
	}

	if (clean === 'it' || clean === 'administrator' || existing.GroupID === '99') {
		if (!aktif) {
			throw new Error(`Akun administrator "${clean}" tidak dapat diblokir.`);
		}
	}

	await runQuery(
		`UPDATE [MenuCP].[dbo].[taUser] SET Aktif = @Aktif WHERE LOWER(RTRIM(LTRIM(UserName))) = @UserName`,
		[
			{ name: 'UserName', type: sql.VarChar(50), value: clean },
			{ name: 'Aktif', type: sql.Bit, value: aktif ? 1 : 0 }
		]
	);

	const updated = await getUserByName(clean);
	if (!updated) throw new Error('Gagal memperbarui status');
	return updated;
}

/**
 * Hapus User
 */
export async function deleteUser(username: string, currentOperator?: string): Promise<{ success: boolean; message: string }> {
	const clean = username.trim().toLowerCase();
	const existing = await getUserByName(clean);
	if (!existing) {
		throw new Error(`Pengguna "${clean}" tidak ditemukan.`);
	}

	if (['it', 'administrator', 'sa'].includes(clean)) {
		throw new Error(`Akun sistem "${clean}" tidak boleh dihapus demi keamanan sistem.`);
	}

	if (currentOperator && clean === currentOperator.trim().toLowerCase()) {
		throw new Error('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif login.');
	}

	await runQuery(
		`DELETE FROM [MenuCP].[dbo].[taUser] WHERE LOWER(RTRIM(LTRIM(UserName))) = @UserName`,
		[{ name: 'UserName', type: sql.VarChar(50), value: clean }]
	);

	return {
		success: true,
		message: `Pengguna "${clean}" berhasil dihapus dari Master User.`
	};
}

/**
 * Export data master user ke berkas Excel
 */
export async function generateUsersExcel(params: {
	q?: string;
	bagian?: string;
	groupId?: string;
	status?: string;
}): Promise<Buffer> {
	const result = await getMasterUsersPaged({
		...params,
		page: 1,
		pageSize: 5000
	});

	const wb = XLSX.utils.book_new();

	const aoa: any[][] = [
		['MASTER DATA PENGGUNA SISTEM ERP (taUser) & SETTING DATABASE MenuCP'],
		[`Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`],
		[`Total Data: ${result.rows.length} Pengguna`],
		[],
		[
			'No',
			'Username',
			'Departemen / Bagian',
			'Role Deskripsi',
			'Group ID',
			'Nama Group Hak Akses',
			'Status Akun',
			'Superadmin?',
			'Kode Print (taSetupPrint)',
			'Input OS / SPK',
			'Sales ID',
			'Show Kurs DBTR',
			'Izin Keluhan',
			'Approved Edit Req',
			'Saldo Harian',
			'Monitoring Doc'
		]
	];

	result.rows.forEach((u, idx) => {
		aoa.push([
			idx + 1,
			u.UserName,
			u.Bagian || '-',
			u.roleLabel || '-',
			u.GroupID || '-',
			u.GroupName || '-',
			u.Aktif ? 'AKTIF' : 'NON-AKTIF (DIBLOKIR)',
			u.isSuperAdmin ? 'YA' : 'TIDAK',
			u.kodeprint || '-',
			u.groupInputOS || '99',
			u.salesID || '-',
			u.ShowKursDBTR ? 'YA' : 'TIDAK',
			u.KeluhanCustomer ? 'YA' : 'TIDAK',
			u.ApprovedEditRequest ?? 99,
			u.SaldoHarian ?? 99,
			u.MonitoringDoc ?? 99
		]);
	});

	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws['!cols'] = [
		{ wch: 6 },  // No
		{ wch: 20 }, // Username
		{ wch: 16 }, // Bagian
		{ wch: 28 }, // Role Deskripsi
		{ wch: 10 }, // GroupID
		{ wch: 28 }, // GroupName
		{ wch: 22 }, // Status
		{ wch: 14 }, // Superadmin
		{ wch: 24 }, // Kode Print
		{ wch: 16 }, // Input OS
		{ wch: 12 }, // Sales ID
		{ wch: 16 }, // Show Kurs
		{ wch: 14 }, // Izin Keluhan
		{ wch: 18 }, // Approved Edit Req
		{ wch: 14 }, // Saldo Harian
		{ wch: 16 }  // Monitoring Doc
	];

	XLSX.utils.book_append_sheet(wb, ws, 'Master User & MenuCP Setting');
	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
