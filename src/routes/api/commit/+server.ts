import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { commitSPK } from "$lib/server/planning";
import { json } from "$lib/http";

const MaterialSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().default(""),
  qtyPerUnit: z.number().default(0),
  totalNeeded: z.number().default(0),
  stockBefore: z.number().default(0),
  stockAfter: z.number().default(0),
  qtyUsed: z.number().default(0),
  departemen: z.string().nullable().optional(),
  level: z.number().default(0),
});

const CommitSchema = z.object({
  noSPK: z.string().min(1),
  kodeBarang: z.string().min(1),
  namaPO: z.string().default(""),
  qty: z.number().positive(),
  userID: z.string().min(1),
  materialUsage: z.array(MaterialSchema).min(1),
});

// COMMIT PO: reserve stok dalam satu transaksi.
export const POST: RequestHandler = async ({ request }) => {
  const parsed = CommitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ success: false, error: "Data yang diperlukan tidak lengkap" }, 400);
  }

  try {
    const commitID = await commitSPK(parsed.data);
    return json({
      success: true,
      commitID,
      message: `PO berhasil di-commit dengan ID: ${commitID}`,
    });
  } catch (error) {
    log.error({ err: error, noSPK: parsed.data?.noSPK }, "Gagal commit PO");
    return json(
      { success: false, error: error instanceof Error ? error.message : "Gagal commit PO" },
      500,
    );
  }
};


