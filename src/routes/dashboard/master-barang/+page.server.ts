import type { Actions, PageServerLoad } from './$types';
import { getMasterGoodsPaged, getMasterItem } from '$lib/server/master';
import { exportMasterGoodsToExcel } from '$lib/export';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
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

	if (id) {
		try {
			detail = await getMasterItem(id);
			if (!detail) error = `ItemID "${id}" tidak ditemukan`;
		} catch (err: any) {
			error = err?.message || 'Gagal memuat detail barang';
		}
	}

	try {
		const paged = await getMasterGoodsPaged(q || undefined, page, pageSize);
		rows = paged.rows;
		total = paged.total;
	} catch (err: any) {
		error = err?.message || 'Gagal memuat master barang';
	}

	return {
		q,
		id,
		page,
		pageSize,
		rows,
		total,
		detail,
		error
	};
};
