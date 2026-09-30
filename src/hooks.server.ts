import type { Handle, ServerInit } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { AUTH_COOKIE, DB_SOURCE_COOKIE, decodeSession, getSessionIdFromCookie } from '$lib/auth';
import { isSessionValid, touchSession } from '$lib/session';
import { dbContext } from '$lib/db';
import { logUserActivity } from '$lib/server/access-log';
import { initWorkers, closeWorkers, addAuditLogJob } from '$lib/server/queue';
import { hasMenuAccess, MENU_NAME_MAP } from '$lib/permissions';

const PUBLIC_PATHS = new Set([
	'/login',
	'/auth/login',
	'/api/login',
	'/api/logout',
	'/api/auth/check'
]);

function isPublic(pathname: string): boolean {
	if (PUBLIC_PATHS.has(pathname)) return true;
	if (
		pathname.startsWith('/favicon') ||
		pathname.startsWith('/og-image') ||
		pathname.startsWith('/_app/') ||
		pathname.startsWith('/static/')
	) {
		return true;
	}
	return false;
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const method = event.request.method;

	// Populate user session and dbSource from cookies
	const token = event.cookies.get(AUTH_COOKIE);
	const user = token ? decodeSession(token) : null;
	if (user) {
		event.locals.user = user;
	}
	const dbSourceCookie = event.cookies.get(DB_SOURCE_COOKIE);
	event.locals.dbSource = dbSourceCookie === 'backup' ? 'backup' : 'live';

	// CORS untuk /api/*
	if (pathname.startsWith('/api/')) {
		if (method === 'OPTIONS') {
			return new Response(null, {
				status: 200,
				headers: {
					'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		const useBackup = event.locals.dbSource === 'backup';
		return dbContext.run({ useBackup }, () => resolve(event));
	}

	// Halaman public -> jika sudah login dan buka /login, redirect ke /dashboard
	if (isPublic(pathname)) {
		if (pathname === '/login' || pathname === '/auth/login') {
			if (user) {
				throw redirect(303, '/dashboard');
			}
		}
		return resolve(event);
	}

	// Halaman terproteksi: / dan /dashboard/*
	const needsAuth = pathname === '/' || pathname.startsWith('/dashboard');
	if (needsAuth) {
		if (!user) {
			const nextParam = pathname + event.url.search;
			throw redirect(303, `/login?next=${encodeURIComponent(nextParam)}`);
		}

		// Single-session check
		const sid = token ? getSessionIdFromCookie(token) : null;
		if (sid) {
			const valid = await isSessionValid(String(user.UserName), sid);
			if (!valid) {
				event.cookies.delete(AUTH_COOKIE, { path: '/' });
				const nextParam = pathname + event.url.search;
				throw redirect(303, `/login?error=session_taken&next=${encodeURIComponent(nextParam)}`);
			}
			touchSession(String(user.UserName)).catch(() => {});
		}

		// Log aktivitas akses menu secara non-blocking
		if (pathname.startsWith('/dashboard')) {
			const cleanPath = pathname.replace(/\/$/, '') || '/dashboard';

			// Proteksi otorisasi menu berdasarkan role pengguna
			if (!hasMenuAccess(cleanPath, user)) {
				throw redirect(303, `/dashboard?error=unauthorized&from=${encodeURIComponent(cleanPath)}`);
			}

			const menuName = MENU_NAME_MAP[cleanPath] || `Menu: ${cleanPath}`;
			const ip =
				event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
				event.request.headers.get('x-real-ip') ||
				'127.0.0.1';
			const userAgent = event.request.headers.get('user-agent');
			const search = event.url.search;
			const action = method === 'POST' ? 'EXECUTE_ACTION' : 'VIEW_PAGE';
			const details = search ? `Query: ${search.slice(0, 200)}` : null;

			const logData = {
				userName: String(user.UserName),
				action,
				menuName,
				path: cleanPath,
				method,
				ip,
				userAgent,
				details
			};

			// Alihkan logging aktivitas ke antrian BullMQ (auditQueue) agar request HTTP tidak terhambat
			addAuditLogJob(logData).catch(() => {
				// Fallback aman langsung ke file jika antrian Redis bermasalah
				logUserActivity(logData).catch(() => {});
			});
		}

		const useBackup = event.locals.dbSource === 'backup';
		return dbContext.run({ useBackup }, () => resolve(event));
	}

	return resolve(event);
};

export const init: ServerInit = async () => {
	// Inisialisasi background workers secara non-blocking agar HTTP server SvelteKit langsung listening di port
	initWorkers().catch(() => {});

	const handleExit = async () => {
		await closeWorkers();
	};

	process.on('SIGINT', handleExit);
	process.on('SIGTERM', handleExit);
};

