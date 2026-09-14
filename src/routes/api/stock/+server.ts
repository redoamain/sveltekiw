import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { getStockRows } from "$lib/server/planning";
import { json, errorMessage } from "$lib/http";

const QuerySchema = z.object({
  itemid: z.string().default("%"),
  tgl1: z.coerce.date().optional(),
  tgl2: z.coerce.date().optional(),
  loc: z.string().default("%"),
  periodeR: z.string().default("201905"),
  kategori: z.string().default("%"),
});

// Stok PPIC — store procedure existing: dbo.rpStokPPIC2
export const GET: RequestHandler = async ({ url }) => {
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return json({ error: "Query parameter tidak valid" }, 400);
  }
  const p = parsed.data;

  try {
    const rows = await getStockRows({
      itemid: p.itemid,
      tgl1: p.tgl1,
      tgl2: p.tgl2,
      loc: p.loc,
      periodeR: p.periodeR,
      kategori: p.kategori,
    });
    return json({ data: rows });
  } catch (error) {
    log.error({ err: error, itemid: p.itemid }, "Gagal ambil stok");
    return json({ error: errorMessage(error, "Gagal mengambil stok") }, 500);
  }
};


