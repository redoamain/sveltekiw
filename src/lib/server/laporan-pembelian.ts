import { getPool, log } from '$lib/db';
import sql from 'mssql';
import * as XLSX from 'xlsx';

export interface LaporanPembelianParams {
	tgl1: string; // YYYY-MM-DD
	tgl2: string; // YYYY-MM-DD
	tab?: 'pemasukan' | 'retur';
	supplier?: string;
	item?: string;
	curr?: string;
	jenisDok?: string;
}

export interface PembelianRow {
	jenisDokPabean: string;
	nomorDokPabean: string;
	tanggalDokPabean: string | null;
	nomorPO?: string;
	nomorBPB?: string;
	nomorSuratJalan?: string;
	tanggalBPB?: string | null;
	tanggalSuratJalan?: string | null;
	pemasokPengirim: string;
	kodeBarang: string;
	namaBarang: string;
	satuan: string;
	jumlah: number;
	curr: string;
	nilaiBarang: number;
	nopol: string;
	noInvoice?: string;
}

export interface LaporanPembelianResult {
	tab: 'pemasukan' | 'retur';
	rows: PembelianRow[];
	summary: {
		totalRows: number;
		totalJumlah: number;
		totalNilaiIDR: number;
		totalNilaiUSD: number;
		totalSupplier: number;
	};
	filters: LaporanPembelianParams;
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
 * Menjalankan Stored Procedure [rpPemasukan] (Laporan Pembelian/Pemasukan)
 */
export async function getLaporanPemasukanData(params: LaporanPembelianParams): Promise<LaporanPembelianResult> {
	const pool = await getPool();

	const tgl1 = params.tgl1 ? params.tgl1 : new Date().toISOString().slice(0, 8) + '01';
	const tgl2 = params.tgl2 ? params.tgl2 : new Date().toISOString().slice(0, 10);
	const supplierFilter = (params.supplier || '').trim().toLowerCase();
	const itemFilter = (params.item || '').trim().toLowerCase();
	const currFilter = (params.curr || '').trim().toUpperCase();
	const jenisDokFilter = (params.jenisDok || '').trim().toUpperCase();

	const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
	const req = pool.request();
	(req as any).overrides = { requestTimeout: reportTimeout };
	req.input('tgl1', sql.DateTime, new Date(`${tgl1}T00:00:00.000Z`));
	req.input('tgl2', sql.DateTime, new Date(`${tgl2}T23:59:59.000Z`));

	try {
		const res = await req.execute('[cp].[dbo].[rpPemasukan]');
		const rawRows = res.recordset || [];

		let rows: PembelianRow[] = rawRows.map((r: any) => ({
			jenisDokPabean: String(r.JenisDokPabean ?? '').trim(),
			nomorDokPabean: String(r.NomorDokPabean ?? '').trim(),
			tanggalDokPabean: r.TanggalDokPabean ? new Date(r.TanggalDokPabean).toISOString().slice(0, 10) : null,
			nomorPO: String(r.NomorPO ?? '').trim(),
			nomorBPB: String(r.NomorBPB ?? '').trim(),
			nomorSuratJalan: String(r.NomorBPB ?? '').trim(),
			tanggalBPB: r.TanggalBPB ? new Date(r.TanggalBPB).toISOString().slice(0, 10) : null,
			tanggalSuratJalan: r.TanggalBPB ? new Date(r.TanggalBPB).toISOString().slice(0, 10) : null,
			pemasokPengirim: String(r.PemasokPengirim ?? '').trim(),
			kodeBarang: String(r.kodebarang ?? r.KodeBarang ?? '').trim(),
			namaBarang: String(r.Namabarang ?? r.NamaBarang ?? '').trim(),
			satuan: String(r.Satuan ?? '').trim(),
			jumlah: Number(r.Jumlah) || 0,
			curr: String(r.CURR ?? r.Curr ?? 'IDR').trim().toUpperCase(),
			nilaiBarang: Number(r.NilaiBarang) || 0,
			nopol: String(r.Nopol ?? r.nopol ?? '').trim(),
			noInvoice: String(r.NoInvoice ?? '').trim()
		}));

		if (supplierFilter) {
			rows = rows.filter((r) => r.pemasokPengirim.toLowerCase().includes(supplierFilter));
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

		let totalJumlah = 0;
		let totalNilaiIDR = 0;
		let totalNilaiUSD = 0;
		const supplierSet = new Set<string>();

		for (const r of rows) {
			totalJumlah += r.jumlah;
			if (r.curr === 'USD') {
				totalNilaiUSD += r.nilaiBarang;
			} else {
				totalNilaiIDR += r.nilaiBarang;
			}
			if (r.pemasokPengirim) {
				supplierSet.add(r.pemasokPengirim);
			}
		}

		return {
			tab: 'pemasukan',
			rows,
			summary: {
				totalRows: rows.length,
				totalJumlah,
				totalNilaiIDR,
				totalNilaiUSD,
				totalSupplier: supplierSet.size
			},
			filters: {
				tgl1,
				tgl2,
				tab: 'pemasukan',
				supplier: params.supplier,
				item: params.item,
				curr: params.curr,
				jenisDok: params.jenisDok
			}
		};
	} catch (err: any) {
		log.error({ err, params }, 'Gagal mengeksekusi stored procedure rpPemasukan');
		throw new Error(`Gagal memuat laporan pemasukan pembelian: ${err?.message || err}`);
	}
}

/**
 * Menjalankan Stored Procedure [rpReturPembelian] (Laporan Retur Pembelian)
 */
export async function getLaporanReturPembelianData(
	params: LaporanPembelianParams
): Promise<LaporanPembelianResult> {
	const pool = await getPool();

	const tgl1 = params.tgl1 ? params.tgl1 : new Date().toISOString().slice(0, 8) + '01';
	const tgl2 = params.tgl2 ? params.tgl2 : new Date().toISOString().slice(0, 10);
	const supplierFilter = (params.supplier || '').trim().toLowerCase();
	const itemFilter = (params.item || '').trim().toLowerCase();
	const currFilter = (params.curr || '').trim().toUpperCase();
	const jenisDokFilter = (params.jenisDok || '').trim().toUpperCase();

	const reportTimeout = Number(process.env.DB_REPORT_TIMEOUT || 180000);
	const req = pool.request();
	(req as any).overrides = { requestTimeout: reportTimeout };
	req.input('tgl1', sql.DateTime, new Date(`${tgl1}T00:00:00.000Z`));
	req.input('tgl2', sql.DateTime, new Date(`${tgl2}T23:59:59.000Z`));

	try {
		const res = await req.execute('[cp].[dbo].[rpReturPembelian]');
		const rawRows = res.recordset || [];

		let rows: PembelianRow[] = rawRows.map((r: any) => ({
			jenisDokPabean: String(r.JenisDokPabean ?? '').trim(),
			nomorDokPabean: String(r.NomorDokPabean ?? '').trim(),
			tanggalDokPabean: r.TanggalDokPabean ? new Date(r.TanggalDokPabean).toISOString().slice(0, 10) : null,
			nomorSuratJalan: String(r.NomorSuratJalan ?? '').trim(),
			tanggalSuratJalan: r.TanggalSuratJalan ? new Date(r.TanggalSuratJalan).toISOString().slice(0, 10) : null,
			pemasokPengirim: String(r.PembeliPeneima ?? r.PemasokPengirim ?? '').trim(),
			kodeBarang: String(r.KodeBarang ?? r.kodebarang ?? '').trim(),
			namaBarang: String(r.NamaBarang ?? r.Namabarang ?? '').trim(),
			satuan: String(r.Satuan ?? '').trim(),
			jumlah: Number(r.Jumlah) || 0,
			curr: String(r.Curr ?? r.CURR ?? 'IDR').trim().toUpperCase(),
			nilaiBarang: Number(r.NilaiBarang) || 0,
			nopol: String(r.Nopol ?? r.nopol ?? '').trim()
		}));

		if (supplierFilter) {
			rows = rows.filter((r) => r.pemasokPengirim.toLowerCase().includes(supplierFilter));
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

		let totalJumlah = 0;
		let totalNilaiIDR = 0;
		let totalNilaiUSD = 0;
		const supplierSet = new Set<string>();

		for (const r of rows) {
			totalJumlah += r.jumlah;
			if (r.curr === 'USD') {
				totalNilaiUSD += r.nilaiBarang;
			} else {
				totalNilaiIDR += r.nilaiBarang;
			}
			if (r.pemasokPengirim) {
				supplierSet.add(r.pemasokPengirim);
			}
		}

		return {
			tab: 'retur',
			rows,
			summary: {
				totalRows: rows.length,
				totalJumlah,
				totalNilaiIDR,
				totalNilaiUSD,
				totalSupplier: supplierSet.size
			},
			filters: {
				tgl1,
				tgl2,
				tab: 'retur',
				supplier: params.supplier,
				item: params.item,
				curr: params.curr,
				jenisDok: params.jenisDok
			}
		};
	} catch (err: any) {
		log.error({ err, params }, 'Gagal mengeksekusi stored procedure rpReturPembelian');
		throw new Error(`Gagal memuat laporan retur pembelian: ${err?.message || err}`);
	}
}

/**
 * Menghasilkan file Excel (.xlsx) Laporan Pembelian / Retur Pembelian
 */
export function generateLaporanPembelianExcel(result: LaporanPembelianResult): Buffer {
	const { rows, summary, filters: f, tab } = result;

	const tgl1Formatted = formatDateId(f.tgl1);
	const tgl2Formatted = formatDateId(f.tgl2);
	const title = tab === 'retur' ? 'LAPORAN RETUR PEMBELIAN' : 'LAPORAN PEMASUKAN BARANG / PEMBELIAN';

	const aoa: any[][] = [];

	aoa.push([null, null, null, null, title]);
	aoa.push([null, null, null, null, 'PT CITI PLUMB']);
	aoa.push([]);
	aoa.push([`Periode: ${tgl1Formatted} s/d ${tgl2Formatted}`, null, null, null, `Total Transaksi: ${summary.totalRows}`]);
	aoa.push([]);

	aoa.push([
		'No.',
		'Dokumen Pabean',
		'No. Dok Pabean',
		'Tgl Dokumen',
		tab === 'retur' ? 'No. Surat Jalan' : 'No. BPB',
		tab === 'retur' ? 'Tgl Surat Jalan' : 'Tgl BPB',
		tab === 'retur' ? 'Penerima Retur / Supplier' : 'Pemasok / Supplier',
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
			r.nomorSuratJalan || r.nomorBPB,
			formatDateId(r.tanggalSuratJalan || r.tanggalBPB),
			r.pemasokPengirim,
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
		{ wch: 18 }, // No BPB/SJ
		{ wch: 14 }, // Tgl BPB/SJ
		{ wch: 32 }, // Supplier
		{ wch: 14 }, // Kode
		{ wch: 30 }, // Nama Barang
		{ wch: 12 }, // Jumlah
		{ wch: 8 },  // Satuan
		{ wch: 6 },  // Curr
		{ wch: 18 }, // Nilai Barang
		{ wch: 18 }  // Nopol
	];

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, tab === 'retur' ? 'Retur Pembelian' : 'Pemasukan Pembelian');

	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
