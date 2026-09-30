import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { getPOItems } from "$lib/server/input-penerimaan";

export const GET: RequestHandler = async ({ url }) => {
	const orderId = url.searchParams.get("orderId") || "";
	if (!orderId.trim()) {
		return json({ error: "Parameter orderId wajib diisi" }, 400);
	}

	try {
		const items = await getPOItems(orderId);
		return json({ items });
	} catch (error: any) {
		return json({ error: error?.message || "Gagal mengambil daftar item PO" }, 500);
	}
};
