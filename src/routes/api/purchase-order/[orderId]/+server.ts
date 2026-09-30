import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getPurchaseOrderDetail,
	updatePurchaseOrder,
	cancelPurchaseOrder,
	toggleCompletePurchaseOrder,
	deletePurchaseOrder
} from '$lib/server/purchase-order';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const orderId = params.orderId;
		const data = await getPurchaseOrderDetail(orderId);
		return json(data);
	} catch (error: any) {
		return json({ error: error?.message || 'Purchase Order tidak ditemukan' }, { status: 404 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const orderId = params.orderId;
		const payload = await request.json();
		payload.orderId = orderId;

		const username = String(locals.user?.UserName || locals.user?.username || 'SYSTEM');
		const isSuperAdmin = Boolean(locals.user?.isSuperAdmin || locals.user?.role === 'IT');

		const result = await updatePurchaseOrder(payload, username, isSuperAdmin);
		return json(result);
	} catch (error: any) {
		return json({ error: error?.message || 'Gagal memperbarui Purchase Order' }, { status: 400 });
	}
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	try {
		const orderId = params.orderId;
		const body = await request.json();
		const username = String(locals.user?.UserName || locals.user?.username || 'SYSTEM');
		const isSuperAdmin = Boolean(locals.user?.isSuperAdmin || locals.user?.role === 'IT');

		if (body.action === 'cancel') {
			const reason = body.reason || 'Dibatalkan oleh pengguna';
			const result = await cancelPurchaseOrder(orderId, reason, username, isSuperAdmin);
			return json(result);
		}

		if (body.action === 'toggle-complete') {
			const completed = Boolean(body.completed);
			const result = await toggleCompletePurchaseOrder(orderId, completed, username);
			return json(result);
		}

		return json({ error: 'Aksi tidak valid' }, { status: 400 });
	} catch (error: any) {
		return json({ error: error?.message || 'Gagal memproses aksi PO' }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const orderId = params.orderId;
		const username = String(locals.user?.UserName || locals.user?.username || 'SYSTEM');
		const isSuperAdmin = Boolean(locals.user?.isSuperAdmin || locals.user?.role === 'IT');

		const result = await deletePurchaseOrder(orderId, username, isSuperAdmin);
		return json(result);
	} catch (error: any) {
		return json({ error: error?.message || 'Gagal menghapus Purchase Order' }, { status: 400 });
	}
};
