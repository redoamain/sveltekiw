import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getPenerimaanTransaction } from "$lib/server/input-penerimaan";

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get("id");
	if (!id) {
		return json({ error: "Parameter id (MoveID) wajib disertakan." }, 400);
	}

	try {
		const txData = await getPenerimaanTransaction(id);
		if (!txData) {
			return json({ error: `Transaksi Penerimaan '${id}' tidak ditemukan.` }, 404);
		}
		return json({ data: txData });
	} catch (error: any) {
		return json({ error: error?.message || "Gagal memuat transaksi penerimaan" }, 500);
	}
};
