import { Queue } from 'bullmq';
import { redisConnectionOptions } from './connection';
import { log } from '$lib/db';

export const AUDIT_QUEUE_NAME = 'kiw-audit-queue';

export interface AuditJobData {
	userName: string;
	action: string;
	menuName: string;
	path: string;
	method: string;
	ip: string | null;
	userAgent: string | null;
	details: string | null;
	createdAt?: string;
}

let auditQueueInstance: Queue<AuditJobData> | null = null;

export function getAuditQueue(): Queue<AuditJobData> {
	if (!auditQueueInstance) {
		auditQueueInstance = new Queue<AuditJobData>(AUDIT_QUEUE_NAME, {
			connection: redisConnectionOptions,
			defaultJobOptions: {
				attempts: 2,
				removeOnComplete: { count: 1000, age: 24 * 3600 },
				removeOnFail: { count: 2000, age: 7 * 24 * 3600 }
			}
		});

		auditQueueInstance.on('error', (err) => {
			log.warn({ err: err?.message }, '[BullMQ] Audit queue error');
		});
	}
	return auditQueueInstance;
}

/**
 * Menambahkan pencatatan log akses/aktivitas ke antrian BullMQ secara instan.
 */
export async function addAuditLogJob(data: AuditJobData) {
	const queue = getAuditQueue();
	return await queue.add('log-activity', data, {
		// Prioritaskan kecepatan tanpa membebani Redis
		removeOnComplete: true
	});
}
