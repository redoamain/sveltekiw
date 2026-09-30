import type { RequestHandler } from '@sveltejs/kit';
import {
	getKartuHutangData,
	generateKartuHutangExcel,
	type KartuHutangParams
} from '$lib/server/kartu-hutang';
import { log } from '$lib/db';

async function doExport(params: KartuHutangParams) {
	const report = await getKartuHutangData(params);
	const buffer = generateKartuHutangExcel(report);
	const tgl1Str = params.tgl1.replace(/-/g, '');
	const tgl2Str = params.tgl2.replace(/-/g, '');
	const fileName = `kartu_hutang_${tgl1Str}_${tgl2Str}.xlsx`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Cache-Control': 'no-store'
		}
	});
}

function parseParams(getParam: (key: string) => string | null): KartuHutangParams {
	const tgl1 = getParam('tgl1')?.trim() || new Date().toISOString().slice(0, 8) + '01';
	const tgl2 = getParam('tgl2')?.trim() || new Date().toISOString().slice(0, 10);
	const companyID = getParam('companyID')?.trim() || '%';
	const curr = getParam('curr')?.trim() || 'IDR';
	const noTrans = getParam('noTrans')?.trim() || '%';
	const transtype = getParam('transtype')?.trim() || '%';
	const company = getParam('company') !== null ? Number(getParam('company')) : 0;
	const hideEmpty = getParam('hideEmpty') === '1' || getParam('hideEmpty') === 'true';

	return {
		tgl1,
		tgl2,
		companyID,
		curr,
		noTrans,
		transtype,
		company,
		hideEmpty
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
		log.error({ err, params }, 'Gagal export kartu hutang (GET)');
		return new Response(JSON.stringify({ error: err?.message || 'Gagal mengekspor kartu hutang' }), {
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
		log.error({ err }, 'Gagal export kartu hutang (POST)');
		return new Response(JSON.stringify({ error: err?.message || 'Gagal mengekspor kartu hutang' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
