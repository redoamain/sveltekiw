<script lang="ts">
	import { PurchaseOrderDocument } from '$lib/components';
	import { Printer, Download, ArrowLeft } from '@lucide/svelte';

	let { data } = $props();
	let header = $derived(data.header);
	let items = $derived(data.items);

	function handlePrint() {
		if (typeof window !== 'undefined') {
			window.print();
		}
	}
</script>

<svelte:head>
	<title>PO #{header.orderId} - Cetak Purchase Order</title>
</svelte:head>

<!-- Floating Print Control Bar (Hidden when printed) -->
<div class="print:hidden sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-300 p-3 shadow-sm">
	<div class="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
		<a
			href="/dashboard/input-po"
			class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 transition-all"
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

<!-- Printable Paper Container (A4 Form Factor matching printPO.pdf) -->
<div class="print-page-wrapper min-h-screen bg-slate-100 py-6 sm:py-10 print:p-0 print:m-0 print:bg-white text-black font-sans">
	<div class="print-paper-sheet max-w-[210mm] mx-auto bg-white border border-neutral-300 print:border-none shadow-md print:shadow-none p-8 sm:p-12 print:p-0">
		<PurchaseOrderDocument {header} {items} />
	</div>
</div>

<style>
	@media print {
		@page {
			size: A4 portrait;
			margin: 10mm 15mm 10mm 15mm;
		}
		:global(html),
		:global(body) {
			background: #ffffff !important;
			color: #000000 !important;
			margin: 0 !important;
			padding: 0 !important;
			width: 100% !important;
			height: auto !important;
			-webkit-print-color-adjust: exact !important;
			print-color-adjust: exact !important;
		}
		:global(.print\:hidden) {
			display: none !important;
		}
		.print-page-wrapper {
			padding: 0 !important;
			margin: 0 !important;
			background: #ffffff !important;
			min-height: 0 !important;
		}
		.print-paper-sheet {
			border: none !important;
			box-shadow: none !important;
			padding: 0 !important;
			margin: 0 !important;
			max-width: 100% !important;
			width: 100% !important;
		}
	}
</style>
