import { Queue } from 'bullmq';
import { redisConnectionOptions } from './connection';
import type { CreateProductionPayload } from '$lib/server/input-produksi';

export const PRODUKSI_QUEUE_NAME = 'kiw-produksi-queue';

export interface DirectProductionJobData {
	type: 'DIRECT_PRODUCTION';
	payload: CreateProductionPayload;
	username: string;
}

export interface BatchProductionJobData {
	type: 'BATCH_PRODUCTION';
	payloads: CreateProductionPayload[];
	username: string;
}

export type ProduksiJobData = DirectProductionJobData | BatchProductionJobData;

export interface ProduksiJobResult {
	success: boolean;
	prodIds: string[];
	totalItems: number;
	message: string;
}

let produksiQueueInstance: Queue<ProduksiJobData, ProduksiJobResult> | null = null;

export function getProduksiQueue(): Queue<ProduksiJobData, ProduksiJobResult> {
	if (!produksiQueueInstance) {
		produksiQueueInstance = new Queue<ProduksiJobData, ProduksiJobResult>(PRODUKSI_QUEUE_NAME, {
			connection: redisConnectionOptions,
			defaultJobOptions: {
				attempts: 3,
				backoff: {
					type: 'exponential',
					delay: 2000
				},
				removeOnComplete: {
					count: 200,
					age: 24 * 3600
				},
				removeOnFail: {
					count: 500,
					age: 7 * 24 * 3600
				}
			}
		});
	}
	return produksiQueueInstance;
}

/**
 * Menambahkan pekerjaan transaksi produksi ke antrian BullMQ.
 */
export async function addProductionJob(data: ProduksiJobData) {
	const queue = getProduksiQueue();
	return await queue.add('save-production', data);
}

/**
 * Mendapatkan status pekerjaan produksi berdasarkan Job ID.
 */
export async function getProduksiJobStatus(jobId: string) {
	const queue = getProduksiQueue();
	const job = await queue.getJob(jobId);
	if (!job) return null;

	const state = await job.getState();
	return {
		id: job.id,
		name: job.name,
		state,
		progress: job.progress,
		result: job.returnvalue,
		failedReason: job.failedReason,
		timestamp: job.timestamp,
		processedOn: job.processedOn,
		finishedOn: job.finishedOn
	};
}
