import { json, type RequestHandler } from '@sveltejs/kit';
import { addHPPExportJob, getHPPJobStatus } from '$lib/server/queue';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	const jobId = url.searchParams.get('jobId');
	if (!jobId) {
		return json({ success: false, message: 'Parameter jobId wajib disertakan.' }, { status: 400 });
	}

	const isDownload = url.searchParams.get('download') === 'true';

	try {
		const status = await getHPPJobStatus(jobId);
		if (!status) {
			return json({ success: false, message: `Pekerjaan #${jobId} tidak ditemukan.` }, { status: 404 });
		}

		// Jika request ingin mendownload berkas Excel yang sudah selesai
		if (isDownload) {
			if (status.state !== 'completed' || !status.result?.fileBase64) {
				return json(
					{
						success: false,
						message: 'Berkas belum selesai diproses atau gagal di-generate.',
						state: status.state
					},
					{ status: 400 }
				);
			}

			const buffer = Buffer.from(status.result.fileBase64, 'base64');
			const fileName = status.result.fileName || `Laporan_HPP_${jobId}.xlsx`;

			return new Response(new Uint8Array(buffer), {
				headers: {
					'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					'Content-Disposition': `attachment; filename="${fileName}"`,
					'Cache-Control': 'no-store'
				}
			});
		}

		// Kembalikan status job
		return json({
			success: true,
			data: {
				id: status.id,
				name: status.name,
				state: status.state,
				progress: status.progress,
				result: status.result
					? {
							success: status.result.success,
							reportType: status.result.reportType,
							fileName: status.result.fileName,
							totalRows: status.result.totalRows,
							grandTotal: status.result.grandTotal,
							message: status.result.message
						}
					: null,
				failedReason: status.failedReason,
				timestamp: status.timestamp,
				processedOn: status.processedOn,
				finishedOn: status.finishedOn
			}
		});
	} catch (err: any) {
		return json(
			{ success: false, message: err?.message || 'Gagal memeriksa status pekerjaan antrian.' },
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const now = new Date();
		const year = String(body.year || now.getFullYear());
		const month = String(body.month || now.getMonth() + 1).padStart(2, '0');
		const tgl1 = body.tgl1 ? String(body.tgl1).trim() : undefined;
		const tgl2 = body.tgl2 ? String(body.tgl2).trim() : undefined;
		const opr = Number(body.opr) || 0;
		const reportType = (body.reportType || 'rekap') as 'rekap' | 'cogm' | 'kartu-stock' | 'mutasi-stock' | 'ytd' | 'harga' | 'kalkulasi' | 'all';
		const item = body.item ? String(body.item).trim() : undefined;
		const hideEmpty = body.hideEmpty !== false;
		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';

		const job = await addHPPExportJob({
			reportType,
			year,
			month,
			tgl1,
			tgl2,
			opr,
			item,
			hideEmpty,
			username
		});

		return json({
			success: true,
			jobId: job.id,
			message: `Pekerjaan export HPP (${reportType.toUpperCase()}) #${job.id} berhasil ditambahkan ke antrian BullMQ.`
		});
	} catch (err: any) {
		return json(
			{ success: false, message: err?.message || 'Gagal menambahkan pekerjaan ke antrian BullMQ.' },
			{ status: 500 }
		);
	}
};
