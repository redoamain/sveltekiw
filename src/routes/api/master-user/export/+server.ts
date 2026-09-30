import type { RequestHandler } from '@sveltejs/kit';
import { generateUsersExcel } from '$lib/server/master-user';
import { log } from '$lib/db';

async function doExport(params: { q?: string; bagian?: string; groupId?: string; status?: string }) {
	const buffer = await generateUsersExcel(params);
	const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const fileName = `master_user_${nowStr}.xlsx`;

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
	const bagian = url.searchParams.get('bagian')?.trim() || undefined;
	const groupId = url.searchParams.get('groupId')?.trim() || undefined;
	const status = url.searchParams.get('status')?.trim() || undefined;

	try {
		return await doExport({ q, bagian, groupId, status });
	} catch (err: any) {
		log.error({ err }, 'Gagal export master user via GET');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data master user' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	let q: string | undefined;
	let bagian: string | undefined;
	let groupId: string | undefined;
	let status: string | undefined;

	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
		const form = await request.formData();
		q = form.get('q')?.toString().trim() || undefined;
		bagian = form.get('bagian')?.toString().trim() || undefined;
		groupId = form.get('groupId')?.toString().trim() || undefined;
		status = form.get('status')?.toString().trim() || undefined;
	} else if (contentType.includes('application/json')) {
		const body = await request.json().catch(() => ({}));
		q = body.q?.toString().trim() || undefined;
		bagian = body.bagian?.toString().trim() || undefined;
		groupId = body.groupId?.toString().trim() || undefined;
		status = body.status?.toString().trim() || undefined;
	}

	try {
		return await doExport({ q, bagian, groupId, status });
	} catch (err: any) {
		log.error({ err }, 'Gagal export master user via POST');
		return new Response(
			JSON.stringify({ error: err?.message || 'Gagal export data master user' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
