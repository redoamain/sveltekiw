import type { RequestHandler } from "./$types";
import { generateMasterGoodsExcelTemplate } from "$lib/server/master";
import { log } from "@/lib/db";

export const GET: RequestHandler = async () => {
	try {
		const buffer = await generateMasterGoodsExcelTemplate();
		const fileName = "Template_Import_Master_Barang.xlsx";

		return new Response(new Uint8Array(buffer), {
			status: 200,
			headers: {
				"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"Content-Disposition": `attachment; filename="${fileName}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (error: any) {
		log.error({ error }, "Gagal menghasilkan template Excel Master Barang");
		return new Response(
			JSON.stringify({ error: error?.message || "Gagal membuat template Excel Master Barang." }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
};
