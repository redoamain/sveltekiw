import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { getMonitoringPO } from "$lib/server/planning";
import { json, errorMessage } from "$lib/http";

// Params sesuai definisi dbo.rpMonitoringPO:
// @No varchar(7), @Tgl1 datetime, @Tgl2 datetime, @Item varchar(14),
// @Company varchar(8), @Tipe varchar(1), @userinput int
const QuerySchema = z.object({
  tgl1: z.coerce.date(),
  tgl2: z.coerce.date(),
  no: z.string().default("%"),
  item: z.string().default("%"),
  company: z.string().default("%"),
  tipe: z.string().default("%"),
  userinput: z.coerce.number().int().default(0),
});

// Monitoring PO — store procedure existing: dbo.rpMonitoringPO
export const GET: RequestHandler = async ({ url }) => {
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return json({ error: "Parameter tgl1 & tgl2 wajib diisi (YYYY-MM-DD)" }, 400);
  }
  const p = parsed.data;

  try {
    const data = await getMonitoringPO(p);
    return json(data);
  } catch (error) {
    log.error({ err: error }, "Gagal ambil monitoring PO");
    return json({ error: errorMessage(error, "Gagal mengambil data PO") }, 500);
  }
};


