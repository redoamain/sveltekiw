import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { deletePenerimaanTransaction } from "$lib/server/input-penerimaan";

export const POST: RequestHandler = async ({ request, locals }) => {
	const username = (locals.user?.UserName as string) || (locals.user?.username as string) || "OPERATOR";

	try {
		const body = await request.json();
		const moveId = String(body.moveId || "").trim();

		if (!moveId) {
			return json({ error: "Nomor bukti Penerimaan (MoveID) wajib disertakan." }, 400);
		}

		const result = await deletePenerimaanTransaction(moveId, username);
		return json(result);
	} catch (error: any) {
		return json({ error: error?.message || "Gagal menghapus transaksi Penerimaan" }, 500);
	}
};
