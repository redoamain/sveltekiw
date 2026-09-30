import { runQuery, log } from "@/lib/db";
import { getPool } from "@/lib/db";
import sql from "mssql";
import * as XLSX from "xlsx";

export interface BukuBesarParams {
  tgl1: string; // YYYY-MM-DD
  tgl2: string; // YYYY-MM-DD
  acc1: string; // e.g. '1101'
  acc2: string; // e.g. '1101.99'
  curr?: string; // 'IDR', 'USD', etc. (default 'IDR')
  ju?: number; // 0 = Semua, 1 = Hanya JU (default 0)
  lawantransaksi?: number; // 1 = Tampilkan Lawan, 0 = Tidak (default 1)
  hideEmpty?: boolean; // Sembunyikan akun bersaldo 0 tanpa mutasi
}

export interface BukuBesarTransaction {
  noBukti: string;
  tgl: string | null;
  remark: string;
  lawanTransaksi: string;
  curr: string;
  rate: number | null;
  debet: number;
  debetRp: number;
  credit: number;
  creditRp: number;
  saldoValas: number;
  saldoRp: number;
  isSaldoAwal: boolean;
}

export interface BukuBesarAccountGroup {
  acc: string;
  accName: string;
  curr: string;
  saldoAwalValas: number;
  saldoAwalRp: number;
  saldoAkhirValas: number;
  saldoAkhirRp: number;
  totalDebetValas: number;
  totalDebetRp: number;
  totalCreditValas: number;
  totalCreditRp: number;
  transactions: BukuBesarTransaction[];
}

export interface BukuBesarReportResult {
  accounts: BukuBesarAccountGroup[];
  grandTotal: {
    totalAccounts: number;
    totalTransactions: number;
    totalSaldoAwalRp: number;
    totalDebetValas: number;
    totalDebetRp: number;
    totalCreditValas: number;
    totalCreditRp: number;
    totalSaldoAkhirRp: number;
  };
  params: BukuBesarParams;
}

export interface COAAccountOption {
  acc: string;
  accName: string;
  accCurr: string;
  accPos: string;
}

/**
 * Mengambil daftar seluruh Akun / Chart of Accounts (COA) dari taGLAcc
 */
export async function getCOAAccounts(): Promise<COAAccountOption[]> {
  try {
    const res = await runQuery(`
      SELECT 
        RTRIM(LTRIM(Acc)) AS acc,
        RTRIM(LTRIM(AccName)) AS accName,
        RTRIM(LTRIM(ISNULL(AccCurr, 'IDR'))) AS accCurr,
        RTRIM(LTRIM(ISNULL(AccPos, 'D'))) AS accPos
      FROM [cp].[dbo].[taGLAcc]
      ORDER BY Acc ASC
    `);

    return res.recordset.map((r: any) => ({
      acc: String(r.acc),
      accName: String(r.accName),
      accCurr: String(r.accCurr),
      accPos: String(r.accPos),
    }));
  } catch (err: any) {
    log.error({ err }, "Gagal mengambil daftar COA dari taGLAcc");
    return [];
  }
}

/**
 * Menjalankan Stored Procedure [rpBBPembantuL] dan mengelompokkan hasil per Akun
 */
