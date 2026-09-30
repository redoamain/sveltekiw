import { json, type RequestHandler } from '@sveltejs/kit';
import { getNextSpkId } from '$lib/server/input-spk';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	const deptId = url.searchParams.get('deptId') || 'IN';
	const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

	try {
		const nextOrderId = await getNextSpkId(deptId, date);
		return json({ success: true, nextOrderId });
	} catch (e: any) {
		return json({ success: false, message: e?.message || 'Gagal generate next OrderID' }, { status: 500 });
	}
};
