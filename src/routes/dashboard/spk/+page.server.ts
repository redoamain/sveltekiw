import type { Actions, PageServerLoad } from './$types';
import { getSPKPaged, bulkUpdateSPK, getSPKForExport } from '$lib/server/spk';
import { exportSPKToExcel } from '$lib/export';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';
	const status = (url.searchParams.get('status') ?? '').toLowerCase();
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '100', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = [100, 1000, 10000].includes(psRaw) ? psRaw : 100;
	const flash = url.searchParams.get('msg') ?? '';
	const flashErr = url.searchParams.get('err') ?? '';

	let rows: any[] = [];
	let total = 0;
	let error = '';

	try {
		const paged = await getSPKPaged({
			q: q || undefined,
			status: status || undefined,
			page,
			pageSize
		});
		rows = paged.rows;
		total = paged.total;
	} catch (err: any) {
		error = err?.message || 'Gagal memuat SPK';
	}

	return {
		q,
		status,
		page,
		pageSize,
		rows,
		total,
		error,
		flash,
		flashErr
	};
};

export const actions: Actions = {
	complete: async ({ request, url }) => {
		const fd = await request.formData();
		const selected = fd.getAll('selected').map(String).filter(Boolean);
		const q = String(fd.get('q') ?? '');
		const status = String(fd.get('status') ?? '');
		const page = String(fd.get('page') ?? '1');
		const pageSize = String(fd.get('pageSize') ?? '100');

		if (selected.length === 0) {
			return fail(400, { error: 'Pilih minimal satu SPK untuk diselesaikan' });
		}

		try {
			const updated = await bulkUpdateSPK(selected.map((OrderID) => ({ OrderID, Completed: true })));
			const msg = `${updated} SPK berhasil diselesaikan${updated !== selected.length ? ` (${selected.length - updated} sudah berstatus selesai)` : ''}`;
			throw redirect(303, `/dashboard/spk?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page}&pageSize=${pageSize}&msg=${encodeURIComponent(msg)}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal mengupdate SPK' });
		}
	},

	activate: async ({ request, url }) => {
		const fd = await request.formData();
		const selected = fd.getAll('selected').map(String).filter(Boolean);
		const q = String(fd.get('q') ?? '');
		const status = String(fd.get('status') ?? '');
		const page = String(fd.get('page') ?? '1');
		const pageSize = String(fd.get('pageSize') ?? '100');

		if (selected.length === 0) {
			return fail(400, { error: 'Pilih minimal satu SPK untuk diaktifkan' });
		}

		try {
			const updated = await bulkUpdateSPK(selected.map((OrderID) => ({ OrderID, Completed: false })));
			const msg = `${updated} SPK berhasil diaktifkan${updated !== selected.length ? ` (${selected.length - updated} sudah aktif)` : ''}`;
			throw redirect(303, `/dashboard/spk?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page}&pageSize=${pageSize}&msg=${encodeURIComponent(msg)}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal mengaktifkan SPK' });
		}
	}
};
