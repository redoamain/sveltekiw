import type { RequestHandler } from './$types';
import { json } from '$lib/http';
import { getLastCustomerId } from '$lib/server/master-customer';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, 401);
	}

	try {
		const data = await getLastCustomerId();
		return json(data);
	} catch (error: any) {
		return json(
			{ error: error?.message || 'Gagal mengambil nomor CompanyID customer berikutnya' },
			500
		);
	}
};