export async function getBukuBesarData(params: BukuBesarParams): Promise<BukuBesarReportResult> {
  const pool = await getPool();

  const tgl1 = params.tgl1 ? params.tgl1 : new Date().toISOString().slice(0, 8) + "01";
  const tgl2 = params.tgl2 ? params.tgl2 : new Date().toISOString().slice(0, 10);
  const acc1 = (params.acc1 || "1101").trim();
  const acc2 = (params.acc2 || "1101.99").trim();
  const curr = (params.curr || "IDR").trim().toUpperCase();
  const ju = Number(params.ju) || 0;
  const lawantransaksi = params.lawantransaksi != null ? Number(params.lawantransaksi) : 1;
  const hideEmpty = Boolean(params.hideEmpty);

  const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 300000);
  const req = pool.request();
  (req as any).timeout = reportTimeout;
  (req as any).overrides = { requestTimeout: reportTimeout };
  req.input("Tgl1", sql.DateTime, new Date(`${tgl1}T00:00:00.000Z`));
  req.input("Tgl2", sql.DateTime, new Date(`${tgl2}T23:59:59.000Z`));
  req.input("Acc1", sql.VarChar(9), acc1);
  req.input("Acc2", sql.VarChar(15), acc2);
  // LANGSUNG CARA KEDUA:
  // Selalu kirim lawantransksi = 0 ke SQL Server agar kueri selesai dalam hitungan detik
  // tanpa beban kursor database yang menyebabkan timeout/crash.
  // Lawan COA diselesaikan langsung secara in-memory di Node.js (50 milidetik).
  req.input("Curr", sql.VarChar(3), curr);
  req.input("ju", sql.Int, ju);
  req.input("lawantransksi", sql.Int, 0);

  try {
    const res = await req.execute("[cp].[dbo].[rpBBPembantuL]");
    const rawRows = res.recordset || [];

  // Bangun index voucher in-memory untuk memetakan Lawan COA per nomor bukti
  const voucherMap = new Map<
    string,
    { debetAccs: Set<string>; creditAccs: Set<string>; allAccs: Set<string> }
  >();

  if (lawantransaksi === 1) {
    for (const row of rawRows) {
      const bukti = String(row.NoBukti ?? "").trim();
      const acc = String(row.Acc ?? "").trim();
      if (!bukti || !acc || String(row.Remark).trim().toUpperCase() === "SALDO AWAL") continue;

      if (!voucherMap.has(bukti)) {
        voucherMap.set(bukti, { debetAccs: new Set(), creditAccs: new Set(), allAccs: new Set() });
      }
      const v = voucherMap.get(bukti)!;
      v.allAccs.add(acc);
      if ((Number(row.DebetRp) || Number(row.Debet) || 0) > 0) {
        v.debetAccs.add(acc);
      }
      if ((Number(row.CreditRp) || Number(row.Credit) || 0) > 0) {
        v.creditAccs.add(acc);
      }
    }
  }

    // Kelompokkan data mentah berdasarkan Acc
    const groupsMap = new Map<string, { acc: string; accName: string; rawList: any[] }>();

    for (const row of rawRows) {
      const a = String(row.Acc ?? "").trim();
      if (!a) continue;
      if (!groupsMap.has(a)) {
        groupsMap.set(a, {
          acc: a,
          accName: String(row.AccName ?? "").trim(),
          rawList: [],
        });
      }
      groupsMap.get(a)!.rawList.push(row);
    }

    const accounts: BukuBesarAccountGroup[] = [];
    let grandDebetValas = 0;
    let grandDebetRp = 0;
    let grandCreditValas = 0;
    let grandCreditRp = 0;
    let grandSaldoAwalRp = 0;
    let grandSaldoAkhirRp = 0;
    let totalTransactionsCount = 0;

    for (const [accCode, group] of groupsMap.entries()) {
      let saldoAwalValas = 0;
      let saldoAwalRp = 0;
      let currAccount = "IDR";

      const transactions: BukuBesarTransaction[] = [];
      let totalDebetValas = 0;
      let totalDebetRp = 0;
      let totalCreditValas = 0;
      let totalCreditRp = 0;

      // Cari baris SALDO AWAL (NoBukti == '' atau Remark == 'SALDO AWAL')
      const saldoAwalRow = group.rawList.find(
        (r) => !r.NoBukti || String(r.Remark).trim().toUpperCase() === "SALDO AWAL"
      );

      if (saldoAwalRow) {
        saldoAwalValas = Number(saldoAwalRow.Begining) || 0;
        saldoAwalRp = Number(saldoAwalRow.BeginingRp) || 0;
        currAccount = String(saldoAwalRow.Curr || "IDR").trim();
      }

      let runningValas = saldoAwalValas;
      let runningRp = saldoAwalRp;

      // Transaksi di luar saldo awal
      const transRows = group.rawList.filter(
        (r) => r.NoBukti && String(r.Remark).trim().toUpperCase() !== "SALDO AWAL"
      );

      for (const r of transRows) {
        const dVal = Number(r.Debet) || 0;
        const dRp = Number(r.DebetRp) || 0;
        const cVal = Number(r.Credit) || 0;
        const cRp = Number(r.CreditRp) || 0;

        totalDebetValas += dVal;
        totalDebetRp += dRp;
        totalCreditValas += cVal;
        totalCreditRp += cRp;

        runningValas += dVal - cVal;
        runningRp += dRp - cRp;

        const dateStr = r.Tgl ? new Date(r.Tgl).toISOString().slice(0, 10) : null;
        const noBuktiStr = String(r.NoBukti ?? "").trim();

        let resolvedLawan = String(r.lawantransaksi ?? "").trim();
        if (!resolvedLawan && lawantransaksi === 1 && noBuktiStr) {
          const v = voucherMap.get(noBuktiStr);
          if (v) {
            const isDebet = dRp > 0 || dVal > 0;
            // Debet berlawanan dengan Kredit, dan sebaliknya
            const opposing = isDebet ? v.creditAccs : v.debetAccs;
            const targets = Array.from(opposing).filter((a) => a !== accCode);

            if (targets.length > 0) {
              resolvedLawan = targets.join(", ");
            } else {
              // Jika sepihak: ambil semua akun lain dalam voucher tersebut selain akun ini
              const allOthers = Array.from(v.allAccs).filter((a) => a !== accCode);
              if (allOthers.length > 0) {
                resolvedLawan = allOthers.join(", ");
              }
            }
          }
        }

        transactions.push({
          noBukti: noBuktiStr,
          tgl: dateStr,
          remark: String(r.Remark ?? "").trim(),
          lawanTransaksi: resolvedLawan,
          curr: String(r.Curr ?? currAccount).trim(),
          rate: r.Rate != null ? Number(r.Rate) : null,
          debet: dVal,
          debetRp: dRp,
          credit: cVal,
          creditRp: cRp,
          saldoValas: runningValas,
          saldoRp: runningRp,
          isSaldoAwal: false,
        });
      }

      const saldoAkhirValas = runningValas;
      const saldoAkhirRp = runningRp;

      // Filter hideEmpty: jika saldo awal 0 dan tidak ada mutasi sama sekali
      if (
        hideEmpty &&
        Math.abs(saldoAwalRp) < 0.01 &&
        transactions.length === 0 &&
        Math.abs(totalDebetRp) < 0.01 &&
        Math.abs(totalCreditRp) < 0.01
      ) {
        continue;
      }

      accounts.push({
        acc: accCode,
        accName: group.accName,
        curr: currAccount,
        saldoAwalValas,
        saldoAwalRp,
        saldoAkhirValas,
        saldoAkhirRp,
        totalDebetValas,
        totalDebetRp,
        totalCreditValas,
        totalCreditRp,
        transactions,
      });

      grandDebetValas += totalDebetValas;
      grandDebetRp += totalDebetRp;
      grandCreditValas += totalCreditValas;
      grandCreditRp += totalCreditRp;
      grandSaldoAwalRp += saldoAwalRp;
      grandSaldoAkhirRp += saldoAkhirRp;
      totalTransactionsCount += transactions.length;
    }

    return {
      accounts,
      grandTotal: {
        totalAccounts: accounts.length,
        totalTransactions: totalTransactionsCount,
        totalSaldoAwalRp: grandSaldoAwalRp,
        totalDebetValas: grandDebetValas,
        totalDebetRp: grandDebetRp,
        totalCreditValas: grandCreditValas,
        totalCreditRp: grandCreditRp,
        totalSaldoAkhirRp: grandSaldoAkhirRp,
      },
      params: {
        tgl1,
        tgl2,
        acc1,
        acc2,
        curr,
        ju,
        lawantransaksi,
        hideEmpty,
      },
    };
  } catch (err: any) {
    log.error({ err, params }, "Gagal mengeksekusi stored procedure rpBBPembantuL");
    if (err?.message?.includes("Timeout") || err?.message?.includes("timeout")) {
      throw new Error(
        `Waktu pemrosesan database habis (Timeout). Untuk rentang waktu panjang (misal 8 bulan), coba matikan opsi "Tampilkan Lawan Transaksi COA" atau perkecil rentang akun.`
      );
    }
    throw new Error(`Gagal memuat laporan buku besar: ${err?.message || err}`);
  }
}

