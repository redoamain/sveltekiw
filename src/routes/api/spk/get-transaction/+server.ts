import { json, type RequestHandler } from '@sveltejs/kit';
import { getSpkTransaction } from '$lib/server/input-spk';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	const orderId = url.searchParams.get('id');
	if (!orderId) {
		return json({ success: false, message: 'Parameter id wajib diisi.' }, { status: 400 });
	}

	try {
		const data = await getSpkTransaction(orderId);
		if (!data) {
			return json({ success: false, message: `SPK #${orderId} tidak ditemukan.` }, { status: 404 });
		}
		return json({ success: true, data });
	} catch (e: any) {
		return json({ success: false, message: e?.message || 'Gagal memuat SPK' }, { status: 500 });
	}
};
