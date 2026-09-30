import type { PageServerLoad } from './$types';
import {
	getKartuHutangData,
	getSupplierList,
	type KartuHutangParams
} from '$lib/server/kartu-hutang';

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
	const transtype = url.searchParams.get('transtype')?.trim() || '%';
	const company = url.searchParams.get('company') !== null ? Number(url.searchParams.get('company')) : 0;
	// Default hideEmpty = true agar tidak menampilkan ratusan supplier tanpa saldo/transaksi
	const hideEmpty =
		url.searchParams.get('hideEmpty') !== null
			? url.searchParams.get('hideEmpty') === '1' || url.searchParams.get('hideEmpty') === 'true'
			: true;

	const params: KartuHutangParams = {
		tgl1,
		tgl2,
		companyID,
		curr,
		noTrans,
		transtype,
		company,
		hideEmpty
	};

	try {
		const [supplierList, reportData] = await Promise.all([
			getSupplierList(),
			getKartuHutangData(params)
		]);

		return {
			...reportData,
			supplierList,
			filters: params
		};
	} catch (err: any) {
		const supplierList = await getSupplierList().catch(() => []);
		return {
			suppliers: [],
			grandTotal: {
				totalSuppliers: 0,
				totalTransactions: 0,
				totalSaldoAwalRp: 0,
				totalBeliRp: 0,
				totalBayarRp: 0,
				totalSaldoAkhirRp: 0
			},
			supplierList,
			filters: params,
			error: err?.message || 'Gagal memuat laporan kartu hutang'
		};
	}
};
