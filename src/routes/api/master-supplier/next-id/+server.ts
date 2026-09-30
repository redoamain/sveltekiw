import type { RequestHandler } from './$types';
import { json } from '$lib/http';
import { getLastSupplierId } from '$lib/server/master-supplier';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, 401);
	}

	try {
		const data = await getLastSupplierId();
		return json(data);
	} catch (error: any) {
		return json(
			{ error: error?.message || 'Gagal mengambil nomor CompanyID supplier berikutnya' },
			500
		);
	}
};
