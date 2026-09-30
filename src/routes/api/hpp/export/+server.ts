import type { RequestHandler } from '@sveltejs/kit';
import { generateHPPExcel, type HPPFilterParams } from '$lib/server/hpp';
import { log } from '$lib/db';

async function handleExport(params: HPPFilterParams & { reportType: 'rekap' | 'cogm' | 'kartu-stock' | 'mutasi-stock' | 'ytd' | 'harga' | 'kalkulasi' | 'all' }) {
	const reportType = params.reportType || 'rekap';
	const buffer = await generateHPPExcel(reportType, params);

	const suffix = params.tgl1 && params.tgl2 ? `${params.tgl1}_${params.tgl2}` : `${params.year}${params.month}`;
	const fileName = `Laporan_HPP_${reportType.toUpperCase()}_${suffix}.xlsx`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Cache-Control': 'no-store'
		}
	});
}

function parseParams(getParam: (key: string) => string | null): HPPFilterParams & { reportType: 'rekap' | 'cogm' | 'kartu-stock' | 'mutasi-stock' | 'ytd' | 'harga' | 'kalkulasi' | 'all' } {
	const now = new Date();
	const year = getParam('year')?.trim() || String(now.getFullYear());
	const month = (getParam('month')?.trim() || String(now.getMonth() + 1)).padStart(2, '0');
	const tgl1 = getParam('tgl1')?.trim() || undefined;
	const tgl2 = getParam('tgl2')?.trim() || undefined;
	const opr = Number(getParam('opr')) || 0;
	const item = getParam('item')?.trim() || undefined;
	const hideEmpty = getParam('hideEmpty') !== 'false';
	const reportType = (getParam('reportType')?.trim() || 'rekap') as any;

	return {
		year,
		month,
		tgl1,
		tgl2,
		opr,
		item,
		hideEmpty,
		reportType
	};
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	const params = parseParams((k) => url.searchParams.get(k));

	try {
		return await handleExport(params);
	} catch (err: any) {
		log.error({ err, params }, 'Gagal export laporan HPP (GET)');
		return new Response(JSON.stringify({ error: err?.message || 'Gagal mengekspor laporan HPP' }), {
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
		const formData = await request.formData();
		const params = parseParams((k) => formData.get(k) as string | null);
		return await handleExport(params);
	} catch (err: any) {
		log.error({ err }, 'Gagal export laporan HPP (POST)');
		return new Response(JSON.stringify({ error: err?.message || 'Gagal mengekspor laporan HPP' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
