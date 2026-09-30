import { runQuery, log } from "@/lib/db";
import * as XLSX from "xlsx";

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function formatPeriodName(periodStr: string): string {
  if (!periodStr || periodStr.length !== 6) return periodStr || '-';
  const y = periodStr.slice(0, 4);
  const m = periodStr.slice(4, 6);
  const months = [
    'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
  ];
  const mIdx = parseInt(m, 10) - 1;
  return `${months[mIdx] || m} ${y}`;
}

function formatDateId(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const p = dateStr.split('-');
  if (p.length === 3) {
    return `${p[2]}/${p[1]}/${p[0]}`;
  }
  return dateStr;
}

// ==========================================
// 1. LAPORAN NERACA (rpneracal.xls)
// ==========================================

export interface NeracaItem {
  g1: string;
  g1Judul: string;
  g2Acc: string;
  g2AccName: string;
  acc: string;
  accName: string;
  saldoRp1: number;
  pct1: number;
  saldoRp2: number;
  pct2: number;
  growth: number;
  accPos: string;
}

export interface NeracaGroup {
  groupCode: string;
  groupName: string;
  items: NeracaItem[];
  subtotalRp1: number;
  subtotalPct1: number;
  subtotalRp2: number;
  subtotalPct2: number;
  subtotalGrowth: number;
}

export interface NeracaSection {
  title: string;
  groups: NeracaGroup[];
  totalRp1: number;
  totalPct1: number;
  totalRp2: number;
  totalPct2: number;
  totalGrowth: number;
}

export interface NeracaReportResult {
  aktiva: NeracaSection;
  pasiva: NeracaSection;
  isBalanced1: boolean;
  isBalanced2: boolean;
  diffRp1: number;
  diffRp2: number;
  periodName1: string;
  periodName2: string;
  params: {
    periode1: string;
    periode2: string;
    tglPeriode: string;
    pjgLevel: number;
    company: number;
  };
}

