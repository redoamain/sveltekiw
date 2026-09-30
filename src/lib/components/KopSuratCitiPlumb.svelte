<script lang="ts">
	interface Props {
		documentTitle?: string;
		documentNumber?: string;
		documentDate?: string;
		class?: string;
		compact?: boolean;
	}

	let {
		documentTitle = 'PURCHASE ORDER (SURAT PESANAN PEMBELIAN)',
		documentNumber,
		documentDate,
		class: className = '',
		compact = false
	}: Props = $props();
</script>

<div class="w-full text-foreground {className}">
	<!-- Kop Surat Header (Logo & Company Info) -->
	<div class="flex items-center justify-between gap-4 pb-3">
		<!-- Left: Logo & Company Identity -->
		<div class="flex items-center gap-3.5">
			<!-- Vector SVG Emblem -->
			<div class="size-16 sm:size-20 shrink-0 bg-white border-2 border-black rounded-lg p-1.5 shadow-[2px_2px_0px_0px_#000] flex items-center justify-center">
				<img
					src="/logo-citiplumb.svg"
					alt="PT. CITI PLUMB Logo"
					class="w-full h-auto object-contain"
				/>
			</div>

			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-xl sm:text-2xl font-black font-display tracking-tight text-black leading-none">
						PT. CITI PLUMB
					</h1>
					<span class="px-1.5 py-0.5 text-[9px] font-mono font-black uppercase bg-black text-white rounded">
						MANUFACTURER
					</span>
				</div>
				<p class="text-xs font-extrabold text-sky-800 uppercase tracking-wide mt-1">
					Sanitary Ware, Faucets & Plumbing Accessories
				</p>
				<p class="text-[11px] font-semibold text-neutral-700 leading-tight mt-0.5">
					Jl. Raya Plosowahyu, Desa Plosowahyu, Kec. Lamongan, Kab. Lamongan, Jawa Timur 62218
				</p>
				<p class="text-[10px] font-mono font-bold text-neutral-600 mt-0.5">
					Telp: (0322) 8802014, (0322) 3326577 &bull; Email: sales@citiplumb.id / info@citiplumb.id
				</p>
			</div>
		</div>

		<!-- Right: Quick Metadata (Optional in Kop) -->
		{#if documentNumber}
			<div class="hidden sm:flex flex-col items-end text-right">
				<span class="px-2 py-0.5 text-[10px] font-mono font-black bg-amber-300 text-black border border-black rounded shadow-[1px_1px_0px_0px_#000]">
					NO. DOKUMEN
				</span>
				<span class="text-base font-black font-mono mt-1 text-black tracking-wider">
					#{documentNumber}
				</span>
				{#if documentDate}
					<span class="text-[10px] font-mono text-neutral-600 mt-0.5">
						Tgl: {documentDate}
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Official Double Divider Line (Garis Kop Surat Resmi) -->
	<div class="border-b-[3px] border-black pb-0.5 mb-3">
		<div class="border-b border-black"></div>
	</div>

	<!-- Document Title Banner -->
	{#if documentTitle}
		<div class="text-center my-2">
			<h2 class="text-base sm:text-lg font-black font-display tracking-wide uppercase text-black inline-block px-4 py-1 border-2 border-black bg-amber-50 shadow-[2px_2px_0px_0px_#000] rounded">
				{documentTitle}
			</h2>
		</div>
	{/if}
</div>
