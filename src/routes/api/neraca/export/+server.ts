import type { RequestHandler } from "@sveltejs/kit";
import { generateNeracaExcel } from "@/lib/server/finance";
import { log } from "@/lib/db";

async function doExport(periode1: string, periode2: string, tglPeriode: string, pjgLevel: number, company: number) {
  const buffer = await generateNeracaExcel(periode1, periode2, tglPeriode, pjgLevel, company);
  const fileName = `rpneracal_${periode1}_${periode2}.xlsx`;

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

  const defaultPeriode1 = `${currentYear}${currentMonth}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultPeriode2 = `${prevDate.getFullYear()}${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const defaultTglPeriode = `${currentYear}-${currentMonth}-${currentDay}`;

  const periode1 = getParam("periode1")?.trim() || defaultPeriode1;
  const periode2 = getParam("periode2")?.trim() || defaultPeriode2;
  const tglPeriode = getParam("tglPeriode")?.trim() || defaultTglPeriode;
  const pjgLevel = Number(getParam("pjgLevel")) || 10;
  const rawComp = getParam("company");
  const company = rawComp !== null && rawComp !== undefined && rawComp !== '' ? Number(rawComp) : 0;

  return { periode1, periode2, tglPeriode, pjgLevel, company };
}

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { periode1, periode2, tglPeriode, pjgLevel, company } = parseParams((k) => url.searchParams.get(k));

  try {
    return await doExport(periode1, periode2, tglPeriode, pjgLevel, company);
  } catch (err: any) {
    log.error({ err }, "Gagal export neraca (GET)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor neraca" }), {
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
  const { periode1, periode2, tglPeriode, pjgLevel, company } = parseParams((k) => {
    const val = formData.get(k);
    return typeof val === "string" ? val : null;
  });

  try {
    return await doExport(periode1, periode2, tglPeriode, pjgLevel, company);
  } catch (err: any) {
    log.error({ err }, "Gagal export neraca (POST)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor neraca" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