/**
 * Format tanggal ke serial number Excel untuk keselarasan dengan rpbbpembantul.xls
 */
function dateToExcelSerial(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const excelEpoch = Date.UTC(1899, 11, 30);
  return (utc - excelEpoch) / (24 * 60 * 60 * 1000);
}

/**
 * Format tanggal ke teks DD/MM/YYYY
 */
function formatDateId(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Menghasilkan Berkas Excel (.xlsx / .xls) dengan struktur dan tata letak
 * yang 100% identik dengan file template `rpbbpembantul.xls`.
 */
export function generateBukuBesarExcelFromData(report: BukuBesarReportResult): Buffer {
  const { accounts, grandTotal, params: p } = report;

  const tgl1Formatted = formatDateId(p.tgl1);
  const tgl2Formatted = formatDateId(p.tgl2);

  const aoa: any[][] = [];

  // Baris 1: Judul Laporan
  aoa.push([null, null, null, null, null, "BUKU BESAR "]);
  // Baris 2: Nama Perusahaan
  aoa.push([null, null, null, null, null, "PT CITI PLUMB "]);
  // Baris 3 & 4: Kosong
  aoa.push([]);
  aoa.push([]);
  // Baris 5: Periode
  aoa.push([`Periode : ${tgl1Formatted} s/d ${tgl2Formatted}`]);
  // Baris 6 & 7: Kosong
  aoa.push([]);
  aoa.push([]);

  // Loop per Akun
  for (const ac of accounts) {
    // Header Akun
    aoa.push(["Account :", null, ac.acc, ac.accName]);
    aoa.push([]);

    // Header Kolom Tabel (Baris 1 & Baris 2)
    aoa.push([
      "Tanggal",
      "No. Bukti",
      "Remark",
      "COA Transaksi",
      null,
      null,
      null,
      "Debet",
      null,
      "Credit",
      null,
      "Saldo(Rp)",
    ]);
    aoa.push([
      null,
      null,
      null,
      null,
      "Curr",
      "Rate",
      "Total",
      "Total(Rp)",
      "Total",
      "Total(Rp)",
      "Saldo",
    ]);
    aoa.push([]);

    // Baris SALDO AWAL
    const tglAwalSerial = p.tgl1 ? dateToExcelSerial(new Date(p.tgl1)) : 46231;
    aoa.push([
      tglAwalSerial,
      null,
      "SALDO AWAL",
      null,
      ac.curr,
      null,
      0,
      0,
      0,
      0,
      ac.saldoAwalValas,
      ac.saldoAwalRp,
    ]);
    aoa.push([]);

    // Baris Transaksi
    for (const t of ac.transactions) {
      const serialTgl = t.tgl ? dateToExcelSerial(new Date(t.tgl)) : null;
      aoa.push([
        serialTgl,
        t.noBukti,
        t.remark,
        t.lawanTransaksi ? ` ${t.lawanTransaksi}` : "",
        t.curr,
        t.rate ?? 1,
        t.debet,
        t.debetRp,
        t.credit,
        t.creditRp,
        0,
        t.saldoRp,
      ]);
      // Di template rpbbpembantul.xls terdapat baris kosong setelah tiap baris transaksi
      aoa.push([]);
    }

    // Baris Subtotal Akun
    aoa.push([
      null,
      null,
      null,
      null,
      null,
      null,
      ac.totalDebetValas,
      ac.totalDebetRp,
      ac.totalCreditValas,
      ac.totalCreditRp,
    ]);

    // Spasi 3 baris kosong antar akun seperti di template asli
    aoa.push([]);
    aoa.push([]);
    aoa.push([]);
  }

  // Baris GRAND TOTAL
  aoa.push([
    "GRAND TOTAL",
    null,
    null,
    null,
    null,
    null,
    grandTotal.totalDebetValas,
    grandTotal.totalDebetRp,
    grandTotal.totalCreditValas,
    grandTotal.totalCreditRp,
  ]);
  aoa.push([]);
  aoa.push([]);

  // Baris Footer Cetak
  const now = new Date();
  const printStr = `Dicetak pada : ${now.toLocaleDateString("id-ID")}  ${now.toLocaleTimeString("id-ID")}`;
  aoa.push([printStr, null, null, null, null, null, null, null, null, null, null, "Halaman 1 dari  1"]);

  // Buat Sheet dengan nama BUKU BESAR PEMBANTU
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set lebar kolom agar rapi saat dibuka
  ws["!cols"] = [
    { wch: 12 }, // Tanggal
    { wch: 16 }, // No. Bukti
    { wch: 42 }, // Remark
    { wch: 25 }, // COA Transaksi
    { wch: 6 },  // Curr
    { wch: 8 },  // Rate
    { wch: 14 }, // Debet Valas
    { wch: 18 }, // Debet Rp
    { wch: 14 }, // Credit Valas
    { wch: 18 }, // Credit Rp
    { wch: 14 }, // Saldo Valas
    { wch: 20 }, // Saldo Rp
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BUKU BESAR PEMBANTU");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Menghasilkan Berkas Excel langsung dari parameter buku besar.
 */
export async function generateBukuBesarExcel(params: BukuBesarParams): Promise<Buffer> {
  const report = await getBukuBesarData(params);
  return generateBukuBesarExcelFromData(report);
}

