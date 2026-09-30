import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions } from './connection';
import { AUDIT_QUEUE_NAME, type AuditJobData } from './audit.queue';
import { logUserActivity } from '$lib/server/access-log';
import { log } from '$lib/db';

let auditWorkerInstance: Worker<AuditJobData> | null = null;

export function getAuditWorker(): Worker<AuditJobData> {
	if (!auditWorkerInstance) {
		auditWorkerInstance = new Worker<AuditJobData>(
			AUDIT_QUEUE_NAME,
			async (job: Job<AuditJobData>) => {
				await logUserActivity(job.data);
				return { logged: true };
			},
			{
				connection: redisConnectionOptions,
				concurrency: 5
			}
		);

		auditWorkerInstance.on('error', (err) => {
			log.error({ err: err?.message }, '[BullMQ Audit Worker] Worker error');
		});
	}
	return auditWorkerInstance;
}
