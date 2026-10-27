import type { RequestHandler } from '@sveltejs/kit';
import { generateRpFormExcel } from '$lib/server/rpform';
import { log } from '$lib/db';

async function doExport(params: { q?: string; group?: string; progType?: string }) {
	const buffer = await generateRpFormExcel(params);
	const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const fileName = `laporan_taRpForm_${nowStr}.xlsx`;

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
	const group = url.searchParams.get('group')?.trim() || undefined;
	const progType = url.searchParams.get('progType')?.trim() || undefined;

	try {
		return await doExport({ q, group, progType });
	} catch (err: any) {
		log.error({ err }, 'Gagal export laporan taRpForm via GET');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data laporan taRpForm' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	let q: string | undefined;
	let group: string | undefined;
	let progType: string | undefined;

	const contentType = request.headers.get('content-type') || '';
	if (
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data')
	) {
		const form = await request.formData();
		q = form.get('q')?.toString().trim() || undefined;
		group = form.get('group')?.toString().trim() || undefined;
		progType = form.get('progType')?.toString().trim() || undefined;
	} else if (contentType.includes('application/json')) {
		const body = await request.json().catch(() => ({}));
		q = body.q?.toString().trim() || undefined;
		group = body.group?.toString().trim() || undefined;
		progType = body.progType?.toString().trim() || undefined;
	}

	try {
		return await doExport({ q, group, progType });
	} catch (err: any) {
		log.error({ err }, 'Gagal export laporan taRpForm via POST');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data laporan taRpForm' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
