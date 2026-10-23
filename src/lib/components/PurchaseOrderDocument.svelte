<script lang="ts">
	import type { PurchaseOrderHeader, PurchaseOrderItemDetail } from '$lib/types/purchase-order';

	interface Props {
		header: PurchaseOrderHeader;
		items: PurchaseOrderItemDetail[];
		class?: string;
	}

	let { header, items, class: className = '' }: Props = $props();

	function formatPoNumber(orderId: string, orderType: string = 'P'): string {
		if (!orderId) return '';
		if (orderId.includes('.')) return orderId;
		const prefix = orderType || 'P';
		if (orderId.length === 7) {
			return `${prefix}.${orderId.slice(0, 2)}.${orderId.slice(2)}`;
		}
		return `${prefix}.${orderId}`;
	}

	function formatOrderDate(dateStr: string): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return dateStr;
		const months = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December'
		];
		return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
	}

	function formatEta(dateStr: string | null | undefined): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return dateStr;
		const dd = String(d.getDate()).padStart(2, '0');
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const yy = String(d.getFullYear()).slice(-2);
		return `${dd}/${mm}/${yy}`;
	}

	function formatNumber(val: number | null | undefined, decimals: number = 2): string {
		if (val === null || val === undefined || isNaN(Number(val))) return '0.00';
		return Number(val).toLocaleString('en-US', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
	}

	function formatPrice(val: number | null | undefined): string {
		if (val === null || val === undefined || isNaN(Number(val))) return '0.00';
		const num = Number(val);
		const hasMoreDecimals = (num * 100) % 1 !== 0;
		const decimals = hasMoreDecimals ? 4 : 2;
		return num.toLocaleString('en-US', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
	}

	function generateDocStamp(hd: PurchaseOrderHeader): string {
		const d = hd.orderDate ? new Date(hd.orderDate) : new Date();
		const yy = String(d.getFullYear()).slice(-2);
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		const cleanId = (hd.orderId || '').replace(/[^a-zA-Z0-9]/g, '');
		return `PON${yy}${mm}${dd}:${cleanId}C:1.re`;
	}

	function cleanItemName(name: string | null | undefined, itemId: string): string {
		const str = (name || '').trim();
		if (/\?{2,}/.test(str)) {
			const withoutQ = str.replace(/\?+/g, '').trim();
			return withoutQ || itemId;
		}
		return str || itemId;
	}

	function formatSpecDisplay(
		spec: string | null | undefined,
		itemName2: string | null | undefined
	): { specText: string; chineseText?: string } {
		const rawSpec = (spec || '').trim();
		const cleanSpecStr = rawSpec === 'nan' || rawSpec === 'null' ? '' : rawSpec;
		const rawChinese = (itemName2 || '').trim();
		const hasChinese = /[\u4e00-\u9fa5]/.test(rawChinese);
		const specHasQuestionMarks = /\?{2,}/.test(cleanSpecStr) || /^\s*\?+\s*$/.test(cleanSpecStr);

		// Jika Spec di database rusak (berisi tanda tanya ?????):
		if (specHasQuestionMarks) {
			const dimensionPart = cleanSpecStr.replace(/\?+/g, '').trim();
			if (hasChinese) {
				return {
					specText: dimensionPart || rawChinese,
					chineseText: dimensionPart ? rawChinese : undefined
				};
			}
			return { specText: dimensionPart };
		}

		// Jika ada teks mandarin di itemName2, tampilkan di kolom Spec:
		if (hasChinese) {
			if (cleanSpecStr && cleanSpecStr !== rawChinese) {
				return {
					specText: cleanSpecStr,
					chineseText: rawChinese
				};
			}
			return { specText: rawChinese };
		}

		return { specText: cleanSpecStr };
	}
</script>

<div class="po-document w-full bg-white text-black font-sans {className}">
	<!-- 1. Header (Logo, Document Title, Doc Number) -->
	<div class="flex items-center justify-between pb-3">
		<div class="w-1/3 flex items-center">
			<img src="/logo-po.png" alt="PT. CITI PLUMB" class="h-7 w-auto object-contain" />
		</div>
		<div class="w-1/3 text-center">
			<h1 class="text-lg sm:text-xl font-bold tracking-wide text-black uppercase">PURCHASE ORDER</h1>
		</div>
		<div class="w-1/3 text-right">
			<span class="text-xs sm:text-sm font-bold text-black">DOC : {header.tipefaktur || '070'}</span>
		</div>
	</div>

	<!-- Status Banner if Canceled -->
	{#if header.canceled}
		<div class="my-2 p-2 bg-red-100 border border-red-600 text-red-800 font-bold text-center text-xs uppercase tracking-wider">
			*** DOKUMEN INI TELAH DIBATALKAN (CANCELED) : {header.cancelReason || 'Tidak ada alasan'} ***
		</div>
	{/if}

	<!-- 2. PO Metadata (2-Column Layout) -->
	<div class="grid grid-cols-2 gap-6 my-3 text-[11px] leading-tight">
		<!-- Left Column: Contract, Currency, REF SPP, Keterangan -->
		<div>
			<table class="w-full border-collapse">
				<tbody>
					<tr>
						<td class="w-24 py-0.5 text-left align-top whitespace-nowrap">No. Contract</td>
						<td class="w-3 py-0.5 text-center align-top">:</td>
						<td class="py-0.5 text-left align-top font-normal">{header.contractNo || ''}</td>
					</tr>
					<tr>
						<td class="py-0.5 text-left align-top whitespace-nowrap">Mata uang</td>
						<td class="py-0.5 text-center align-top">:</td>
						<td class="py-0.5 text-left align-top font-normal">{header.curr || 'USD'}</td>
					</tr>
					<tr>
						<td class="py-0.5 text-left align-top whitespace-nowrap">REF SPP</td>
						<td class="py-0.5 text-center align-top">:</td>
						<td class="py-0.5 text-left align-top font-normal">{header.refSpp || ''}</td>
					</tr>
					<tr>
						<td class="py-0.5 text-left align-top whitespace-nowrap">Keterangan</td>
						<td class="py-0.5 text-center align-top">:</td>
						<td class="py-0.5 text-left align-top font-normal whitespace-pre-line">{header.remark || ''}</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Right Column: No, Tanggal, Kepada Yth & Supplier Details -->
		<div>
			<table class="w-full border-collapse">
				<tbody>
					<tr>
						<td class="w-24 py-0.5 text-left align-top whitespace-nowrap">No.</td>
						<td class="w-3 py-0.5 text-center align-top">:</td>
						<td class="py-0.5 text-left align-top font-bold">{formatPoNumber(header.orderId, header.orderType)}</td>
					</tr>
					<tr>
						<td class="py-0.5 text-left align-top whitespace-nowrap">Tanggal</td>
						<td class="py-0.5 text-center align-top">:</td>
						<td class="py-0.5 text-left align-top font-normal">{formatOrderDate(header.orderDate)}</td>
					</tr>
					<tr>
						<td class="py-0.5 text-left align-top whitespace-nowrap" colspan="3">
							<div class="mt-0.5">Kepada Yth :</div>
							<div class="font-bold uppercase text-black mt-0.5 leading-tight">{header.supplierName}</div>
							{#if header.supplierAddress}
								<div class="font-normal text-black leading-tight mt-0.5 whitespace-pre-line">
									{header.supplierAddress}
								</div>
							{/if}
							{#if header.supplierCity}
								<div class="font-normal text-black leading-tight mt-0.5">
									{header.supplierCity}
								</div>
							{/if}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>

	<!-- 3. Items Table -->
	<div class="w-full mt-4">
		<table class="w-full border-collapse text-[11px] leading-normal">
			<thead>
				<tr class="border-t border-b border-black font-bold text-black">
					<th class="py-1.5 px-1 text-left font-bold w-[13%]">Kode</th>
					<th class="py-1.5 px-1 text-left font-bold w-[23%]">Uraian</th>
					<th class="py-1.5 px-1 text-left font-bold w-[12%]">Spec</th>
					<th class="py-1.5 px-1 text-right font-bold w-[11%]">Qty</th>
					<th class="py-1.5 px-1 text-center font-bold w-[7%]">Satuan</th>
					<th class="py-1.5 px-1 text-right font-bold w-[11%]">Harga/unit</th>
					<th class="py-1.5 px-1 text-right font-bold w-[11%]">Jumlah</th>
					<th class="py-1.5 px-1 text-center font-bold w-[6%]">ETA</th>
					<th class="py-1.5 px-1 text-left font-bold w-[6%]">Keterangan</th>
				</tr>
			</thead>
			<tbody>
				{#each items as item}
					{@const specInfo = formatSpecDisplay(item.spec, item.itemName2)}
					<tr class="align-top">
						<td class="py-1.5 px-1 text-left">{item.itemId}</td>
						<td class="py-1.5 px-1 text-left font-normal">
							<div>{cleanItemName(item.itemName, item.itemId)}</div>
						</td>
						<td class="py-1.5 px-1 text-left font-normal">
							<div>{specInfo.specText}</div>
							{#if specInfo.chineseText}
								<div class="text-[10px] text-neutral-800 leading-tight mt-0.5 font-chinese">
									{specInfo.chineseText}
								</div>
							{/if}
						</td>
						<td class="py-1.5 px-1 text-right font-normal">{formatNumber(item.kgs)}</td>
						<td class="py-1.5 px-1 text-center font-normal">{item.satuan}</td>
						<td class="py-1.5 px-1 text-right font-normal">{formatPrice(item.price)}</td>
						<td class="py-1.5 px-1 text-right font-normal">{formatNumber(item.total || 0)}</td>
						<td class="py-1.5 px-1 text-center font-normal">{formatEta(item.maxEta)}</td>
						<td class="py-1.5 px-1 text-left font-normal">{item.ogReason || item.bagMarking || ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- 4. Summary Box (Terbilang on Left, Totals on Right) -->
	<div class="border-t border-b border-black grid grid-cols-12 text-[11px] mt-1">
		<!-- Left: Terbilang -->
		<div class="col-span-7 py-2 pr-3 border-r border-black flex flex-col justify-start">
			<div class="leading-tight text-black">
				<span class="font-normal">Terbilang : </span>
				<span class="font-normal uppercase">{header.terbilang}</span>
			</div>
		</div>

		<!-- Right: Totals -->
		<div class="col-span-5 py-1.5 pl-3">
			<table class="w-full border-collapse text-[11px] text-black">
				<tbody>
					<tr>
						<td class="py-0.5 text-left font-normal w-24">Sub total</td>
						<td class="py-0.5 text-center w-3">:</td>
						<td class="py-0.5 text-right font-normal">{formatNumber(header.dpp)}</td>
					</tr>
					<tr>
						<td class="py-0.5 text-left font-normal">PPn</td>
						<td class="py-0.5 text-center">:</td>
						<td class="py-0.5 text-right font-normal">{formatNumber(header.taxAmount)}</td>
					</tr>
					<tr>
						<td class="py-0.5 text-left font-normal">Jumlah</td>
						<td class="py-0.5 text-center">:</td>
						<td class="py-0.5 text-right font-normal">{formatNumber(header.dpp + header.taxAmount)}</td>
					</tr>
					<tr>
						<td class="py-0.5 text-left font-normal">Add. Cost</td>
						<td class="py-0.5 text-center">:</td>
						<td class="py-0.5 text-right font-normal">{formatNumber(header.addCost || 0)}</td>
					</tr>
					<tr class="font-bold">
						<td class="py-0.5 text-left font-bold">Grand Total</td>
						<td class="py-0.5 text-center font-bold">:</td>
						<td class="py-0.5 text-right font-bold">{formatNumber(header.total)}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>

	<!-- 5. Footer: Catatan & Tanda Tangan -->
	<div class="grid grid-cols-12 gap-4 mt-3 text-[10px] leading-tight">
		<!-- Left: Catatan -->
		<div class="col-span-8 flex flex-col justify-between">
			<div class="space-y-0.5 text-black leading-snug">
				<div class="font-normal">Catatan :</div>
				<div>- Nomer PO harus dicantumkan pada SJ/DO maupun invoice</div>
				<div>- NPWP PT CITIPLUMB : 03.001.823.8-618.000</div>
				<div class="pl-2">Jalan Raya Plosowahyu RT.4/RW.1 Kec.Lamongan Kab Lamongan JAWA TIMUR</div>
				<div>- Untuk Pengiriman wajib melampirkan Invoice, Faktur Pajak, COA/MSDS (Jika ada)</div>
				<div>- Barang yang tidak sesuai sample akan diretur</div>
			</div>
			<div class="mt-4 font-mono text-[9px] text-neutral-800">
				{generateDocStamp(header)}
			</div>
		</div>

		<!-- Right: Hormat kami & Underline for signature -->
		<div class="col-span-4 flex flex-col items-center justify-between min-h-[90px] text-xs text-black">
			<div>Hormat kami,</div>
			<div class="mt-14 font-mono">( _________________ )</div>
		</div>
	</div>

	<!-- 6. Page Number -->
	<div class="text-right text-[10px] text-black mt-2">
		Page 1 of 1
	</div>
</div>

<style>
	.po-document {
		font-family: Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimSun", "Noto Sans SC", sans-serif;
	}
	.font-chinese {
		font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimSun", "Noto Sans SC", Arial, sans-serif;
	}
	@media print {
		.po-document {
			width: 100% !important;
			color: #000000 !important;
		}
	}
</style>
