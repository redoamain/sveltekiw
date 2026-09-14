import type { Actions, PageServerLoad } from './$types';
import {
	todayISO,
	daysAgoISO,
	getActiveOrders,
	getActiveOrdersPaged,
	computePlan,
	storePlan,
	getStoredPlan,
	commitSPK,
	uncommitPO,
	saveCalculation,
	getCalculations,
	getCalculation,
	deleteCalculation,
	saveOverride,
	getOverrides,
	toggleOverride,
	deleteOverride,
	getCommitted
} from '$lib/server/planning';
import type { PlanMaterialRow } from '$lib/domain/material';
import { groupOrdersBySpk, aggregateByKodeBarang, buildCommitUsage } from '$lib/domain/material';
import { exportPlanToExcel } from '$lib/export';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const today = todayISO();
	const defaultStart = daysAgoISO(30);

	const tgl1 = url.searchParams.get('tgl1') ?? defaultStart;
	const tgl2 = url.searchParams.get('tgl2') ?? today;
	const q = (url.searchParams.get('q') ?? '').trim();
	const flashMsg = url.searchParams.get('msg') ?? '';
	const flashErr = url.searchParams.get('err') ?? '';
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '50', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const pageSize = [25, 50, 100, 200].includes(psRaw) ? psRaw : 50;

	let loadError = '';

	// Fetch orders, committed, overrides, and records concurrently
	const [pagedResult, committedResult, overridesResult, recordsResult] = await Promise.all([
		getActiveOrdersPaged(tgl1, tgl2, page, pageSize, q || undefined).catch((err: any) => {
			loadError = err?.message || 'Gagal memuat SPK';
			return { rows: [], total: 0, totalQty: 0 };
		}),
		getCommitted().catch(() => ({ committedPOs: [], reservations: [] })),
		getOverrides().catch(() => []),
		getCalculations(50).catch(() => [])
	]);

	const orders = pagedResult.rows;
	const pagedTotal = pagedResult.total;
	const pagedTotalQty = pagedResult.totalQty;
	const committed = committedResult;
	const overrides = overridesResult;
	const records = recordsResult;

	// Load stored plan from planId if passed
	let plan: any = null;
	const planIdParam = url.searchParams.get('planId');
	if (planIdParam) {
		const stored = getStoredPlan(planIdParam);
		if (stored) {
			plan = {
				rows: stored.rows,
				summary: stored.summary,
				planId: planIdParam,
				spkList: stored.groups.map((g) => g.No_SPK)
			};
		}
	}

	// Load plan from history if ?calc=id
	let planFromHistory = false;
	const calcIdParam = url.searchParams.get('calc');
	if (calcIdParam && !plan) {
		try {
			const rec = await getCalculation(calcIdParam);
			if (rec) {
				const rawRows = (rec.material_data as Partial<PlanMaterialRow>[]) ?? [];
				plan = {
					rows: rawRows.map((r) => ({
						ItemID: r.ItemID ?? '',
						ItemName: r.ItemName ?? r.ItemID ?? '',
						ItemName2: r.ItemName2 ?? '-',
						Departemen: r.Departemen ?? '',
						Level: Number(r.Level) || 0,
						TotalNeeded: Number(r.TotalNeeded) || 0,
						StockWincp: Number(r.StockWincp) || Number(r.StockAkhir) || 0,
						StockAkhir: Number(r.StockAkhir) || 0,
						QtyReserved: Number(r.QtyReserved) || 0,
						TotalDibutuhkan: Number(r.TotalDibutuhkan) || Number(r.TotalNeeded) || 0,
						Available:
							Number(r.Available ?? r.StockWincp ?? 0) -
							(Number(r.QtyReserved) || 0) -
							(Number(r.TotalNeeded) || 0),
						Shortage: Number(r.Shortage) || 0,
						Status: (r.Status ??
							(Number(r.Available ?? r.StockWincp) > 0 ? 'AMAN' : 'HABIS')) as any
					})),
					summary: {
						totalMaterials: Number(rec.total_materials),
						totalNeeded: Number(rec.total_kebutuhan),
						totalShortage: Number(rec.total_kekurangan),
						aman: Number(rec.material_aman),
						kurang: Number(rec.material_kurang),
						habis: Number(rec.material_habis)
					}
				};
				planFromHistory = true;
			}
		} catch {}
	}

	const groups = groupOrdersBySpk(orders);
	const committedSPKs = new Set(
		committed.committedPOs.filter((p: any) => p.status === 'COMMITTED').map((p: any) => p.noSPK)
	);

	return {
		tgl1,
		tgl2,
		q,
		page,
		pageSize,
		orders,
		groups,
		pagedTotal,
		pagedTotalQty,
		loadError,
		flashMsg,
		flashErr,
		plan,
		planFromHistory,
		committed,
		committedSPKs: Array.from(committedSPKs),
		overrides,
		records
	};
};

