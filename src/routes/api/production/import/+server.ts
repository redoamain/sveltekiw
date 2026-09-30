import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { parseProductionExcelImport } from "$lib/server/input-produksi";
import { log } from "@/lib/db";

import { AUTH_COOKIE, decodeSession } from "$lib/auth";

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  // Verifikasi apakah user terotentikasi (via locals atau cookies)
  const user = locals.user || decodeSession(cookies.get(AUTH_COOKIE) ?? null);
  if (!user?.UserName && !user?.username) {
    return json({ error: "Sesi login tidak valid. Silakan login kembali." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return json({ error: "File Excel wajib diunggah." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return json({ error: "File yang diunggah kosong." }, { status: 400 });
    }

    const parsed = await parseProductionExcelImport(buffer);

    return json({
      success: true,
      fileName: file.name,
      ...parsed,
    });
  } catch (error: any) {
    log.error({ error }, "Gagal memproses import Excel produksi");
    return json(
      {
        success: false,
        error: error?.message || "Gagal memproses file Excel yang diunggah.",
      },
      { status: 400 }
    );
  }
};
