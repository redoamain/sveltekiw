import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { getBom } from "$lib/server/planning";
import { json, errorMessage } from "$lib/http";

const QuerySchema = z.object({ itemid: z.string().min(1) });

// BOM tree — store procedure existing: dbo.rpBOMTree (ter-cache di service)
export const GET: RequestHandler = async ({ url }) => {
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return json({ error: "Parameter itemid wajib diisi" }, 400);
  }
  const itemid = parsed.data.itemid;

  try {
    const response = await getBom(itemid);
    return json(response, 200, { "Cache-Control": "public, s-maxage=1800" });
  } catch (error) {
    log.error({ err: error, itemid }, "Gagal ambil BOM");
    return json({ error: errorMessage(error, "Gagal mengambil BOM") }, 500);
  }
};


