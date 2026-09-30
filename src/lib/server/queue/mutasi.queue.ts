import { Queue } from 'bullmq';
import { redisConnectionOptions } from './connection';
import type { CreateMutasiPayload } from '$lib/server/input-mutasi';

export const MUTASI_QUEUE_NAME = 'kiw-mutasi-queue';

export interface ImportMutasiJobData {
	type: 'IMPORT_EXCEL';
	fileBase64: string;
	fileName: string;
	username: string;
	autoCommit?: boolean;
	headerOverrides?: Partial<CreateMutasiPayload>;
}

export interface DirectMutasiJobData {
	type: 'DIRECT_MUTASI';
	payload: CreateMutasiPayload;
	username: string;
}

export type MutasiJobData = ImportMutasiJobData | DirectMutasiJobData;

export interface MutasiJobResult {
	success: boolean;
	moveId?: string;
	totalItems?: number;
	totalKgs?: number;
	totalBags?: number;
	message: string;
	parsedData?: any;
}

let mutasiQueueInstance: Queue<MutasiJobData, MutasiJobResult> | null = null;

export function getMutasiQueue(): Queue<MutasiJobData, MutasiJobResult> {
	if (!mutasiQueueInstance) {
		mutasiQueueInstance = new Queue<MutasiJobData, MutasiJobResult>(MUTASI_QUEUE_NAME, {
			connection: redisConnectionOptions,
			defaultJobOptions: {
				attempts: 3,
				backoff: {
					type: 'exponential',
					delay: 2000
				},
				removeOnComplete: {
					count: 200,
					age: 24 * 3600 // Simpan histori 24 jam
				},
				removeOnFail: {
					count: 500,
					age: 7 * 24 * 3600 // Simpan log gagal 7 hari
				}
			}
		});
	}
	return mutasiQueueInstance;
}

/**
 * Menambahkan pekerjaan proses background import Excel mutasi.
 */
export async function addImportMutasiJob(data: Omit<ImportMutasiJobData, 'type'>) {
	const queue = getMutasiQueue();
	const job = await queue.add('import-excel', {
		type: 'IMPORT_EXCEL',
		...data
	});
	return job;
}

/**
 * Mendapatkan status job BullMQ berdasarkan Job ID.
 */
export async function getMutasiJobStatus(jobId: string) {
	const queue = getMutasiQueue();
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
