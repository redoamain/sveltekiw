import type { RequestHandler } from "@sveltejs/kit";
import { generateLaporanProduksiExcel } from "@/lib/server/laporan-produksi";
import { log } from "@/lib/db";

async function doExport(filters: {
  dept?: string;
  q?: string;
  tgl1?: string;
  tgl2?: string;
  status?: "all" | "completed" | "ongoing";
}) {
  const buffer = await generateLaporanProduksiExcel(filters);
  const dateStr = new Date().toISOString().slice(0, 10);
  const deptStr = filters.dept ? `_${filters.dept}` : "";
  const fileName = `Laporan_Produksi_SPK${deptStr}_${dateStr}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const dept = url.searchParams.get("dept")?.trim() || "";
  const q = url.searchParams.get("q")?.trim() || "";
  const tgl1 = url.searchParams.get("tgl1")?.trim() || "";
  const tgl2 = url.searchParams.get("tgl2")?.trim() || "";
  const statusParam = url.searchParams.get("status")?.trim();
  const status = statusParam === "completed" || statusParam === "ongoing" ? statusParam : "all";

  try {
    return await doExport({ dept, q, tgl1, tgl2, status });
  } catch (err: any) {
    log.error({ err, dept, q, tgl1, tgl2 }, "Gagal export laporan produksi SPK (GET)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor laporan produksi" }), {
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
    const dept = String(fd.get("dept") ?? "").trim();
    const q = String(fd.get("q") ?? "").trim();
    const tgl1 = String(fd.get("tgl1") ?? "").trim();
    const tgl2 = String(fd.get("tgl2") ?? "").trim();
    const statusParam = String(fd.get("status") ?? "").trim();
    const status = statusParam === "completed" || statusParam === "ongoing" ? statusParam : "all";

    return await doExport({ dept, q, tgl1, tgl2, status });
  } catch (err: any) {
    log.error({ err }, "Gagal export laporan produksi SPK (POST)");
    return new Response(JSON.stringify({ error: err?.message || "Gagal mengekspor laporan produksi" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
