import { json, type RequestHandler } from '@sveltejs/kit';
import { parseSpkExcelImport } from '$lib/server/input-spk';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			return json({ success: false, message: 'File Excel wajib diunggah.' }, { status: 400 });
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const parsed = await parseSpkExcelImport(buffer);

		return json({
			success: true,
			data: parsed
		});
	} catch (err: any) {
		return json(
			{
				success: false,
				message: err?.message || 'Gagal memproses file Excel import SPK.'
			},
			{ status: 400 }
		);
	}
};
