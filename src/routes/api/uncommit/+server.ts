import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { uncommitPO } from "$lib/server/planning";
import { json } from "$lib/http";

const UncommitSchema = z.object({
  noSPK: z.string().min(1),
  userID: z.string().min(1),
});

// UNCOMMIT PO: release stok dalam satu transaksi.
export const POST: RequestHandler = async ({ request }) => {
  const parsed = UncommitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ success: false, error: "No SPK dan UserID diperlukan" }, 400);
  }
  const { noSPK, userID } = parsed.data;

  try {
    await uncommitPO(noSPK, userID);
    return json({ success: true, message: "PO berhasil di-uncommit" });
  } catch (error) {
    if (error instanceof Error && error.message === "COMMITTED_NOT_FOUND") {
      return json({ success: false, error: "Committed PO tidak ditemukan" }, 404);
    }
    log.error({ err: error, noSPK }, "Gagal uncommit PO");
    return json(
      { success: false, error: error instanceof Error ? error.message : "Gagal uncommit PO" },
      500,
    );
  }
};


