import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	getPurchaseOrders,
	getPurchaseOrderInitialData,
	createPurchaseOrder,
	updatePurchaseOrder,
	cancelPurchaseOrder,
	toggleCompletePurchaseOrder,
	deletePurchaseOrder
} from '$lib/server/purchase-order';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q') || '';
	const tgl1 = url.searchParams.get('tgl1') || '';
	const tgl2 = url.searchParams.get('tgl2') || '';
	const status = (url.searchParams.get('status') || 'all') as any;
	const companyId = url.searchParams.get('companyId') || '';
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const pageSize = parseInt(url.searchParams.get('pageSize') || '15', 10);
	const tab = url.searchParams.get('tab') || 'form';

	const [initialData, poList] = await Promise.all([
		getPurchaseOrderInitialData(),
		getPurchaseOrders({
			q,
			tgl1,
			tgl2,
			status,
			companyId,
			page,
			pageSize
		})
	]);

	return {
		initialData,
		poList,
		filter: {
			q,
			tgl1,
			tgl2,
			status,
			companyId,
			page,
			pageSize,
			tab
		}
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const username = String(locals.user?.UserName || locals.user?.username || 'SYSTEM');
		const isSuperAdmin = Boolean(locals.user?.isSuperAdmin || locals.user?.role === 'IT');

		try {
			const data = await request.formData();
			const payloadRaw = data.get('payload');
			if (!payloadRaw) {
				return fail(400, { success: false, message: 'Data formulir tidak lengkap.' });
			}

			const payload = JSON.parse(String(payloadRaw));
			const result = await createPurchaseOrder(payload, username, isSuperAdmin);
			return result;
		} catch (err: any) {
			return fail(400, { success: false, message: err?.message || 'Gagal menyimpan Purchase Order.' });
		}
	},

	update: async ({ request, locals }) => {
		const username = String(locals.user?.UserName || locals.user?.username || 'SYSTEM');
		const isSuperAdmin = Boolean(locals.user?.isSuperAdmin || locals.user?.role === 'IT');

		try {
			const data = await request.formData();
			const payloadRaw = data.get('payload');
			if (!payloadRaw) {
				return fail(400, { success: false, message: 'Data pembaruan tidak lengkap.' });
			}

			const payload = JSON.parse(String(payloadRaw));
			const result = await updatePurchaseOrder(payload, username, isSuperAdmin);
			return result;
		} catch (err: any) {
			return fail(400, { success: false, message: err?.message || 'Gagal memperbarui Purchase Order.' });
		}
	},

	cancel: async ({ request, locals }) => {
		const username = String(locals.user?.UserName || locals.user?.username || 'SYSTEM');
		const isSuperAdmin = Boolean(locals.user?.isSuperAdmin || locals.user?.role === 'IT');

		try {
			const data = await request.formData();
			const orderId = String(data.get('orderId') || '');
			const reason = String(data.get('reason') || 'Dibatalkan oleh pengguna');

			const result = await cancelPurchaseOrder(orderId, reason, username, isSuperAdmin);
			return result;
		} catch (err: any) {
			return fail(400, { success: false, message: err?.message || 'Gagal membatalkan Purchase Order.' });
		}
	},

	toggleComplete: async ({ request, locals }) => {
		const username = String(locals.user?.UserName || locals.user?.username || 'SYSTEM');

		try {
			const data = await request.formData();
			const orderId = String(data.get('orderId') || '');
			const completed = data.get('completed') === 'true';

			const result = await toggleCompletePurchaseOrder(orderId, completed, username);
			return result;
		} catch (err: any) {
			return fail(400, { success: false, message: err?.message || 'Gagal mengubah status selesai.' });
		}
	},

	delete: async ({ request, locals }) => {
		const username = String(locals.user?.UserName || locals.user?.username || 'SYSTEM');
		const isSuperAdmin = Boolean(locals.user?.isSuperAdmin || locals.user?.role === 'IT');

		try {
			const data = await request.formData();
			const orderId = String(data.get('orderId') || '');

			const result = await deletePurchaseOrder(orderId, username, isSuperAdmin);
			return result;
		} catch (err: any) {
			return fail(400, { success: false, message: err?.message || 'Gagal menghapus Purchase Order.' });
		}
	}
};
