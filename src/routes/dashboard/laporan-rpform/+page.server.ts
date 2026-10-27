import type { PageServerLoad } from './$types';
import { getRpFormPaged, getRpFormGroups, getRpFormStats } from '$lib/server/rpform';

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = url.searchParams.get('q') ?? '';
	const group = url.searchParams.get('group') ?? '';
	const progType = url.searchParams.get('progType') ?? '';
	const view = url.searchParams.get('view') ?? 'table';
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '50', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const validPs = [25, 50, 100, 200, 500];
	const pageSize = validPs.includes(psRaw) ? psRaw : 50;

	const [pagedResult, groups, stats] = await Promise.all([
		getRpFormPaged({
			q: q || undefined,
			group: group || undefined,
			progType: progType || undefined,
			page,
			pageSize
		}).catch(() => ({
			rows: [],
			total: 0,
			page: 1,
			pageSize,
			totalPages: 0,
			stats: {
				total: 0,
				totalGroups: 0,
				totalPrograms: 0,
				totalStoredProcedures: 0,
				totalWithRemark: 0
			}
		})),
		getRpFormGroups().catch(() => []),
		getRpFormStats().catch(() => ({
			total: 0,
			totalGroups: 0,
			totalPrograms: 0,
			totalStoredProcedures: 0,
			totalWithRemark: 0
		}))
	]);

	return {
		q,
		group,
		progType,
		view,
		page,
		pageSize,
		rows: pagedResult.rows,
		total: pagedResult.total,
		totalPages: pagedResult.totalPages,
		groups,
		stats: pagedResult.stats || stats,
		currentUser: locals.user?.UserName || locals.user?.username || 'OPERATOR'
	};
};
