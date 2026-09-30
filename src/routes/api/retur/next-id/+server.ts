import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getNextReturId } from "$lib/server/input-retur";

export const GET: RequestHandler = async ({ url }) => {
	const date = url.searchParams.get("date") || undefined;

	try {
		const nextMoveId = await getNextReturId(date);
		return json({ nextMoveId });
	} catch (error: any) {
		return json({ error: error?.message || "Gagal mendapatkan nomor Retur berikutnya" }, 500);
	}
};
