import { json, type RequestHandler } from '@sveltejs/kit';
import { addImportMutasiJob, getMutasiJobStatus } from '$lib/server/queue';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	const jobId = url.searchParams.get('jobId');
	if (!jobId) {
		return json({ success: false, message: 'Parameter jobId wajib disertakan.' }, { status: 400 });
	}

	try {
		const status = await getMutasiJobStatus(jobId);
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
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const autoCommit = formData.get('autoCommit') === 'true';

		if (!file) {
			return json({ success: false, message: 'File Excel wajib diunggah.' }, { status: 400 });
		}

		const arrayBuffer = await file.arrayBuffer();
		const fileBase64 = Buffer.from(arrayBuffer).toString('base64');
		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';

		const job = await addImportMutasiJob({
			fileBase64,
			fileName: file.name,
			username,
			autoCommit
		});

		return json({
			success: true,
			jobId: job.id,
			message: `Pekerjaan import #${job.id} berhasil ditambahkan ke antrian BullMQ.`
		});
	} catch (err: any) {
		return json(
			{ success: false, message: err?.message || 'Gagal menambahkan pekerjaan ke antrian.' },
			{ status: 500 }
		);
	}
};
