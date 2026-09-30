import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions } from './connection';
import { HPP_QUEUE_NAME, type HPPExportJobData, type HPPJobResult } from './hpp.queue';
import {
	generateHPPExcel,
	getHPPData,
	getHPPCOGMData,
	getHPPYTDData,
	getHargaHPPData,
	getHasilKalkulasiHPPData,
	getHPPKartuStockData,
	getHPPMutasiStockData
} from '$lib/server/hpp';
import { log } from '$lib/db';

let hppWorkerInstance: Worker<HPPExportJobData, HPPJobResult> | null = null;

export function getHPPWorker(): Worker<HPPExportJobData, HPPJobResult> {
	if (!hppWorkerInstance) {
		hppWorkerInstance = new Worker<HPPExportJobData, HPPJobResult>(
			HPP_QUEUE_NAME,
			async (job: Job<HPPExportJobData, HPPJobResult>) => {
				const data = job.data;
				log.info(`[BullMQ HPP Worker] Memulai proses job #${job.id} (${data.reportType}) untuk periode ${data.year}-${data.month}`);
				await job.updateProgress(15);

				const year = data.year;
				const month = data.month;
				const opr = data.opr;
				const item = data.item;
				const tgl1 = data.tgl1;
				const tgl2 = data.tgl2;
				const hideEmpty = data.hideEmpty;

				let totalRows = 0;
				let grandTotal = 0;

				// 1. Eksekusi SP dan hitung total baris
				if (data.reportType === 'rekap') {
					const res = await getHPPData({ year, month, opr });
					totalRows = res.rawRowsCount;
					grandTotal = res.grandTotalHPP;
				} else if (data.reportType === 'cogm') {
					const res = await getHPPCOGMData({ year, month, opr, item });
					totalRows = res.totalRows;
					grandTotal = res.totalNilai;
				} else if (data.reportType === 'kartu-stock') {
					const res = await getHPPKartuStockData({ year, month, tgl1, tgl2, item });
					totalRows = res.totalMovements;
					grandTotal = res.grandTotalNilaiAkhir;
				} else if (data.reportType === 'mutasi-stock') {
					const res = await getHPPMutasiStockData({ year, month, tgl1, tgl2, item, hideEmpty });
					totalRows = res.totalItems;
					grandTotal = res.grandTotalAkhirNilai;
				} else if (data.reportType === 'ytd') {
					const res = await getHPPYTDData({ year, month, opr });
					totalRows = res.rawRowsCount;
					grandTotal = res.grandTotalHPP;
				} else if (data.reportType === 'harga') {
					const res = await getHargaHPPData({ item });
					totalRows = res.length;
				} else if (data.reportType === 'kalkulasi') {
					const res = await getHasilKalkulasiHPPData({});
					totalRows = res.length;
				} else if (data.reportType === 'all') {
					const resRekap = await getHPPData({ year, month, opr });
					totalRows = resRekap.rawRowsCount;
					grandTotal = resRekap.grandTotalHPP;
				}

				await job.updateProgress(60);

				// 2. Generate file Excel (.xlsx)
				log.info(`[BullMQ HPP Worker] Menghasilkan file Excel untuk job #${job.id}`);
				const buffer = await generateHPPExcel(data.reportType, {
					year,
					month,
					opr,
					item,
					tgl1,
					tgl2,
					hideEmpty
				});

				await job.updateProgress(90);

				const fileName = `Laporan_HPP_${data.reportType.toUpperCase()}_${year}${month}.xlsx`;
				const fileBase64 = buffer.toString('base64');

				await job.updateProgress(100);
				log.info(`[BullMQ HPP Worker] Selesai memproses job #${job.id} - ${fileName} (${totalRows} baris)`);

				return {
					success: true,
					reportType: data.reportType,
					fileName,
					fileBase64,
					totalRows,
					grandTotal,
					message: `Laporan HPP (${data.reportType.toUpperCase()}) berhasil digenerate (${totalRows.toLocaleString('id-ID')} baris).`
				};
			},
			{
				connection: redisConnectionOptions,
				concurrency: 2
			}
		);

		hppWorkerInstance.on('completed', (job) => {
			log.info(`[BullMQ HPP Worker] Job #${job.id} SUKSES selesai.`);
		});

		hppWorkerInstance.on('failed', (job, err) => {
			log.error({ err: err?.message, jobId: job?.id }, `[BullMQ HPP Worker] Job #${job?.id} GAGAL`);
		});

		hppWorkerInstance.on('error', (err) => {
			log.error({ err: err?.message }, '[BullMQ HPP Worker] Worker error');
		});
	}

	return hppWorkerInstance;
}
