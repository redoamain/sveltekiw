import type { Actions, PageServerLoad } from './$types';
import {
	getMasterEkspedisiPaged,
	getEkspedisiById,
	getNextEkspedisiId,
	getAllSuppliersForSelect,
	createEkspedisi,
	updateEkspedisi,
	deleteEkspedisi,
	type CreateEkspedisiPayload,
	type MasterEkspedisi
} from '$lib/server/master-ekspedisi';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = url.searchParams.get('q') ?? '';
	const hasNpwp = url.searchParams.get('hasNpwp') ?? '';
	const hasSupplier = url.searchParams.get('hasSupplier') ?? '';
	const id = url.searchParams.get('id') ?? '';
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '25', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const validPs = [10, 25, 50, 100];
	const pageSize = validPs.includes(psRaw) ? psRaw : 25;

	let detail: MasterEkspedisi | null = null;
	if (id) {
		try {
			detail = await getEkspedisiById(id);
		} catch {
			// ignore detail lookup error
		}
	}

	const [pagedResult, suppliers, idInfo] = await Promise.all([
		getMasterEkspedisiPaged({
			q: q || undefined,
			hasNpwp: hasNpwp || undefined,
			hasSupplier: hasSupplier || undefined,
			page,
			pageSize
		}).catch(() => ({
			rows: [],
			total: 0,
			page: 1,
			pageSize,
			totalPages: 0,
			stats: { total: 0, totalWithNPWP: 0, totalWithoutNPWP: 0, totalWithSupplier: 0 }
		})),
		getAllSuppliersForSelect().catch(() => []),
		getNextEkspedisiId().catch(() => ({ lastId: null, nextId: 'EXP01' }))
	]);

	return {
		q,
		hasNpwp,
		hasSupplier,
		page,
		pageSize,
		rows: pagedResult.rows,
		total: pagedResult.total,
		totalPages: pagedResult.totalPages,
		stats: pagedResult.stats,
		suppliers,
		nextId: idInfo.nextId,
		lastId: idInfo.lastId,
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

		const ekspedisiID = String(form.get('ekspedisiID') ?? '').trim().toUpperCase();
		const Nama = String(form.get('Nama') ?? '').trim();
		const NoNPWP = String(form.get('NoNPWP') ?? '').trim() || null;
		const SupplierID = String(form.get('SupplierID') ?? '').trim().toUpperCase() || null;

		if (!Nama) {
			return fail(400, {
				success: false,
				error: 'Nama Ekspedisi (Nama) wajib diisi.'
			});
		}

		if (isEdit && !ekspedisiID) {
			return fail(400, {
				success: false,
				error: 'Kode Ekspedisi (ekspedisiID) wajib diisi saat mode perbarui.'
			});
		}

		if (ekspedisiID && ekspedisiID.length > 5) {
			return fail(400, {
				success: false,
				error: 'Kode Ekspedisi maksimal 5 karakter.'
			});
		}

		if (Nama.length > 50) {
			return fail(400, {
				success: false,
				error: 'Nama Ekspedisi maksimal 50 karakter.'
			});
		}

		if (NoNPWP && NoNPWP.length > 20) {
			return fail(400, {
				success: false,
				error: 'Nomor NPWP maksimal 20 karakter.'
			});
		}

		if (SupplierID && SupplierID.length > 8) {
			return fail(400, {
				success: false,
				error: 'Kode Rekanan Supplier maksimal 8 karakter.'
			});
		}

		const payload: CreateEkspedisiPayload = {
			ekspedisiID: ekspedisiID || undefined,
			Nama,
			NoNPWP,
			SupplierID
		};

		try {
			if (isEdit) {
				const updated = await updateEkspedisi(ekspedisiID, payload, username);
				return {
					success: true,
					isEdit: true,
					item: updated,
					message: `Ekspedisi "${updated.Nama}" (${updated.ekspedisiID}) berhasil diperbarui.`
				};
			} else {
				const created = await createEkspedisi(payload, username);
				return {
					success: true,
					isEdit: false,
					item: created,
					message: `Ekspedisi baru "${created.Nama}" (${created.ekspedisiID}) berhasil ditambahkan.`
				};
			}
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menyimpan data ekspedisi.'
			});
		}
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const ekspedisiID = String(form.get('ekspedisiID') ?? '').trim().toUpperCase();

		if (!ekspedisiID) {
			return fail(400, {
				success: false,
				error: 'Kode Ekspedisi wajib disertakan untuk menghapus.'
			});
		}

		try {
			const res = await deleteEkspedisi(ekspedisiID);
			return {
				success: true,
				ekspedisiID,
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menghapus ekspedisi.'
			});
		}
	}
};
