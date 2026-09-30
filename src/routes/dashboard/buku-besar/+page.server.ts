import type { PageServerLoad } from "./$types";
import { getBukuBesarData, getCOAAccounts, type BukuBesarParams } from "@/lib/server/buku-besar";

export const load: PageServerLoad = async ({ url, locals }) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const defaultTgl1 = `${year}-${month}-01`;
  const defaultTgl2 = `${year}-${month}-${day}`;

  const tgl1 = url.searchParams.get("tgl1")?.trim() || defaultTgl1;
  const tgl2 = url.searchParams.get("tgl2")?.trim() || defaultTgl2;
  const acc1 = url.searchParams.get("acc1")?.trim() || "1101";
  const acc2 = url.searchParams.get("acc2")?.trim() || "1101.99";
  const curr = url.searchParams.get("curr")?.trim() || "IDR";
  const ju = Number(url.searchParams.get("ju")) || 0;
  const lawantransaksi = url.searchParams.get("lawantransaksi") !== null
    ? Number(url.searchParams.get("lawantransaksi"))
    : 1;
  // Default hideEmpty = true agar tidak menampilkan ratusan akun kosong
  const hideEmpty = url.searchParams.get("hideEmpty") !== null
    ? url.searchParams.get("hideEmpty") === "1" || url.searchParams.get("hideEmpty") === "true"
    : true;

  const params: BukuBesarParams = {
    tgl1,
    tgl2,
    acc1,
    acc2,
    curr,
    ju,
    lawantransaksi,
    hideEmpty,
  };

  try {
    const [coaList, reportData] = await Promise.all([
      getCOAAccounts(),
      getBukuBesarData(params),
    ]);

    return {
      ...reportData,
      coaList,
      filters: params,
    };
  } catch (err: any) {
    const coaList = await getCOAAccounts().catch(() => []);
    return {
      accounts: [],
      grandTotal: {
        totalAccounts: 0,
        totalTransactions: 0,
        totalSaldoAwalRp: 0,
        totalDebetValas: 0,
        totalDebetRp: 0,
        totalCreditValas: 0,
        totalCreditRp: 0,
        totalSaldoAkhirRp: 0,
      },
      coaList,
      filters: params,
      error: err?.message || "Gagal memuat laporan buku besar",
    };
  }
};
