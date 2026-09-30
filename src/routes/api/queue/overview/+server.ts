import { json, type RequestHandler } from '@sveltejs/kit';
import { getAllQueuesStats } from '$lib/server/queue';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const stats = await getAllQueuesStats();
		return json({
			success: true,
			data: stats,
			timestamp: new Date().toISOString()
		});
	} catch (err: any) {
		return json(
			{ success: false, message: err?.message || 'Gagal mengambil statistik antrian.' },
			{ status: 500 }
		);
	}
};
