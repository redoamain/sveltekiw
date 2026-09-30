import { getPool, log, runQuery } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface KartuPiutangParams {
	tgl1: string; // YYYY-MM-DD
	tgl2: string; // YYYY-MM-DD
	companyID?: string; // default '%'
	curr?: string; // default 'IDR'
	noTrans?: string; // default '%'
	tipeTrans?: string; // default '%'
	hideEmpty?: boolean; // Sembunyikan saldo 0 & tanpa mutasi
}

export interface KartuPiutangTransaction {
	status: string;
	transID: string;
	transType: string;
	transDate: string | null;
	dueDate: string | null;
	remark: string;
	curr: string;
	rate: number | null;
	jualValas: number;
	jualRp: number;
	payCurr: string | null;
	payRate: number | null;
	bayarValas: number;
	bayarRp: number;
	saldoRp: number;
	saldoGiro: number | null;
	remarkSO?: string;
	notaDO?: number | null;
	isSaldoAwal: boolean;
}

export interface KartuPiutangCustomerGroup {
	companyID: string;
	companyName: string;
	address: string;
	phone: string;
	plafon: number;
	curr: string;
	saldoAwalValas: number;
	saldoAwalRp: number;
	totalJualValas: number;
	totalJualRp: number;
	totalBayarValas: number;
	totalBayarRp: number;
	saldoAkhirValas: number;
	saldoAkhirRp: number;
	transactions: KartuPiutangTransaction[];
}

export interface KartuPiutangReportResult {
	customers: KartuPiutangCustomerGroup[];
	grandTotal: {
		totalCustomers: number;
		totalTransactions: number;
		totalSaldoAwalRp: number;
		totalJualRp: number;
		totalBayarRp: number;
		totalSaldoAkhirRp: number;
	};
	params: KartuPiutangParams;
}

export interface CustomerOption {
	id: string;
	name: string;
}

/**
 * Mengambil daftar seluruh Customer dari taCustomer
 */
export async function getCustomerList(): Promise<CustomerOption[]> {
	try {
		const res = await runQuery(`
			SELECT 
				RTRIM(LTRIM(CompanyID)) AS id,
				RTRIM(LTRIM(CompanyName1)) AS name
			FROM [cp].[dbo].[taCustomer]
			WHERE CompanyID IS NOT NULL AND RTRIM(LTRIM(CompanyID)) <> ''
			ORDER BY CompanyName1 ASC
		`);

		return (res.recordset || []).map((r: any) => ({
			id: String(r.id),
			name: String(r.name)
		}));
	} catch (err: any) {
		log.error({ err }, 'Gagal mengambil daftar customer dari taCustomer');
		return [];
	}
}

/**
 * Menjalankan Stored Procedure [rpKartuPiutangL] dan mengelompokkan hasil per Customer
 */
