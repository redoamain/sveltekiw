import { getPool, log, runQuery } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface KartuHutangParams {
	tgl1: string; // YYYY-MM-DD
	tgl2: string; // YYYY-MM-DD
	companyID?: string; // default '%'
	curr?: string; // default 'IDR'
	noTrans?: string; // default '%'
	transtype?: string; // default '%'
	company?: number; // 0 = Semua, 1 = DBTR, 2 = MDU
	hideEmpty?: boolean; // Sembunyikan saldo 0 & tanpa mutasi
}

export interface KartuHutangTransaction {
	status: string;
	transID: string;
	transType: string;
	transDate: string | null;
	dueDate: string | null;
	remark: string;
	curr: string;
	rate: number | null;
	beliValas: number;
	beliRp: number;
	payCurr: string | null;
	payRate: number | null;
	bayarValas: number;
	bayarRp: number;
	saldoRp: number;
	saldoGiro: number | null;
	isSaldoAwal: boolean;
}

export interface KartuHutangSupplierGroup {
	companyID: string;
	companyName: string;
	address: string;
	phone: string;
	plafon: number;
	curr: string;
	saldoAwalValas: number;
	saldoAwalRp: number;
	totalBeliValas: number;
	totalBeliRp: number;
	totalBayarValas: number;
	totalBayarRp: number;
	saldoAkhirValas: number;
	saldoAkhirRp: number;
	transactions: KartuHutangTransaction[];
}

export interface KartuHutangReportResult {
	suppliers: KartuHutangSupplierGroup[];
	grandTotal: {
		totalSuppliers: number;
		totalTransactions: number;
		totalSaldoAwalRp: number;
		totalBeliRp: number;
		totalBayarRp: number;
		totalSaldoAkhirRp: number;
	};
	params: KartuHutangParams;
}

export interface SupplierOption {
	id: string;
	name: string;
}

/**
 * Mengambil daftar seluruh Supplier dari taSupplier
 */
export async function getSupplierList(): Promise<SupplierOption[]> {
	try {
		const res = await runQuery(`
			SELECT 
				RTRIM(LTRIM(CompanyID)) AS id,
				RTRIM(LTRIM(CompanyName1)) AS name
			FROM [cp].[dbo].[taSupplier]
			WHERE CompanyID IS NOT NULL AND RTRIM(LTRIM(CompanyID)) <> ''
			ORDER BY CompanyName1 ASC
		`);

		return (res.recordset || []).map((r: any) => ({
			id: String(r.id),
			name: String(r.name)
		}));
	} catch (err: any) {
		log.error({ err }, 'Gagal mengambil daftar supplier dari taSupplier');
		return [];
	}
}

/**
 * Menjalankan Stored Procedure [rpKartuUtangL] dan mengelompokkan hasil per Supplier
 */
