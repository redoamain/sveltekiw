import type { RequestHandler } from './$types';
import { json } from '$lib/http';
import { getProgramDefinition } from '$lib/server/rpform';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, 401);
	}

	const progName = url.searchParams.get('progName')?.trim();
	if (!progName) {
		return json({ error: 'Parameter progName wajib disertakan' }, 400);
	}

	try {
		const result = await getProgramDefinition(progName);
		return json(result);
	} catch (err: any) {
		return json(
			{ error: err?.message || 'Gagal memuat definisi program' },
			500
		);
	}
};
