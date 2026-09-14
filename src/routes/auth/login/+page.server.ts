import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const next = url.searchParams.get('next');
	throw redirect(303, next ? `/login?next=${encodeURIComponent(next)}` : '/login');
};
