import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { getMonitoringSO } from "$lib/server/planning";
import { json, errorMessage } from "$lib/http";

// Params sesuai definisi dbo.rpMonitoringSO:
// @No varchar(7), @Tgl1 datetime, @Tgl2 datetime, @Item varchar(14),
// @Company varchar(8), @Tipe varchar(1), @kredit int, @jenisTOP int
const QuerySchema = z.object({
  tgl1: z.coerce.date(),
  tgl2: z.coerce.date(),
  no: z.string().default("%"),
  item: z.string().default("%"),
  company: z.string().default("%"),
  tipe: z.string().default("%"),
  kredit: z.coerce.number().int().default(0),
  jenisTOP: z.coerce.number().int().default(0),
});

// Monitoring SO — store procedure existing: dbo.rpMonitoringSO
export const GET: RequestHandler = async ({ url }) => {
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return json({ error: "Parameter tgl1 & tgl2 wajib diisi (YYYY-MM-DD)" }, 400);
  }
  const p = parsed.data;

  try {
    const data = await getMonitoringSO(p);
    return json(data);
  } catch (error) {
    log.error({ err: error }, "Gagal ambil monitoring SO");
    return json({ error: errorMessage(error, "Gagal mengambil data SO") }, 500);
  }
};


