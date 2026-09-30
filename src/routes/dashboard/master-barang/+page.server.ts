import type { Actions, PageServerLoad } from './$types';
import {
	getMasterGoodsPaged,
	getMasterItem,
	getMasterReferenceData,
	createMasterItem,
	updateMasterItem,
	deleteMasterItem,
	type CreateMasterItemPayload
} from '$lib/server/master';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = url.searchParams.get('q') ?? '';
	const id = url.searchParams.get('id') ?? '';
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '50', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const validPs = [25, 50, 100, 200];
	const pageSize = validPs.includes(psRaw) ? psRaw : 50;

	let rows: any[] = [];
	let total = 0;
	let error = '';
	let detail: any = null;

	const [referenceData, pagedResult] = await Promise.all([
		getMasterReferenceData().catch(() => ({ kinds: [], departments: [], units: [] })),
		getMasterGoodsPaged(q || undefined, page, pageSize).catch((err: any) => {
			error = err?.message || 'Gagal memuat master barang';
			return { rows: [], total: 0 };
		})
	]);

	rows = pagedResult.rows;
	total = pagedResult.total;

	if (id) {
		try {
			detail = await getMasterItem(id);
			if (!detail) error = `ItemID "${id}" tidak ditemukan`;
		} catch (err: any) {
			error = err?.message || 'Gagal memuat detail barang';
		}
	}

	return {
		q,
		id,
		page,
		pageSize,
		rows,
		total,
		detail,
		error,
		referenceData,
		currentUser: locals.user?.UserName || locals.user?.username || 'OPERATOR'
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';
		const form = await request.formData();
		const isEdit = form.get('isEdit') === 'true';

		const ItemID = String(form.get('ItemID') ?? '').trim().toUpperCase();
		const ItemName = String(form.get('ItemName') ?? '').trim();
		const KodeJenis = String(form.get('KodeJenis') ?? '').trim().toUpperCase();
		const namebc = String(form.get('namebc') ?? '').trim() || undefined;
		const ItemName2 = String(form.get('ItemName2') ?? '').trim() || undefined;
		const Mark = String(form.get('Mark') ?? '').trim() || undefined;
		const SatuanKecil = String(form.get('SatuanKecil') ?? '').trim().toUpperCase() || 'PCS';
		const Spec = String(form.get('Spec') ?? '').trim() || undefined;
		const bahan = String(form.get('bahan') ?? '').trim() || undefined;
		const warnac = String(form.get('warnac') ?? '').trim() || undefined;

		if (!ItemID) {
			return fail(400, { success: false, error: 'Kode Barang (ItemID) wajib diisi.' });
		}
		if (!ItemName) {
			return fail(400, { success: false, error: 'Nama Barang (ItemName) wajib diisi.' });
		}
		if (!KodeJenis) {
			return fail(400, { success: false, error: 'Jenis Barang wajib dipilih.' });
		}

		const payload: CreateMasterItemPayload = {
			ItemID,
			ItemName,
			namebc,
			ItemName2,
			KodeJenis,
			Mark,
			SatuanKecil,
			Spec,
			bahan,
			warnac
		};

		try {
			if (isEdit) {
				const updated = await updateMasterItem(ItemID, payload, username);
				return { success: true, isEdit: true, item: updated, message: `Barang "${ItemID}" berhasil diperbarui.` };
			} else {
				const created = await createMasterItem(payload, username);
				return { success: true, isEdit: false, item: created, message: `Barang "${ItemID}" berhasil ditambahkan.` };
			}
		} catch (err: any) {
			return fail(400, { success: false, error: err?.message || 'Gagal menyimpan barang ke master.' });
		}
	},

	delete: async ({ request, locals }) => {
		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';
		const form = await request.formData();
		const itemId = String(form.get('itemId') ?? '').trim().toUpperCase();

		if (!itemId) {
			return fail(400, { success: false, error: 'Kode Barang wajib diisi untuk menghapus.' });
		}

		try {
			const res = await deleteMasterItem(itemId, username);
			return { success: true, itemId, ...res };
		} catch (err: any) {
			return fail(400, { success: false, error: err?.message || 'Gagal menghapus barang.' });
		}
	}
};
