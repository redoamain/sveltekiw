import type { PageServerLoad } from './$types';
import {
	getLaporanPemasukanData,
	getLaporanReturPembelianData,
	type LaporanPembelianParams
} from '$lib/server/laporan-pembelian';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');

	const defaultTgl1 = `${year}-${month}-01`;
	const defaultTgl2 = `${year}-${month}-${day}`;

	const tgl1 = url.searchParams.get('tgl1')?.trim() || defaultTgl1;
	const tgl2 = url.searchParams.get('tgl2')?.trim() || defaultTgl2;
	const tab = (url.searchParams.get('tab')?.trim() || 'pemasukan') as 'pemasukan' | 'retur';
	const supplier = url.searchParams.get('supplier')?.trim() || undefined;
	const item = url.searchParams.get('item')?.trim() || undefined;
	const curr = url.searchParams.get('curr')?.trim() || undefined;
	const jenisDok = url.searchParams.get('jenisDok')?.trim() || undefined;

	const params: LaporanPembelianParams = {
		tgl1,
		tgl2,
		tab,
		supplier,
		item,
		curr,
		jenisDok
	};

	try {
		const reportData =
			tab === 'retur'
				? await getLaporanReturPembelianData(params)
				: await getLaporanPemasukanData(params);

		return reportData;
	} catch (err: any) {
		return {
			tab,
			rows: [],
			summary: {
				totalRows: 0,
				totalJumlah: 0,
				totalNilaiIDR: 0,
				totalNilaiUSD: 0,
				totalSupplier: 0
			},
			filters: params,
			error: err?.message || 'Gagal memuat laporan pembelian'
		};
	}
};
