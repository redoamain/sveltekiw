import { json, type RequestHandler } from '@sveltejs/kit';
import { addBukuBesarExportJob, getBukuBesarJobStatus } from '$lib/server/queue';
import type { BukuBesarParams } from '$lib/server/buku-besar';

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
		const status = await getBukuBesarJobStatus(jobId);
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
			const fileName = status.result.fileName || `rpbbpembantul_${jobId}.xlsx`;

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
							fileName: status.result.fileName,
							totalAccounts: status.result.totalAccounts,
							totalTransactions: status.result.totalTransactions,
							totalSaldoAkhirRp: status.result.totalSaldoAkhirRp,
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
		const tgl1 = body.tgl1?.trim() || new Date().toISOString().slice(0, 8) + '01';
		const tgl2 = body.tgl2?.trim() || new Date().toISOString().slice(0, 10);
		const acc1 = body.acc1?.trim() || '1101';
		const acc2 = body.acc2?.trim() || '1101.99';
		const curr = body.curr?.trim() || 'IDR';
		const ju = Number(body.ju) || 0;
		const lawantransaksi = body.lawantransaksi !== undefined && body.lawantransaksi !== null ? Number(body.lawantransaksi) : 1;
		const hideEmpty = body.hideEmpty === true || body.hideEmpty === '1' || body.hideEmpty === 'true';
		const username = (locals.user?.UserName as string) || (locals.user?.username as string) || 'OPERATOR';

		const params: BukuBesarParams = {
			tgl1,
			tgl2,
			acc1,
			acc2,
			curr,
			ju,
			lawantransaksi,
			hideEmpty
		};

		const job = await addBukuBesarExportJob({
			params,
			username
		});

		return json({
			success: true,
			jobId: job.id,
			message: `Pekerjaan export Buku Besar #${job.id} berhasil didaftarkan ke antrian BullMQ.`
		});
	} catch (err: any) {
		return json(
			{ success: false, message: err?.message || 'Gagal menambahkan pekerjaan ke antrian BullMQ.' },
			{ status: 500 }
		);
	}
};
