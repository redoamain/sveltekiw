import type { PageServerLoad } from './$types';
import {
	getLaporanPenjualanData,
	type LaporanPenjualanParams
} from '$lib/server/laporan-penjualan';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');

	const defaultTgl1 = `${year}-${month}-01`;
	const defaultTgl2 = `${year}-${month}-${day}`;

	const tgl1 = url.searchParams.get('tgl1')?.trim() || defaultTgl1;
	const tgl2 = url.searchParams.get('tgl2')?.trim() || defaultTgl2;
	const customer = url.searchParams.get('customer')?.trim() || undefined;
	const item = url.searchParams.get('item')?.trim() || undefined;
	const curr = url.searchParams.get('curr')?.trim() || undefined;
	const jenisDok = url.searchParams.get('jenisDok')?.trim() || undefined;

	const params: LaporanPenjualanParams = {
		tgl1,
		tgl2,
		customer,
		item,
		curr,
		jenisDok
	};

	try {
		const reportData = await getLaporanPenjualanData(params);
		return reportData;
	} catch (err: any) {
		return {
			rows: [],
			summary: {
				totalRows: 0,
				totalJumlah: 0,
				totalNilaiIDR: 0,
				totalNilaiUSD: 0,
				totalCustomer: 0
			},
			filters: params,
			error: err?.message || 'Gagal memuat laporan penjualan'
		};
	}
};
