import type { RequestHandler } from './$types';
import { json } from '$lib/http';
import { getNextEkspedisiId } from '$lib/server/master-ekspedisi';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, 401);
	}

	try {
		const name = url.searchParams.get('name')?.trim() || undefined;
		const data = await getNextEkspedisiId(name);
		return json(data);
	} catch (error: any) {
		return json(
			{ error: error?.message || 'Gagal mengambil nomor kode ekspedisi berikutnya' },
			500
		);
	}
};
