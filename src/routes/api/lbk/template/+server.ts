import type { RequestHandler } from "./$types";
import { generateLbkExcelTemplate } from "$lib/server/input-lbk";
import { log } from "@/lib/db";

export const GET: RequestHandler = async () => {
  try {
    const buffer = await generateLbkExcelTemplate();
    const fileName = "Template_Import_LBK.xlsx";

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    log.error({ error }, "Gagal menghasilkan template Excel LBK");
    return new Response(JSON.stringify({ error: error?.message || "Gagal membuat template Excel LBK." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
