import { Queue } from 'bullmq';
import { redisConnectionOptions } from './connection';
import type { BukuBesarParams } from '$lib/server/buku-besar';

export const BUKU_BESAR_QUEUE_NAME = 'kiw-buku-besar-queue';

export interface BukuBesarExportJobData {
	type: 'EXPORT_BUKU_BESAR';
	params: BukuBesarParams;
	username: string;
}

export interface BukuBesarJobResult {
	success: boolean;
	fileName: string;
	fileBase64?: string;
	totalAccounts: number;
	totalTransactions: number;
	totalSaldoAkhirRp: number;
	message: string;
}

let bukuBesarQueueInstance: Queue<BukuBesarExportJobData, BukuBesarJobResult> | null = null;

export function getBukuBesarQueue(): Queue<BukuBesarExportJobData, BukuBesarJobResult> {
	if (!bukuBesarQueueInstance) {
		bukuBesarQueueInstance = new Queue<BukuBesarExportJobData, BukuBesarJobResult>(
			BUKU_BESAR_QUEUE_NAME,
			{
				connection: redisConnectionOptions,
				defaultJobOptions: {
					attempts: 2,
					backoff: {
						type: 'exponential',
						delay: 3000
					},
					removeOnComplete: {
						count: 200,
						age: 24 * 3600 // Simpan histori 24 jam
					},
					removeOnFail: {
						count: 500,
						age: 7 * 24 * 3600 // Simpan histori kegagalan 7 hari
					}
				}
			}
		);
	}
	return bukuBesarQueueInstance;
}

/**
 * Menambahkan pekerjaan proses background export Excel Buku Besar ke antrian BullMQ.
 */
export async function addBukuBesarExportJob(data: { params: BukuBesarParams; username: string }) {
	const queue = getBukuBesarQueue();
	const tgl1Str = (data.params.tgl1 || '').replace(/-/g, '');
	const tgl2Str = (data.params.tgl2 || '').replace(/-/g, '');
	const job = await queue.add(`export-buku-besar-${tgl1Str}-${tgl2Str}`, {
		type: 'EXPORT_BUKU_BESAR',
		params: data.params,
		username: data.username
	});
	return job;
}

/**
 * Mendapatkan status job BullMQ berdasarkan Job ID.
 */
export async function getBukuBesarJobStatus(jobId: string) {
	const queue = getBukuBesarQueue();
	const job = await queue.getJob(jobId);
	if (!job) return null;

	const state = await job.getState();
	const progress = job.progress;
	const returnValue = job.returnvalue;
	const failedReason = job.failedReason;

	return {
		id: job.id,
		name: job.name,
		state,
		progress,
		result: returnValue,
		failedReason,
		timestamp: job.timestamp,
		processedOn: job.processedOn,
		finishedOn: job.finishedOn
	};
}
