import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions } from './connection';
import {
	MUTASI_QUEUE_NAME,
	type MutasiJobData,
	type MutasiJobResult
} from './mutasi.queue';
import {
	parseMutasiExcelImport,
	createMutasiTransaction,
	type CreateMutasiPayload
} from '$lib/server/input-mutasi';
import { log } from '$lib/db';

let mutasiWorkerInstance: Worker<MutasiJobData, MutasiJobResult> | null = null;

export function getMutasiWorker(): Worker<MutasiJobData, MutasiJobResult> {
	if (!mutasiWorkerInstance) {
		mutasiWorkerInstance = new Worker<MutasiJobData, MutasiJobResult>(
			MUTASI_QUEUE_NAME,
			async (job: Job<MutasiJobData, MutasiJobResult>) => {
				log.info(`[BullMQ Worker] Memulai proses job #${job.id} (${job.name})`);
				await job.updateProgress(10);

				const data = job.data;

				if (data.type === 'IMPORT_EXCEL') {
					// 1. Decode buffer
					const fileBuffer = Buffer.from(data.fileBase64, 'base64');
					await job.updateProgress(30);

					// 2. Parse Excel & Validasi Master Barang
					const parsed = await parseMutasiExcelImport(fileBuffer);
					await job.updateProgress(60);

					if (data.autoCommit) {
						// Validasi kelayakan sebelum commit
						if (!parsed.header.locSrc || !parsed.header.locDest) {
							throw new Error('Gudang Asal dan Gudang Tujuan wajib diisi dalam file Excel.');
						}
						if (parsed.header.locSrc === parsed.header.locDest) {
							throw new Error('Gudang Asal dan Gudang Tujuan tidak boleh sama.');
						}
						if (parsed.summary.invalidCount > 0) {
							throw new Error(
								`File memiliki ${parsed.summary.invalidCount} item tidak valid atau belum terdaftar.`
							);
						}

						const payload: CreateMutasiPayload = {
							moveType: parsed.header.moveType || 'R',
							moveDate: parsed.header.moveDate || new Date().toISOString().slice(0, 10),
							locSrc: parsed.header.locSrc,
							locDest: parsed.header.locDest,
							prodType: parsed.header.prodType || null,
							remark: parsed.header.remark || `Import Excel (${data.fileName})`,
							noRator: parsed.header.noRator || null,
							details: parsed.items.map((it) => ({
								itemId: it.itemId,
								bags: it.bags,
								kgs: it.kgs,
								notes: it.notes
							})),
							...(data.headerOverrides || {})
						};

						await job.updateProgress(80);
						const res = await createMutasiTransaction(payload, data.username);
						await job.updateProgress(100);

						return {
							success: true,
							moveId: res.moveId,
							totalItems: parsed.summary.totalRows,
							totalKgs: parsed.summary.totalKgs,
							totalBags: parsed.summary.totalBags,
							message: `Berhasil import dan simpan mutasi #${res.moveId} (${parsed.summary.totalRows} barang).`,
							parsedData: parsed
						};
					} else {
						await job.updateProgress(100);
						return {
							success: true,
							totalItems: parsed.summary.totalRows,
							totalKgs: parsed.summary.totalKgs,
							totalBags: parsed.summary.totalBags,
							message: `Berhasil parsing & validasi file Excel (${parsed.summary.totalRows} baris).`,
							parsedData: parsed
						};
					}
				} else if (data.type === 'DIRECT_MUTASI') {
					await job.updateProgress(40);
					const res = await createMutasiTransaction(data.payload, data.username);
					await job.updateProgress(100);

					return {
						success: true,
						moveId: res.moveId,
						totalItems: data.payload.details?.length || 0,
						totalKgs: data.payload.details?.reduce((acc, d) => acc + (Number(d.kgs) || 0), 0) || 0,
						message: res.message
					};
				}

				throw new Error('Tipe pekerjaan mutasi tidak dikenali.');
			},
			{
				connection: redisConnectionOptions,
				concurrency: 3
			}
		);

		mutasiWorkerInstance.on('completed', (job) => {
			log.info(`[BullMQ Worker] Job #${job.id} selesai dengan sukses.`);
		});

		mutasiWorkerInstance.on('failed', (job, err) => {
			log.error({ err: err?.message, jobId: job?.id }, `[BullMQ Worker] Job gagal diproses.`);
		});

		mutasiWorkerInstance.on('error', (err) => {
			log.error({ err: err?.message }, '[BullMQ Worker] Worker error');
		});
	}

	return mutasiWorkerInstance;
}
