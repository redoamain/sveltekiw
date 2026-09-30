import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions } from './connection';
import {
	BUKU_BESAR_QUEUE_NAME,
	type BukuBesarExportJobData,
	type BukuBesarJobResult
} from './buku-besar.queue';
import {
	getBukuBesarData,
	generateBukuBesarExcelFromData
} from '$lib/server/buku-besar';
import { log } from '$lib/db';

let bukuBesarWorkerInstance: Worker<BukuBesarExportJobData, BukuBesarJobResult> | null = null;

export function getBukuBesarWorker(): Worker<BukuBesarExportJobData, BukuBesarJobResult> {
	if (!bukuBesarWorkerInstance) {
		bukuBesarWorkerInstance = new Worker<BukuBesarExportJobData, BukuBesarJobResult>(
			BUKU_BESAR_QUEUE_NAME,
			async (job: Job<BukuBesarExportJobData, BukuBesarJobResult>) => {
				const { params, username } = job.data;
				const tgl1Str = (params.tgl1 || '').replace(/-/g, '');
				const tgl2Str = (params.tgl2 || '').replace(/-/g, '');

				log.info(
					`[BullMQ Buku Besar Worker] Memulai proses job #${job.id} untuk periode ${params.tgl1} s/d ${params.tgl2} (user: ${username})`
				);
				await job.updateProgress(15);

				// 1. Eksekusi Stored Procedure rpBBPembantuL
				const report = await getBukuBesarData(params);
				await job.updateProgress(65);

				// 2. Generate file Excel (.xlsx) dengan tata letak template asli rpbbpembantul.xls
				log.info(`[BullMQ Buku Besar Worker] Menghasilkan file Excel untuk job #${job.id}`);
				const buffer = generateBukuBesarExcelFromData(report);
				await job.updateProgress(90);

				const fileName = `rpbbpembantul_${tgl1Str}_${tgl2Str}.xlsx`;
				const fileBase64 = buffer.toString('base64');

				await job.updateProgress(100);
				log.info(
					`[BullMQ Buku Besar Worker] Selesai memproses job #${job.id} - ${fileName} (${report.grandTotal.totalAccounts} akun, ${report.grandTotal.totalTransactions} transaksi)`
				);

				return {
					success: true,
					fileName,
					fileBase64,
					totalAccounts: report.grandTotal.totalAccounts,
					totalTransactions: report.grandTotal.totalTransactions,
					totalSaldoAkhirRp: report.grandTotal.totalSaldoAkhirRp,
					message: `Buku besar berhasil digenerate (${report.grandTotal.totalAccounts.toLocaleString('id-ID')} akun, ${report.grandTotal.totalTransactions.toLocaleString('id-ID')} transaksi mutasi).`
				};
			},
			{
				connection: redisConnectionOptions,
				concurrency: 2
			}
		);

		bukuBesarWorkerInstance.on('completed', (job) => {
			log.info(`[BullMQ Buku Besar Worker] Job #${job.id} SUKSES selesai.`);
		});

		bukuBesarWorkerInstance.on('failed', (job, err) => {
			log.error(
				{ err: err?.message, jobId: job?.id },
				`[BullMQ Buku Besar Worker] Job #${job?.id} GAGAL`
			);
		});
	}

	return bukuBesarWorkerInstance;
}
