import { Queue } from 'bullmq';
import { redisConnectionOptions } from './connection';

export const HPP_QUEUE_NAME = 'kiw-hpp-queue';

export interface HPPExportJobData {
	type: 'EXPORT_HPP';
	reportType: 'rekap' | 'cogm' | 'kartu-stock' | 'mutasi-stock' | 'ytd' | 'harga' | 'kalkulasi' | 'all';
	year: string;
	month: string;
	tgl1?: string;
	tgl2?: string;
	opr: number;
	item?: string;
	hideEmpty?: boolean;
	username: string;
}

export interface HPPJobResult {
	success: boolean;
	reportType: string;
	fileName: string;
	fileBase64?: string;
	totalRows: number;
	grandTotal?: number;
	message: string;
}

let hppQueueInstance: Queue<HPPExportJobData, HPPJobResult> | null = null;

export function getHPPQueue(): Queue<HPPExportJobData, HPPJobResult> {
	if (!hppQueueInstance) {
		hppQueueInstance = new Queue<HPPExportJobData, HPPJobResult>(HPP_QUEUE_NAME, {
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
		});
	}
	return hppQueueInstance;
}

/**
 * Menambahkan pekerjaan proses background export Excel laporan HPP ke antrian BullMQ.
 */
export async function addHPPExportJob(data: Omit<HPPExportJobData, 'type'>) {
	const queue = getHPPQueue();
	const job = await queue.add(`export-${data.reportType}`, {
		type: 'EXPORT_HPP',
		...data
	});
	return job;
}

/**
 * Mendapatkan status job BullMQ berdasarkan Job ID.
 */
export async function getHPPJobStatus(jobId: string) {
	const queue = getHPPQueue();
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
