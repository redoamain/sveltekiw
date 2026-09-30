import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions } from './connection';
import {
	PRODUKSI_QUEUE_NAME,
	type ProduksiJobData,
	type ProduksiJobResult
} from './produksi.queue';
import { createProductionTransaction } from '$lib/server/input-produksi';
import { log } from '$lib/db';

let produksiWorkerInstance: Worker<ProduksiJobData, ProduksiJobResult> | null = null;

export function getProduksiWorker(): Worker<ProduksiJobData, ProduksiJobResult> {
	if (!produksiWorkerInstance) {
		produksiWorkerInstance = new Worker<ProduksiJobData, ProduksiJobResult>(
			PRODUKSI_QUEUE_NAME,
			async (job: Job<ProduksiJobData, ProduksiJobResult>) => {
				log.info(`[BullMQ Produksi Worker] Memproses job #${job.id}`);
				await job.updateProgress(10);

				const data = job.data;
				if (data.type === 'DIRECT_PRODUCTION') {
					await job.updateProgress(30);
					const res = await createProductionTransaction(data.payload, data.username);
					await job.updateProgress(100);

					return {
						success: true,
						prodIds: [res.prodId],
						totalItems: data.payload.details?.length || 0,
						message: res.message
					};
				} else if (data.type === 'BATCH_PRODUCTION') {
					const total = data.payloads.length;
					const prodIds: string[] = [];
					let processedCount = 0;

					for (const p of data.payloads) {
						const res = await createProductionTransaction(p, data.username);
						prodIds.push(res.prodId);
						processedCount++;
						await job.updateProgress(Math.round((processedCount / total) * 100));
					}

					return {
						success: true,
						prodIds,
						totalItems: data.payloads.reduce((acc, p) => acc + (p.details?.length || 0), 0),
						message: `Berhasil memproses ${prodIds.length} transaksi produksi batch.`
					};
				}

				throw new Error('Tipe pekerjaan produksi tidak dikenali.');
			},
			{
				connection: redisConnectionOptions,
				concurrency: 2
			}
		);

		produksiWorkerInstance.on('completed', (job) => {
			log.info(`[BullMQ Produksi Worker] Job #${job.id} selesai.`);
		});

		produksiWorkerInstance.on('failed', (job, err) => {
			log.error({ err: err?.message, jobId: job?.id }, `[BullMQ Produksi Worker] Job gagal.`);
		});

		produksiWorkerInstance.on('error', (err) => {
			log.error({ err: err?.message }, '[BullMQ Produksi Worker] Worker error');
		});
	}

	return produksiWorkerInstance;
}
