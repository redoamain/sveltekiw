import type { PageServerLoad } from './$types';
import { getSPKPaged } from '$lib/server/spk';
import { getMasterGoodsPaged } from '$lib/server/master';
import { getMonitoringProduksiPaged } from '$lib/server/monitoring-produksi';
import { getActiveOrdersPaged } from '$lib/server/planning';

export const load: PageServerLoad = async () => {
	let spkTotal = 0;
	let spkActive = 0;
	let spkCompleted = 0;
	let masterTotal = 0;
	let prodTotal = 0;
	let ppActiveTotal = 0;
	let recentSPK: any[] = [];
	let recentMaster: any[] = [];
	let recentProd: any[] = [];

	try {
		const [spkRes, masterRes, prodRes, ppRes] = await Promise.all([
			Promise.all([
				getSPKPaged({ page: 1, pageSize: 1 }),
				getSPKPaged({ status: 'active', page: 1, pageSize: 6 }),
				getSPKPaged({ status: 'completed', page: 1, pageSize: 1 })
			]),
			getMasterGoodsPaged(undefined, 1, 6),
			getMonitoringProduksiPaged({ page: 1, pageSize: 6 }),
			getActiveOrdersPaged(undefined, undefined, 1, 1)
		]);

		spkTotal = spkRes[0].total;
		spkActive = spkRes[1].total;
		spkCompleted = spkRes[2].total;
		recentSPK = spkRes[1].rows;

		masterTotal = masterRes.total;
		recentMaster = masterRes.rows;

		prodTotal = prodRes.total;
		recentProd = prodRes.rows;

		ppActiveTotal = ppRes.total;
	} catch (err) {
		console.error('[Dashboard] Error loading overview data:', err);
	}

	return {
		spkTotal,
		spkActive,
		spkCompleted,
		masterTotal,
		prodTotal,
		ppActiveTotal,
		recentSPK,
		recentMaster,
		recentProd
	};
};
