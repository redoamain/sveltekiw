/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageServerLoad } from './$types';
import {
	getHPPData,
	getHPPCOGMData,
	getHPPKartuStockData,
	getHPPMutasiStockData,
	getHPPYTDData,
	getHargaHPPData,
	getHasilKalkulasiHPPData,
	type HPPFilterParams
} from '$lib/server/hpp';

export const load: PageServerLoad = async ({ url }) => {
	const now = new Date();
	const currentYear = String(now.getFullYear());
	const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

	const tab = (url.searchParams.get('tab') || 'rekap') as
		| 'rekap'
		| 'cogm'
		| 'kartu-stock'
		| 'mutasi-stock'
		| 'ytd'
		| 'harga'
		| 'kalkulasi';
	const year = url.searchParams.get('year')?.trim() || currentYear;
	const month = (url.searchParams.get('month')?.trim() || currentMonth).padStart(2, '0');
	const lastDay = new Date(Number(year), Number(month), 0).getDate();
	const tgl1 = url.searchParams.get('tgl1')?.trim() || `${year}-${month}-01`;
	const tgl2 = url.searchParams.get('tgl2')?.trim() || `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
	const opr = Number(url.searchParams.get('opr')) || 0;
	const item = url.searchParams.get('item')?.trim() || '';
	const hideEmpty = url.searchParams.get('hideEmpty') !== 'false';

	const filters: HPPFilterParams & { tab: string } = {
		tab,
		year,
		month,
		tgl1,
		tgl2,
		opr,
		item,
		hideEmpty
	};

	try {
		if (tab === 'cogm') {
			const cogmData = await getHPPCOGMData({ year, month, opr, item });
			return {
				tab,
				filters,
				cogmData,
				kartuStockData: null,
				mutasiStockData: null,
				rekapData: null,
				ytdData: null,
				hargaData: null,
				kalkulasiData: null,
				error: null
			};
		} else if (tab === 'kartu-stock') {
			const kartuStockData = await getHPPKartuStockData({ year, month, tgl1, tgl2, item });
			return {
				tab,
				filters,
				cogmData: null,
				kartuStockData,
				mutasiStockData: null,
				rekapData: null,
				ytdData: null,
				hargaData: null,
				kalkulasiData: null,
				error: null
			};
		} else if (tab === 'mutasi-stock') {
			const mutasiStockData = await getHPPMutasiStockData({ year, month, tgl1, tgl2, item, hideEmpty });
			return {
				tab,
				filters,
				cogmData: null,
				kartuStockData: null,
				mutasiStockData,
				rekapData: null,
				ytdData: null,
				hargaData: null,
				kalkulasiData: null,
				error: null
			};
		} else if (tab === 'ytd') {
			const ytdData = await getHPPYTDData({ year, month, opr });
			return {
				tab,
				filters,
				cogmData: null,
				kartuStockData: null,
				mutasiStockData: null,
				rekapData: null,
				ytdData,
				hargaData: null,
				kalkulasiData: null,
				error: null
			};
		} else if (tab === 'harga') {
			const hargaData = await getHargaHPPData({ item });
			return {
				tab,
				filters,
				cogmData: null,
				kartuStockData: null,
				mutasiStockData: null,
				rekapData: null,
				ytdData: null,
				hargaData,
				kalkulasiData: null,
				error: null
			};
		} else if (tab === 'kalkulasi') {
			const kalkulasiData = await getHasilKalkulasiHPPData({});
			return {
				tab,
				filters,
				cogmData: null,
				kartuStockData: null,
				mutasiStockData: null,
				rekapData: null,
				ytdData: null,
				hargaData: null,
				kalkulasiData,
				error: null
			};
		} else {
			// Default: tab === 'rekap' (rpHPP)
			const rekapData = await getHPPData({ year, month, opr });
			return {
				tab: 'rekap',
				filters,
				cogmData: null,
				kartuStockData: null,
				mutasiStockData: null,
				rekapData,
				ytdData: null,
				hargaData: null,
				kalkulasiData: null,
				error: null
			};
		}
	} catch (err: any) {
		return {
			tab,
			filters,
			cogmData: null,
			kartuStockData: null,
			mutasiStockData: null,
			rekapData: null,
			ytdData: null,
			hargaData: null,
			kalkulasiData: null,
			error: err?.message || 'Gagal memuat laporan HPP'
		};
	}
};
