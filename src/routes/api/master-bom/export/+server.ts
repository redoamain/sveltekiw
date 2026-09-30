import type { RequestHandler } from './$types';
import { generateBomListExcel, generateSingleBomExcel } from '$lib/server/master-bom';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const transId = String(formData.get('transId') ?? '').trim();

	if (transId) {
		const buffer = await generateSingleBomExcel(transId);
		return new Response(buffer as unknown as BodyInit, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="BOM-${transId}.xlsx"`
			}
		});
	}

	const q = String(formData.get('q') ?? '').trim();
	const locIdSource = String(formData.get('locIdSource') ?? '').trim();
	const locId = String(formData.get('locId') ?? '').trim();

	const buffer = await generateBomListExcel({
		q: q || undefined,
		locIdSource: locIdSource || undefined,
		locId: locId || undefined
	});

	const dateStr = new Date().toISOString().slice(0, 10);
	return new Response(buffer as unknown as BodyInit, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="Master-BOM-${dateStr}.xlsx"`
		}
	});
};

export const GET: RequestHandler = async ({ url }) => {
	const transId = url.searchParams.get('transId')?.trim();

	if (transId) {
		const buffer = await generateSingleBomExcel(transId);
		return new Response(buffer as unknown as BodyInit, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="BOM-${transId}.xlsx"`
			}
		});
	}

	const q = url.searchParams.get('q')?.trim();
	const locIdSource = url.searchParams.get('locIdSource')?.trim();
	const locId = url.searchParams.get('locId')?.trim();

	const buffer = await generateBomListExcel({
		q: q || undefined,
		locIdSource: locIdSource || undefined,
		locId: locId || undefined
	});

	const dateStr = new Date().toISOString().slice(0, 10);
	return new Response(buffer as unknown as BodyInit, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="Master-BOM-${dateStr}.xlsx"`
		}
	});
};
