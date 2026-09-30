import type { RequestHandler } from './$types';
import { exportPurchaseOrderListExcel } from '$lib/server/purchase-order';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const q = url.searchParams.get('q') || '';
		const tgl1 = url.searchParams.get('tgl1') || '';
		const tgl2 = url.searchParams.get('tgl2') || '';
		const status = (url.searchParams.get('status') || 'all') as any;
		const companyId = url.searchParams.get('companyId') || '';

		const buffer = await exportPurchaseOrderListExcel({
			q,
			tgl1,
			tgl2,
			status,
			companyId
		});

		const nowStr = new Date().toISOString().slice(0, 10);
		const filename = `DAFTAR_PO_CITI_PLUMB_${nowStr}.xlsx`;

		return new Response(buffer as any, {
			status: 200,
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'no-cache'
			}
		});
	} catch (error: any) {
		return new Response(error?.message || 'Gagal mengekspor daftar PO ke Excel', { status: 500 });
	}
};
