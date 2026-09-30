import type { Actions, PageServerLoad } from './$types';
import {
	getMasterSuppliersPaged,
	getSupplierById,
	getLastSupplierId,
	createSupplier,
	updateSupplier,
	deleteSupplier,
	type CreateSupplierPayload,
	type MasterSupplier
} from '$lib/server/master-supplier';
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

	let detail: MasterSupplier | null = null;
	if (id) {
		try {
			detail = await getSupplierById(id);
		} catch (err) {
			// ignore detail error
		}
	}

	const [pagedResult, idInfo] = await Promise.all([
		getMasterSuppliersPaged({
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
				stats: { total: 0, totalLokal: 0, totalImport: 0, totalIDR: 0, totalValas: 0 }
			};
		}),
		getLastSupplierId()
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
		detail,
		currentUser: locals.user?.UserName || locals.user?.username || 'OPERATOR'
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
		const Import = form.get('Import') === 'true' || form.get('Import') === 'on' || form.get('Import') === '1';
		const NonLokal = form.get('NonLokal') === 'true' || form.get('NonLokal') === 'on' || form.get('NonLokal') === '1';
		const Bank = String(form.get('Bank') ?? '').trim() || null;
		const NoRek = String(form.get('NoRek') ?? '').trim() || null;
		const NamaRek = String(form.get('NamaRek') ?? '').trim() || null;
		const NotePurchasing = String(form.get('NotePurchasing') ?? '').trim() || null;

		if (!CompanyName1) {
			return fail(400, { success: false, error: 'Nama Perusahaan / Supplier (CompanyName1) wajib diisi.' });
		}

		if (isEdit && !CompanyID) {
			return fail(400, { success: false, error: 'Kode Supplier (CompanyID) wajib diisi saat mode perbarui.' });
		}

		const payload: CreateSupplierPayload = {
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
			Import,
			NonLokal,
			Bank,
			NoRek,
			NamaRek,
			NotePurchasing
		};

		try {
			if (isEdit) {
				const updated = await updateSupplier(CompanyID, payload, username);
				return {
					success: true,
					isEdit: true,
					item: updated,
					message: `Supplier "${updated.CompanyName1}" (${updated.CompanyID}) berhasil diperbarui.`
				};
			} else {
				const created = await createSupplier(payload, username);
				return {
					success: true,
					isEdit: false,
					item: created,
					message: `Supplier baru "${created.CompanyName1}" (${created.CompanyID}) berhasil ditambahkan.`
				};
			}
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menyimpan data supplier.'
			});
		}
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const companyId = String(form.get('companyId') ?? '').trim().toUpperCase();

		if (!companyId) {
			return fail(400, { success: false, error: 'Kode Supplier wajib disertakan untuk menghapus.' });
		}

		try {
			const res = await deleteSupplier(companyId);
			return {
				success: true,
				companyId,
				message: res.message
			};
		} catch (err: any) {
			return fail(400, {
				success: false,
				error: err?.message || 'Gagal menghapus supplier.'
			});
		}
	}
};
