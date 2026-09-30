import type { RequestHandler } from "@sveltejs/kit";
import { json } from "$lib/http";
import { searchSpkList } from "$lib/server/input-produksi";

export const GET: RequestHandler = async ({ url }) => {
  const dept = url.searchParams.get("dept") ?? "";
  const q = url.searchParams.get("q") ?? "";

  try {
    const spkList = await searchSpkList(dept, q, 100);
    return json({ spkList });
  } catch (error: any) {
    return json({ error: error?.message || "Gagal mencari SPK" }, 500);
  }
};
