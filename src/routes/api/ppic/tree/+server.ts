import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { getSpkBomTree } from "$lib/server/planning";
import { json, errorMessage } from "$lib/http";

const QuerySchema = z.object({
  itemid: z.string().min(1),
  qty: z.coerce.number().min(0.0001).default(1),
  noSPK: z.string().optional().default(""),
  namaPO: z.string().optional().default(""),
  namaBarang: z.string().optional().default(""),
  tanggalOrder: z.string().optional(),
  planDate: z.string().optional(),
});

export const GET: RequestHandler = async ({ url }) => {
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return json({ error: "Parameter itemid wajib diisi" }, 400);
  }

  const { itemid, qty, noSPK, namaPO, namaBarang, tanggalOrder, planDate } = parsed.data;

  try {
    const tree = await getSpkBomTree({
      kodeBarang: itemid,
      targetQty: qty,
      noSPK,
      namaPO,
      namaBarang,
      tanggalOrder,
      planDate,
    });

    return json({ tree }, 200, { "Cache-Control": "private, max-age=60" });
  } catch (error) {
    log.error({ err: error, itemid, noSPK }, "Gagal mengambil BOM tree untuk SPK");
    return json({ error: errorMessage(error, "Gagal mengambil BOM tree SPK") }, 500);
  }
};
