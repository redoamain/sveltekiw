import type { RequestHandler } from "./$types";
import { getRekapMutasiPembelian } from "$lib/server/kartu-stock";
import { log } from "@/lib/db";

export const GET: RequestHandler = async ({ url }) => {
  const tgl1 = (url.searchParams.get("tgl1") ?? "").trim();
  const tgl2 = (url.searchParams.get("tgl2") ?? "").trim();
  const loc = (url.searchParams.get("loc") ?? "%").trim();
  const hideZeroParam = url.searchParams.get("hideZero");
  const hideZero = hideZeroParam === null ? true : hideZeroParam === "true";
  const search = (url.searchParams.get("search") ?? "").trim();

  if (!tgl1 || !tgl2) {
    return new Response(
      JSON.stringify({ error: "Parameter tgl1 dan tgl2 wajib diisi." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const data = await getRekapMutasiPembelian({
      tgl1,
      tgl2,
      loc,
      hideZero,
      search: search || undefined,
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    log.error({ error, tgl1, tgl2, loc }, "Gagal mengambil rekap mutasi pembelian");
    return new Response(
      JSON.stringify({ error: error?.message || "Gagal memuat rekap mutasi pembelian." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
