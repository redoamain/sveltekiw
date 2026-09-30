import type { RequestHandler } from '@sveltejs/kit';
import {
	getLaporanPenjualanData,
	generateLaporanPenjualanExcel,
	type LaporanPenjualanParams
} from '$lib/server/laporan-penjualan';
import { log } from '$lib/db';

async function doExport(params: LaporanPenjualanParams) {
	const report = await getLaporanPenjualanData(params);
	const buffer = generateLaporanPenjualanExcel(report);
	const tgl1Str = params.tgl1.replace(/-/g, '');
	const tgl2Str = params.tgl2.replace(/-/g, '');
	const fileName = `laporan_penjualan_${tgl1Str}_${tgl2Str}.xlsx`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Cache-Control': 'no-store'
		}
	});
}

function parseParams(getParam: (key: string) => string | null): LaporanPenjualanParams {
	const tgl1 = getParam('tgl1')?.trim() || new Date().toISOString().slice(0, 8) + '01';
	const tgl2 = getParam('tgl2')?.trim() || new Date().toISOString().slice(0, 10);
	const customer = getParam('customer')?.trim() || undefined;
	const item = getParam('item')?.trim() || undefined;
	const curr = getParam('curr')?.trim() || undefined;
	const jenisDok = getParam('jenisDok')?.trim() || undefined;

	return {
		tgl1,
		tgl2,
		customer,
		item,
		curr,
		jenisDok
	};
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	const params = parseParams((k) => url.searchParams.get(k));

	try {
		return await doExport(params);
	} catch (err: any) {
		log.error({ err, params }, 'Gagal export laporan penjualan (GET)');
		return new Response(JSON.stringify({ error: err?.message || 'Gagal mengekspor laporan penjualan' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	try {
		const fd = await request.formData();
		const params = parseParams((k) => {
			const v = fd.get(k);
			return v != null ? String(v) : null;
		});

		return await doExport(params);
	} catch (err: any) {
		log.error({ err }, 'Gagal export laporan penjualan (POST)');
		return new Response(JSON.stringify({ error: err?.message || 'Gagal mengekspor laporan penjualan' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
