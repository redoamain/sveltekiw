import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { bulkUpdateSPK } from "$lib/server/spk";
import { json } from "$lib/http";
import { log } from "$lib/db";

const BodySchema = z.object({
  spkList: z.array(
    z.object({
      OrderID: z.string().min(1),
      Completed: z.boolean(),
    }),
  ),
});

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body harus JSON { spkList: [{OrderID, Completed}] }" }, 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Format spkList tidak valid", details: parsed.error.flatten() }, 400);
  }

  try {
    const updatedCount = await bulkUpdateSPK(parsed.data.spkList);
    return json({
      success: true,
      message: `${updatedCount} SPK berhasil diupdate`,
      updatedCount,
    });
  } catch (err) {
    log.error({ err }, "Bulk update SPK gagal");
    return json({ error: "Error updating SPK status" }, 500);
  }
};


