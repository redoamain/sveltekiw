import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { searchOpenPOs } from "$lib/server/input-penerimaan";

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get("q") || "";
	const limit = parseInt(url.searchParams.get("limit") || "20", 10);

	try {
		const pos = await searchOpenPOs(q, limit);
		return json({ pos });
	} catch (error: any) {
		return json({ error: error?.message || "Gagal mencari Purchase Order" }, 500);
	}
};
