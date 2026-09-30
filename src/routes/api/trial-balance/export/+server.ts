import type { RequestHandler } from "@sveltejs/kit";
import { generateTrialBalanceExcel } from "@/lib/server/finance";
import { log } from "@/lib/db";

async function doExport(periode: string, tglPeriode: string, pjgLevel: number, company: number) {
  const buffer = await generateTrialBalanceExcel(periode, tglPeriode, pjgLevel, company);
  const fileName = `rptrialbalancel_${periode}.xlsx`;

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

  const defaultPeriode = `${currentYear}${currentMonth}`;
  const defaultTglPeriode = `${currentYear}-${currentMonth}-${currentDay}`;

  const periode = getParam("periode")?.trim() || defaultPeriode;
  const tglPeriode = getParam("tglPeriode")?.trim() || defaultTglPeriode;
  const pjgLevel = Number(getParam("pjgLevel")) || 10;
  const rawComp = getParam("company");
  const company = rawComp !== null && rawComp !== undefined && rawComp !== '' ? Number(rawComp) : 0;

  return { periode, tglPeriode, pjgLevel, company };
}

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { periode, tglPeriode, pjgLevel, company } = parseParams((k) => url.searchParams.get(k));

  try {
    return await doExport(periode, tglPeriode, pjgLevel, company);
  } catch (err: any) {
    log.error({ err }, "Gagal export trial balance (GET)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor trial balance" }), {
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
  const { periode, tglPeriode, pjgLevel, company } = parseParams((k) => {
    const val = formData.get(k);
    return typeof val === "string" ? val : null;
  });

  try {
    return await doExport(periode, tglPeriode, pjgLevel, company);
  } catch (err: any) {
    log.error({ err }, "Gagal export trial balance (POST)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor trial balance" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