export async function getNeracaData(
  periode1: string,
  periode2: string,
  tglPeriode: string,
  pjgLevel = 10,
  company = 0
): Promise<NeracaReportResult> {
  try {
    const res = await runQuery(`
      EXEC [cp].[dbo].[rpNeracaL] 
        @PjgLevel = ${Number(pjgLevel) || 10}, 
        @Periode1 = '${periode1}', 
        @Periode2 = '${periode2}', 
        @TglPeriode = '${tglPeriode}', 
        @company = ${Number(company) || 0}
    `);

    const rawRows = (res.recordset || []).map((r: any) => ({
      g1: String(r.G1 || '').trim(),
      g1Judul: String(r.G1Judul || '').trim().toUpperCase(),
      g2Acc: String(r.G2Acc || '').trim(),
      g2AccName: String(r.G2AccName || '').trim().toUpperCase(),
      acc: String(r.Acc || '').trim(),
      accName: String(r.AccName || '').trim(),
      saldoRp1: Number(r.VSaldoRp1 || 0),
      saldoRp2: Number(r.VSaldoRp2 || 0),
      accPos: String(r.AccPos || 'D').trim().toUpperCase(),
    }));

    // Hitung total dasar untuk persentase
    let rawTotalAktiva1 = 0, rawTotalAktiva2 = 0;
    let rawTotalPasiva1 = 0, rawTotalPasiva2 = 0;

    for (const r of rawRows) {
      if (r.g1Judul.includes('AKTIVA')) {
        rawTotalAktiva1 += r.saldoRp1;
        rawTotalAktiva2 += r.saldoRp2;
      } else {
        rawTotalPasiva1 += r.saldoRp1;
        rawTotalPasiva2 += r.saldoRp2;
      }
    }

    const baseTotal1 = rawTotalAktiva1 || 1;
    const baseTotal2 = rawTotalAktiva2 || 1;

    const buildSection = (title: string, predicate: (r: any) => boolean, base1: number, base2: number): NeracaSection => {
      const sectionRows = rawRows.filter(predicate);
      const groupMap = new Map<string, NeracaGroup>();

      for (const r of sectionRows) {
        const pct1 = (r.saldoRp1 / base1) * 100;
        const pct2 = (r.saldoRp2 / base2) * 100;
        const growth = r.saldoRp2 !== 0 ? ((r.saldoRp1 - r.saldoRp2) / Math.abs(r.saldoRp2)) * 100 : 0;

        const item: NeracaItem = {
          ...r,
          pct1,
          pct2,
          growth,
        };

        if (!groupMap.has(item.g2Acc)) {
          groupMap.set(item.g2Acc, {
            groupCode: item.g2Acc,
            groupName: item.g2AccName,
            items: [],
            subtotalRp1: 0,
            subtotalPct1: 0,
            subtotalRp2: 0,
            subtotalPct2: 0,
            subtotalGrowth: 0,
          });
        }
        const g = groupMap.get(item.g2Acc)!;
        g.items.push(item);
        g.subtotalRp1 += item.saldoRp1;
        g.subtotalRp2 += item.saldoRp2;
      }

      const groups = Array.from(groupMap.values()).map(g => {
        g.subtotalPct1 = (g.subtotalRp1 / base1) * 100;
        g.subtotalPct2 = (g.subtotalRp2 / base2) * 100;
        g.subtotalGrowth = g.subtotalRp2 !== 0 ? ((g.subtotalRp1 - g.subtotalRp2) / Math.abs(g.subtotalRp2)) * 100 : 0;
        return g;
      });

      const totalRp1 = groups.reduce((acc, g) => acc + g.subtotalRp1, 0);
      const totalRp2 = groups.reduce((acc, g) => acc + g.subtotalRp2, 0);
      const totalPct1 = (totalRp1 / base1) * 100;
      const totalPct2 = (totalRp2 / base2) * 100;
      const totalGrowth = totalRp2 !== 0 ? ((totalRp1 - totalRp2) / Math.abs(totalRp2)) * 100 : 0;

      return {
        title,
        groups,
        totalRp1,
        totalPct1,
        totalRp2,
        totalPct2,
        totalGrowth,
      };
    };

    const aktiva = buildSection('AKTIVA', (r) => r.g1Judul.includes('AKTIVA'), baseTotal1, baseTotal2);
    const pasiva = buildSection('KEWAJIBAN & MODAL', (r) => !r.g1Judul.includes('AKTIVA'), baseTotal1, baseTotal2);

    const diffRp1 = aktiva.totalRp1 - pasiva.totalRp1;
    const diffRp2 = aktiva.totalRp2 - pasiva.totalRp2;

    return {
      aktiva,
      pasiva,
      isBalanced1: Math.abs(diffRp1) < 1,
      isBalanced2: Math.abs(diffRp2) < 1,
      diffRp1,
      diffRp2,
      periodName1: formatPeriodName(periode1),
      periodName2: formatPeriodName(periode2),
      params: { periode1, periode2, tglPeriode, pjgLevel, company },
    };
  } catch (err: any) {
    log.error({ err }, 'Gagal menjalankan SP rpNeracaL');
    throw err;
  }
}

/**
 * Menghasilkan Berkas Excel (.xlsx) dengan struktur dan tata letak
 * identik dengan template `rpneracal.xls`.
 */
