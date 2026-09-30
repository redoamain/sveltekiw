import type { RequestHandler } from "./$types";
import { generateProductionExcelTemplate } from "$lib/server/input-produksi";
import { log } from "@/lib/db";

export const GET: RequestHandler = async ({ url }) => {
  try {
    const dept = url.searchParams.get("dept") || undefined;
    const buffer = await generateProductionExcelTemplate(dept);
    const fileName = `Template_Import_Produksi${dept ? `_${dept}` : ""}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    log.error({ error }, "Gagal menghasilkan template Excel produksi");
    return new Response(JSON.stringify({ error: error?.message || "Gagal membuat template Excel." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
