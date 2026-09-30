import type { RequestHandler } from '@sveltejs/kit';
import { generateSuppliersExcel } from '$lib/server/master-supplier';
import { log } from '$lib/db';

async function doExport(params: { q?: string; status?: string; curr?: string }) {
	const buffer = await generateSuppliersExcel(params);
	const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const fileName = `master_supplier_${nowStr}.xlsx`;

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
	const status = url.searchParams.get('status')?.trim() || undefined;
	const curr = url.searchParams.get('curr')?.trim() || undefined;

	try {
		return await doExport({ q, status, curr });
	} catch (err: any) {
		log.error({ err }, 'Gagal export master supplier via GET');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data master supplier' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	let q: string | undefined;
	let status: string | undefined;
	let curr: string | undefined;

	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
		const form = await request.formData();
		q = form.get('q')?.toString().trim() || undefined;
		status = form.get('status')?.toString().trim() || undefined;
		curr = form.get('curr')?.toString().trim() || undefined;
	} else if (contentType.includes('application/json')) {
		const body = await request.json().catch(() => ({}));
		q = body.q?.toString().trim() || undefined;
		status = body.status?.toString().trim() || undefined;
		curr = body.curr?.toString().trim() || undefined;
	}

	try {
		return await doExport({ q, status, curr });
	} catch (err: any) {
		log.error({ err }, 'Gagal export master supplier via POST');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data master supplier' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
