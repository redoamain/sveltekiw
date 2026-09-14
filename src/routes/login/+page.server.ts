import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	AUTH_COOKIE,
	DB_SOURCE_COOKIE,
	authCookieOptions,
	decodeSession,
	encodeSession,
	verifyCredentials
} from '$lib/auth';
import { createSession, deleteSession, getActiveSession } from '$lib/session';
import { randomUUID } from 'node:crypto';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const existing = cookies.get(AUTH_COOKIE);
	if (existing && decodeSession(existing)) {
		const next = url.searchParams.get('next') || '/dashboard/ppic';
		throw redirect(303, next);
	}

	let error = url.searchParams.get('error') ?? '';
	if (error === 'session_taken') {
		error = 'Sesi Anda telah berakhir — akun login di perangkat lain. Silakan login kembali.';
	}

	const nextParam = url.searchParams.get('next') ?? '/dashboard/ppic';
	return {
		error,
		nextParam
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const fd = await request.formData();
		const username = String(fd.get('username') ?? '').trim();
		const password = String(fd.get('password') ?? '').trim();
		const next = String(fd.get('next') ?? '/dashboard/ppic');
		const dbSourceRaw = String(fd.get('db_source') ?? 'live');
		const useBackup = dbSourceRaw === 'backup';

		if (!username || !password) {
			return fail(400, { error: 'Username dan password wajib diisi', username });
		}

		try {
			const user = await verifyCredentials(username, password, useBackup);
			if (!user) {
				return fail(400, { error: 'Username atau password salah', username });
			}

			// Hapus session lama jika ada
			const existing = await getActiveSession(String(user.UserName));
			if (existing) {
				await deleteSession(String(user.UserName));
			}

			// Buat session baru
			const sid = randomUUID();
			const token = encodeSession(user, sid);

			cookies.set(AUTH_COOKIE, token, authCookieOptions());
			cookies.set(DB_SOURCE_COOKIE, useBackup ? 'backup' : 'live', {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				path: '/',
				maxAge: 60 * 60 * 8
			});

			const ip =
				request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
				getClientAddress() ??
				null;
			const ua = request.headers.get('user-agent');
			await createSession(String(user.UserName), sid, { ip, ua });

			throw redirect(303, next);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: 'Gagal terhubung ke database login', username });
		}
	}
};
