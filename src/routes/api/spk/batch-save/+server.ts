import { json, type RequestHandler } from '@sveltejs/kit';
import { createSpkBatchTransactions, type BatchCreateSpkPayload } from '$lib/server/input-spk';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';

	try {
		const payload = (await request.json()) as BatchCreateSpkPayload;

		if (!payload || !Array.isArray(payload.groups) || payload.groups.length === 0) {
			return json(
				{ success: false, message: 'Tidak ada data grup departemen yang akan disimpan.' },
				{ status: 400 }
			);
		}

		const result = await createSpkBatchTransactions(payload, username);

		return json({
			success: true,
			createdOrders: result.createdOrders,
			message: result.message
		});
	} catch (err: any) {
		return json(
			{
				success: false,
				message: err?.message || 'Gagal menyimpan transaksi SPK multi-departemen.'
			},
			{ status: 400 }
		);
	}
};
