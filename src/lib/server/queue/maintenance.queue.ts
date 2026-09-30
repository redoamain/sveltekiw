import { Queue } from 'bullmq';
import { redisConnectionOptions } from './connection';
import { log } from '$lib/db';

export const MAINTENANCE_QUEUE_NAME = 'kiw-maintenance-queue';

export interface MaintenanceJobData {
	task: 'SESSION_CLEANUP' | 'HEALTH_CHECK' | 'LOG_ROTATE';
}

let maintenanceQueueInstance: Queue<MaintenanceJobData> | null = null;

export function getMaintenanceQueue(): Queue<MaintenanceJobData> {
	if (!maintenanceQueueInstance) {
		maintenanceQueueInstance = new Queue<MaintenanceJobData>(MAINTENANCE_QUEUE_NAME, {
			connection: redisConnectionOptions,
			defaultJobOptions: {
				attempts: 2,
				removeOnComplete: { count: 50, age: 24 * 3600 },
				removeOnFail: { count: 100, age: 7 * 24 * 3600 }
			}
		});

		maintenanceQueueInstance.on('error', (err) => {
			log.warn({ err: err?.message }, '[BullMQ] Maintenance queue error');
		});
	}
	return maintenanceQueueInstance;
}

function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error('Redis connection/auth timed out')), ms)
		)
	]);
}

/**
 * Daftarkan cron repeatable jobs (jadwal berkala otomatis).
 */
export async function setupScheduledJobs() {
	try {
		const queue = getMaintenanceQueue();

		// 1. Session Cleanup setiap 15 menit
		await withTimeout(
			queue.upsertJobScheduler(
				'session-cleanup-scheduler',
				{ every: 15 * 60 * 1000 },
				{
					name: 'session-cleanup',
					data: { task: 'SESSION_CLEANUP' }
				}
			)
		);

		// 2. Health check database setiap 30 menit
		await withTimeout(
			queue.upsertJobScheduler(
				'health-check-scheduler',
				{ every: 30 * 60 * 1000 },
				{
					name: 'health-check',
					data: { task: 'HEALTH_CHECK' }
				}
			)
		);

		log.info('[BullMQ] Jadwal cron maintenance otomatis berhasil didaftarkan via upsertJobScheduler (15m & 30m).');
	} catch (err: any) {
		log.warn({ err: err?.message }, '[BullMQ] Gagal mendaftarkan scheduled maintenance jobs (Redis timeout atau NOAUTH)');
	}
}