export async function getKartuHutangData(params: KartuHutangParams): Promise<KartuHutangReportResult> {
	const pool = await getPool();

	const tgl1 = params.tgl1 ? params.tgl1 : new Date().toISOString().slice(0, 8) + '01';
	const tgl2 = params.tgl2 ? params.tgl2 : new Date().toISOString().slice(0, 10);
	const companyID = (params.companyID || '%').trim();
	const curr = (params.curr || 'IDR').trim().toUpperCase();
	const noTrans = (params.noTrans || '%').trim();
	const transtype = (params.transtype || '%').trim();
	const company = params.company !== undefined ? Number(params.company) : 0;
	const hideEmpty = Boolean(params.hideEmpty);

	const periodeR = tgl1.replace(/-/g, '').slice(0, 6);

	const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
	const req = pool.request();
	(req as any).overrides = { requestTimeout: reportTimeout };
	req.input('CompanyID', sql.VarChar(8), companyID);
	req.input('Tgl1', sql.DateTime, new Date(`${tgl1}T00:00:00.000Z`));
	req.input('Tgl2', sql.DateTime, new Date(`${tgl2}T23:59:59.000Z`));
	req.input('Curr', sql.VarChar(3), curr);
	req.input('NoTrans', sql.VarChar(9), noTrans);
	req.input('transtype', sql.VarChar(2), transtype);
	req.input('PeriodeR', sql.VarChar(6), periodeR);
	req.input('company', sql.Int, company);

	try {
		const res = await req.execute('[cp].[dbo].[rpKartuUtangL]');
		const rawRows = res.recordset || [];

		// Kelompokkan data berdasarkan CompanyID
		const groupsMap = new Map<
			string,
			{
				companyID: string;
				companyName: string;
				address: string;
				phone: string;
				plafon: number;
				rawList: any[];
			}
		>();

		for (const row of rawRows) {
			const cId = String(row.CompanyID ?? '').trim();
			if (!cId) continue;
			if (!groupsMap.has(cId)) {
				groupsMap.set(cId, {
					companyID: cId,
					companyName: String(row.CompanyName1 ?? '').trim() || cId,
					address: String(row.Address1 ?? '').trim(),
					phone: String(row.Phone1 ?? '').trim(),
					plafon: Number(row.Plafon) || 0,
					rawList: []
				});
			}
			groupsMap.get(cId)!.rawList.push(row);
		}

		const suppliers: KartuHutangSupplierGroup[] = [];
		let grandSaldoAwalRp = 0;
		let grandBeliRp = 0;
		let grandBayarRp = 0;
		let grandSaldoAkhirRp = 0;
		let grandTransactionsCount = 0;

		for (const [cId, group] of groupsMap.entries()) {
			let saldoAwalValas = 0;
			let saldoAwalRp = 0;
			let currSupplier = curr;

			// Baris SA (Saldo Awal)
			const saRow = group.rawList.find((r) => String(r.Status ?? '').trim().toUpperCase() === 'SA');
			if (saRow) {
				saldoAwalValas = Number(saRow.Total) || 0;
				saldoAwalRp = Number(saRow.TotalRp) || 0;
				currSupplier = String(saRow.Curr ?? curr).trim();
			}

			// Transaksi non-SA
			const transRows = group.rawList.filter(
				(r) => String(r.Status ?? '').trim().toUpperCase() !== 'SA'
			);

			// Urutkan transaksi secara kronologis
			transRows.sort((a, b) => {
				const dateA = a.TransDate ? new Date(a.TransDate).getTime() : 0;
				const dateB = b.TransDate ? new Date(b.TransDate).getTime() : 0;
				if (dateA !== dateB) return dateA - dateB;
				return String(a.TransID ?? '').localeCompare(String(b.TransID ?? ''));
			});

			let runningRp = saldoAwalRp;
			let totalBeliValas = 0;
			let totalBeliRp = 0;
			let totalBayarValas = 0;
			let totalBayarRp = 0;
			const transactions: KartuHutangTransaction[] = [];

			for (const r of transRows) {
				const beliVal = Number(r.Total) || 0;
				const beliR = Number(r.TotalRp) || 0;
				const bayarVal = Number(r.PayTotal) || 0;
				const bayarR = Number(r.PayTotalRp) || 0;

				totalBeliValas += beliVal;
				totalBeliRp += beliR;
				totalBayarValas += bayarVal;
				totalBayarRp += bayarR;

				runningRp = runningRp + beliR - bayarR;

				const dateStr = r.TransDate ? new Date(r.TransDate).toISOString().slice(0, 10) : null;
				const dueStr = r.DueDate ? new Date(r.DueDate).toISOString().slice(0, 10) : null;

				transactions.push({
					status: String(r.Status ?? '').trim(),
					transID: String(r.TransID ?? '').trim(),
					transType: String(r.TransType ?? '').trim(),
					transDate: dateStr,
					dueDate: dueStr,
					remark: String(r.Remark ?? '').trim(),
					curr: String(r.Curr ?? currSupplier).trim(),
					rate: r.Rate != null ? Number(r.Rate) : null,
					beliValas: beliVal,
					beliRp: beliR,
					payCurr: r.PayCurr ? String(r.PayCurr).trim() : null,
					payRate: r.PayRate != null ? Number(r.PayRate) : null,
					bayarValas: bayarVal,
					bayarRp: bayarR,
					saldoRp: runningRp,
					saldoGiro: r.SaldoGiro != null ? Number(r.SaldoGiro) : null,
					isSaldoAwal: false
				});
			}

			const saldoAkhirRp = runningRp;
			const saldoAkhirValas = saldoAwalValas + totalBeliValas - totalBayarValas;

			// Filter hideEmpty: saldo awal 0 dan tidak ada mutasi sama sekali
			if (
				hideEmpty &&
				Math.abs(saldoAwalRp) < 0.01 &&
				transactions.length === 0 &&
				Math.abs(totalBeliRp) < 0.01 &&
				Math.abs(totalBayarRp) < 0.01
			) {
				continue;
			}

			suppliers.push({
				companyID: cId,
				companyName: group.companyName,
				address: group.address,
				phone: group.phone,
				plafon: group.plafon,
				curr: currSupplier,
				saldoAwalValas,
				saldoAwalRp,
				totalBeliValas,
				totalBeliRp,
				totalBayarValas,
				totalBayarRp,
				saldoAkhirValas,
				saldoAkhirRp,
				transactions
			});

			grandSaldoAwalRp += saldoAwalRp;
			grandBeliRp += totalBeliRp;
			grandBayarRp += totalBayarRp;
			grandSaldoAkhirRp += saldoAkhirRp;
			grandTransactionsCount += transactions.length;
		}

		return {
			suppliers,
			grandTotal: {
				totalSuppliers: suppliers.length,
				totalTransactions: grandTransactionsCount,
				totalSaldoAwalRp: grandSaldoAwalRp,
				totalBeliRp: grandBeliRp,
				totalBayarRp: grandBayarRp,
				totalSaldoAkhirRp: grandSaldoAkhirRp
			},
			params: {
				tgl1,
				tgl2,
				companyID,
				curr,
				noTrans,
				transtype,
				company,
				hideEmpty
			}
		};
	} catch (err: any) {
		log.error({ err, params }, 'Gagal mengeksekusi stored procedure rpKartuUtangL');
		if (err?.message?.includes('Timeout') || err?.message?.includes('timeout')) {
			throw new Error(
				'Waktu pemrosesan database habis (Timeout). Coba persempit rentang tanggal atau pilih supplier spesifik.'
			);
		}
		throw new Error(`Gagal memuat laporan kartu hutang: ${err?.message || err}`);
	}
}

