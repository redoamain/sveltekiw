import type { RequestHandler } from "@sveltejs/kit";
import { generateJurnalExcel } from "@/lib/server/finance";
import { log } from "@/lib/db";

async function doExport(tgl1: string, tgl2: string, curr: string) {
  const buffer = await generateJurnalExcel(tgl1, tgl2, curr);
  const tgl1Str = tgl1.replace(/-/g, "");
  const tgl2Str = tgl2.replace(/-/g, "");
  const fileName = `rpjurnallistl_${tgl1Str}_${tgl2Str}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function parseParams(getParam: (key: string) => string | null) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentDay = String(now.getDate()).padStart(2, '0');

  const defaultTgl1 = `${currentYear}-${currentMonth}-01`;
  const defaultTgl2 = `${currentYear}-${currentMonth}-${currentDay}`;

  const tgl1 = getParam("tgl1")?.trim() || defaultTgl1;
  const tgl2 = getParam("tgl2")?.trim() || defaultTgl2;
  const curr = getParam("curr")?.trim() || "IDR";

  return { tgl1, tgl2, curr };
}

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { tgl1, tgl2, curr } = parseParams((k) => url.searchParams.get(k));

  try {
    return await doExport(tgl1, tgl2, curr);
  } catch (err: any) {
    log.error({ err }, "Gagal export jurnal (GET)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor jurnal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const formData = await request.formData().catch(() => new FormData());
  const { tgl1, tgl2, curr } = parseParams((k) => {
    const val = formData.get(k);
    return typeof val === "string" ? val : null;
  });

  try {
    return await doExport(tgl1, tgl2, curr);
  } catch (err: any) {
    log.error({ err }, "Gagal export jurnal (POST)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor jurnal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
