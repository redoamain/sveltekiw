import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	getSpkInitialData,
	getSpkTransaction,
	createSpkTransaction,
	updateSpkTransaction,
	deleteSpkTransaction,
	type CreateSpkPayload
} from '$lib/server/input-spk';

export const load: PageServerLoad = async ({ url, locals }) => {
	const initData = await getSpkInitialData();
	const editId = url.searchParams.get('id') || url.searchParams.get('edit');

	let existingTransaction: Awaited<ReturnType<typeof getSpkTransaction>> = null;
	if (editId) {
		existingTransaction = await getSpkTransaction(editId);
	}

	return {
		...initData,
		existingTransaction,
		currentUser: locals.user?.UserName || locals.user?.username || 'OPERATOR'
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';
		const form = await request.formData();
		const payloadRaw = form.get('payload') as string;

		if (!payloadRaw) {
			return fail(400, { success: false, message: 'Payload data tidak ditemukan.' });
		}

		let payload: CreateSpkPayload;
		try {
			payload = JSON.parse(payloadRaw);
		} catch {
			return fail(400, { success: false, message: 'Format data JSON tidak valid.' });
		}

		const isEdit = form.get('isEdit') === 'true';

		try {
			if (isEdit) {
				const res = await updateSpkTransaction(payload, username);
				return { ...res, isEdit: true };
			} else {
				const res = await createSpkTransaction(payload, username);
				return { ...res, isEdit: false };
			}
		} catch (err: any) {
			return fail(400, { success: false, message: err?.message || 'Gagal menyimpan transaksi SPK.' });
		}
	},

	delete: async ({ request, locals }) => {
		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';
		const form = await request.formData();
		const orderId = form.get('orderId') as string;

		if (!orderId) {
			return fail(400, { success: false, message: 'Nomor OrderID SPK wajib diisi.' });
		}

		try {
			const res = await deleteSpkTransaction(orderId, username);
			return { ...res };
		} catch (err: any) {
			return fail(400, { success: false, message: err?.message || 'Gagal menghapus transaksi SPK.' });
		}
	}
};
