import type { PageServerLoad } from './$types';
import { getLabaRugiData } from '@/lib/server/finance';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
	const currentDay = String(now.getDate()).padStart(2, '0');

	const defaultPeriode1 = `${currentYear}${currentMonth}`;
	const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const defaultPeriode2 = `${prevDate.getFullYear()}${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
	const defaultTglPeriode = `${currentYear}-${currentMonth}-${currentDay}`;

	const periode1 = url.searchParams.get('periode1')?.trim() || defaultPeriode1;
	const periode2 = url.searchParams.get('periode2')?.trim() || defaultPeriode2;
	const tglPeriode = url.searchParams.get('tglPeriode')?.trim() || defaultTglPeriode;
	const pjgLevel = Number(url.searchParams.get('pjgLevel')) || 10;
	const jenisopr = url.searchParams.has('jenisopr') ? Number(url.searchParams.get('jenisopr')) : 0;
	const company = url.searchParams.has('company') ? Number(url.searchParams.get('company')) : 0;

	const filters = { periode1, periode2, tglPeriode, pjgLevel, jenisopr, company };

	try {
		const data = await getLabaRugiData(periode1, periode2, tglPeriode, pjgLevel, jenisopr, company);
		return {
			...data,
			filters
		};
	} catch (err: any) {
		return {
			rows: [],
			periodName1: '',
			periodName2: '',
			summary: {
				penjualanBersih: 0,
				hpp: 0,
				labaKotor: 0,
				bebanUsaha: 0,
				labaBersihOperasi: 0,
				labaBersih: 0
			},
			params: filters,
			filters,
			error: err?.message || 'Gagal memuat data Laporan Laba Rugi'
		};
	}
};
