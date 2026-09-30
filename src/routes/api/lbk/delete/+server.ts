import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { deleteLbkTransaction } from "$lib/server/input-lbk";
import { log } from "@/lib/db";

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const moveId = body.moveId;
    const moveType = body.moveType || "A";

    if (!moveId) {
      return json({ error: "Nomor bukti LBK (moveId) wajib disertakan." }, 400);
    }

    const username = (locals.user as any)?.UserName || (locals.user as any)?.username || "OPERATOR";
    const result = await deleteLbkTransaction(moveId, moveType, username);

    return json(result);
  } catch (error: any) {
    log.error({ error }, "Gagal menghapus transaksi LBK");
    return json({ error: error?.message || "Gagal menghapus transaksi LBK." }, 500);
  }
};
