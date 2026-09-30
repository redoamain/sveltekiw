import type { PageServerLoad } from './$types';
import { getNeracaData } from '@/lib/server/finance';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
	const currentDay = String(now.getDate()).padStart(2, '0');

	// Periode berjalan (misal: 202609)
	const defaultPeriode1 = `${currentYear}${currentMonth}`;
	// Periode pembanding (bulan lalu)
	const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const defaultPeriode2 = `${prevDate.getFullYear()}${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
	const defaultTglPeriode = `${currentYear}-${currentMonth}-${currentDay}`;

	const periode1 = url.searchParams.get('periode1')?.trim() || defaultPeriode1;
	const periode2 = url.searchParams.get('periode2')?.trim() || defaultPeriode2;
	const tglPeriode = url.searchParams.get('tglPeriode')?.trim() || defaultTglPeriode;
	const pjgLevel = Number(url.searchParams.get('pjgLevel')) || 10;
	const company = url.searchParams.has('company') ? Number(url.searchParams.get('company')) : 0;

	const filters = { periode1, periode2, tglPeriode, pjgLevel, company };

	try {
		const data = await getNeracaData(periode1, periode2, tglPeriode, pjgLevel, company);
		return {
			...data,
			filters
		};
	} catch (err: any) {
		return {
			aktiva: { title: 'AKTIVA', groups: [], totalRp1: 0, totalPct1: 0, totalRp2: 0, totalPct2: 0, totalGrowth: 0 },
			pasiva: { title: 'KEWAJIBAN & EKUITAS', groups: [], totalRp1: 0, totalPct1: 0, totalRp2: 0, totalPct2: 0, totalGrowth: 0 },
			isBalanced1: false,
			isBalanced2: false,
			diffRp1: 0,
			diffRp2: 0,
			filters,
			error: err?.message || 'Gagal memuat data Laporan Neraca'
		};
	}
};