/**
 * Format tanggal ke serial number Excel
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
	if (!dateStr) return '';
	const parts = dateStr.split('-');
	if (parts.length === 3) {
		return `${parts[2]}/${parts[1]}/${parts[0]}`;
	}
	return dateStr;
}

/**
 * Menghasilkan Berkas Excel (.xlsx) untuk Laporan Kartu Hutang
 */
export function generateKartuHutangExcel(report: KartuHutangReportResult): Buffer {
	const { suppliers, grandTotal, params: p } = report;

	const tgl1Formatted = formatDateId(p.tgl1);
	const tgl2Formatted = formatDateId(p.tgl2);

	const aoa: any[][] = [];

	// Header Laporan
	aoa.push([null, null, null, 'LAPORAN KARTU HUTANG (ACCOUNTS PAYABLE)']);
	aoa.push([null, null, null, 'PT CITI PLUMB']);
	aoa.push([]);
	aoa.push([`Periode: ${tgl1Formatted} s/d ${tgl2Formatted}`, null, null, null, `Valas: ${p.curr || 'IDR'}`]);
	aoa.push([]);

	for (const sup of suppliers) {
		// Header Supplier
		aoa.push(['Supplier:', sup.companyID, sup.companyName, null, 'Telp:', sup.phone]);
		aoa.push(['Alamat:', sup.address]);
		aoa.push([]);

		// Header Tabel
		aoa.push([
			'Tanggal',
			'No. Bukti',
			'Tipe',
			'Jatuh Tempo',
			'Status',
			'Keterangan',
			'Beli / Tambah (Rp)',
			'Bayar / Kurang (Rp)',
			'Saldo Hutang (Rp)'
		]);

		// Baris Saldo Awal
		const tglAwalSerial = p.tgl1 ? dateToExcelSerial(new Date(p.tgl1)) : null;
		aoa.push([
			tglAwalSerial,
			'-',
			'-',
			'-',
			'SA',
			'SALDO AWAL',
			0,
			0,
			sup.saldoAwalRp
		]);

		// Transaksi
		for (const t of sup.transactions) {
			const serialTgl = t.transDate ? dateToExcelSerial(new Date(t.transDate)) : null;
			const serialDue = t.dueDate ? dateToExcelSerial(new Date(t.dueDate)) : '-';
			aoa.push([
				serialTgl,
				t.transID,
				t.transType,
				serialDue,
				t.status,
				t.remark,
				t.beliRp,
				t.bayarRp,
				t.saldoRp
			]);
		}

		// Subtotal Supplier
		aoa.push([
			'TOTAL SUPPLIER',
			sup.companyID,
			null,
			null,
			null,
			null,
			sup.totalBeliRp,
			sup.totalBayarRp,
			sup.saldoAkhirRp
		]);
		aoa.push([]);
		aoa.push([]);
	}

	// Grand Total
	aoa.push([
		'GRAND TOTAL',
		null,
		null,
		null,
		null,
		null,
		grandTotal.totalBeliRp,
		grandTotal.totalBayarRp,
		grandTotal.totalSaldoAkhirRp
	]);

	const ws = XLSX.utils.aoa_to_sheet(aoa);
	ws['!cols'] = [
		{ wch: 12 }, // Tanggal
		{ wch: 16 }, // No. Bukti
		{ wch: 8 },  // Tipe
		{ wch: 12 }, // Jatuh Tempo
		{ wch: 8 },  // Status
		{ wch: 40 }, // Keterangan
		{ wch: 20 }, // Beli
		{ wch: 20 }, // Bayar
		{ wch: 22 }  // Saldo
	];

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Kartu Hutang');

	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
