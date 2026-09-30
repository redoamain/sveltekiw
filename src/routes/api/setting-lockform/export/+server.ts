import type { RequestHandler } from './$types';
import { exportLockformsToExcel } from '$lib/server/lockform';

export const GET: RequestHandler = async () => {
	const buffer = await exportLockformsToExcel();
	const dateStr = new Date().toISOString().slice(0, 10);

	return new Response(buffer as unknown as BodyInit, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="Status-Kunci-Form-${dateStr}.xlsx"`
		}
	});
};

export const POST: RequestHandler = async () => {
	const buffer = await exportLockformsToExcel();
	const dateStr = new Date().toISOString().slice(0, 10);

	return new Response(buffer as unknown as BodyInit, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="Status-Kunci-Form-${dateStr}.xlsx"`
		}
	});
};
