import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { deleteReturTransaction } from "$lib/server/input-retur";

export const POST: RequestHandler = async ({ request, locals }) => {
	const username = (locals.user?.UserName as string) || (locals.user?.username as string) || "OPERATOR";

	try {
		const body = await request.json();
		const moveId = String(body.moveId || "").trim();

		if (!moveId) {
			return json({ error: "Nomor bukti Retur (MoveID) wajib disertakan." }, 400);
		}

		const result = await deleteReturTransaction(moveId, username);
		return json(result);
	} catch (error: any) {
		return json({ error: error?.message || "Gagal menghapus transaksi Retur" }, 500);
	}
};
