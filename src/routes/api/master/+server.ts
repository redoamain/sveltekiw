import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { getMasterForApi } from "$lib/server/master";
import { json } from "$lib/http";

const QuerySchema = z.object({
  ids: z.string().optional(),
  itemId: z.string().optional(),
});

// Master barang (taGoods). Mendukung batch `ids=a,b,c` dan single `itemId`.
export const GET: RequestHandler = async ({ url }) => {
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return json({ error: "Query tidak valid" }, 400);
  }

  try {
    const result = await getMasterForApi(parsed.data);
    return json(result);
  } catch (error) {
    log.error({ err: error }, "Gagal ambil master item");
    return json({ success: false, error: "Gagal mengambil master item" }, 500);
  }
};


