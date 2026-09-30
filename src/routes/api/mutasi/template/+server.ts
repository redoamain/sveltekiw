import type { RequestHandler } from "./$types";
import { generateMutasiExcelTemplate } from "$lib/server/input-mutasi";
import { log } from "@/lib/db";

export const GET: RequestHandler = async () => {
  try {
    const buffer = await generateMutasiExcelTemplate();
    const fileName = "Template_Import_Mutasi_Gudang.xlsx";

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    log.error({ error }, "Gagal menghasilkan template Excel mutasi gudang");
    return new Response(JSON.stringify({ error: error?.message || "Gagal membuat template Excel mutasi." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
