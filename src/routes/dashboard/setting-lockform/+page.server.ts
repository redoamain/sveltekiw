import type { Actions, PageServerLoad } from './$types';
import {
	getAllLockforms,
	updateSingleLockDate,
	batchUpdateLockDates,
	saveLockform,
	deleteLockform
} from '$lib/server/lockform';
import { fail, redirect } from '@sveltejs/kit';
import { hasMenuAccess } from '$lib/permissions';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	if (!hasMenuAccess('/dashboard/setting-lockform', locals.user)) {
		throw redirect(303, '/dashboard?error=unauthorized&from=/dashboard/setting-lockform');
	}

	const q = url.searchParams.get('q') ?? '';
	const tipeRaw = url.searchParams.get('tipe') ?? 'all';
	const statusRaw = (url.searchParams.get('status') ?? 'all') as 'all' | 'locked' | 'unlocked';

	const tipe = tipeRaw === 'all' || tipeRaw === '' ? 'all' : Number(tipeRaw);
	const status = ['all', 'locked', 'unlocked'].includes(statusRaw) ? statusRaw : 'all';

	const { items, stats } = await getAllLockforms({
		q,
		tipe,
		status
	}).catch(() => ({
		items: [],
		stats: {
			totalForms: 0,
			totalOperasional: 0,
			totalFinance: 0,
			totalProduksi: 0,
			totalLocked: 0,
			totalUnlocked: 0,
			latestLockDate: null
		}
	}));

	return {
		items,
		stats,
		q,
		tipe: tipeRaw,
		status,
		currentUser: (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR'
	};
};

export const actions: Actions = {
	updateDate: async ({ request, locals }) => {
		const form = await request.formData();
		const formName = String(form.get('formName') ?? '').trim();
		const lockDate = String(form.get('lockDate') ?? '').trim();
		const operator = String(locals.user?.UserName || locals.user?.username || 'OPERATOR').trim();

		if (!formName) {
			return fail(400, { success: false, error: 'Nama form wajib disertakan.' });
		}

		try {
			const res = await updateSingleLockDate(formName, lockDate || null, operator);
			return {
				success: true,
				action: 'updateDate',
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal memperbarui tanggal kunci form.'
			});
		}
	},

	batchUpdate: async ({ request, locals }) => {
		const form = await request.formData();
		const formNamesRaw = String(form.get('formNames') ?? '[]');
		const lockDate = String(form.get('lockDate') ?? '').trim();
		const actionType = String(form.get('actionType') ?? 'lock').trim();
		const operator = String(locals.user?.UserName || locals.user?.username || 'OPERATOR').trim();

		let formNames: string[] = [];
		try {
			formNames = JSON.parse(formNamesRaw);
		} catch {
			return fail(400, { success: false, error: 'Format daftar form tidak valid.' });
		}

		if (!Array.isArray(formNames) || formNames.length === 0) {
			return fail(400, { success: false, error: 'Pilih minimal satu form untuk diperbarui.' });
		}

		if (actionType === 'lock' && !lockDate) {
			return fail(400, { success: false, error: 'Tentukan tanggal batas kunci untuk batch update.' });
		}

		try {
			const targetDate = actionType === 'unlock' ? null : lockDate;
			const res = await batchUpdateLockDates(formNames, targetDate, operator);
			return {
				success: true,
				action: 'batchUpdate',
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal batch update tanggal kunci form.'
			});
		}
	},

	save: async ({ request, locals }) => {
		const form = await request.formData();
		const isEdit = form.get('isEdit') === 'true';
		const formName = String(form.get('formName') ?? '').trim();
		const formAlias = String(form.get('formAlias') ?? '').trim();
		const formTipe = parseInt(String(form.get('formTipe') ?? '0'), 10) || 0;
		const lockDate = String(form.get('lockDate') ?? '').trim();
		const operator = String(locals.user?.UserName || locals.user?.username || 'OPERATOR').trim();

		if (!formName) {
			return fail(400, { success: false, error: 'Nama Form (Form_Name) wajib diisi.' });
		}

		try {
			const res = await saveLockform(
				{
					formName,
					formAlias: formAlias || formName,
					formTipe,
					lockDate: lockDate || null,
					isEdit
				},
				operator
			);

			return {
				success: true,
				action: 'save',
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menyimpan data form ke taLockform.'
			});
		}
	},

	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const formName = String(form.get('formName') ?? '').trim();
		const operator = String(locals.user?.UserName || locals.user?.username || 'OPERATOR').trim();

		if (!formName) {
			return fail(400, { success: false, error: 'Nama form yang akan dihapus wajib disertakan.' });
		}

		try {
			const res = await deleteLockform(formName, operator);
			return {
				success: true,
				action: 'delete',
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menghapus form dari taLockform.'
			});
		}
	}
};
