import type { RequestHandler } from '@sveltejs/kit';
import { generateCOAExcel } from '$lib/server/master-coa';
import { log } from '$lib/db';

async function doExport(params: {
	q?: string;
	group?: string;
	type?: string;
	pos?: string;
	curr?: string;
	status?: string;
}) {
	const buffer = await generateCOAExcel(params);
	const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const fileName = `bagan_akun_coa_${nowStr}.xlsx`;

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
	const type = url.searchParams.get('type')?.trim() || undefined;
	const pos = url.searchParams.get('pos')?.trim() || undefined;
	const curr = url.searchParams.get('curr')?.trim() || undefined;
	const status = url.searchParams.get('status')?.trim() || undefined;

	try {
		return await doExport({ q, group, type, pos, curr, status });
	} catch (err: any) {
		log.error({ err }, 'Gagal export COA via GET');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data bagan akun' }),
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
	let type: string | undefined;
	let pos: string | undefined;
	let curr: string | undefined;
	let status: string | undefined;

	const contentType = request.headers.get('content-type') || '';
	if (
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data')
	) {
		const form = await request.formData();
		q = form.get('q')?.toString().trim() || undefined;
		group = form.get('group')?.toString().trim() || undefined;
		type = form.get('type')?.toString().trim() || undefined;
		pos = form.get('pos')?.toString().trim() || undefined;
		curr = form.get('curr')?.toString().trim() || undefined;
		status = form.get('status')?.toString().trim() || undefined;
	} else if (contentType.includes('application/json')) {
		const body = await request.json().catch(() => ({}));
		q = body.q?.toString().trim() || undefined;
		group = body.group?.toString().trim() || undefined;
		type = body.type?.toString().trim() || undefined;
		pos = body.pos?.toString().trim() || undefined;
		curr = body.curr?.toString().trim() || undefined;
		status = body.status?.toString().trim() || undefined;
	}

	try {
		return await doExport({ q, group, type, pos, curr, status });
	} catch (err: any) {
		log.error({ err }, 'Gagal export COA via POST');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data bagan akun' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
