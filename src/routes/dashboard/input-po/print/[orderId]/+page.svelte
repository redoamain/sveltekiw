<script lang="ts">
	import { onMount } from 'svelte';
	import { KopSuratCitiPlumb } from '$lib/components';
	import { Printer, Download, ArrowLeft, CheckCircle2, ShieldCheck, AlertCircle } from '@lucide/svelte';

	let { data } = $props();
	let header = $derived(data.header);
	let items = $derived(data.items);
	let companyInfo = $derived(data.companyInfo);

	function handlePrint() {
		if (typeof window !== 'undefined') {
			window.print();
		}
	}

	function formatRupiah(val: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: header.curr || 'IDR',
			maximumFractionDigits: 2
		}).format(val);
	}
</script>

<svelte:head>
	<title>PO #{header.orderId} - PT. CITI PLUMB (Cetak / PDF)</title>
</svelte:head>

<!-- Floating Print Control Bar (Hidden when printed) -->
<div class="print:hidden sticky top-0 z-50 bg-background/95 backdrop-blur border-b-2 border-border p-3 shadow-md">
	<div class="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
		<a
			href="/dashboard/input-po"
			class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all"
		>
			<ArrowLeft class="size-4" />
			<span>Kembali ke Input PO</span>
		</a>

		<div class="flex items-center gap-2">
			<a
				href="/api/purchase-order/{header.orderId}/export/excel"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-emerald-500 text-white text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-emerald-600 active:translate-x-0.5 active:translate-y-0.5 transition-all"
			>
				<Download class="size-4" />
				<span>Unduh Excel (.xlsx)</span>
			</a>

			<button
				type="button"
				onclick={handlePrint}
				class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border-2 border-black bg-primary text-white text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all cursor-pointer"
			>
				<Printer class="size-4" />
				<span>Cetak / Simpan PDF</span>
			</button>
		</div>
	</div>
</div>

