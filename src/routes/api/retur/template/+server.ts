import type { RequestHandler } from "./$types";
import { generateReturExcelTemplate } from "$lib/server/input-retur";
import { log } from "@/lib/db";

export const GET: RequestHandler = async () => {
	try {
		const buffer = await generateReturExcelTemplate();
		const fileName = "Template_Import_Retur_Produksi.xlsx";

		return new Response(new Uint8Array(buffer), {
			status: 200,
			headers: {
				"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"Content-Disposition": `attachment; filename="${fileName}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (error: any) {
		log.error({ error }, "Gagal menghasilkan template Excel Retur Produksi");
		return new Response(
			JSON.stringify({ error: error?.message || "Gagal membuat template Excel Retur." }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
};
