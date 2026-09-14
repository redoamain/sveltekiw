import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { getActiveOrders } from "$lib/server/planning";
import { json, errorMessage } from "$lib/http";

const QuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  q: z.string().optional(),
});

// Production Order aktif (SPK) — OrderID pola 'AS%', belum Completed.
export const GET: RequestHandler = async ({ url }) => {
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return json({ error: "Query tidak valid" }, 400);
  }
  const { startDate, endDate, q } = parsed.data;

  try {
    const data = await getActiveOrders(
      startDate ? startDate.toISOString().slice(0, 10) : undefined,
      endDate ? endDate.toISOString().slice(0, 10) : undefined,
      q?.trim() || undefined,
    );
    return json(data);
  } catch (error) {
    log.error({ err: error }, "Gagal ambil production order");
    return json({ error: errorMessage(error, "Gagal mengambil production order") }, 500);
  }
};


