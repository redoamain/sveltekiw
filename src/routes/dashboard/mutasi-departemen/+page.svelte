<script lang="ts">
	import { PageHeader, Badge, Button } from '$lib/components';
	import {
		FileSpreadsheet,
		ExternalLink,
		Download,
		RotateCw,
		Maximize2,
		Minimize2,
		ShieldCheck,
		Layers,
		CheckCircle2,
		Sparkles
	} from '@lucide/svelte';

	const KIW_SHEET_HOST = '192.168.1.215';
	const KIW_SHEET_URL = 'https://kws.citiplumb.id';
	const gristUrl = `${KIW_SHEET_URL}/o/citiplumb/doc/pnPY9D1FA4hsBGaBtdbVz2`;
	let iframeEl = $state<HTMLIFrameElement | null>(null);
	let isFullscreen = $state(false);
	let selectedDept = $state('ALL');

	function refreshFrame() {
		if (iframeEl) {
			const currentSrc = iframeEl.src;
			iframeEl.src = '';
			setTimeout(() => {
				if (iframeEl) iframeEl.src = currentSrc;
			}, 100);
		}
	}

	function toggleFullscreen() {
		isFullscreen = !isFullscreen;
	}

	function downloadDept(dept: string) {
		window.location.href = `http://${KIW_SHEET_HOST}:8485/api/export-dept?dept=${dept}`;
	}
</script>

<div class="space-y-5">
	<!-- Page Header Neo-Brutal -->
	<PageHeader
		title="kiw-sheet"
		description="Mutasi Antar Departemen — Sistem Serah-Terima 2 Arah (Two-Way Handshake), Verifikasi Grade A/B/C, dan Saldo Stok Realtime Terintegrasi."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<a
					href={gristUrl}
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2.5 rounded-xl border-3 border-black shadow-[3px_3px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
				>
					<ExternalLink size={15} />
					<span>Buka Tab Penuh</span>
				</a>
				<button
					onclick={refreshFrame}
					title="Refresh Frame"
					class="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-black font-bold text-xs uppercase tracking-wider px-3 py-2.5 rounded-xl border-3 border-black shadow-[3px_3px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
				>
					<RotateCw size={15} />
					<span>Refresh</span>
				</button>
				<button
					onclick={toggleFullscreen}
					title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
					class="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-black font-bold text-xs uppercase tracking-wider px-3 py-2.5 rounded-xl border-3 border-black shadow-[3px_3px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
				>
					{#if isFullscreen}
						<Minimize2 size={15} />
						<span>Kecilkan</span>
					{:else}
						<Maximize2 size={15} />
						<span>Fullscreen</span>
					{/if}
				</button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Quick Info & Export Toolbar Neo-Brutal -->
	<div
		class="p-4 rounded-xl border-3 border-black bg-white shadow-[4px_4px_0_0_#000] flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
	>
		<!-- Feature Highlights -->
		<div class="flex flex-wrap items-center gap-2 text-xs font-bold">
			<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 border-2 border-black shadow-[2px_2px_0_0_#000]">
				<CheckCircle2 size={14} class="text-emerald-700" />
				Two-Way Handshake Aktif
			</span>
			<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-100 text-blue-900 border-2 border-black shadow-[2px_2px_0_0_#000]">
				<Layers size={14} class="text-blue-700" />
				Grade A, B, C Ready
			</span>
			<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-100 text-purple-900 border-2 border-black shadow-[2px_2px_0_0_#000]">
				<ShieldCheck size={14} class="text-purple-700" />
				Access Rules Protected
			</span>
		</div>

		<!-- Quick Department Exporter -->
		<div class="flex items-center gap-2 w-full md:w-auto">
			<select
				bind:value={selectedDept}
				class="text-xs font-bold bg-slate-50 text-black border-2 border-black rounded-lg px-3 py-1.5 shadow-[2px_2px_0_0_#000] focus:ring-0 focus:outline-none cursor-pointer"
			>
				<option value="ALL">🏢 SEMUA DEPT (Multi-Sheet)</option>
				<option value="INJEKSI">🏭 INJEKSI (Stok & Mesin)</option>
				<option value="PLATING">⚡ PLATING (WIP Chrome)</option>
				<option value="SPRAY">🎨 SPRAY (WIP Cat)</option>
				<option value="GUDANG_IMPOR">🚢 GUDANG IMPOR (Part China)</option>
				<option value="GUDANG_LOKAL">📦 GUDANG LOKAL (Karton/Bahan)</option>
				<option value="RESIN">🧪 BAHAN RESIN (Resin & Pigmen)</option>
				<option value="MUTASI">📑 BUKU MUTASI (Ledger)</option>
			</select>
			<button
				onclick={() => downloadDept(selectedDept)}
				class="inline-flex items-center gap-1.5 bg-[#10B981] hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all whitespace-nowrap"
			>
				<Download size={14} />
				<span>Download Excel</span>
			</button>
		</div>
	</div>

	<!-- Embedded Grist Frame Container -->
	<div
		class={`relative transition-all duration-200 ${
			isFullscreen
				? 'fixed inset-0 z-50 bg-black/80 p-4 flex flex-col justify-center items-center'
				: 'w-full'
		}`}
	>
		{#if isFullscreen}
			<div class="w-full max-w-7xl flex justify-between items-center mb-3 text-white font-bold">
				<div class="flex items-center gap-2 text-sm">
					<FileSpreadsheet class="text-emerald-400" />
					<span>Mutasi & Stok Lapangan — Mode Layar Penuh</span>
				</div>
				<button
					onclick={toggleFullscreen}
					class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1 rounded-lg border-2 border-black font-bold text-xs shadow-[2px_2px_0_0_#000]"
				>
					✕ Tutup Fullscreen (ESC)
				</button>
			</div>
		{/if}

		<div
			class={`w-full overflow-hidden border-3 border-black bg-white shadow-[6px_6px_0_0_#000] rounded-2xl ${
				isFullscreen ? 'h-[92vh] max-w-7xl' : 'h-[calc(100vh-250px)] min-h-[700px]'
			}`}
		>
			<iframe
				bind:this={iframeEl}
				src={gristUrl}
				title="Dokumen Mutasi & Stok Antar Departemen (kiw-sheet)"
				class="w-full h-full border-0 bg-slate-50"
				allow="clipboard-read; clipboard-write"
			></iframe>
		</div>
	</div>
</div>
