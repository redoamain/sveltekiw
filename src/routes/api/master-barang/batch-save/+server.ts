import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { importMasterGoods, type CreateMasterItemPayload } from "$lib/server/master";
import { log } from "@/lib/db";

export const POST: RequestHandler = async ({ request, locals }) => {
	const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';

	try {
		const body = await request.json();
		const items = (body.items ?? []) as CreateMasterItemPayload[];
		const updateExisting = Boolean(body.updateExisting);

		if (!Array.isArray(items) || items.length === 0) {
			return json({ error: "Daftar barang untuk di-import tidak boleh kosong." }, 400);
		}

		const result = await importMasterGoods(items, updateExisting, username);
		return json({
			success: true,
			data: result,
		});
	} catch (error: any) {
		log.error({ error }, "Gagal melakukan import batch Master Barang");
		return json({ error: error?.message || "Gagal menyimpan data import Master Barang." }, 500);
	}
};
