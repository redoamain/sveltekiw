import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { parsePenerimaanExcelImport } from "$lib/server/input-penerimaan";

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return json({ error: "File Excel tidak ditemukan pada request." }, 400);
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const result = await parsePenerimaanExcelImport(buffer);
		return json({ success: true, data: { ...result, fileName: file.name } });
	} catch (error: any) {
		return json({ error: error?.message || "Gagal memproses file Excel import penerimaan" }, 400);
	}
};
