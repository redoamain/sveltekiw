import type { RequestHandler } from "@sveltejs/kit";
import { log } from "$lib/db";
import { getCommitted } from "$lib/server/planning";
import { json } from "$lib/http";

// Committed POs + reservasi stok aktif.
export const GET: RequestHandler = async () => {
  try {
    const data = await getCommitted();
    return json({ success: true, data });
  } catch (error) {
    log.error({ err: error }, "Gagal ambil committed PO");
    return json(
      {
        success: false,
        error: "Gagal mengambil data committed PO",
        data: { committedPOs: [], reservations: [] },
      },
      500,
    );
  }
};


