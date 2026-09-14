import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { log } from "$lib/db";
import {
  getOverrides,
  saveOverride,
  toggleOverride,
  deleteOverride,
} from "$lib/server/planning";
import { json } from "$lib/http";

const OverrideSchema = z.object({
  id: z.number().int().optional(),
  originalItemId: z.string().min(1),
  replacementItemId: z.string().min(1),
  replacementItemName: z.string().optional(),
  replacementItemName2: z.string().optional(),
  isActive: z.boolean().optional(),
  createdBy: z.string().default("system"),
});

const PATCH_Schema = z.object({
  id: z.number().int().min(1),
  isActive: z.boolean(),
});

// GET: ambil semua BOM overrides
export const GET: RequestHandler = async () => {
  try {
    const data = await getOverrides();
    return json({ success: true, data });
  } catch (error) {
    log.error({ err: error }, "Gagal ambil BOM overrides");
    return json({ success: false, error: "Failed to fetch BOM overrides" }, 500);
  }
};

// POST: tambah override baru
export const POST: RequestHandler = async ({ request }) => {
  const parsed = OverrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ success: false, error: "Data tidak valid" }, 400);
  }

  try {
    const data = await saveOverride(parsed.data);
    return json({ success: true, data });
  } catch (error) {
    log.error({ err: error }, "Gagal simpan BOM override");
    return json({ success: false, error: "Failed to save BOM override" }, 500);
  }
};

// PATCH: toggle aktif/nonaktif
export const PATCH: RequestHandler = async ({ request }) => {
  const parsed = PATCH_Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ success: false, error: "ID dan isActive diperlukan" }, 400);
  }

  try {
    const data = await toggleOverride(parsed.data.id, parsed.data.isActive);
    return json({ success: true, data });
  } catch (error) {
    log.error({ err: error }, "Gagal toggle BOM override");
    return json({ success: false, error: "Failed to toggle BOM override" }, 500);
  }
};

// DELETE: hapus
export const DELETE: RequestHandler = async ({ url }) => {
  const id = Number(url.searchParams.get("id"));
  if (!id) {
    return json({ success: false, error: "ID is required" }, 400);
  }

  try {
    await deleteOverride(id);
    return json({ success: true, message: "BOM override deleted successfully" });
  } catch (error) {
    log.error({ err: error }, "Gagal hapus BOM override");
    return json({ success: false, error: "Failed to delete BOM override" }, 500);
  }
};


