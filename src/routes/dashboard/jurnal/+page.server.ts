import type { PageServerLoad } from './$types';
import { getJurnalListData } from '@/lib/server/finance';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
	const currentDay = String(now.getDate()).padStart(2, '0');

	const defaultTgl1 = `${currentYear}-${currentMonth}-01`;
	const defaultTgl2 = `${currentYear}-${currentMonth}-${currentDay}`;

	const tgl1 = url.searchParams.get('tgl1')?.trim() || defaultTgl1;
	const tgl2 = url.searchParams.get('tgl2')?.trim() || defaultTgl2;
	const curr = url.searchParams.get('curr')?.trim() || 'IDR';

	try {
		const data = await getJurnalListData(tgl1, tgl2, curr);
		return {
			...data,
			filters: { tgl1, tgl2, curr }
		};
	} catch (err: any) {
		return {
			groups: [],
			totals: {
				totalTransactions: 0,
				totalEntries: 0,
				totalDebetRp: 0,
				totalCreditRp: 0,
				isBalanced: false
			},
			filters: { tgl1, tgl2, curr },
			error: err?.message || 'Gagal memuat Jurnal Transaksi'
		};
	}
};
