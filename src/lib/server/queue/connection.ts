import type { ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { log } from '$lib/db';

const host = process.env.REDIS_HOST || '127.0.0.1';
const port = parseInt(process.env.REDIS_PORT || '6379', 10);
const password = process.env.REDIS_PASSWORD || undefined;

export const redisConnectionOptions: ConnectionOptions = {
	host,
	port,
	password,
	maxRetriesPerRequest: null,
	enableReadyCheck: false
};

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
	if (!redisClient) {
		redisClient = new Redis({
			...redisConnectionOptions,
			lazyConnect: true
		});

		redisClient.on('error', (err) => {
			log.error({ err: err?.message }, '[BullMQ/Redis] Koneksi Redis bermasalah');
		});

		redisClient.on('connect', () => {
			log.info(`[BullMQ/Redis] Berhasil terhubung ke Redis ${host}:${port}`);
		});
	}
	return redisClient;
}
