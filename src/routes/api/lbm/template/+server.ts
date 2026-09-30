import type { RequestHandler } from "./$types";
import { generateLbmExcelTemplate } from "$lib/server/input-lbm";
import { log } from "@/lib/db";

export const GET: RequestHandler = async () => {
  try {
    const buffer = await generateLbmExcelTemplate();
    const fileName = "Template_Import_LBM.xlsx";

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    log.error({ error }, "Gagal menghasilkan template Excel LBM");
    return new Response(JSON.stringify({ error: error?.message || "Gagal membuat template Excel LBM." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
