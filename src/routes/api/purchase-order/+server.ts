import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getPurchaseOrders,
	createPurchaseOrder,
	getPurchaseOrderInitialData,
	searchSuppliers,
	searchGoods,
	getNextPurchaseOrderId
} from '$lib/server/purchase-order';

export const GET: RequestHandler = async ({ url }) => {
	const action = url.searchParams.get('action');

	try {
		if (action === 'initial') {
			const data = await getPurchaseOrderInitialData();
			return json(data);
		}

		if (action === 'search-suppliers') {
			const q = url.searchParams.get('q') || '';
			const limit = parseInt(url.searchParams.get('limit') || '25', 10);
			const suppliers = await searchSuppliers(q, limit);
			return json({ suppliers });
		}

		if (action === 'search-goods') {
			const q = url.searchParams.get('q') || '';
			const limit = parseInt(url.searchParams.get('limit') || '25', 10);
			const goods = await searchGoods(q, limit);
			return json({ goods });
		}

		if (action === 'next-id') {
			const date = url.searchParams.get('date') || '';
			const nextId = await getNextPurchaseOrderId(date);
			return json({ nextId });
		}

		// Default: Search / List Purchase Orders
		const q = url.searchParams.get('q') || '';
		const tgl1 = url.searchParams.get('tgl1') || '';
		const tgl2 = url.searchParams.get('tgl2') || '';
		const status = (url.searchParams.get('status') || 'all') as any;
		const companyId = url.searchParams.get('companyId') || '';
		const page = parseInt(url.searchParams.get('page') || '1', 10);
		const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

		const result = await getPurchaseOrders({
			q,
			tgl1,
			tgl2,
			status,
			companyId,
			page,
			pageSize
		});

		return json(result);
	} catch (error: any) {
		return json({ error: error?.message || 'Gagal memproses permintaan' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const payload = await request.json();
		const username = String(locals.user?.UserName || locals.user?.username || 'SYSTEM');
		const isSuperAdmin = Boolean(locals.user?.isSuperAdmin || locals.user?.role === 'IT');

		const result = await createPurchaseOrder(payload, username, isSuperAdmin);
		return json(result);
	} catch (error: any) {
		return json({ error: error?.message || 'Gagal menyimpan Purchase Order' }, { status: 400 });
	}
};
