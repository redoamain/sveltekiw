import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getPurchaseOrderDetail } from '$lib/server/purchase-order';

export const load: PageServerLoad = async ({ params }) => {
	try {
		const orderId = params.orderId;
		const data = await getPurchaseOrderDetail(orderId);
		return {
			...data
		};
	} catch (err: any) {
		throw error(404, err?.message || 'Purchase Order tidak ditemukan');
	}
};
