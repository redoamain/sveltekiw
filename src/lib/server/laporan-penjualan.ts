import { getPool, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface LaporanPenjualanParams {
	tgl1: string; // YYYY-MM-DD
	tgl2: string; // YYYY-MM-DD
	customer?: string;
	item?: string;
	curr?: string;
	jenisDok?: string;
}

export interface PenjualanRow {
	jenisDokPabean: string;
	nomorDokPabean: string;
	tanggalDokPabean: string | null;
	nomorSuratJalan: string;
	tanggalSuratJalan: string | null;
	pembeliPenerima: string;
	kodeBarang: string;
	namaBarang: string;
	satuan: string;
	jumlah: number;
	curr: string;
	nilaiBarang: number;
	nopol: string;
}

export interface LaporanPenjualanResult {
	rows: PenjualanRow[];
	summary: {
		totalRows: number;
		totalJumlah: number;
		totalNilaiIDR: number;
		totalNilaiUSD: number;
		totalCustomer: number;
	};
	filters: LaporanPenjualanParams;
}

/**
 * Format tanggal ke teks DD/MM/YYYY
 */
function formatDateId(dateStr: string | null | undefined): string {
	if (!dateStr) return '';
	const parts = dateStr.split('-');
	if (parts.length === 3) {
		return `${parts[2]}/${parts[1]}/${parts[0]}`;
	}
	return dateStr;
}

/**
 * Menjalankan Stored Procedure [rpPenjualan] (atau [rpPengeluaran])
 */
export async function getLaporanPenjualanData(params: LaporanPenjualanParams): Promise<LaporanPenjualanResult> {
	const pool = await getPool();

	const tgl1 = params.tgl1 ? params.tgl1 : new Date().toISOString().slice(0, 8) + '01';
	const tgl2 = params.tgl2 ? params.tgl2 : new Date().toISOString().slice(0, 10);
	const customerFilter = (params.customer || '').trim().toLowerCase();
	const itemFilter = (params.item || '').trim().toLowerCase();
	const currFilter = (params.curr || '').trim().toUpperCase();
	const jenisDokFilter = (params.jenisDok || '').trim().toUpperCase();

	const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
	const req = pool.request();
	(req as any).overrides = { requestTimeout: reportTimeout };
	req.input('tgl1', sql.DateTime, new Date(`${tgl1}T00:00:00.000Z`));
	req.input('tgl2', sql.DateTime, new Date(`${tgl2}T23:59:59.000Z`));

	try {
		let res;
		try {
			res = await req.execute('[cp].[dbo].[rpPenjualan]');
		} catch {
			// Fallback ke rpPengeluaran bila rpPenjualan belum ada
			res = await req.execute('[cp].[dbo].[rpPengeluaran]');
		}

		const rawRows = res.recordset || [];
		let rows: PenjualanRow[] = rawRows.map((r: any) => ({
			jenisDokPabean: String(r.JenisDokPabean ?? '').trim(),
			nomorDokPabean: String(r.NomorDokPabean ?? '').trim(),
			tanggalDokPabean: r.TanggalDokPabean ? new Date(r.TanggalDokPabean).toISOString().slice(0, 10) : null,
			nomorSuratJalan: String(r.NomorSuratJalan ?? '').trim(),
			tanggalSuratJalan: r.TanggalSuratJalan ? new Date(r.TanggalSuratJalan).toISOString().slice(0, 10) : null,
			pembeliPenerima: String(r.PembeliPeneima ?? r.PembeliPenerima ?? '').trim(),
			kodeBarang: String(r.KodeBarang ?? r.kodebarang ?? '').trim(),
			namaBarang: String(r.NamaBarang ?? r.Namabarang ?? '').trim(),
			satuan: String(r.Satuan ?? '').trim(),
			jumlah: Number(r.Jumlah) || 0,
			curr: String(r.Curr ?? r.CURR ?? 'IDR').trim().toUpperCase(),
			nilaiBarang: Number(r.NilaiBarang) || 0,
			nopol: String(r.Nopol ?? r.nopol ?? '').trim()
		}));

		// Filter sisi aplikasi untuk pencarian spesifik
		if (customerFilter) {
			rows = rows.filter((r) => r.pembeliPenerima.toLowerCase().includes(customerFilter));
		}
		if (itemFilter) {
			rows = rows.filter(
				(r) => r.kodeBarang.toLowerCase().includes(itemFilter) || r.namaBarang.toLowerCase().includes(itemFilter)
			);
		}
		if (currFilter) {
			rows = rows.filter((r) => r.curr === currFilter);
		}
		if (jenisDokFilter) {
			rows = rows.filter((r) => r.jenisDokPabean.toUpperCase().includes(jenisDokFilter));
		}

		// Hitung ringkasan
		let totalJumlah = 0;
		let totalNilaiIDR = 0;
		let totalNilaiUSD = 0;
		const customerSet = new Set<string>();

		for (const r of rows) {
			totalJumlah += r.jumlah;
			if (r.curr === 'USD') {
				totalNilaiUSD += r.nilaiBarang;
			} else {
				totalNilaiIDR += r.nilaiBarang;
			}
			if (r.pembeliPenerima) {
				customerSet.add(r.pembeliPenerima);
			}
		}

		return {
			rows,
			summary: {
				totalRows: rows.length,
				totalJumlah,
				totalNilaiIDR,
				totalNilaiUSD,
				totalCustomer: customerSet.size
			},
			filters: {
				tgl1,
				tgl2,
				customer: params.customer,
				item: params.item,
				curr: params.curr,
				jenisDok: params.jenisDok
			}
		};
	} catch (err: any) {
		log.error({ err, params }, 'Gagal mengeksekusi stored procedure rpPenjualan / rpPengeluaran');
		throw new Error(`Gagal memuat laporan penjualan: ${err?.message || err}`);
	}
}

/**
 * Menghasilkan file Excel (.xlsx) Laporan Penjualan
 */
export function generateLaporanPenjualanExcel(result: LaporanPenjualanResult): Buffer {
	const { rows, summary, filters: f } = result;

	const tgl1Formatted = formatDateId(f.tgl1);
	const tgl2Formatted = formatDateId(f.tgl2);

	const aoa: any[][] = [];

	aoa.push([null, null, null, null, 'LAPORAN PENJUALAN']);
	aoa.push([null, null, null, null, 'PT CITI PLUMB']);
	aoa.push([]);
	aoa.push([`Periode: ${tgl1Formatted} s/d ${tgl2Formatted}`, null, null, null, `Total Transaksi: ${summary.totalRows}`]);
	aoa.push([]);

	aoa.push([
		'No.',
		'Dokumen Pabean',
		'No. Dok Pabean',
		'Tgl Dokumen',
		'No. Surat Jalan',
		'Tgl Surat Jalan',
		'Pembeli / Customer',
		'Kode Barang',
		'Nama Barang',
		'Jumlah',
		'Satuan',
		'Valas',
		'Nilai Barang',
		'No. Polisi'
	]);

	rows.forEach((r, idx) => {
		aoa.push([
			idx + 1,
			r.jenisDokPabean,
			r.nomorDokPabean,
			formatDateId(r.tanggalDokPabean),
			r.nomorSuratJalan,
			formatDateId(r.tanggalSuratJalan),
			r.pembeliPenerima,
			r.kodeBarang,
			r.namaBarang,
			r.jumlah,
			r.satuan,
			r.curr,
			r.nilaiBarang,
			r.nopol
		]);
	});

	aoa.push([]);
	aoa.push([
		'TOTAL KESELURUHAN',
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		summary.totalJumlah,
		null,
		'IDR',
		summary.totalNilaiIDR
	]);
	if (summary.totalNilaiUSD > 0) {
		aoa.push([
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			'USD',
			summary.totalNilaiUSD
		]);
	}

	const ws = XLSX.utils.aoa_to_sheet(aoa);
	ws['!cols'] = [
		{ wch: 6 },  // No
		{ wch: 16 }, // Jenis Dok
		{ wch: 16 }, // No Dok
		{ wch: 14 }, // Tgl Dok
		{ wch: 18 }, // No SJ
		{ wch: 14 }, // Tgl SJ
		{ wch: 32 }, // Customer
		{ wch: 14 }, // Kode
		{ wch: 30 }, // Nama Barang
		{ wch: 12 }, // Jumlah
		{ wch: 8 },  // Satuan
		{ wch: 6 },  // Curr
		{ wch: 18 }, // Nilai Barang
		{ wch: 18 }  // Nopol
	];

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Penjualan');

	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
