import type { RequestHandler } from "@sveltejs/kit";
import { generateBukuBesarExcel, type BukuBesarParams } from "@/lib/server/buku-besar";
import { log } from "@/lib/db";

async function doExport(params: BukuBesarParams) {
  const buffer = await generateBukuBesarExcel(params);
  const tgl1Str = params.tgl1.replace(/-/g, "");
  const tgl2Str = params.tgl2.replace(/-/g, "");
  const fileName = `rpbbpembantul_${tgl1Str}_${tgl2Str}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function parseParams(getParam: (key: string) => string | null): BukuBesarParams {
  const tgl1 = getParam("tgl1")?.trim() || new Date().toISOString().slice(0, 8) + "01";
  const tgl2 = getParam("tgl2")?.trim() || new Date().toISOString().slice(0, 10);
  const acc1 = getParam("acc1")?.trim() || "1101";
  const acc2 = getParam("acc2")?.trim() || "1101.99";
  const curr = getParam("curr")?.trim() || "IDR";
  const ju = Number(getParam("ju")) || 0;
  const lawantransaksi = getParam("lawantransaksi") !== null ? Number(getParam("lawantransaksi")) : 1;
  const hideEmpty = getParam("hideEmpty") === "1" || getParam("hideEmpty") === "true";

  return {
    tgl1,
    tgl2,
    acc1,
    acc2,
    curr,
    ju,
    lawantransaksi,
    hideEmpty,
  };
}

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const params = parseParams((k) => url.searchParams.get(k));

  try {
    return await doExport(params);
  } catch (err: any) {
    log.error({ err, params }, "Gagal export buku besar (GET)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor buku besar" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const fd = await request.formData();
    const params = parseParams((k) => {
      const v = fd.get(k);
      return v != null ? String(v) : null;
    });

    return await doExport(params);
  } catch (err: any) {
    log.error({ err }, "Gagal export buku besar (POST)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor buku besar" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
