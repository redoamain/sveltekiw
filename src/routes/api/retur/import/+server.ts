import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { parseReturExcelImport } from "$lib/server/input-retur";
import { log } from "@/lib/db";

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file || typeof file === "string") {
			return json({ error: "File Excel Retur wajib diunggah." }, 400);
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const parsed = await parseReturExcelImport(buffer);
		return json({
			success: true,
			data: {
				...parsed,
				fileName: file.name,
				fileSize: file.size,
			},
		});
	} catch (error: any) {
		log.error({ error }, "Gagal membaca & memparsing file Excel Retur");
		return json({ error: error?.message || "Format file Excel Retur tidak valid." }, 400);
	}
};
