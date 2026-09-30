import type { RequestHandler } from './$types';
import { getNextBomTransId } from '$lib/server/master-bom';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		const nextId = await getNextBomTransId();
		return json({ success: true, nextId });
	} catch (err: any) {
		return json({ success: false, error: err?.message || 'Gagal generate next TransID' }, { status: 500 });
	}
};
