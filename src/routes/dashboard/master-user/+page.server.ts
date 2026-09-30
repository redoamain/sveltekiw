import type { Actions, PageServerLoad } from './$types';
import {
	getMasterUsersPaged,
	getUserByName,
	createUser,
	updateUser,
	toggleUserStatus,
	deleteUser,
	getAllUserGroups,
	getAllSetupPrint,
	saveSetupPrint,
	deleteSetupPrint,
	getGroupHakAkses,
	toggleHakAksesField,
	type CreateUserPayload
} from '$lib/server/master-user';
import { fail, redirect } from '@sveltejs/kit';
import { resolveUserRole } from '$lib/permissions';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const roleInfo = resolveUserRole(locals.user);
	// Pastikan hanya IT / Superadmin yang bisa mengakses Master User
	if (!roleInfo.isSuperAdmin && roleInfo.role !== 'IT') {
		throw redirect(303, '/dashboard?error=unauthorized&from=/dashboard/master-user');
	}

	const activeTab = url.searchParams.get('tab') || 'user';
	const q = url.searchParams.get('q') ?? '';
	const bagian = url.searchParams.get('bagian') ?? '';
	const groupId = url.searchParams.get('groupId') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '25', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const validPs = [10, 25, 50, 100];
	const pageSize = validPs.includes(psRaw) ? psRaw : 25;

	// Opsi untuk Tab Hak Akses Group
	const selectedGroupId = url.searchParams.get('selectedGroupId') || '99';
	const selectedDeptId = url.searchParams.get('selectedDeptId') || 'ALL';

	const [pagedResult, setupPrints, groups, groupHakAkses] = await Promise.all([
		getMasterUsersPaged({
			q: q || undefined,
			bagian: bagian || undefined,
			groupId: groupId || undefined,
			status: status || undefined,
			page,
			pageSize
		}).catch(() => ({
			rows: [],
			total: 0,
			page: 1,
			pageSize,
			totalPages: 0,
			stats: { total: 0, totalAktif: 0, totalNonAktif: 0, totalAdmin: 0 },
			groups: [],
			setupPrints: []
		})),
		getAllSetupPrint(),
		getAllUserGroups(),
		activeTab === 'akses' ? getGroupHakAkses(selectedGroupId, selectedDeptId) : Promise.resolve([])
	]);

	return {
		activeTab,
		q,
		bagian,
		groupId,
		status,
		page,
		pageSize,
		rows: pagedResult.rows,
		total: pagedResult.total,
		totalPages: pagedResult.totalPages,
		stats: pagedResult.stats,
		groups,
		setupPrints,
		groupHakAkses,
		selectedGroupId,
		selectedDeptId,
		currentUser: (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR'
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const isEdit = form.get('isEdit') === 'true';

		const UserName = String(form.get('UserName') ?? '').trim().toLowerCase();
		const Password = String(form.get('Password') ?? '').trim();
		const Bagian = String(form.get('Bagian') ?? '').trim().toUpperCase();
		const GroupID = String(form.get('GroupID') ?? '').trim();
		const Aktif = form.get('Aktif') === 'true' || form.get('Aktif') === 'on' || form.get('Aktif') === '1';

		// MenuCP Database Settings
		const kodeprint = String(form.get('kodeprint') ?? '').trim() || 'global';
		const salesID = String(form.get('salesID') ?? '').trim() || '99';
		const groupInputOS = String(form.get('groupInputOS') ?? '').trim() || '99';
		const groupInputMB = String(form.get('groupInputMB') ?? '').trim() || '99';
		const groupInputKeluhan = String(form.get('groupInputKeluhan') ?? '').trim() || '99';
		const KeluhanCustomer = form.get('KeluhanCustomer') === 'true' || form.get('KeluhanCustomer') === 'on' || form.get('KeluhanCustomer') === '1';
		const ApprovedEditRequest = parseInt(String(form.get('ApprovedEditRequest') ?? '99'), 10) || 99;
		const SaldoHarian = parseInt(String(form.get('SaldoHarian') ?? '99'), 10) || 99;
		const MonitoringDoc = parseInt(String(form.get('MonitoringDoc') ?? '99'), 10) || 99;
		const ShowKursDBTR = form.get('ShowKursDBTR') === 'true' || form.get('ShowKursDBTR') === 'on' || form.get('ShowKursDBTR') === '1';

		if (!UserName) {
			return fail(400, { success: false, error: 'Username wajib diisi.' });
		}

		if (!isEdit && !Password) {
			return fail(400, { success: false, error: 'Password wajib diisi untuk pengguna baru.' });
		}

		if (!Bagian) {
			return fail(400, { success: false, error: 'Departemen / Bagian wajib dipilih.' });
		}

		if (!GroupID) {
			return fail(400, { success: false, error: 'Hak Akses Group wajib dipilih.' });
		}

		const payload: CreateUserPayload = {
			UserName,
			Password: Password || undefined,
			Bagian,
			GroupID,
			Aktif,
			kodeprint,
			salesID,
			groupInputOS,
			groupInputMB,
			groupInputKeluhan,
			KeluhanCustomer,
			ApprovedEditRequest,
			SaldoHarian,
			MonitoringDoc,
			ShowKursDBTR
		};

		try {
			if (isEdit) {
				const updated = await updateUser(UserName, payload);
				return {
					success: true,
					isEdit: true,
					item: updated,
					message: `Pengguna "${updated.UserName}" berhasil diperbarui dengan setting MenuCP.`
				};
			} else {
				const created = await createUser(payload);
				return {
					success: true,
					isEdit: false,
					item: created,
					message: `Pengguna baru "${created.UserName}" berhasil didaftarkan ke MenuCP.`
				};
			}
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menyimpan data pengguna.'
			});
		}
	},

	toggleStatus: async ({ request }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim().toLowerCase();
		const aktif = form.get('aktif') === 'true';

		if (!username) {
			return fail(400, { success: false, error: 'Username wajib disertakan.' });
		}

		try {
			const updated = await toggleUserStatus(username, aktif);
			return {
				success: true,
				message: `Status login "${updated.UserName}" diubah menjadi ${updated.Aktif ? 'Aktif' : 'Non-aktif (Diblokir)'}.`
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal mengubah status pengguna.'
			});
		}
	},

	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim().toLowerCase();
		const currentOperator = String(locals.user?.UserName || locals.user?.username || '').trim().toLowerCase();

		if (!username) {
			return fail(400, { success: false, error: 'Username wajib disertakan.' });
		}

		try {
			const res = await deleteUser(username, currentOperator);
			return {
				success: true,
				username,
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menghapus pengguna.'
			});
		}
	},

	savePrinter: async ({ request }) => {
		const form = await request.formData();
		const kode = String(form.get('kode') ?? '').trim().toLowerCase();
		const txt = String(form.get('txt') ?? '').trim();
		const txtP = String(form.get('txtP') ?? '').trim();

		if (!kode) {
			return fail(400, { success: false, error: 'Kode printer wajib diisi.' });
		}

		try {
			await saveSetupPrint({ kode, txt, txtP });
			return {
				success: true,
				tab: 'printer',
				message: `Profil printer "${kode}" berhasil disimpan ke MenuCP.`
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				tab: 'printer',
				error: err?.message || 'Gagal menyimpan profil printer.'
			});
		}
	},

	deletePrinter: async ({ request }) => {
		const form = await request.formData();
		const kode = String(form.get('kode') ?? '').trim().toLowerCase();

		if (!kode) {
			return fail(400, { success: false, error: 'Kode printer wajib diisi.' });
		}

		try {
			const res = await deleteSetupPrint(kode);
			return {
				success: true,
				tab: 'printer',
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				tab: 'printer',
				error: err?.message || 'Gagal menghapus profil printer.'
			});
		}
	},

	toggleHakAkses: async ({ request }) => {
		const form = await request.formData();
		const groupId = String(form.get('groupId') ?? '').trim();
		const menuId = String(form.get('menuId') ?? '').trim();
		const field = String(form.get('field') ?? '') as 'IsEnabled' | 'IsVisible' | 'IsAppend' | 'IsEdit' | 'IsDelete';
		const value = form.get('value') === 'true';

		if (!groupId || !menuId || !field) {
			return fail(400, { success: false, error: 'Parameter hak akses tidak lengkap.' });
		}

		try {
			await toggleHakAksesField(groupId, menuId, field, value);
			return {
				success: true,
				tab: 'akses',
				message: `Hak akses "${menuId}" (${field}) untuk Group [${groupId}] berhasil diubah.`
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				tab: 'akses',
				error: err?.message || 'Gagal memperbarui hak akses.'
			});
		}
	}
};
