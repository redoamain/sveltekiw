import type { PageServerLoad } from './$types';
import { getTrialBalanceData } from '@/lib/server/finance';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
	const currentDay = String(now.getDate()).padStart(2, '0');

	const defaultPeriode = `${currentYear}${currentMonth}`;
	const defaultTglPeriode = `${currentYear}-${currentMonth}-${currentDay}`;

	const periode = url.searchParams.get('periode')?.trim() || defaultPeriode;
	const tglPeriode = url.searchParams.get('tglPeriode')?.trim() || defaultTglPeriode;
	const pjgLevel = Number(url.searchParams.get('pjgLevel')) || 10;
	const company = url.searchParams.has('company') ? Number(url.searchParams.get('company')) : 0;

	const filters = { periode, tglPeriode, pjgLevel, company };

	try {
		const data = await getTrialBalanceData(periode, tglPeriode, pjgLevel, company);
		return {
			...data,
			filters
		};
	} catch (err: any) {
		return {
			items: [],
			totals: {
				totalAccounts: 0,
				totalAwalDebet: 0,
				totalAwalKredit: 0,
				totalMutasiDebet: 0,
				totalMutasiKredit: 0,
				totalAkhirDebet: 0,
				totalAkhirKredit: 0,
				isBalanced: false
			},
			filters,
			error: err?.message || 'Gagal memuat Neraca Saldo'
		};
	}
};
