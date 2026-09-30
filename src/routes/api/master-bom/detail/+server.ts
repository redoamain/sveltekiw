import type { RequestHandler } from './$types';
import { getBomDetailByTransId, getBomTreeByItemId } from '$lib/server/master-bom';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const transId = url.searchParams.get('transId')?.trim();
	if (!transId) {
		return json({ success: false, error: 'Parameter transId wajib disertakan.' }, { status: 400 });
	}

	try {
		const detail = await getBomDetailByTransId(transId);
		if (!detail) {
			return json({ success: false, error: `BOM "${transId}" tidak ditemukan.` }, { status: 404 });
		}

		const tree = await getBomTreeByItemId(detail.header.ItemID);

		return json({
			success: true,
			header: detail.header,
			details: detail.details,
			tree
		});
	} catch (err: any) {
		return json({ success: false, error: err?.message || 'Gagal memuat detail BOM' }, { status: 500 });
	}
};