<!-- Printable Paper Container (A4 Form Factor) -->
<div class="min-h-screen bg-slate-100 py-6 sm:py-10 print:p-0 print:m-0 print:bg-white text-neutral-900 font-sans">
	<div class="max-w-4xl mx-auto bg-white border border-neutral-300 print:border-none shadow-lg print:shadow-none p-6 sm:p-10 rounded-sm">
		<!-- 1. Kop Surat PT. CITI PLUMB (Resmi dengan Logo dan Alamat) -->
		<KopSuratCitiPlumb
			documentTitle="PURCHASE ORDER (SURAT PESANAN PEMBELIAN)"
			documentNumber={header.orderId}
			documentDate={header.orderDate}
		/>

		<!-- Status Watermark (If Canceled) -->
		{#if header.canceled}
			<div class="my-3 p-3 bg-red-100 border-2 border-red-600 text-red-900 rounded font-black text-center text-sm uppercase tracking-widest">
				*** DOKUMEN INI TELAH DIBATALKAN (CANCELED) : {header.cancelReason || 'Tidak ada alasan'} ***
			</div>
		{/if}

		<!-- 2. Grid Informasi PO & Pemasok -->
		<div class="grid grid-cols-2 gap-4 my-4 text-xs">
			<!-- Kolom Kiri: Pemasok (Vendor) -->
			<div class="border-2 border-black p-3.5 rounded bg-neutral-50/50">
				<div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-300">
					<span class="font-mono font-black uppercase text-[11px] text-neutral-600">KEPADA / VENDOR:</span>
					<span class="font-mono font-bold text-[10px] text-neutral-500">KODE: {header.companyId}</span>
				</div>
				<h3 class="font-black text-sm text-black uppercase mb-1">
					{header.supplierName}
				</h3>
				<p class="font-medium text-neutral-700 leading-tight">
					{header.supplierAddress || 'Alamat tidak tercantum'}
				</p>
				<p class="font-medium text-neutral-700 leading-tight mt-0.5">
					{header.supplierCity ? `Kota: ${header.supplierCity}` : ''}
				</p>
				<div class="mt-2 pt-2 border-t border-dashed border-neutral-300 text-[11px] space-y-0.5">
					<div><span class="font-bold text-neutral-600">Telepon:</span> {header.supplierPhone || '-'}</div>
					<div><span class="font-bold text-neutral-600">NPWP / Tax ID:</span> {header.supplierTaxId || '-'}</div>
					{#if header.supplierEmail}
						<div><span class="font-bold text-neutral-600">Email:</span> {header.supplierEmail}</div>
					{/if}
				</div>
			</div>

			<!-- Kolom Kanan: Pengiriman & Dokumen -->
			<div class="border-2 border-black p-3.5 rounded bg-neutral-50/50 flex flex-col justify-between">
				<div>
					<div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-300">
						<span class="font-mono font-black uppercase text-[11px] text-neutral-600">RINCIAN PESANAN:</span>
						<span class="px-1.5 py-0.2 bg-black text-white text-[10px] font-mono font-black rounded">
							{header.tipeDok}
						</span>
					</div>
					<table class="w-full text-[11px]">
						<tbody>
							<tr>
								<td class="font-bold text-neutral-600 py-0.5 w-32">Nomor PO</td>
								<td class="font-mono font-black text-black">: #{header.orderId}</td>
							</tr>
							<tr>
								<td class="font-bold text-neutral-600 py-0.5">Tanggal PO</td>
								<td class="font-semibold text-black">: {header.orderDate}</td>
							</tr>
							<tr>
								<td class="font-bold text-neutral-600 py-0.5">Jatuh Tempo</td>
								<td class="font-semibold text-black">: {header.dueDate || '-'}</td>
							</tr>
							<tr>
								<td class="font-bold text-neutral-600 py-0.5">Estimasi Kirim (ETA)</td>
								<td class="font-semibold text-black">: {header.deliveryDate || '-'}</td>
							</tr>
							<tr>
								<td class="font-bold text-neutral-600 py-0.5">Mata Uang / Kurs</td>
								<td class="font-semibold text-black">: {header.curr} (Kurs: {header.rate})</td>
							</tr>
						</tbody>
					</table>
				</div>

				<div class="mt-2 pt-2 border-t border-neutral-300 text-[10.5px]">
					<span class="font-bold text-neutral-600 block">Tujuan Pengiriman:</span>
					<span class="font-semibold text-neutral-800 leading-tight block">
						{companyInfo.deliveryAddress}
					</span>
				</div>
			</div>
		</div>

		<!-- 3. Tabel Item Barang -->
		<div class="my-4 overflow-x-auto">
			<table class="w-full border-collapse border-2 border-black text-xs">
				<thead>
					<tr class="bg-neutral-100 text-black border-b-2 border-black font-mono uppercase text-[11px]">
						<th class="border-r border-black p-2 text-center w-10">No</th>
						<th class="border-r border-black p-2 text-left w-36">Kode Barang</th>
						<th class="border-r border-black p-2 text-left">Nama Barang & Spesifikasi</th>
						<th class="border-r border-black p-2 text-right w-20">Kuantitas</th>
						<th class="border-r border-black p-2 text-center w-16">Satuan</th>
						<th class="border-r border-black p-2 text-right w-28">Harga Satuan</th>
						<th class="p-2 text-right w-32">Total</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item, index}
						<tr class="border-b border-neutral-300 hover:bg-neutral-50/50">
							<td class="border-r border-black p-2 text-center font-mono font-bold text-neutral-600">
								{index + 1}
							</td>
							<td class="border-r border-black p-2 font-mono font-black text-black">
								{item.itemId}
							</td>
							<td class="border-r border-black p-2 font-semibold text-neutral-900">
								<div>{item.itemName}</div>
								{#if item.ogReason || item.bagMarking}
									<div class="text-[10px] text-neutral-500 font-mono mt-0.5">
										{item.ogReason || item.bagMarking}
									</div>
								{/if}
							</td>
							<td class="border-r border-black p-2 text-right font-mono font-bold text-black">
								{item.kgs.toLocaleString('id-ID')}
							</td>
							<td class="border-r border-black p-2 text-center font-mono font-semibold text-neutral-700">
								{item.satuan}
							</td>
							<td class="border-r border-black p-2 text-right font-mono text-neutral-800">
								{formatRupiah(item.price)}
							</td>
							<td class="p-2 text-right font-mono font-black text-black">
								{formatRupiah(item.total || 0)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- 4. Rincian Total & Terbilang -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 text-xs">
			<!-- Kiri: Catatan & Terbilang -->
			<div class="border-2 border-black p-3 rounded bg-neutral-50/60 flex flex-col justify-between">
				<div>
					<span class="font-mono font-black text-[10px] uppercase text-neutral-600 block mb-1">
						CATATAN / INSTRUKSI KHUSUS:
					</span>
					<p class="font-medium text-neutral-800 italic leading-relaxed text-xs">
						{header.remark || 'Tidak ada catatan tambahan.'}
					</p>
				</div>
				<div class="mt-3 pt-2 border-t border-neutral-300">
					<span class="font-mono font-black text-[10px] uppercase text-neutral-600 block">
						TERBILANG:
					</span>
					<p class="font-bold text-black font-display text-xs capitalize mt-0.5 leading-tight">
						# {header.terbilang} #
					</p>
				</div>
			</div>

			<!-- Kanan: Summary Angka -->
			<div class="border-2 border-black p-3.5 rounded bg-neutral-50/60 space-y-1.5 font-mono">
				<div class="flex items-center justify-between text-xs">
					<span class="font-bold text-neutral-600">Subtotal (DPP):</span>
					<span class="font-black text-black">{formatRupiah(header.dpp)}</span>
				</div>
				<div class="flex items-center justify-between text-xs">
					<span class="font-bold text-neutral-600">PPN ({header.tax}%):</span>
					<span class="font-black text-black">{formatRupiah(header.taxAmount)}</span>
				</div>
				<div class="border-t-2 border-black pt-2 flex items-center justify-between text-sm">
					<span class="font-display font-black uppercase text-black">Total Akhir (PO):</span>
					<span class="font-black text-base text-black">{formatRupiah(header.total)}</span>
				</div>
			</div>
		</div>

		<!-- 5. Syarat & Ketentuan PO -->
		<div class="border border-neutral-300 p-2.5 rounded text-[10px] text-neutral-600 leading-tight mb-6">
			<span class="font-bold text-black uppercase block mb-0.5">Syarat & Ketentuan Pembelian:</span>
			<ol class="list-decimal pl-4 space-y-0.5">
				<li>Nomor Purchase Order wajib dicantumkan pada Surat Jalan (Delivery Order) dan Faktur Tagihan.</li>
				<li>Barang harus dikirimkan sesuai dengan spesifikasi teknis, jumlah, dan toleransi yang disepakati.</li>
				<li>Pemeriksaan kualitas (QC) akan dilakukan saat barang tiba di gudang PT. CITI PLUMB.</li>
			</ol>
		</div>

		<!-- 6. Tanda Tangan Resmi (3 Pihak) -->
		<div class="grid grid-cols-3 gap-4 text-center text-xs mt-6 pt-4 border-t-2 border-black">
			<!-- Pihak 1: Dibuat -->
			<div class="flex flex-col justify-between h-28">
				<div>
					<span class="font-bold text-neutral-600 uppercase text-[10px]">Dibuat Oleh:</span>
					<div class="font-black text-black text-xs mt-0.5">BAGIAN PURCHASING</div>
				</div>
				<div>
					<div class="font-mono font-bold text-black">( ______________________ )</div>
					<div class="text-[10px] text-neutral-500 mt-0.5">Tgl: {header.orderDate}</div>
				</div>
			</div>

			<!-- Pihak 2: Disetujui -->
			<div class="flex flex-col justify-between h-28">
				<div>
					<span class="font-bold text-neutral-600 uppercase text-[10px]">Disetujui Oleh:</span>
					<div class="font-black text-black text-xs mt-0.5">DIREKTUR / MANAJER</div>
				</div>
				<div>
					<div class="font-mono font-bold text-black">( ______________________ )</div>
					<div class="text-[10px] text-neutral-500 mt-0.5">Tgl: ___________________</div>
				</div>
			</div>

			<!-- Pihak 3: Pemasok -->
			<div class="flex flex-col justify-between h-28">
				<div>
					<span class="font-bold text-neutral-600 uppercase text-[10px]">Diterima & Disetujui:</span>
					<div class="font-black text-black text-xs mt-0.5">{header.supplierName.slice(0, 24)}</div>
				</div>
				<div>
					<div class="font-mono font-bold text-black">( ______________________ )</div>
					<div class="text-[10px] text-neutral-500 mt-0.5">Tgl: ___________________</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	@media print {
		@page {
			size: A4 portrait;
			margin: 10mm;
		}
		:global(body) {
			background: white !important;
			color: black !important;
		}
	}
</style>
