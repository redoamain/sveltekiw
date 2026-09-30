import type { RequestHandler } from '@sveltejs/kit';
import {
	getLaporanPemasukanData,
	getLaporanReturPembelianData,
	generateLaporanPembelianExcel,
	type LaporanPembelianParams
} from '$lib/server/laporan-pembelian';
import { log } from '$lib/db';

async function doExport(params: LaporanPembelianParams) {
	const tab = params.tab || 'pemasukan';
	const report =
		tab === 'retur'
			? await getLaporanReturPembelianData(params)
			: await getLaporanPemasukanData(params);

	const buffer = generateLaporanPembelianExcel(report);
	const tgl1Str = params.tgl1.replace(/-/g, '');
	const tgl2Str = params.tgl2.replace(/-/g, '');
	const prefix = tab === 'retur' ? 'retur_pembelian' : 'laporan_pemasukan';
	const fileName = `${prefix}_${tgl1Str}_${tgl2Str}.xlsx`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Cache-Control': 'no-store'
		}
	});
}

function parseParams(getParam: (key: string) => string | null): LaporanPembelianParams {
	const tgl1 = getParam('tgl1')?.trim() || new Date().toISOString().slice(0, 8) + '01';
	const tgl2 = getParam('tgl2')?.trim() || new Date().toISOString().slice(0, 10);
	const tab = (getParam('tab')?.trim() || 'pemasukan') as 'pemasukan' | 'retur';
	const supplier = getParam('supplier')?.trim() || undefined;
	const item = getParam('item')?.trim() || undefined;
	const curr = getParam('curr')?.trim() || undefined;
	const jenisDok = getParam('jenisDok')?.trim() || undefined;

	return {
		tgl1,
		tgl2,
		tab,
		supplier,
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
		log.error({ err, params }, 'Gagal export laporan pembelian (GET)');
		return new Response(JSON.stringify({ error: err?.message || 'Gagal mengekspor laporan pembelian' }), {
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
		log.error({ err }, 'Gagal export laporan pembelian (POST)');
		return new Response(JSON.stringify({ error: err?.message || 'Gagal mengekspor laporan pembelian' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
