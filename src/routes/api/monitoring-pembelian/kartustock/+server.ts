import type { RequestHandler } from "@sveltejs/kit";
import { getKartuStock } from "$lib/server/monitoring-pembelian";
import { log } from "$lib/db";

export const GET: RequestHandler = async ({ url }) => {
  const tgl1 = url.searchParams.get("tgl1")?.trim();
  const tgl2 = url.searchParams.get("tgl2")?.trim();
  const itemid = url.searchParams.get("itemid")?.trim();

  if (!tgl1 || !tgl2 || !itemid) {
    return new Response(
      JSON.stringify({ error: "Parameter tgl1, tgl2, dan itemid wajib diisi" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const data = await getKartuStock({ tgl1, tgl2, itemid });
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    log.error({ err, tgl1, tgl2, itemid }, "Gagal fetch kartu stock");
    return new Response(
      JSON.stringify({ error: "Gagal memuat data kartu stock" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
