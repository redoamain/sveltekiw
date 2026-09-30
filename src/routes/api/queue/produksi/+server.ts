import { json, type RequestHandler } from '@sveltejs/kit';
import { addProductionJob, getProduksiJobStatus } from '$lib/server/queue';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	const jobId = url.searchParams.get('jobId');
	if (!jobId) {
		return json({ success: false, message: 'Parameter jobId wajib disertakan.' }, { status: 400 });
	}

	try {
		const status = await getProduksiJobStatus(jobId);
		if (!status) {
			return json({ success: false, message: `Pekerjaan #${jobId} tidak ditemukan.` }, { status: 404 });
		}

		return json({
			success: true,
			data: status
		});
	} catch (err: any) {
		return json(
			{ success: false, message: err?.message || 'Gagal memeriksa status pekerjaan.' },
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';

		if (body.type === 'BATCH_PRODUCTION') {
			if (!Array.isArray(body.payloads) || body.payloads.length === 0) {
				return json({ success: false, message: 'Array payloads tidak boleh kosong.' }, { status: 400 });
			}

			const job = await addProductionJob({
				type: 'BATCH_PRODUCTION',
				payloads: body.payloads,
				username
			});

			return json({
				success: true,
				jobId: job.id,
				message: `Pekerjaan produksi batch #${job.id} berhasil ditambahkan ke antrian.`
			});
		} else {
			if (!body.payload) {
				return json({ success: false, message: 'Payload transaksi produksi wajib diisi.' }, { status: 400 });
			}

			const job = await addProductionJob({
				type: 'DIRECT_PRODUCTION',
				payload: body.payload,
				username
			});

			return json({
				success: true,
				jobId: job.id,
				message: `Pekerjaan produksi #${job.id} berhasil ditambahkan ke antrian.`
			});
		}
	} catch (err: any) {
		return json(
			{ success: false, message: err?.message || 'Gagal menambahkan pekerjaan produksi ke antrian.' },
			{ status: 500 }
		);
	}
};
