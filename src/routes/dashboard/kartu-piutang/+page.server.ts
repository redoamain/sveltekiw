import type { PageServerLoad } from './$types';
import {
	getKartuPiutangData,
	getCustomerList,
	type KartuPiutangParams
} from '$lib/server/kartu-piutang';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');

	const defaultTgl1 = `${year}-${month}-01`;
	const defaultTgl2 = `${year}-${month}-${day}`;

	const tgl1 = url.searchParams.get('tgl1')?.trim() || defaultTgl1;
	const tgl2 = url.searchParams.get('tgl2')?.trim() || defaultTgl2;
	const companyID = url.searchParams.get('companyID')?.trim() || '%';
	const curr = url.searchParams.get('curr')?.trim() || 'IDR';
	const noTrans = url.searchParams.get('noTrans')?.trim() || '%';
	const tipeTrans = url.searchParams.get('tipeTrans')?.trim() || '%';
	// Default hideEmpty = true agar tidak menampilkan ratusan customer tanpa saldo/transaksi
	const hideEmpty =
		url.searchParams.get('hideEmpty') !== null
			? url.searchParams.get('hideEmpty') === '1' || url.searchParams.get('hideEmpty') === 'true'
			: true;

	const params: KartuPiutangParams = {
		tgl1,
		tgl2,
		companyID,
		curr,
		noTrans,
		tipeTrans,
		hideEmpty
	};

	try {
		const [customerList, reportData] = await Promise.all([
			getCustomerList(),
			getKartuPiutangData(params)
		]);

		return {
			...reportData,
			customerList,
			filters: params
		};
	} catch (err: any) {
		const customerList = await getCustomerList().catch(() => []);
		return {
			customers: [],
			grandTotal: {
				totalCustomers: 0,
				totalTransactions: 0,
				totalSaldoAwalRp: 0,
				totalJualRp: 0,
				totalBayarRp: 0,
				totalSaldoAkhirRp: 0
			},
			customerList,
			filters: params,
			error: err?.message || 'Gagal memuat laporan kartu piutang'
		};
	}
};
