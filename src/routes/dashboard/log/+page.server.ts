import type { Actions, PageServerLoad } from './$types';
import { getTaLogPaged, getTaLogForExport } from '$lib/server/ta-log';
import { exportTaLogToExcel } from '$lib/export';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';
	const tgl1 = (url.searchParams.get('tgl1') ?? '').trim();
	const tgl2 = (url.searchParams.get('tgl2') ?? '').trim();
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '100', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = [100, 1000, 10000].includes(psRaw) ? psRaw : 100;

	let rows: any[] = [];
	let total = 0;
	let error = '';

	try {
		const paged = await getTaLogPaged({
			q: q || undefined,
			tgl1: tgl1 || undefined,
			tgl2: tgl2 || undefined,
			page,
			pageSize
		});
		rows = paged.rows;
		total = paged.total;
	} catch (err: any) {
		error = err?.message || 'Gagal memuat log transaksi';
	}

	return {
		q,
		tgl1,
		tgl2,
		page,
		pageSize,
		rows,
		total,
		error
	};
};
