import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getReturTransaction } from "$lib/server/input-retur";

export const GET: RequestHandler = async ({ url }) => {
	const moveId = (url.searchParams.get("moveId") || url.searchParams.get("id") || "").trim();

	if (!moveId) {
		return json({ error: "Nomor bukti Retur (MoveID) wajib disertakan." }, 400);
	}

	try {
		const tx = await getReturTransaction(moveId);
		if (!tx) {
			return json({ error: `Transaksi Retur '${moveId}' tidak ditemukan.` }, 404);
		}
		return json({ success: true, transaction: tx });
	} catch (error: any) {
		return json({ error: error?.message || "Gagal memuat transaksi Retur" }, 500);
	}
};
