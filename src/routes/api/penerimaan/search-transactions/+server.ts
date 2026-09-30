import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { searchPenerimaanTransactions } from "$lib/server/input-penerimaan";

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get("q") || "";
	const limit = parseInt(url.searchParams.get("limit") || "20", 10);

	try {
		const transactions = await searchPenerimaanTransactions(q, limit);
		return json({ transactions });
	} catch (error: any) {
		return json({ error: error?.message || "Gagal mencari transaksi penerimaan" }, 500);
	}
};
