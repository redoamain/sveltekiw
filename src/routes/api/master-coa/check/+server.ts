import type { RequestHandler } from './$types';
import { json } from '$lib/http';
import { coaExists } from '$lib/server/master-coa';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, 401);
	}

	const acc = url.searchParams.get('acc')?.trim();
	if (!acc) {
		return json({ exists: false });
	}

	try {
		const exists = await coaExists(acc);
		return json({ exists, acc });
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal memeriksa kode akun' }, 500);
	}
};
