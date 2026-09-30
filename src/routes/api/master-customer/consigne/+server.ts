import type { RequestHandler } from './$types';
import { json } from '$lib/http';
import { getAllConsigne, getNextConsigneId } from '$lib/server/master-customer';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, 401);
	}

	try {
		const [list, nextId] = await Promise.all([
			getAllConsigne(),
			getNextConsigneId()
		]);
		return json({ list, nextId });
	} catch (error: any) {
		return json(
			{ error: error?.message || 'Gagal mengambil data taConsigne' },
			500
		);
	}
};