export async function generateNeracaExcel(
  periode1: string,
  periode2: string,
  tglPeriode: string,
  pjgLevel = 10,
  company = 0
): Promise<Buffer> {
  const data = await getNeracaData(periode1, periode2, tglPeriode, pjgLevel, company);
  const aoa: any[][] = [];

  aoa.push([]);
  aoa.push([null, "NERACA "]);
  aoa.push([null, "PT. CITI PLUMB"]);
  aoa.push([]);
  aoa.push([null, `PER ${formatDateId(tglPeriode)}`]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([null, data.periodName1, null, null, data.periodName2, null, null, "% GROWTH"]);
  aoa.push([]);
  aoa.push([]);

  // AKTIVA
  aoa.push([data.aktiva.title]);
  for (const grp of data.aktiva.groups) {
    aoa.push([]);
    aoa.push([grp.groupName]);
    aoa.push([]);
    for (const item of grp.items) {
      aoa.push([item.accName, item.saldoRp1, item.pct1 / 100, "%", item.saldoRp2, item.pct2 / 100, "%", item.growth / 100, "%"]);
    }
    aoa.push([]);
    aoa.push([grp.groupName, grp.subtotalRp1, grp.subtotalPct1 / 100, "%", grp.subtotalRp2, grp.subtotalPct2 / 100, "%", grp.subtotalGrowth / 100, "%"]);
  }

  aoa.push([]);
  aoa.push([data.aktiva.title, data.aktiva.totalRp1, data.aktiva.totalPct1 / 100, "%", data.aktiva.totalRp2, data.aktiva.totalPct2 / 100, "%", data.aktiva.totalGrowth / 100, "%"]);
  aoa.push([]);
  aoa.push([]);

  // KEWAJIBAN & MODAL
  aoa.push([data.pasiva.title]);
  for (const grp of data.pasiva.groups) {
    aoa.push([]);
    aoa.push([grp.groupName]);
    aoa.push([]);
    for (const item of grp.items) {
      aoa.push([item.accName, item.saldoRp1, item.pct1 / 100, "%", item.saldoRp2, item.pct2 / 100, "%", item.growth / 100, "%"]);
    }
    aoa.push([]);
    aoa.push([grp.groupName, grp.subtotalRp1, grp.subtotalPct1 / 100, "%", grp.subtotalRp2, grp.subtotalPct2 / 100, "%", grp.subtotalGrowth / 100, "%"]);
  }

  aoa.push([]);
  aoa.push([data.pasiva.title, data.pasiva.totalRp1, data.pasiva.totalPct1 / 100, "%", data.pasiva.totalRp2, data.pasiva.totalPct2 / 100, "%", data.pasiva.totalGrowth / 100, "%"]);
  aoa.push([]);
  aoa.push([`Dicetak pada : ${new Date().toLocaleString('id-ID')}`, null, null, null, null, null, null, null, "Halaman 1 dari 1"]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 45 },
    { wch: 20 },
    { wch: 10 },
    { wch: 4 },
    { wch: 20 },
    { wch: 10 },
    { wch: 4 },
    { wch: 14 },
    { wch: 4 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "NERACA");
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ==========================================
// 2. LAPORAN LABA RUGI (rprugilabanew.xls)
// ==========================================

export interface LabaRugiRow {
  groupTitle: string;
  titleNR: string;
  acc: string;
  accName: string;
  detail: boolean;
  saldoRp1: number;
  saldoRp2: number;
  saldoYTD: number;
}

export interface LabaRugiReportResult {
  rows: LabaRugiRow[];
  periodName1: string;
  periodName2: string;
  summary: {
    penjualanBersih: number;
    hpp: number;
    labaKotor: number;
    bebanUsaha: number;
    labaBersihOperasi: number;
    labaBersih: number;
  };
  params: {
    periode1: string;
    periode2: string;
    tglPeriode: string;
    pjgLevel: number;
    jenisopr: number;
    company: number;
  };
}

export async function getLabaRugiData(
  periode1: string,
  periode2: string,
  tglPeriode: string,
  pjgLevel = 10,
  jenisopr = 0,
  company = 0
): Promise<LabaRugiReportResult> {
  try {
    const res = await runQuery(`
      EXEC [cp].[dbo].[rpRugiLabaNew] 
        @PjgLevel = ${Number(pjgLevel) || 10}, 
        @Periode1 = '${periode1}', 
        @Periode2 = '${periode2}', 
        @TglPeriode = '${tglPeriode}', 
        @jenisopr = ${Number(jenisopr) || 0}, 
        @company = ${Number(company) || 0}
    `);

    const rows: LabaRugiRow[] = (res.recordset || []).map((r: any) => ({
      groupTitle: String(r.GroupTitleNR || '').trim(),
      titleNR: String(r.TitleNR || '').trim(),
      acc: String(r.acc || '').trim(),
      accName: String(r.accname || '').trim(),
      detail: Boolean(r.detail),
      saldoRp1: Number(r.totalrp1 || 0),
      saldoRp2: Number(r.totalrp2 || 0),
      saldoYTD: Number(r.totalrpYTD || 0),
    }));

    let penjualanBersih = 0, hpp = 0, labaKotor = 0, bebanUsaha = 0, labaBersihOperasi = 0, labaBersih = 0;

    for (const r of rows) {
      const tUpper = r.titleNR.toUpperCase();
      if (tUpper.includes('TOTAL PENJUALAN BERSIH')) penjualanBersih = r.saldoRp1;
      else if (tUpper === 'TOTAL HPP') hpp = Math.abs(r.saldoRp1);
      else if (tUpper.includes('TOTAL LABA/RUGI KOTOR') || tUpper.includes('LABA (RUGI) KOTOR')) labaKotor = r.saldoRp1;
      else if (tUpper.includes('TOTAL BIAYA OPERASIONAL') || tUpper.includes('BEBAN USAHA')) bebanUsaha = Math.abs(r.saldoRp1);
      else if (tUpper.includes('LABA (RUGI) OPERASIONAL')) labaBersihOperasi = r.saldoRp1;
      else if (tUpper.includes('LABA/RUGI BERSIH') || tUpper.includes('LABA/RUGI SEBELUM')) labaBersih = r.saldoRp1;
    }

    if (labaBersih === 0 && labaBersihOperasi !== 0) labaBersih = labaBersihOperasi;

    return {
      rows,
      periodName1: formatPeriodName(periode1),
      periodName2: formatPeriodName(periode2),
      summary: {
        penjualanBersih,
        hpp,
        labaKotor,
        bebanUsaha,
        labaBersihOperasi,
        labaBersih,
      },
      params: { periode1, periode2, tglPeriode, pjgLevel, jenisopr, company },
    };
  } catch (err: any) {
    log.error({ err }, 'Gagal menjalankan SP rpRugiLabaNew');
    throw err;
  }
}

/**
 * Menghasilkan Berkas Excel (.xlsx) dengan struktur dan tata letak
 * identik dengan template `rprugilabanew.xls`.
 */
export async function generateLabaRugiExcel(
  periode1: string,
  periode2: string,
  tglPeriode: string,
  pjgLevel = 10,
  jenisopr = 0,
  company = 0
): Promise<Buffer> {
  const data = await getLabaRugiData(periode1, periode2, tglPeriode, pjgLevel, jenisopr, company);
  const aoa: any[][] = [];

  aoa.push([]);
  aoa.push([null, "LAPORAN LABA (RUGI) "]);
  aoa.push([null, "PT. CITIPLUMB "]);
  aoa.push([null, `PER ${formatDateId(tglPeriode)}`]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([null, data.periodName1, data.periodName2, "Y T D"]);
  aoa.push([]);

  let lastGroup = '';
  let lastTitle = '';

  for (const r of data.rows) {
    if (r.groupTitle && r.groupTitle !== lastGroup) {
      aoa.push([r.groupTitle]);
      lastGroup = r.groupTitle;
    }
    if (r.titleNR && r.titleNR !== lastTitle && !r.titleNR.startsWith('TOTAL')) {
      aoa.push([r.titleNR]);
      lastTitle = r.titleNR;
    }

    if (r.detail) {
      aoa.push([r.accName, r.saldoRp1, r.saldoRp2, r.saldoYTD]);
    } else {
      aoa.push([]);
      aoa.push([r.titleNR || r.accName, r.saldoRp1, r.saldoRp2, r.saldoYTD]);
      aoa.push([]);
    }
  }

  aoa.push([]);
  aoa.push([`Dicetak pada : ${new Date().toLocaleString('id-ID')}`, null, null, "Halaman  1  dari  1"]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 50 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "LAPORAN LABA (RUGI)");
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ==========================================
// 3. NERACA SALDO (rptrialbalancel-l.xls)
// ==========================================

export interface TrialBalanceItem {
  acc: string;
  accName: string;
  saldoAwalDebet: number;
  saldoAwalKredit: number;
  mutasiDebet: number;
  mutasiKredit: number;
  saldoAkhirDebet: number;
  saldoAkhirKredit: number;
}

export interface TrialBalanceReportResult {
  items: TrialBalanceItem[];
  totals: {
    totalAccounts: number;
    totalAwalDebet: number;
    totalAwalKredit: number;
    totalMutasiDebet: number;
    totalMutasiKredit: number;
    totalAkhirDebet: number;
    totalAkhirKredit: number;
    isBalanced: boolean;
  };
  periodName: string;
  params: {
    periode: string;
    tglPeriode: string;
    pjgLevel: number;
    company: number;
  };
}

export async function getTrialBalanceData(
  periode: string,
  tglPeriode: string,
  pjgLevel = 10,
  company = 0
): Promise<TrialBalanceReportResult> {
  try {
    const res = await runQuery(`
      EXEC [cp].[dbo].[rpTrialBalanceL] 
        @PjgLevel = ${Number(pjgLevel) || 10}, 
        @Periode = '${periode}', 
        @TglPeriode = '${tglPeriode}', 
        @company = ${Number(company) || 0}
    `);

    let totalAwalDebet = 0, totalAwalKredit = 0;
    let totalMutasiDebet = 0, totalMutasiKredit = 0;
    let totalAkhirDebet = 0, totalAkhirKredit = 0;

    const items: TrialBalanceItem[] = (res.recordset || []).map((r: any) => {
      const vLastRp = Number(r.VLastRp || 0);
      const vDebetRp = Number(r.VDebetRp || 0);
      const vCreditRp = Number(r.VCreditRp || 0);
      const rawSaldoAwal = vLastRp - vDebetRp + vCreditRp;

      const saldoAwalDebet = rawSaldoAwal > 0 ? rawSaldoAwal : 0;
      const saldoAwalKredit = rawSaldoAwal < 0 ? Math.abs(rawSaldoAwal) : 0;

      const saldoAkhirDebet = vLastRp > 0 ? vLastRp : 0;
      const saldoAkhirKredit = vLastRp < 0 ? Math.abs(vLastRp) : 0;

      totalAwalDebet += saldoAwalDebet;
      totalAwalKredit += saldoAwalKredit;
      totalMutasiDebet += vDebetRp;
      totalMutasiKredit += vCreditRp;
      totalAkhirDebet += saldoAkhirDebet;
      totalAkhirKredit += saldoAkhirKredit;

      return {
        acc: String(r.Acc || '').trim(),
        accName: String(r.AccName || '').trim(),
        saldoAwalDebet,
        saldoAwalKredit,
        mutasiDebet: vDebetRp,
        mutasiKredit: vCreditRp,
        saldoAkhirDebet,
        saldoAkhirKredit,
      };
    });

    const isBalanced = Math.abs(totalMutasiDebet - totalMutasiKredit) < 1;

    return {
      items,
      totals: {
        totalAccounts: items.length,
        totalAwalDebet,
        totalAwalKredit,
        totalMutasiDebet,
        totalMutasiKredit,
        totalAkhirDebet,
        totalAkhirKredit,
        isBalanced,
      },
      periodName: formatPeriodName(periode),
      params: { periode, tglPeriode, pjgLevel, company },
    };
  } catch (err: any) {
    log.error({ err }, 'Gagal menjalankan SP rpTrialBalanceL');
    throw err;
  }
}

/**
 * Menghasilkan Berkas Excel (.xlsx) dengan struktur dan tata letak
 * identik dengan template `rptrialbalancel-l.xls`.
 */
export async function generateTrialBalanceExcel(
  periode: string,
  tglPeriode: string,
  pjgLevel = 10,
  company = 0
): Promise<Buffer> {
  const data = await getTrialBalanceData(periode, tglPeriode, pjgLevel, company);
  const aoa: any[][] = [];

  aoa.push([null, null, null, "TRIAL BALANCE "]);
  aoa.push([null, null, null, "PT.CITI PLUMB "]);
  aoa.push([]);
  aoa.push([null, null, null, `PER ${formatDateId(tglPeriode)}`]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([null, null, "Saldo Awal", null, null, "Mutasi", null, "Saldo Akhir"]);
  aoa.push(["Perkiraan", "Nama Perkiraan "]);
  aoa.push([null, null, "Debet", "Kredit", "Debet", "Kredit", "Debet", "Kredit"]);
  aoa.push([]);

  for (const item of data.items) {
    aoa.push([
      item.acc,
      item.accName,
      item.saldoAwalDebet,
      item.saldoAwalKredit,
      item.mutasiDebet,
      item.mutasiKredit,
      item.saldoAkhirDebet,
      item.saldoAkhirKredit,
    ]);
  }

  aoa.push([]);
  aoa.push([
    null,
    "TOTAL ",
    data.totals.totalAwalDebet,
    data.totals.totalAwalKredit,
    data.totals.totalMutasiDebet,
    data.totals.totalMutasiKredit,
    data.totals.totalAkhirDebet,
    data.totals.totalAkhirKredit,
  ]);
  aoa.push([]);
  aoa.push([`Dicetak pada : ${new Date().toLocaleString('id-ID')}`]);
  aoa.push([null, null, null, null, null, null, null, "Halaman  1  dari  1"]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 15 },
    { wch: 45 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TRIAL BALANCE");
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ==========================================
// 4. JURNAL TRANSAKSI (rpjurnallistl.xls)
// ==========================================

export interface JurnalItem {
  alias: string;
  transNo: string;
  transType: string;
  transDate: string;
  acc: string;
  accName: string;
  remark: string;
  curr: string;
  rate: number;
  debetValas: number;
  debetRp: number;
  creditValas: number;
  creditRp: number;
}

export interface JurnalGroup {
  transNo: string;
  transDate: string;
  transType: string;
  alias: string;
  items: JurnalItem[];
  totalDebetRp: number;
  totalCreditRp: number;
}

export interface JurnalReportResult {
  groups: JurnalGroup[];
  totals: {
    totalTransactions: number;
    totalEntries: number;
    totalDebetRp: number;
    totalCreditRp: number;
    isBalanced: boolean;
  };
  params: {
    tgl1: string;
    tgl2: string;
    curr: string;
  };
}

export async function getJurnalListData(
  tgl1: string,
  tgl2: string,
  curr = 'IDR'
): Promise<JurnalReportResult> {
  try {
    const res = await runQuery(`
      EXEC [cp].[dbo].[rpJurnalListL] 
        @Tgl1 = '${tgl1}', 
        @Tgl2 = '${tgl2}', 
        @Curr = '${curr}'
    `);

    const groupMap = new Map<string, JurnalGroup>();
    let grandDebetRp = 0;
    let grandCreditRp = 0;
    let totalEntries = 0;

    for (const r of res.recordset || []) {
      const transNo = String(r.TransNo || '').trim();
      const rawDate = r.TransDate;
      const transDate = rawDate instanceof Date
        ? rawDate.toISOString().slice(0, 10)
        : String(rawDate || '').slice(0, 10);
      const debetValas = Number(r.Debet || 0);
      const debetRp = Number(r.DebetRp || 0);
      const creditValas = Number(r.Credit || 0);
      const creditRp = Number(r.CreditRp || 0);

      const item: JurnalItem = {
        alias: String(r.Alias || '').trim(),
        transNo,
        transType: String(r.TransType || '').trim(),
        transDate,
        acc: String(r.Acc || '').trim(),
        accName: String(r.AccName || '').trim(),
        remark: String(r.Remark || '').trim(),
        curr: String(r.Curr || 'IDR').trim(),
        rate: Number(r.Rate || 1),
        debetValas,
        debetRp,
        creditValas,
        creditRp,
      };

      grandDebetRp += debetRp;
      grandCreditRp += creditRp;
      totalEntries++;

      if (!groupMap.has(transNo)) {
        groupMap.set(transNo, {
          transNo,
          transDate,
          transType: item.transType,
          alias: item.alias,
          items: [],
          totalDebetRp: 0,
          totalCreditRp: 0,
        });
      }

      const g = groupMap.get(transNo)!;
      g.items.push(item);
      g.totalDebetRp += debetRp;
      g.totalCreditRp += creditRp;
    }

    const groups = Array.from(groupMap.values());
    const isBalanced = Math.abs(grandDebetRp - grandCreditRp) < 1;

    return {
      groups,
      totals: {
        totalTransactions: groups.length,
        totalEntries,
        totalDebetRp: grandDebetRp,
        totalCreditRp: grandCreditRp,
        isBalanced,
      },
      params: { tgl1, tgl2, curr },
    };
  } catch (err: any) {
    log.error({ err }, 'Gagal menjalankan SP rpJurnalListL');
    throw err;
  }
}

/**
 * Menghasilkan Berkas Excel (.xlsx) dengan struktur dan tata letak
 * identik dengan template `rpjurnallistl.xls`.
 */
export async function generateJurnalExcel(
  tgl1: string,
  tgl2: string,
  curr = 'IDR'
): Promise<Buffer> {
  const data = await getJurnalListData(tgl1, tgl2, curr);
  const aoa: any[][] = [];

  aoa.push([null, null, "DETAIL JURNAL LIST "]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([`Periode : ${formatDateId(tgl1)} s/d ${formatDateId(tgl2)}`]);
  aoa.push([]);
  aoa.push(["Account", null, "Remark ", "Curr", "Rate", "Debet", null, "Credit"]);
  aoa.push([null, null, null, null, null, "Total", "Total (Rp)", "Total", "Total (Rp) "]);
  aoa.push([]);
  aoa.push([]);

  for (const group of data.groups) {
    aoa.push(["Tanggal       :", formatDateId(group.transDate), "No. Bukti :", `${group.alias}-${group.transNo}`]);
    for (const item of group.items) {
      aoa.push([
        item.acc,
        item.accName,
        item.remark,
        item.curr,
        item.rate,
        item.debetValas,
        item.debetRp,
        item.creditValas,
        item.creditRp,
      ]);
    }
    aoa.push([]);
    aoa.push([]);
  }

  aoa.push([null, null, null, "Grand Total (Rp) :", null, data.totals.totalDebetRp, null, data.totals.totalCreditRp]);
  aoa.push([]);
  aoa.push([null, null, null, null, null, null, null, null, "Halaman 1 dari  1"]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 15 },
    { wch: 40 },
    { wch: 30 },
    { wch: 8 },
    { wch: 8 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DETAIL JURNAL LIS");
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
