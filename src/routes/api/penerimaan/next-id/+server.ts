import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getNextPenerimaanId, getNextTransId } from "$lib/server/input-penerimaan";

export const GET: RequestHandler = async ({ url }) => {
	const dateStr = url.searchParams.get("date") || undefined;
	try {
		const [nextMoveId, nextTransId] = await Promise.all([
			getNextPenerimaanId(dateStr),
			getNextTransId(dateStr),
		]);
		return json({ nextMoveId, nextTransId });
	} catch (error: any) {
		return json({ error: error?.message || "Gagal mengambil nomor bukti penerimaan berikutnya" }, 500);
	}
};