export const actions: Actions = {
	hitung: async ({ request, url }) => {
		const fd = await request.formData();
		const tgl1 = String(fd.get('tgl1') ?? '');
		const tgl2 = String(fd.get('tgl2') ?? '');
		const q = String(fd.get('q') ?? '');
		const page = String(fd.get('page') ?? '1');
		const pageSize = String(fd.get('pageSize') ?? '50');
		const selectedSpks = fd.getAll('spk').map(String).filter(Boolean);

		if (selectedSpks.length === 0) {
			return fail(400, { error: 'Pilih minimal satu SPK terlebih dahulu.' });
		}

		try {
			const allOrders = await getActiveOrders(tgl1, tgl2, q || undefined);
			const computed = await computePlan(allOrders, selectedSpks);
			const planId = storePlan(computed);

			const p = new URLSearchParams({ tgl1, tgl2, page, pageSize, planId });
			if (q) p.set('q', q);
			throw redirect(303, `/dashboard/ppic?${p.toString()}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal menghitung material' });
		}
	},

	commit: async ({ request, url }) => {
		const fd = await request.formData();
		const planId = String(fd.get('planId') ?? '');
		let selectedSpks = fd.getAll('spk').map(String).filter(Boolean);
		const userID = String(fd.get('userID') || 'system').trim() || 'system';

		const stored = getStoredPlan(planId);
		if (!stored) {
			return fail(400, { error: 'Data hitungan kedaluwarsa — silakan Hitung Material ulang.' });
		}

		if (selectedSpks.length === 0 && stored.groups.length > 0) {
			selectedSpks = stored.groups.map((g) => g.No_SPK);
		}

		const targets = stored.groups.filter((g) => selectedSpks.includes(g.No_SPK));
		if (targets.length === 0) {
			return fail(400, { error: 'Tidak ada SPK valid yang dipilih untuk di-commit.' });
		}

		try {
			const targetSet = new Set(targets.map((g) => g.No_SPK));
			const reservationsByItem = new Map<string, number>();
			for (const r of stored.reservations ?? []) {
				if (r.status !== 'RESERVED' || r.reservedQty <= 0 || !r.noSPK) continue;
				if (targetSet.has(r.noSPK)) continue;
				const id = String(r.itemID ?? '').trim().toUpperCase();
				if (!id) continue;
				reservationsByItem.set(id, (reservationsByItem.get(id) || 0) + Number(r.reservedQty) || 0);
			}

			let committedCount = 0;
			for (const group of targets) {
				const materialUsage = buildCommitUsage(
					group.lines,
					stored.bomByKodeBarang,
					stored.stockRows,
					reservationsByItem
				);
				await commitSPK({
					noSPK: group.No_SPK,
					kodeBarang: group.lines.map((l) => l.Kode_Barang).join(' | '),
					namaPO: group.Nama_PO,
					qty: group.totalQty,
					userID,
					materialUsage
				});
				committedCount++;
			}

			throw redirect(303, `/dashboard/ppic?msg=${encodeURIComponent(`Commit berhasil untuk ${committedCount} SPK.`)}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal commit PO' });
		}
	},

	simpan: async ({ request }) => {
		const fd = await request.formData();
		const planId = String(fd.get('planId') ?? '');
		const calcName = String(fd.get('calcName') ?? '').trim();

		const stored = getStoredPlan(planId);
		if (!stored) {
			return fail(400, { error: 'Data hitungan kedaluwarsa — silakan Hitung Material ulang.' });
		}

		try {
			const today = todayISO();
			const calcId = `PP-${today}-${Date.now().toString().slice(-6)}`;
			await saveCalculation({
				calculation_id: calcId,
				calculation_name: calcName || calcId,
				user_id: 'system',
				po_list: stored.agg.map((a) => ({ kode: a.Kode_Barang, qty: a.QTY })),
				total_po: stored.groups.length,
				material_data: stored.rows,
				total_materials: stored.summary.totalMaterials,
				total_kebutuhan: stored.summary.totalNeeded,
				total_kekurangan: stored.summary.totalShortage,
				material_aman: stored.summary.aman,
				material_kurang: stored.summary.kurang,
				material_habis: stored.summary.habis
			});

			throw redirect(303, `/dashboard/ppic?msg=${encodeURIComponent(`Perhitungan tersimpan sebagai ${calcName || calcId}.`)}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal menyimpan perhitungan' });
		}
	},

	uncommit: async ({ request }) => {
		const fd = await request.formData();
		const noSPK = String(fd.get('noSPK') ?? '');

		if (!noSPK) {
			return fail(400, { error: 'No SPK tidak valid' });
		}

		try {
			await uncommitPO(noSPK, 'system');
			throw redirect(303, `/dashboard/ppic?msg=${encodeURIComponent(`PO ${noSPK} di-uncommit, stok dikembalikan.`)}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal uncommit PO' });
		}
	},

	tambahOverride: async ({ request }) => {
		const fd = await request.formData();
		const originalItemId = String(fd.get('originalItemId') ?? '').trim().toUpperCase();
		const replacementItemId = String(fd.get('replacementItemId') ?? '').trim().toUpperCase();

		if (!originalItemId || !replacementItemId) {
			return fail(400, { error: 'Original Item dan Replacement Item wajib diisi' });
		}

		try {
			await saveOverride({ originalItemId, replacementItemId, isActive: true });
			throw redirect(303, `/dashboard/ppic?msg=${encodeURIComponent('BOM override berhasil ditambahkan.')}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal menambahkan BOM override' });
		}
	},

	toggleOverride: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const isActive = String(fd.get('isActive')) === 'true';

		try {
			if (id) await toggleOverride(id, isActive);
			throw redirect(303, `/dashboard/ppic?msg=${encodeURIComponent('Status override berhasil diubah.')}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal mengubah status override' });
		}
	},

	hapusOverride: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));

		try {
			if (id) await deleteOverride(id);
			throw redirect(303, `/dashboard/ppic?msg=${encodeURIComponent('BOM override berhasil dihapus.')}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal menghapus override' });
		}
	},

	hapusCalc: async ({ request }) => {
		const fd = await request.formData();
		const calculationId = String(fd.get('calculation_id') ?? '');

		try {
			if (calculationId) await deleteCalculation(calculationId);
			throw redirect(303, `/dashboard/ppic?msg=${encodeURIComponent('Perhitungan berhasil dihapus.')}`);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			return fail(500, { error: err?.message || 'Gagal menghapus perhitungan' });
		}
	}
};
