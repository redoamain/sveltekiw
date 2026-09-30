import { json, type RequestHandler } from '@sveltejs/kit';
import { deleteSpkTransaction } from '$lib/server/input-spk';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { orderId } = await request.json();
		if (!orderId) {
			return json({ success: false, message: 'Nomor SPK wajib diisi.' }, { status: 400 });
		}

		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';
		const res = await deleteSpkTransaction(orderId, username);

		return json(res);
	} catch (e: any) {
		return json(
			{ success: false, message: e?.message || 'Gagal menghapus transaksi SPK.' },
			{ status: 500 }
		);
	}
};
