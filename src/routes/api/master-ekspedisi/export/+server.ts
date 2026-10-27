import type { RequestHandler } from '@sveltejs/kit';
import { generateEkspedisiExcel } from '$lib/server/master-ekspedisi';
import { log } from '$lib/db';

async function doExport(params: { q?: string; hasNpwp?: string; hasSupplier?: string }) {
	const buffer = await generateEkspedisiExcel(params);
	const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const fileName = `master_ekspedisi_${nowStr}.xlsx`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Cache-Control': 'no-store'
		}
	});
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	const q = url.searchParams.get('q')?.trim() || undefined;
	const hasNpwp = url.searchParams.get('hasNpwp')?.trim() || undefined;
	const hasSupplier = url.searchParams.get('hasSupplier')?.trim() || undefined;

	try {
		return await doExport({ q, hasNpwp, hasSupplier });
	} catch (err: any) {
		log.error({ err }, 'Gagal export master ekspedisi via GET');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data master ekspedisi' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	let q: string | undefined;
	let hasNpwp: string | undefined;
	let hasSupplier: string | undefined;

	const contentType = request.headers.get('content-type') || '';
	if (
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data')
	) {
		const form = await request.formData();
		q = form.get('q')?.toString().trim() || undefined;
		hasNpwp = form.get('hasNpwp')?.toString().trim() || undefined;
		hasSupplier = form.get('hasSupplier')?.toString().trim() || undefined;
	} else if (contentType.includes('application/json')) {
		const body = await request.json().catch(() => ({}));
		q = body.q?.toString().trim() || undefined;
		hasNpwp = body.hasNpwp?.toString().trim() || undefined;
		hasSupplier = body.hasSupplier?.toString().trim() || undefined;
	}

	try {
		return await doExport({ q, hasNpwp, hasSupplier });
	} catch (err: any) {
		log.error({ err }, 'Gagal export master ekspedisi via POST');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data master ekspedisi' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
