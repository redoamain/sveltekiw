import type { RequestHandler } from '@sveltejs/kit';
import { generateSpkExcelTemplate } from '$lib/server/input-spk';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	try {
		const buffer = await generateSpkExcelTemplate();
		const filename = `Template_SPK_KIW_${new Date().toISOString().slice(0, 10)}.xlsx`;

		return new Response(buffer as unknown as BodyInit, {
			status: 200,
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'no-store'
			}
		});
	} catch (err: any) {
		return new Response(`Gagal membuat template Excel: ${err?.message}`, { status: 500 });
	}
};
