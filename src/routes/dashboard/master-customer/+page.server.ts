import type { Actions, PageServerLoad } from './$types';
import {
	getMasterCustomersPaged,
	getCustomerById,
	getLastCustomerId,
	createCustomer,
	updateCustomer,
	deleteCustomer,
	getAllConsigne,
	getNextConsigneId,
	createConsigne,
	updateConsigne,
	deleteConsigne,
	type CreateCustomerPayload,
	type MasterCustomer,
	type MasterConsigne
} from '$lib/server/master-customer';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = url.searchParams.get('q') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const curr = url.searchParams.get('curr') ?? '';
	const id = url.searchParams.get('id') ?? '';
	const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
	const psRaw = parseInt(url.searchParams.get('pageSize') ?? '25', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const validPs = [10, 25, 50, 100];
	const pageSize = validPs.includes(psRaw) ? psRaw : 25;

	let detail: MasterCustomer | null = null;
	if (id) {
		try {
			detail = await getCustomerById(id);
		} catch (err) {
			// ignore detail error
		}
	}

	const [pagedResult, idInfo, consigneList, nextConsigneId] = await Promise.all([
		getMasterCustomersPaged({
			q: q || undefined,
			status: status || undefined,
			curr: curr || undefined,
			page,
			pageSize
		}).catch((err) => {
			return {
				rows: [],
				total: 0,
				page: 1,
				pageSize,
				totalPages: 0,
				stats: {
					total: 0,
					totalLokal: 0,
					totalExport: 0,
					totalConsigne: 0,
					totalActive: 0,
					totalDelisted: 0,
					totalIDR: 0,
					totalValas: 0
				}
			};
		}),
		getLastCustomerId(),
		getAllConsigne().catch(() => []),
		getNextConsigneId().catch(() => '001')
	]);

	return {
		q,
		status,
		curr,
		page,
		pageSize,
		rows: pagedResult.rows,
		total: pagedResult.total,
		totalPages: pagedResult.totalPages,
		stats: pagedResult.stats,
		nextId: idInfo.nextId,
		lastId: idInfo.lastId,
		consigneList,
		nextConsigneId,
		detail,
		currentUser: (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR'
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';
		const form = await request.formData();
		const isEdit = form.get('isEdit') === 'true';

		const CompanyID = String(form.get('CompanyID') ?? '').trim().toUpperCase();
		const CompanyName1 = String(form.get('CompanyName1') ?? '').trim();
		const CompanyName2 = String(form.get('CompanyName2') ?? '').trim() || null;
		const Address1 = String(form.get('Address1') ?? '').trim() || null;
		const Address2 = String(form.get('Address2') ?? '').trim() || null;
		const City = String(form.get('City') ?? '').trim() || null;
		const Provinsi = String(form.get('Provinsi') ?? '').trim() || null;
		const Negara = String(form.get('Negara') ?? '').trim() || 'INDONESIA';
		const PostalCode = String(form.get('PostalCode') ?? '').trim() || null;
		const Phone1 = String(form.get('Phone1') ?? '').trim() || null;
		const Phone2 = String(form.get('Phone2') ?? '').trim() || null;
		const Fax1 = String(form.get('Fax1') ?? '').trim() || null;
		const Email = String(form.get('Email') ?? '').trim() || null;
		const Contact1 = String(form.get('Contact1') ?? '').trim() || null;
		const Job1 = String(form.get('Job1') ?? '').trim() || null;
		const TaxID = String(form.get('TaxID') ?? '').trim() || null;
		const Curr = String(form.get('Curr') ?? 'IDR').trim().toUpperCase() || 'IDR';
		const Status = String(form.get('Status') ?? '').trim() || null;
		const Export = form.get('Export') === 'true' || form.get('Export') === 'on' || form.get('Export') === '1';
		const Consigne = form.get('Consigne') === 'true' || form.get('Consigne') === 'on' || form.get('Consigne') === '1';
		const Delisted = form.get('Delisted') === 'true' || form.get('Delisted') === 'on' || form.get('Delisted') === '1';

		const plafonRaw = form.get('Plafon');
		const Plafon = plafonRaw !== null && plafonRaw !== '' ? Number(plafonRaw) : null;

		const dueRaw = form.get('Due');
		const Due = dueRaw !== null && dueRaw !== '' ? parseInt(String(dueRaw), 10) : null;

		const NoteMarketing = String(form.get('NoteMarketing') ?? '').trim() || null;
		const NoteFinance = String(form.get('NoteFinance') ?? '').trim() || null;

		if (!CompanyName1) {
			return fail(400, { success: false, error: 'Nama Perusahaan Customer (CompanyName1) wajib diisi.' });
		}

		if (isEdit && !CompanyID) {
			return fail(400, { success: false, error: 'Kode Customer (CompanyID) wajib diisi saat mode perbarui.' });
		}

		const payload: CreateCustomerPayload = {
			CompanyID: CompanyID || undefined,
			CompanyName1,
			CompanyName2,
			Address1,
			Address2,
			City,
			Provinsi,
			Negara,
			PostalCode,
			Phone1,
			Phone2,
			Fax1,
			Email,
			Contact1,
			Job1,
			TaxID,
			Curr,
			Status,
			Export,
			Consigne,
			Delisted,
			Plafon,
			Due,
			NoteMarketing,
			NoteFinance
		};

		try {
			if (isEdit) {
				const updated = await updateCustomer(CompanyID, payload, username);
				return {
					success: true,
					isEdit: true,
					item: updated,
					message: `Customer "${updated.CompanyName1}" (${updated.CompanyID}) berhasil diperbarui.`
				};
			} else {
				const created = await createCustomer(payload, username);
				return {
					success: true,
					isEdit: false,
					item: created,
					message: `Customer baru "${created.CompanyName1}" (${created.CompanyID}) berhasil ditambahkan.`
				};
			}
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menyimpan data customer.'
			});
		}
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const companyId = String(form.get('companyId') ?? '').trim().toUpperCase();

		if (!companyId) {
			return fail(400, { success: false, error: 'Kode Customer wajib disertakan untuk menghapus.' });
		}

		try {
			const res = await deleteCustomer(companyId);
			return {
				success: true,
				companyId,
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menghapus customer.'
			});
		}
	},

	saveConsigne: async ({ request }) => {
		const form = await request.formData();
		const isEdit = form.get('isEdit') === 'true';
		const oldConsigne = String(form.get('oldConsigne') ?? '').trim();
		const Consigne = String(form.get('Consigne') ?? '').trim();
		const ConsigneID = String(form.get('ConsigneID') ?? '').trim() || null;
		const targetHariRaw = form.get('TargetHari');
		const TargetHari = targetHariRaw !== null && targetHariRaw !== '' ? parseInt(String(targetHariRaw), 10) : 14;

		if (!Consigne) {
			return fail(400, { success: false, error: 'Nama / Rekanan Consignee wajib diisi.' });
		}

		try {
			if (isEdit) {
				const updated = await updateConsigne(oldConsigne, { Consigne, ConsigneID, TargetHari });
				return {
					success: true,
					isConsigneAction: true,
					message: `Data Consignee "${updated.Consigne}" (${updated.ConsigneID || '-'}) berhasil diperbarui.`
				};
			} else {
				const created = await createConsigne({ Consigne, ConsigneID, TargetHari });
				return {
					success: true,
					isConsigneAction: true,
					message: `Consignee baru "${created.Consigne}" (${created.ConsigneID || '-'}) berhasil ditambahkan ke taConsigne.`
				};
			}
		} catch (err: any) {
			return fail(400, {
				success: false,
				isConsigneAction: true,
				error: err?.message || 'Gagal menyimpan data consigne.'
			});
		}
	},

	deleteConsigne: async ({ request }) => {
		const form = await request.formData();
		const consigne = String(form.get('consigne') ?? '').trim();

		if (!consigne) {
			return fail(400, { success: false, isConsigneAction: true, error: 'Nama Consignee wajib disertakan.' });
		}

		try {
			const res = await deleteConsigne(consigne);
			return {
				success: true,
				isConsigneAction: true,
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				isConsigneAction: true,
				error: err?.message || 'Gagal menghapus consigne.'
			});
		}
	}
};
