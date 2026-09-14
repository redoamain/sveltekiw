import type { PageServerLoad } from './$types';
import { getAccessLogsPaged } from '$lib/server/access-log';

function todayISO(): string {
	return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return d.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ url }) => {
	const today = todayISO();
	const defaultStart = daysAgoISO(7);

	const q = url.searchParams.get('q') ?? '';
	const user = url.searchParams.get('user') ?? '';
	const menu = url.searchParams.get('menu') ?? '';
	const tgl1 = (url.searchParams.get('tgl1') ?? defaultStart).trim();
	const tgl2 = (url.searchParams.get('tgl2') ?? today).trim();
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '50', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = [25, 50, 100, 200].includes(psRaw) ? psRaw : 50;

	let rows: any[] = [];
	let total = 0;
	let stats = {
		todayTotal: 0,
		activeUsersCount: 0,
		topMenu: 'Dashboard'
	};
	let error = '';

	try {
		const res = await getAccessLogsPaged({
			q: q || undefined,
			user: user || undefined,
			menu: menu || undefined,
			tgl1: tgl1 || undefined,
			tgl2: tgl2 || undefined,
			page,
			pageSize
		});
		rows = res.rows;
		total = res.total;
		stats = res.stats;
	} catch (err: any) {
		error = err?.message || 'Gagal memuat log akses pengguna';
	}

	return {
		q,
		user,
		menu,
		tgl1,
		tgl2,
		page,
		pageSize,
		rows,
		total,
		stats,
		error
	};
};