export async function getKartuPiutangData(params: KartuPiutangParams): Promise<KartuPiutangReportResult> {
	const pool = await getPool();

	const tgl1 = params.tgl1 ? params.tgl1 : new Date().toISOString().slice(0, 8) + '01';
	const tgl2 = params.tgl2 ? params.tgl2 : new Date().toISOString().slice(0, 10);
	const companyID = (params.companyID || '%').trim();
	const curr = (params.curr || 'IDR').trim().toUpperCase();
	const noTrans = (params.noTrans || '%').trim();
	const tipeTrans = (params.tipeTrans || '%').trim();
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
	req.input('TipeTrans', sql.VarChar(2), tipeTrans);
	req.input('PeriodeR', sql.VarChar(6), periodeR);

	try {
		const res = await req.execute('[cp].[dbo].[rpKartuPiutangL]');
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

		const customers: KartuPiutangCustomerGroup[] = [];
		let grandSaldoAwalRp = 0;
		let grandJualRp = 0;
		let grandBayarRp = 0;
		let grandSaldoAkhirRp = 0;
		let grandTransactionsCount = 0;

		for (const [cId, group] of groupsMap.entries()) {
			let saldoAwalValas = 0;
			let saldoAwalRp = 0;
			let currCustomer = curr;

			// Baris SA (Saldo Awal)
			const saRow = group.rawList.find((r) => String(r.Status ?? '').trim().toUpperCase() === 'SA');
			if (saRow) {
				saldoAwalValas = Number(saRow.Total) || 0;
				saldoAwalRp = Number(saRow.TotalRp) || 0;
				currCustomer = String(saRow.Curr ?? curr).trim();
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
			let totalJualValas = 0;
			let totalJualRp = 0;
			let totalBayarValas = 0;
			let totalBayarRp = 0;
			const transactions: KartuPiutangTransaction[] = [];

			for (const r of transRows) {
				const jualVal = Number(r.Total) || 0;
				const jualR = Number(r.TotalRp) || 0;
				const bayarVal = Number(r.PayTotal) || 0;
				const bayarR = Number(r.PayTotalRp) || 0;

				totalJualValas += jualVal;
				totalJualRp += jualR;
				totalBayarValas += bayarVal;
				totalBayarRp += bayarR;

				runningRp = runningRp + jualR - bayarR;

				const dateStr = r.TransDate ? new Date(r.TransDate).toISOString().slice(0, 10) : null;
				const dueStr = r.DueDate ? new Date(r.DueDate).toISOString().slice(0, 10) : null;

				transactions.push({
					status: String(r.Status ?? '').trim(),
					transID: String(r.TransID ?? '').trim(),
					transType: String(r.TransType ?? '').trim(),
					transDate: dateStr,
					dueDate: dueStr,
					remark: String(r.Remark ?? '').trim(),
					curr: String(r.Curr ?? currCustomer).trim(),
					rate: r.Rate != null ? Number(r.Rate) : null,
					jualValas: jualVal,
					jualRp: jualR,
					payCurr: r.PayCurr ? String(r.PayCurr).trim() : null,
					payRate: r.PayRate != null ? Number(r.PayRate) : null,
					bayarValas: bayarVal,
					bayarRp: bayarR,
					saldoRp: runningRp,
					saldoGiro: r.SaldoGiro != null ? Number(r.SaldoGiro) : null,
					remarkSO: r.remarkSO ? String(r.remarkSO).trim() : undefined,
					notaDO: r.NotaDO != null ? Number(r.NotaDO) : null,
					isSaldoAwal: false
				});
			}

			const saldoAkhirRp = runningRp;
			const saldoAkhirValas = saldoAwalValas + totalJualValas - totalBayarValas;

			// Filter hideEmpty: saldo awal 0 dan tidak ada mutasi sama sekali
			if (
				hideEmpty &&
				Math.abs(saldoAwalRp) < 0.01 &&
				transactions.length === 0 &&
				Math.abs(totalJualRp) < 0.01 &&
				Math.abs(totalBayarRp) < 0.01
			) {
				continue;
			}

			customers.push({
				companyID: cId,
				companyName: group.companyName,
				address: group.address,
				phone: group.phone,
				plafon: group.plafon,
				curr: currCustomer,
				saldoAwalValas,
				saldoAwalRp,
				totalJualValas,
				totalJualRp,
				totalBayarValas,
				totalBayarRp,
				saldoAkhirValas,
				saldoAkhirRp,
				transactions
			});

			grandSaldoAwalRp += saldoAwalRp;
			grandJualRp += totalJualRp;
			grandBayarRp += totalBayarRp;
			grandSaldoAkhirRp += saldoAkhirRp;
			grandTransactionsCount += transactions.length;
		}

		return {
			customers,
			grandTotal: {
				totalCustomers: customers.length,
				totalTransactions: grandTransactionsCount,
				totalSaldoAwalRp: grandSaldoAwalRp,
				totalJualRp: grandJualRp,
				totalBayarRp: grandBayarRp,
				totalSaldoAkhirRp: grandSaldoAkhirRp
			},
			params: {
				tgl1,
				tgl2,
				companyID,
				curr,
				noTrans,
				tipeTrans,
				hideEmpty
			}
		};
	} catch (err: any) {
		log.error({ err, params }, 'Gagal mengeksekusi stored procedure rpKartuPiutangL');
		if (err?.message?.includes('Timeout') || err?.message?.includes('timeout')) {
			throw new Error(
				'Waktu pemrosesan database habis (Timeout). Coba persempit rentang tanggal atau pilih customer spesifik.'
			);
		}
		throw new Error(`Gagal memuat laporan kartu piutang: ${err?.message || err}`);
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
 * Menghasilkan Berkas Excel (.xlsx) untuk Laporan Kartu Piutang
 */
export function generateKartuPiutangExcel(report: KartuPiutangReportResult): Buffer {
	const { customers, grandTotal, params: p } = report;

	const tgl1Formatted = formatDateId(p.tgl1);
	const tgl2Formatted = formatDateId(p.tgl2);

	const aoa: any[][] = [];

	// Header Laporan
	aoa.push([null, null, null, 'LAPORAN KARTU PIUTANG (ACCOUNTS RECEIVABLE)']);
	aoa.push([null, null, null, 'PT CITI PLUMB']);
	aoa.push([]);
	aoa.push([`Periode: ${tgl1Formatted} s/d ${tgl2Formatted}`, null, null, null, `Valas: ${p.curr || 'IDR'}`]);
	aoa.push([]);

	for (const cust of customers) {
		// Header Customer
		aoa.push(['Customer:', cust.companyID, cust.companyName, null, 'Telp:', cust.phone]);
		aoa.push(['Alamat:', cust.address]);
		aoa.push([]);

		// Header Tabel
		aoa.push([
			'Tanggal',
			'No. Bukti',
			'Tipe',
			'Jatuh Tempo',
			'Status',
			'Keterangan',
			'Jual / Tambah (Rp)',
			'Bayar / Kurang (Rp)',
			'Saldo Piutang (Rp)'
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
			cust.saldoAwalRp
		]);

		// Transaksi
		for (const t of cust.transactions) {
			const serialTgl = t.transDate ? dateToExcelSerial(new Date(t.transDate)) : null;
			const serialDue = t.dueDate ? dateToExcelSerial(new Date(t.dueDate)) : '-';
			aoa.push([
				serialTgl,
				t.transID,
				t.transType,
				serialDue,
				t.status,
				t.remark,
				t.jualRp,
				t.bayarRp,
				t.saldoRp
			]);
		}

		// Subtotal Customer
		aoa.push([
			'TOTAL CUSTOMER',
			cust.companyID,
			null,
			null,
			null,
			null,
			cust.totalJualRp,
			cust.totalBayarRp,
			cust.saldoAkhirRp
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
		grandTotal.totalJualRp,
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
		{ wch: 20 }, // Jual
		{ wch: 20 }, // Bayar
		{ wch: 22 }  // Saldo
	];

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Kartu Piutang');

	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
