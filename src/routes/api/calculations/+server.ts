import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import { saveCalculation, getCalculations, deleteCalculation } from "$lib/server/planning";
import { json } from "$lib/http";

const SaveSchema = z.object({
  calculation_id: z.string().min(1),
  calculation_name: z.string().optional(),
  user_id: z.string().default("system"),
  po_list: z.any().default([]),
  total_po: z.number().int().default(0),
  material_data: z.any(),
  total_materials: z.number().int().default(0),
  total_kebutuhan: z.number().default(0),
  total_kekurangan: z.number().default(0),
  material_aman: z.number().int().default(0),
  material_kurang: z.number().int().default(0),
  material_habis: z.number().int().default(0),
  stock_date: z.coerce.date().optional(),
  notes: z.string().optional(),
});

// POST: simpan / update hasil perhitungan material
export const POST: RequestHandler = async ({ request }) => {
  const parsed = SaveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.material_data) {
    return json({ success: false, error: "Missing required fields" }, 400);
  }

  try {
    await saveCalculation(parsed.data);
    return json({
      success: true,
      message: "Perhitungan tersimpan",
      calculation_id: parsed.data.calculation_id,
    });
  } catch (error) {
    log.error({ err: error }, "Gagal simpan perhitungan");
    return json({ success: false, error: "Failed to save material requirements" }, 500);
  }
};

// GET: ambil history perhitungan (parse JSON fields)
export const GET: RequestHandler = async ({ url }) => {
  const calculation_id = url.searchParams.get("calculation_id");
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  try {
    if (calculation_id) {
      const all = await getCalculations(1000);
      const records = all.filter((r) => r.calculation_id === calculation_id);
      return json({ success: true, data: records, total: records.length });
    }
    const records = await getCalculations(limit, offset);
    return json({ success: true, data: records, total: records.length });
  } catch (error) {
    log.error({ err: error }, "Gagal ambil history perhitungan");
    return json({ success: false, error: "Failed to fetch data" }, 500);
  }
};

// DELETE: hapus
export const DELETE: RequestHandler = async ({ url }) => {
  const calculation_id = url.searchParams.get("calculation_id");
  if (!calculation_id) {
    return json({ success: false, error: "calculation_id is required" }, 400);
  }

  try {
    await deleteCalculation(calculation_id);
    return json({ success: true, message: "Data deleted successfully" });
  } catch (error) {
    log.error({ err: error }, "Gagal hapus perhitungan");
    return json({ success: false, error: "Failed to delete data" }, 500);
  }
};


