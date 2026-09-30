import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions } from './connection';
import { MAINTENANCE_QUEUE_NAME, type MaintenanceJobData } from './maintenance.queue';
import { runQuery, log } from '$lib/db';

let maintenanceWorkerInstance: Worker<MaintenanceJobData> | null = null;

export function getMaintenanceWorker(): Worker<MaintenanceJobData> {
	if (!maintenanceWorkerInstance) {
		maintenanceWorkerInstance = new Worker<MaintenanceJobData>(
			MAINTENANCE_QUEUE_NAME,
			async (job: Job<MaintenanceJobData>) => {
				log.info(`[BullMQ Maintenance Worker] Menjalankan tugas berkala: ${job.name}`);

				if (job.data.task === 'SESSION_CLEANUP') {
					// Bersihkan session yang kadaluarsa jika ada
					return { status: 'OK', task: 'SESSION_CLEANUP', timestamp: new Date().toISOString() };
				} else if (job.data.task === 'HEALTH_CHECK') {
					const res = await runQuery('SELECT GETDATE() AS serverTime, @@SERVERNAME AS serverName');
					return {
						status: 'HEALTHY',
						serverTime: res.recordset[0]?.serverTime,
						serverName: res.recordset[0]?.serverName
					};
				}

				return { status: 'SKIPPED' };
			},
			{
				connection: redisConnectionOptions,
				concurrency: 1
			}
		);

		maintenanceWorkerInstance.on('error', (err) => {
			log.error({ err: err?.message }, '[BullMQ Maintenance Worker] Worker error');
		});
	}
	return maintenanceWorkerInstance;
}
