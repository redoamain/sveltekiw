import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { deleteLbmTransaction } from "$lib/server/input-lbm";
import { log } from "@/lib/db";

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const moveId = body.moveId;
    const moveType = body.moveType || "A";

    if (!moveId) {
      return json({ error: "Nomor bukti LBM (moveId) wajib disertakan." }, 400);
    }

    const username = (locals.user as any)?.UserName || (locals.user as any)?.username || "OPERATOR";
    const result = await deleteLbmTransaction(moveId, moveType, username);

    return json(result);
  } catch (error: any) {
    log.error({ error }, "Gagal menghapus transaksi LBM");
    return json({ error: error?.message || "Gagal menghapus transaksi LBM." }, 500);
  }
};
