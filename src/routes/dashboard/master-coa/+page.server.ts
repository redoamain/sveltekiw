import type { Actions, PageServerLoad } from './$types';
import {
	getCOAPaged,
	getCOAById,
	getAllGLGroups,
	getAllParentAccounts,
	createCOA,
	updateCOA,
	toggleDelistedCOA,
	deleteCOA,
	type CreateCOAPayload,
	type MasterCOA
} from '$lib/server/master-coa';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = url.searchParams.get('q') ?? '';
	const group = url.searchParams.get('group') ?? '';
	const type = url.searchParams.get('type') ?? '';
	const pos = url.searchParams.get('pos') ?? '';
	const curr = url.searchParams.get('curr') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const id = url.searchParams.get('id') ?? '';
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '50', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const validPs = [25, 50, 100, 200, 500];
	const pageSize = validPs.includes(psRaw) ? psRaw : 50;

	let detail: MasterCOA | null = null;
	if (id) {
		try {
			detail = await getCOAById(id);
		} catch {
			// ignore lookup error
		}
	}

	const [pagedResult, groups, parents] = await Promise.all([
		getCOAPaged({
			q: q || undefined,
			group: group || undefined,
			type: type || undefined,
			pos: pos || undefined,
			curr: curr || undefined,
			status: status || undefined,
			page,
			pageSize
		}).catch(() => ({
			rows: [],
			total: 0,
			page: 1,
			pageSize,
			totalPages: 0,
			stats: {
				total: 0,
				totalAktiva: 0,
				totalHutang: 0,
				totalModal: 0,
				totalPendapatan: 0,
				totalBiaya: 0,
				totalKasBank: 0,
				totalActive: 0,
				totalDelisted: 0
			}
		})),
		getAllGLGroups().catch(() => []),
		getAllParentAccounts().catch(() => [])
	]);

	return {
		q,
		group,
		type,
		pos,
		curr,
		status,
		page,
		pageSize,
		rows: pagedResult.rows,
		total: pagedResult.total,
		totalPages: pagedResult.totalPages,
		stats: pagedResult.stats,
		groups,
		parents,
		detail,
		currentUser: locals.user?.UserName || locals.user?.username || 'OPERATOR'
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const username =
			(locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';
		const form = await request.formData();
		const isEdit = form.get('isEdit') === 'true';

		const Acc = String(form.get('Acc') ?? '').trim();
		const AccName = String(form.get('AccName') ?? '').trim();
		const AccName2 = String(form.get('AccName2') ?? '').trim() || null;
		const AccGroup = String(form.get('AccGroup') ?? '').trim() || null;
		const AccType = String(form.get('AccType') ?? '2').trim() || '2';
		const AccPos = String(form.get('AccPos') ?? 'D').trim().toUpperCase() || 'D';
		const AccParent = String(form.get('AccParent') ?? '').trim() || null;
		const AccCurr = String(form.get('AccCurr') ?? 'IDR').trim().toUpperCase() || 'IDR';
		const AccountBank = String(form.get('AccountBank') ?? '').trim() || null;
		const Remark = String(form.get('Remark') ?? '').trim() || null;
		const Delisted = form.get('Delisted') === 'true' || form.get('Delisted') === 'on' || form.get('Delisted') === '1';

		if (!Acc) {
			return fail(400, {
				success: false,
				error: 'Nomor / Kode Perkiraan (Acc) wajib diisi.'
			});
		}

		if (!AccName) {
			return fail(400, {
				success: false,
				error: 'Nama Perkiraan (AccName) wajib diisi.'
			});
		}

		if (Acc.length > 15) {
			return fail(400, {
				success: false,
				error: 'Kode Perkiraan maksimal 15 karakter.'
			});
		}

		if (AccName.length > 100) {
			return fail(400, {
				success: false,
				error: 'Nama Perkiraan maksimal 100 karakter.'
			});
		}

		const payload: CreateCOAPayload = {
			Acc,
			AccName,
			AccName2,
			AccGroup,
			AccType,
			AccPos,
			AccParent,
			AccCurr,
			AccountBank,
			Remark,
			Delisted
		};

		try {
			if (isEdit) {
				const updated = await updateCOA(Acc, payload, username);
				return {
					success: true,
					isEdit: true,
					item: updated,
					message: `Akun "${updated.AccName}" (${updated.Acc}) berhasil diperbarui.`
				};
			} else {
				const created = await createCOA(payload, username);
				return {
					success: true,
					isEdit: false,
					item: created,
					message: `Akun baru "${created.AccName}" (${created.Acc}) berhasil ditambahkan.`
				};
			}
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menyimpan data akun perkiraan.'
			});
		}
	},

	toggleStatus: async ({ request }) => {
		const form = await request.formData();
		const acc = String(form.get('acc') ?? '').trim();
		const currentDelisted = form.get('delisted') === 'true';

		if (!acc) {
			return fail(400, { success: false, error: 'Kode akun tidak valid.' });
		}

		try {
			const res = await toggleDelistedCOA(acc, !currentDelisted);
			return {
				success: true,
				acc,
				delisted: res.delisted,
				message: `Status akun "${acc}" diubah menjadi ${res.delisted ? 'Nonaktif (Delisted)' : 'Aktif'}.`
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal mengubah status akun.'
			});
		}
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const acc = String(form.get('acc') ?? '').trim();

		if (!acc) {
			return fail(400, {
				success: false,
				error: 'Kode akun wajib disertakan untuk menghapus.'
			});
		}

		try {
			const res = await deleteCOA(acc);
			return {
				success: true,
				acc,
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menghapus akun perkiraan.'
			});
		}
	}
};
