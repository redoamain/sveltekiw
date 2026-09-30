import type { RequestHandler } from './$types';
import { exportSinglePurchaseOrderExcel } from '$lib/server/purchase-order';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const orderId = params.orderId;
		const buffer = await exportSinglePurchaseOrderExcel(orderId);

		const filename = `PO_${orderId}_CITI_PLUMB.xlsx`;

		return new Response(buffer as any, {
			status: 200,
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'no-cache'
			}
		});
	} catch (error: any) {
		return new Response(error?.message || 'Gagal mengekspor PO ke Excel', { status: 500 });
	}
};
