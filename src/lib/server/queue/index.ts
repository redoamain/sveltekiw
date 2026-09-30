import { getMutasiQueue } from './mutasi.queue';
import { getMutasiWorker } from './mutasi.worker';
import { getAuditQueue } from './audit.queue';
import { getAuditWorker } from './audit.worker';
import { getProduksiQueue } from './produksi.queue';
import { getProduksiWorker } from './produksi.worker';
import { getMaintenanceQueue, setupScheduledJobs } from './maintenance.queue';
import { getMaintenanceWorker } from './maintenance.worker';
import { getHPPQueue } from './hpp.queue';
import { getHPPWorker } from './hpp.worker';
import { getBukuBesarQueue } from './buku-besar.queue';
import { getBukuBesarWorker } from './buku-besar.worker';
import { log } from '$lib/db';

export * from './connection';
export * from './mutasi.queue';
export * from './mutasi.worker';
export * from './audit.queue';
export * from './audit.worker';
export * from './produksi.queue';
export * from './produksi.worker';
export * from './maintenance.queue';
export * from './maintenance.worker';
export * from './hpp.queue';
export * from './hpp.worker';
export * from './buku-besar.queue';
export * from './buku-besar.worker';

let isWorkersInitialized = false;

/**
 * Inisialisasi semua background worker & scheduled jobs BullMQ.
 * Dipanggil saat server aplikasi berjalan.
 */
export async function initWorkers() {
	if (isWorkersInitialized) return;

	if (process.env.ENABLE_EMBEDDED_WORKER === 'false') {
		log.info('[BullMQ] Embedded workers dinonaktifkan via ENABLE_EMBEDDED_WORKER=false');
		return;
	}

	try {
		log.info('[BullMQ] Mengaktifkan semua background workers (Mutasi, Audit Log, Produksi, Maintenance, HPP, Buku Besar)...');
		
		// Inisialisasi worker instances
		getMutasiWorker();
		getAuditWorker();
		getProduksiWorker();
		getMaintenanceWorker();
		getHPPWorker();
		getBukuBesarWorker();

		// Pasang scheduled cron jobs
		await setupScheduledJobs();

		isWorkersInitialized = true;
		log.info('[BullMQ] Semua background workers & jadwal cron berhasil diaktifkan.');
	} catch (err: any) {
		log.error({ err: err?.message }, '[BullMQ] Gagal menginisialisasi workers');
	}
}

/**
 * Menutup koneksi workers secara graceful saat shutdown.
 */
export async function closeWorkers() {
	try {
		log.info('[BullMQ] Menutup semua worker...');
		const workers = [
			getMutasiWorker(),
			getAuditWorker(),
			getProduksiWorker(),
			getMaintenanceWorker(),
			getHPPWorker(),
			getBukuBesarWorker()
		];
		await Promise.allSettled(workers.map((w) => w.close()));
		log.info('[BullMQ] Semua worker berhasil ditutup dengan aman.');
	} catch (e: any) {
		log.warn({ err: e?.message }, '[BullMQ] Gagal menutup workers saat shutdown');
	}
}

/**
 * Mendapatkan ringkasan statistik semua queue untuk dashboard/monitoring.
 */
export async function getAllQueuesStats() {
	const queues = [
		{ name: 'Mutasi', q: getMutasiQueue() },
		{ name: 'Audit Log', q: getAuditQueue() },
		{ name: 'Produksi', q: getProduksiQueue() },
		{ name: 'Maintenance', q: getMaintenanceQueue() },
		{ name: 'Laporan HPP', q: getHPPQueue() },
		{ name: 'Buku Besar', q: getBukuBesarQueue() }
	];

	const stats = await Promise.all(
		queues.map(async ({ name, q }) => {
			const [waiting, active, completed, failed, delayed] = await Promise.all([
				q.getWaitingCount(),
				q.getActiveCount(),
				q.getCompletedCount(),
				q.getFailedCount(),
				q.getDelayedCount()
			]);
			return {
				queueName: q.name,
				displayName: name,
				counts: { waiting, active, completed, failed, delayed }
			};
		})
	);

	return stats;
}
