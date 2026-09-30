import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { searchReturTransactions } from "$lib/server/input-retur";

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get("q") || "";
	const limit = parseInt(url.searchParams.get("limit") || "25", 10);

	try {
		const results = await searchReturTransactions(q, limit);
		return json({ results });
	} catch (error: any) {
		return json({ error: error?.message || "Gagal mencari data transaksi Retur" }, 500);
	}
};
