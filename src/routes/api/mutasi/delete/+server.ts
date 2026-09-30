import type { RequestHandler } from "./$types";
import { json } from "$lib/http";
import { deleteMutasiTransaction } from "$lib/server/input-mutasi";

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const moveId = (body.moveId ?? "").trim();
    const moveType = (body.moveType ?? "R").trim();

    if (!moveId) {
      return json({ error: "Nomor Mutasi (MoveID) wajib diisi." }, 400);
    }

    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    const result = await deleteMutasiTransaction(moveId, moveType, username);
    return json({ ...result });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal menghapus transaksi mutasi" }, 500);
  }
};
