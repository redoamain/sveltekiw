import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { parseMasterGoodsExcelImport } from "$lib/server/master";
import { log } from "@/lib/db";

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file || typeof file === "string") {
			return json({ error: "File Excel Master Barang wajib diunggah." }, 400);
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const parsed = await parseMasterGoodsExcelImport(buffer);
		return json({
			success: true,
			data: {
				...parsed,
				fileName: file.name,
				fileSize: file.size,
			},
		});
	} catch (error: any) {
		log.error({ error }, "Gagal membaca & memvalidasi file Excel Master Barang");
		return json({ error: error?.message || "Format file Excel Master Barang tidak valid." }, 400);
	}
};
