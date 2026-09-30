import type { RequestHandler } from "./$types";
import { generatePenerimaanExcelTemplate } from "$lib/server/input-penerimaan";

export const GET: RequestHandler = async () => {
	try {
		const buffer = await generatePenerimaanExcelTemplate();
		return new Response(buffer as unknown as BodyInit, {
			headers: {
				"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"Content-Disposition": 'attachment; filename="Template_Penerimaan_Gudang.xlsx"',
			},
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error?.message || "Gagal membuat template Excel" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
