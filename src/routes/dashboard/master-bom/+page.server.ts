import type { Actions, PageServerLoad } from './$types';
import {
	getMasterBomPaged,
	getBomDetailByTransId,
	createBom,
	updateBom,
	deleteBom,
	getNextBomTransId,
	getAllBomLocations,
	type CreateBomPayload,
	type UpdateBomPayload
} from '$lib/server/master-bom';
import { fail, redirect } from '@sveltejs/kit';
import { hasMenuAccess } from '$lib/permissions';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	if (!hasMenuAccess('/dashboard/master-bom', locals.user)) {
		throw redirect(303, '/dashboard?error=unauthorized&from=/dashboard/master-bom');
	}

	const q = url.searchParams.get('q') ?? '';
	const locIdSource = url.searchParams.get('locIdSource') ?? '';
	const locId = url.searchParams.get('locId') ?? '';
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '25', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const validPs = [10, 25, 50, 100, 200];
	const pageSize = validPs.includes(psRaw) ? psRaw : 25;

	const [pagedResult, locations, nextTransId] = await Promise.all([
		getMasterBomPaged({
			q: q || undefined,
			locIdSource: locIdSource || undefined,
			locId: locId || undefined,
			page,
			pageSize
		}).catch(() => ({
			rows: [],
			total: 0,
			page: 1,
			pageSize,
			totalPages: 0,
			stats: {
				totalBom: 0,
				totalDetails: 0,
				totalFinishedGoods: 0,
				totalAssembly: 0,
				totalInjeksi: 0
			}
		})),
		getAllBomLocations(),
		getNextBomTransId().catch(() => '2600001')
	]);

	return {
		q,
		locIdSource,
		locId,
		page,
		pageSize,
		rows: pagedResult.rows,
		total: pagedResult.total,
		totalPages: pagedResult.totalPages,
		stats: pagedResult.stats,
		locations,
		nextTransId,
		currentUser: (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR'
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const form = await request.formData();
		const isEdit = form.get('isEdit') === 'true';
		const operator = String(locals.user?.UserName || locals.user?.username || 'OPERATOR').trim();

		const TransID = String(form.get('TransID') ?? '').trim();
		const ItemID = String(form.get('ItemID') ?? '').trim().toUpperCase();
		const Transdate = String(form.get('Transdate') ?? '').trim();
		const HasilPackQty = parseInt(String(form.get('HasilPackQty') ?? '1'), 10) || 1;
		const HasilPackSatuan = String(form.get('HasilPackSatuan') ?? 'PCS').trim().toUpperCase();
		const LocIDSource = String(form.get('LocIDSource') ?? '').trim().toUpperCase() || null;
		const LocID = String(form.get('LocID') ?? '').trim().toUpperCase() || null;
		const Remark = String(form.get('Remark') ?? '').trim() || null;
		const detailsJson = String(form.get('detailsJson') ?? '[]');

		if (!ItemID) {
			return fail(400, { success: false, error: 'Produk Hasil (ItemID) wajib dipilih.' });
		}

		let details: Array<{ ItemID: string; BahanQty: number; BahanPackSatuan: string }> = [];
		try {
			details = JSON.parse(detailsJson);
		} catch {
			return fail(400, { success: false, error: 'Format data komponen bahan tidak valid.' });
		}

		if (!Array.isArray(details) || details.length === 0) {
			return fail(400, { success: false, error: 'Minimal sertakan 1 (satu) baris komponen bahan.' });
		}

		// Filter baris kosong
		details = details.filter((d) => d.ItemID && Number(d.BahanQty) > 0);
		if (details.length === 0) {
			return fail(400, { success: false, error: 'Pastikan seluruh baris komponen memiliki kode bahan dan kuantitas lebih dari 0.' });
		}

		try {
			if (isEdit) {
				if (!TransID) {
					return fail(400, { success: false, error: 'TransID wajib disertakan saat memperbarui BOM.' });
				}
				const payload: UpdateBomPayload = {
					Transdate: Transdate || undefined,
					HasilPackQty,
					HasilPackSatuan,
					LocIDSource,
					LocID,
					Remark,
					details
				};
				const res = await updateBom(TransID, payload, operator);
				return {
					success: true,
					isEdit: true,
					TransID: res.TransID,
					message: res.message
				};
			} else {
				const payload: CreateBomPayload = {
					TransID: TransID || undefined,
					Transdate: Transdate || undefined,
					ItemID,
					HasilPackQty,
					HasilPackSatuan,
					LocIDSource,
					LocID,
					Remark,
					details
				};
				const res = await createBom(payload, operator);
				return {
					success: true,
					isEdit: false,
					TransID: res.TransID,
					message: res.message
				};
			}
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menyimpan Master BOM.'
			});
		}
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const transId = String(form.get('transId') ?? '').trim();

		if (!transId) {
			return fail(400, { success: false, error: 'TransID BOM wajib disertakan.' });
		}

		try {
			const res = await deleteBom(transId);
			return {
				success: true,
				transId,
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menghapus Master BOM.'
			});
		}
	}
};
