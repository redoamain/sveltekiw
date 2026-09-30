<script lang="ts">
	import {
		Badge,
		Button,
		Input,
		Label,
		PageHeader,
		Table,
		TableHeader,
		TableRow,
		TableHead,
		TableBody,
		TableCell,
		LoadingOverlay,
		Alert,
		EmptyState
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		Factory,
		Download,
		Printer,
		Search,
		Calendar,
		Clock,
		Sparkles,
		Layers,
		TrendingUp,
		Wallet,
		Coins,
		Scale,
		FileSpreadsheet,
		RefreshCw,
		CheckCircle2,
		AlertCircle,
		ChevronDown,
		ChevronRight,
		ChevronLeft,
		Package,
		Boxes,
		ExternalLink
	} from '@lucide/svelte';

	let { data } = $props();

	let loading = $state(false);
	let exportLoading = $state(false);

	// State pencarian client-side dalam tabel
	let searchQuery = $state('');

	let filteredCOGM = $derived(
		!data.cogmData
			? []
			: !searchQuery
				? data.cogmData.rows
				: data.cogmData.rows.filter(
						(r) =>
							r.TransID.toLowerCase().includes(searchQuery.toLowerCase()) ||
							r.itemID.toLowerCase().includes(searchQuery.toLowerCase()) ||
							r.itemname.toLowerCase().includes(searchQuery.toLowerCase()) ||
							r.Acc.includes(searchQuery)
					)
	);

	let filteredHarga = $derived(
		!data.hargaData
			? []
			: !searchQuery
				? data.hargaData
				: data.hargaData.filter(
						(r) =>
							r.ItemID.toLowerCase().includes(searchQuery.toLowerCase()) ||
							r.ItemName.toLowerCase().includes(searchQuery.toLowerCase())
					)
	);

	// Client-side filtering & pagination untuk Kartu Stock HPP
	let kartuPage = $state(1);
	const KARTU_PAGE_SIZE = 15;

	let filteredKartuItems = $derived(
		!data.kartuStockData
			? []
			: !searchQuery
				? data.kartuStockData.items
				: data.kartuStockData.items.filter(
						(it) =>
							it.itemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
							it.itemName.toLowerCase().includes(searchQuery.toLowerCase())
					)
	);

	let paginatedKartuItems = $derived(
		filteredKartuItems.slice((kartuPage - 1) * KARTU_PAGE_SIZE, kartuPage * KARTU_PAGE_SIZE)
	);

	let totalKartuPages = $derived(Math.max(1, Math.ceil(filteredKartuItems.length / KARTU_PAGE_SIZE)));

	// Expand/Collapse Kartu Stock items
	let expandedKartuItems = $state<Record<string, boolean>>({});

	function toggleKartuItem(itemId: string) {
		expandedKartuItems[itemId] = !expandedKartuItems[itemId];
	}

	function expandAllKartu() {
		const next: Record<string, boolean> = {};
		for (const it of filteredKartuItems) {
			next[it.itemId] = true;
		}
		expandedKartuItems = next;
	}

	function collapseAllKartu() {
		expandedKartuItems = {};
	}

	// Client-side filtering untuk Mutasi Stock HPP
	let collapsedMutasiGroups = $state<Record<string, boolean>>({});

	function toggleMutasiGroup(gName: string) {
		collapsedMutasiGroups[gName] = !collapsedMutasiGroups[gName];
	}

	let filteredMutasiGroups = $derived(
		!data.mutasiStockData
			? []
			: !searchQuery
				? data.mutasiStockData.groups
				: data.mutasiStockData.groups
						.map((grp) => ({
							...grp,
							rows: grp.rows.filter(
								(r) =>
									r.ItemID.toLowerCase().includes(searchQuery.toLowerCase()) ||
									r.ItemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
									grp.namaJenis.toLowerCase().includes(searchQuery.toLowerCase())
							)
						}))
						.filter((grp) => grp.rows.length > 0)
	);

	// State Modal Antrian BullMQ
	let showQueueModal = $state(false);
	let queueLoading = $state(false);
	let currentJobId = $state<string | null>(null);
	let jobState = $state<'waiting' | 'active' | 'completed' | 'failed' | null>(null);
	let jobProgress = $state(0);
	let jobResult = $state<any>(null);
	let jobError = $state<string | null>(null);
	let pollInterval = $state<any>(null);

	// Collapsible group state untuk Rekap HPP & YTD
	let collapsedGroups = $state<Record<string, boolean>>({});

	function toggleGroup(gName: string) {
		collapsedGroups[gName] = !collapsedGroups[gName];
	}

	function formatNum(val: number | null | undefined, dec = 2): string {
		if (val == null || isNaN(val)) return '0,00';
		return Number(val).toLocaleString('id-ID', {
			minimumFractionDigits: dec,
			maximumFractionDigits: dec
		});
	}

	const MONTH_NAMES = [
		{ val: '01', label: 'Januari' },
		{ val: '02', label: 'Februari' },
		{ val: '03', label: 'Maret' },
		{ val: '04', label: 'April' },
		{ val: '05', label: 'Mei' },
		{ val: '06', label: 'Juni' },
		{ val: '07', label: 'Juli' },
		{ val: '08', label: 'Agustus' },
		{ val: '09', label: 'September' },
		{ val: '10', label: 'Oktober' },
		{ val: '11', label: 'November' },
		{ val: '12', label: 'Desember' }
	];

	// Hitung list tahun yang tersedia
	const currentYearNum = new Date().getFullYear();
	const YEARS = Array.from({ length: 7 }, (_, i) => String(currentYearNum - 4 + i));

	// Navigasi Tab
	const TABS = [
		{ id: 'rekap', label: '1. Rekap HPP Bulanan (rpHPP)' },
		{ id: 'cogm', label: '2. Rincian COGM (rpHPPCOGM)' },
		{ id: 'kartu-stock', label: '3. Kartu Stock HPP (rpHPPKartuStockBrgL)' },
		{ id: 'mutasi-stock', label: '4. Mutasi Stock HPP (rpHPPMutasiStockBrg2)' },
		{ id: 'ytd', label: '5. Rekap Kumulatif YTD (rpHPPYTD)' },
		{ id: 'harga', label: '6. Tarif HPP Barang (rpHargaHPP)' },
		{ id: 'kalkulasi', label: '7. Hasil Kalkulasi HPP (rpHasilKalkulasiHPP)' }
	];

	// ==========================================
	// BULLMQ BACKGROUND QUEUE LOGIC
	// ==========================================

	async function startBullMQExport(targetReportType?: string) {
		const repType = targetReportType || data.tab;
		showQueueModal = true;
		queueLoading = true;
		jobState = 'waiting';
		jobProgress = 5;
		jobResult = null;
		jobError = null;

		try {
			const res = await fetch('/api/queue/hpp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reportType: repType,
					year: data.filters.year,
					month: data.filters.month,
					tgl1: data.filters.tgl1,
					tgl2: data.filters.tgl2,
					opr: data.filters.opr,
					item: data.filters.item,
					hideEmpty: data.filters.hideEmpty
				})
			});

			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.message || 'Gagal membuat pekerjaan di antrian BullMQ');
			}

			currentJobId = json.jobId;
			toast.info('Antrian BullMQ', `Pekerjaan #${currentJobId} berhasil didaftarkan ke antrian worker.`);
			pollJobStatus(json.jobId);
		} catch (err: any) {
			queueLoading = false;
			jobState = 'failed';
			jobError = err?.message || 'Terjadi kesalahan sistem';
			toast.error('Gagal Antrian', jobError || '');
		}
	}

	function pollJobStatus(jobId: string) {
		if (pollInterval) clearInterval(pollInterval);

		pollInterval = setInterval(async () => {
			try {
				const res = await fetch(`/api/queue/hpp?jobId=${jobId}`);
				const json = await res.json();

				if (json.success && json.data) {
					jobState = json.data.state;
					jobProgress = typeof json.data.progress === 'number' ? json.data.progress : jobProgress;

					if (jobState === 'completed') {
						clearInterval(pollInterval);
						queueLoading = false;
						jobProgress = 100;
						jobResult = json.data.result;
						toast.success('Pekerjaan Selesai', `Laporan HPP berhasil digenerate oleh BullMQ worker.`);
					} else if (jobState === 'failed') {
						clearInterval(pollInterval);
						queueLoading = false;
						jobError = json.data.failedReason || 'Pekerjaan gagal diproses di background worker';
						toast.error('Pekerjaan Gagal', jobError || '');
					}
				}
			} catch {
				// Abaikan error jaringan sesaat saat polling
			}
		}, 1500);
	}

	function closeQueueModal() {
		if (pollInterval) clearInterval(pollInterval);
		showQueueModal = false;
	}
</script>

<LoadingOverlay show={loading} message="Memuat Laporan HPP..." submessage="Mohon tunggu sejenak" />

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Laporan HPP (Harga Pokok Produksi)"
		description="Rekapitulasi dan rincian seluruh stored procedure HPP (rpHPP, rpHPPCOGM, rpHPPYTD, rpHargaHPP, rpHasilKalkulasiHPP) terintegrasi ekspor Excel dan antrian background BullMQ."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<!-- Tombol Export Excel Langsung -->
				<form method="post" action="/api/hpp/export" class="inline-flex">
					<input type="hidden" name="year" value={data.filters.year} />
					<input type="hidden" name="month" value={data.filters.month} />
					<input type="hidden" name="tgl1" value={data.filters.tgl1 || ''} />
					<input type="hidden" name="tgl2" value={data.filters.tgl2 || ''} />
					<input type="hidden" name="opr" value={String(data.filters.opr)} />
					<input type="hidden" name="item" value={data.filters.item || ''} />
					<input type="hidden" name="hideEmpty" value={String(data.filters.hideEmpty !== false)} />
					<input type="hidden" name="reportType" value={data.tab} />

					<Button
						type="submit"
						variant="secondary"
						disabled={exportLoading}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export Excel langsung untuk tab aktif saat ini"
					>
						<Download class="size-4 mr-1.5" />
						Export Excel Tab Ini
					</Button>
				</form>

				<!-- Tombol Export Background BullMQ (Anti-Timeout) -->
				<Button
					type="button"
					variant="default"
					onclick={() => startBullMQExport(data.tab)}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer bg-amber-400 hover:bg-amber-300 text-black border-black"
					title="Gunakan antrian BullMQ di background worker — cocok untuk data besar tanpa risiko timeout HTTP"
				>
					<Sparkles class="size-4 mr-1.5" />
					Export via BullMQ (Anti-Timeout)
				</Button>

				<!-- Cetak -->
				<Button
					type="button"
					variant="secondary"
					onclick={() => window.print()}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer hidden sm:inline-flex"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Navigasi Tabs Stored Procedure HPP -->
	<div class="flex flex-wrap items-center gap-2 border-b-2 border-border/40 pb-2">
		{#each TABS as tabItem}
			<a
				href="?tab={tabItem.id}&year={data.filters.year}&month={data.filters.month}&tgl1={data.filters.tgl1 || ''}&tgl2={data.filters.tgl2 || ''}&opr={data.filters.opr}&item={encodeURIComponent(data.filters.item || '')}&hideEmpty={String(data.filters.hideEmpty !== false)}"
				class="h-10 px-4 inline-flex items-center justify-center rounded-lg border-[3px] text-xs font-black uppercase tracking-wide transition-all brutal-shadow-sm {data.tab === tabItem.id ? 'bg-primary text-primary-foreground border-border' : 'bg-card hover:bg-muted text-foreground border-border'}"
			>
				{tabItem.label}
			</a>
		{/each}
	</div>

	<!-- Metric Cards (Khusus Rekap HPP Bulanan & YTD) -->
	{#if (data.tab === 'rekap' && data.rekapData) || (data.tab === 'ytd' && data.ytdData)}
		{@const currentReport = data.tab === 'rekap' ? data.rekapData : data.ytdData}
		{#if currentReport}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<!-- Total HPP -->
				<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-primary/10">
					<div class="flex items-center justify-between text-muted-foreground">
						<span class="text-xs font-black uppercase tracking-wider text-primary">Grand Total HPP</span>
						<Coins class="size-4 text-primary" />
					</div>
					<div class="mt-2">
						<div class="font-mono text-xl font-black text-primary">
							Rp {formatNum(currentReport.grandTotalHPP, 0)}
						</div>
						<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
							{currentReport.rawRowsCount} Baris Akun
						</p>
					</div>
				</div>

				<!-- Saldo Awal Bahan -->
				<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
					<div class="flex items-center justify-between text-muted-foreground">
						<span class="text-xs font-black uppercase tracking-wider">Saldo Awal Bahan</span>
						<Wallet class="size-4 text-slate-500" />
					</div>
					<div class="mt-2">
						<div class="font-mono text-xl font-black text-foreground">
							Rp {formatNum(currentReport.totalSaldoAwal, 0)}
						</div>
						<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Komponen 00-SALDO AWAL</p>
					</div>
				</div>

				<!-- Pembelian Bahan -->
				<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
					<div class="flex items-center justify-between text-muted-foreground">
						<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Pembelian Bahan</span>
						<Layers class="size-4 text-emerald-600" />
					</div>
					<div class="mt-2">
						<div class="font-mono text-xl font-black text-emerald-700 dark:text-emerald-400">
							Rp {formatNum(currentReport.totalBahanBaku, 0)}
						</div>
						<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Komponen 01-PEMBELIAN</p>
					</div>
				</div>

				<!-- Biaya Produksi / Overhead -->
				<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-amber-500/5">
					<div class="flex items-center justify-between text-muted-foreground">
						<span class="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Biaya Produksi & TKL</span>
						<Factory class="size-4 text-amber-600" />
					</div>
					<div class="mt-2">
						<div class="font-mono text-xl font-black text-amber-700 dark:text-amber-400">
							Rp {formatNum(currentReport.totalBiayaProduksi, 0)}
						</div>
						<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Injection, Plating, Spray, Assembly</p>
					</div>
				</div>

				<!-- Persediaan Akhir -->
				<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-rose-500/5 col-span-2 lg:col-span-1">
					<div class="flex items-center justify-between text-muted-foreground">
						<span class="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">Persediaan Akhir</span>
						<Scale class="size-4 text-rose-600" />
					</div>
					<div class="mt-2">
						<div class="font-mono text-xl font-black text-rose-700 dark:text-rose-400">
							Rp {formatNum(currentReport.totalPersediaanAkhir, 0)}
						</div>
						<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Komponen 99-PERSEDIAAN AKHIR</p>
					</div>
				</div>
			</div>
		{/if}
	{:else if data.tab === 'kartu-stock' && data.kartuStockData}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-primary/10">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-primary">Grand Total Nilai Akhir</span>
					<Coins class="size-4 text-primary" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-xl font-black text-primary">
						Rp {formatNum(data.kartuStockData.grandTotalNilaiAkhir, 0)}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
						Periode {data.kartuStockData.tgl1} s/d {data.kartuStockData.tgl2}
					</p>
				</div>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider">Total Item Barang</span>
					<Boxes class="size-4 text-slate-500" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-xl font-black text-foreground">
						{data.kartuStockData.totalItems.toLocaleString('id-ID')} Item
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Barang dengan riwayat stok</p>
				</div>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider">Total Mutasi Transaksi</span>
					<TrendingUp class="size-4 text-slate-500" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-xl font-black text-foreground">
						{data.kartuStockData.totalMovements.toLocaleString('id-ID')} Baris
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Saldo awal & pergerakan</p>
				</div>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-amber-500/5">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Stored Procedure</span>
					<Sparkles class="size-4 text-amber-600" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-sm font-black text-amber-800 dark:text-amber-300">
						rpHPPKartuStockBrgL
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Perhitungan running balance & HPP/Kg</p>
				</div>
			</div>
		</div>
	{:else if data.tab === 'mutasi-stock' && data.mutasiStockData}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider">Saldo Awal</span>
					<Wallet class="size-4 text-slate-500" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-lg font-black text-foreground">
						Rp {formatNum(data.mutasiStockData.grandTotalSldNilai, 0)}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Persediaan Awal Bulan</p>
				</div>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Masuk (In)</span>
					<TrendingUp class="size-4 text-emerald-600" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-lg font-black text-emerald-700 dark:text-emerald-400">
						Rp {formatNum(data.mutasiStockData.grandTotalNilaiI, 0)}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Mutasi Masuk & Produksi</p>
				</div>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-rose-500/5">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">Total Keluar (Out)</span>
					<Scale class="size-4 text-rose-600" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-lg font-black text-rose-700 dark:text-rose-400">
						Rp {formatNum(data.mutasiStockData.grandTotalNilaiO, 0)}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Mutasi Keluar & Penjualan</p>
				</div>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-primary/10">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-primary">Saldo Akhir</span>
					<Coins class="size-4 text-primary" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-lg font-black text-primary">
						Rp {formatNum(data.mutasiStockData.grandTotalAkhirNilai, 0)}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Persediaan Akhir Bulan</p>
				</div>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between col-span-2 lg:col-span-1">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider">Total Item & Kategori</span>
					<Boxes class="size-4 text-slate-500" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-lg font-black text-foreground">
						{data.mutasiStockData.totalItems.toLocaleString('id-ID')} Item
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">{data.mutasiStockData.groups.length} Kategori Barang</p>
				</div>
			</div>
		</div>
	{:else if data.tab === 'cogm' && data.cogmData}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow bg-primary/10">
				<span class="text-xs font-black uppercase tracking-wider text-primary">Total Nilai COGM</span>
				<div class="mt-2 font-mono text-2xl font-black text-primary">
					Rp {formatNum(data.cogmData.totalNilai, 2)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Nilai Harga Pokok Barang Jadi (itval)</p>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow">
				<span class="text-xs font-black uppercase tracking-wider">Total Quantity (Pcs)</span>
				<div class="mt-2 font-mono text-2xl font-black text-foreground">
					{formatNum(data.cogmData.totalQty, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Total Qty Produksi</p>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow">
				<span class="text-xs font-black uppercase tracking-wider">Total Baris Transaksi</span>
				<div class="mt-2 font-mono text-2xl font-black text-foreground">
					{data.cogmData.totalRows.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Transaksi COGM Periode {data.filters.year}-{data.filters.month}</p>
			</div>
		</div>
	{/if}

	<!-- Filter Form Neo-Brutalist -->
	<form
		method="get"
		action="/dashboard/hpp"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4"
	>
		<input type="hidden" name="tab" value={data.tab} />

		<div class="flex items-center justify-between pb-2 border-b-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-foreground">Parameter Filter:</span>
				<code class="text-[11px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
					SP: {data.tab === 'rekap' ? 'rpHPP' : data.tab === 'cogm' ? 'rpHPPCOGM' : data.tab === 'kartu-stock' ? 'rpHPPKartuStockBrgL' : data.tab === 'mutasi-stock' ? 'rpHPPMutasiStockBrg2' : data.tab === 'ytd' ? 'rpHPPYTD' : data.tab === 'harga' ? 'rpHargaHPP' : 'rpHasilKalkulasiHPP'}
				</code>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
			<!-- Tahun -->
			<div class="space-y-1.5">
				<Label>Tahun Periode</Label>
				<select
					name="year"
					value={data.filters.year}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-black brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					{#each YEARS as y}
						<option value={y}>{y}</option>
					{/each}
				</select>
			</div>

			<!-- Bulan -->
			<div class="space-y-1.5">
				<Label>Bulan</Label>
				<select
					name="month"
					value={data.filters.month}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-black brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					{#each MONTH_NAMES as m}
						<option value={m.val}>{m.val} — {m.label}</option>
					{/each}
				</select>
			</div>

			{#if data.tab === 'kartu-stock' || data.tab === 'mutasi-stock'}
				<!-- Tanggal Mulai (tgl1) -->
				<div class="space-y-1.5">
					<Label>Tanggal Mulai</Label>
					<Input
						type="date"
						name="tgl1"
						value={data.filters.tgl1 || ''}
						class="h-11 font-mono text-xs font-bold"
					/>
				</div>

				<!-- Tanggal Selesai (tgl2) -->
				<div class="space-y-1.5">
					<Label>Tanggal Selesai</Label>
					<Input
						type="date"
						name="tgl2"
						value={data.filters.tgl2 || ''}
						class="h-11 font-mono text-xs font-bold"
					/>
				</div>
			{:else}
				<!-- Tipe Operasi -->
				<div class="space-y-1.5">
					<Label>Tipe Operasi</Label>
					<select
						name="opr"
						value={String(data.filters.opr)}
						class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-black brutal-shadow-sm focus:outline-none cursor-pointer"
					>
						<option value="0">0 — Semua Operasi</option>
						<option value="1">1 — Operasi 1</option>
						<option value="2">2 — Operasi 2</option>
					</select>
				</div>
			{/if}

			<!-- Filter Item ID (Opsional) -->
			<div class="space-y-1.5 {data.tab === 'kartu-stock' || data.tab === 'mutasi-stock' ? '' : 'lg:col-span-2'}">
				<Label>Filter Kode / Nama Item (Opsional)</Label>
				<Input
					type="text"
					name="item"
					value={data.filters.item || ''}
					placeholder="Contoh: LC-07, Grommet..."
					class="h-11 font-mono text-xs font-bold"
				/>
			</div>
		</div>

		{#if data.tab === 'kartu-stock' || data.tab === 'mutasi-stock'}
			<div class="flex flex-wrap items-center justify-between gap-4 pt-2 border-t-2 border-border/40">
				<div class="flex items-center gap-4">
					{#if data.tab === 'mutasi-stock'}
						<label class="flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
							<input
								type="checkbox"
								name="hideEmpty"
								value="true"
								checked={data.filters.hideEmpty !== false}
								class="size-4 rounded border-2 border-border accent-primary cursor-pointer"
							/>
							<span>Sembunyikan Item Saldo Nol & Tanpa Mutasi</span>
						</label>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<Button type="submit" class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm px-6">
						Tampilkan Laporan
					</Button>
				</div>
			</div>
		{:else}
			<div class="flex items-center justify-between pt-2 border-t-2 border-border/40">
				<span class="text-[11px] text-muted-foreground font-medium">
					Tip: Gunakan tombol "Export via BullMQ" bila mengekspor laporan dengan ribuan transaksi agar tidak timeout.
				</span>

				<div class="flex items-center gap-2">
					<Button type="submit" class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm px-6">
						Tampilkan Laporan
					</Button>
				</div>
			</div>
		{/if}
	</form>

	<!-- Error Alert -->
	{#if data.error}
		<Alert variant="error" title="Terjadi Kesalahan" dismissible>
			{data.error}
		</Alert>
	{/if}

	<!-- ========================================== -->
	<!-- TAB 1: REKAP HPP BULANAN (rpHPP)          -->
	<!-- ========================================== -->
	{#if data.tab === 'rekap' && data.rekapData}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black uppercase tracking-wider text-muted-foreground">
					Struktur Komponen Rekapitulasi HPP Periode {data.filters.year}-{data.filters.month}:
				</span>
			</div>

			{#each data.rekapData.groups as grp}
				<div class="bg-card rounded-xl border-[3px] border-border overflow-hidden brutal-shadow">
					<!-- Header Group -->
					<button
						type="button"
						onclick={() => toggleGroup(grp.groupName)}
						class="w-full flex items-center justify-between px-4 py-3 bg-muted/60 hover:bg-muted border-b-2 border-border/40 font-black text-xs uppercase tracking-wide cursor-pointer text-left"
					>
						<div class="flex items-center gap-2">
							{#if collapsedGroups[grp.groupName]}
								<ChevronRight class="size-4 text-muted-foreground" />
							{:else}
								<ChevronDown class="size-4 text-muted-foreground" />
							{/if}
							<span>{grp.groupName}</span>
							<Badge variant="secondary" class="text-[10px] ml-2">
								{grp.items.length} Akun
							</Badge>
						</div>

						<div class="font-mono text-sm font-black {grp.subtotalRp < 0 ? 'text-rose-600' : 'text-foreground'}">
							Rp {formatNum(grp.subtotalRp, 2)}
						</div>
					</button>

					<!-- Isi Tabel Group -->
					{#if !collapsedGroups[grp.groupName]}
						<Table>
							<TableHeader>
								<TableRow class="bg-muted/30">
									<TableHead class="w-16">No</TableHead>
									<TableHead class="w-24">Alias</TableHead>
									<TableHead class="w-32">Kode Akun</TableHead>
									<TableHead>Keterangan / Nama Akun</TableHead>
									<TableHead class="text-right w-44">Jumlah (Rp)</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each grp.items as item, idx}
									<TableRow class="hover:bg-muted/40">
										<TableCell class="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
										<TableCell class="font-mono text-xs font-bold">{item.alias}</TableCell>
										<TableCell class="font-mono text-xs font-bold text-primary">{item.acc}</TableCell>
										<TableCell class="text-xs font-medium">{item.remark}</TableCell>
										<TableCell class="font-mono text-xs font-bold text-right {item.totalrp < 0 ? 'text-rose-600' : ''}">
											Rp {formatNum(item.totalrp, 2)}
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					{/if}
				</div>
			{/each}

			<!-- Grand Total Bar -->
			<div class="bg-primary text-primary-foreground rounded-xl border-[3px] border-border p-4 brutal-shadow flex items-center justify-between">
				<div>
					<span class="text-xs font-black uppercase tracking-wider opacity-90">Grand Total Harga Pokok Produksi</span>
					<p class="text-[11px] opacity-80">Saldo Awal + Pembelian + Biaya Produksi - Persediaan Akhir</p>
				</div>
				<div class="font-mono text-2xl font-black">
					Rp {formatNum(data.rekapData.grandTotalHPP, 2)}
				</div>
			</div>
		</div>

	<!-- ========================================== -->
	<!-- TAB 2: RINCIAN COGM (rpHPPCOGM)            -->
	<!-- ========================================== -->
	{:else if data.tab === 'cogm' && data.cogmData}
		<div class="space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<span class="text-xs font-black uppercase tracking-wider text-muted-foreground">
					Menampilkan {data.cogmData.rows.length} Transaksi COGM:
				</span>

				<div class="w-72">
					<Input
						type="text"
						bind:value={searchQuery}
						placeholder="Cari No Bukti / Item ID..."
						class="h-9 text-xs"
					/>
				</div>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border overflow-x-auto brutal-shadow">
				<Table>
					<TableHeader>
						<TableRow class="bg-muted/60">
							<TableHead class="w-12">No</TableHead>
							<TableHead class="w-36">No. Transaksi</TableHead>
							<TableHead class="w-24">Kode Akun</TableHead>
							<TableHead class="w-48">Nama Akun</TableHead>
							<TableHead class="w-16 text-center">Pos</TableHead>
							<TableHead class="w-36">Item ID</TableHead>
							<TableHead>Nama Barang</TableHead>
							<TableHead class="text-right w-24">Qty</TableHead>
							<TableHead class="text-right w-36">Nilai COGM (Rp)</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if filteredCOGM.length === 0}
							<TableRow>
								<TableCell colspan={9} class="py-8 text-center text-muted-foreground text-xs font-bold">
									Tidak ada data transaksi yang cocok dengan pencarian.
								</TableCell>
							</TableRow>
						{:else}
							{#each filteredCOGM.slice(0, 500) as row, idx}
								<TableRow class="hover:bg-muted/40">
									<TableCell class="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
									<TableCell class="font-mono text-xs font-black text-primary">{row.TransID}</TableCell>
									<TableCell class="font-mono text-xs font-bold">{row.Acc}</TableCell>
									<TableCell class="text-xs font-medium truncate max-w-[200px]" title={row.AccName}>{row.AccName}</TableCell>
									<TableCell class="text-xs text-center font-bold">
										<Badge variant={row.Pos === 'D' ? 'default' : 'secondary'} class="font-mono text-[10px]">
											{row.Pos}
										</Badge>
									</TableCell>
									<TableCell class="font-mono text-xs font-bold">{row.itemID}</TableCell>
									<TableCell class="text-xs font-medium">{row.itemname}</TableCell>
									<TableCell class="font-mono text-xs font-bold text-right">{formatNum(row.qty, 0)}</TableCell>
									<TableCell class="font-mono text-xs font-black text-right text-emerald-700 dark:text-emerald-400">
										Rp {formatNum(row.itval, 2)}
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>

				{#if filteredCOGM.length > 500}
					<div class="p-3 text-center border-t-2 border-border/40 text-xs font-bold text-muted-foreground bg-muted/20">
						Menampilkan 500 dari {filteredCOGM.length.toLocaleString('id-ID')} transaksi di layar. Gunakan tombol Export Excel untuk mengunduh seluruh baris data.
					</div>
				{/if}
			</div>
		</div>

	<!-- ========================================== -->
	<!-- TAB 3: KARTU STOCK HPP (rpHPPKartuStockBrgL)-->
	<!-- ========================================== -->
	{:else if data.tab === 'kartu-stock' && data.kartuStockData}
		<div class="space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-3 bg-card rounded-xl border-[3px] border-border p-3 brutal-shadow">
				<div class="flex items-center gap-2">
					<span class="text-xs font-black uppercase text-foreground">
						Menampilkan {filteredKartuItems.length} dari {data.kartuStockData.totalItems} Item Barang:
					</span>
					<Badge variant="secondary" class="font-mono text-[10px]">
						{data.kartuStockData.totalMovements.toLocaleString('id-ID')} Mutasi
					</Badge>
				</div>

				<div class="flex items-center gap-2">
					<div class="w-64">
						<Input
							type="text"
							bind:value={searchQuery}
							placeholder="Cari Item ID / Nama Barang..."
							class="h-9 text-xs"
						/>
					</div>
					<Button
						type="button"
						variant="secondary"
						onclick={expandAllKartu}
						class="h-9 px-3 border-2 font-bold text-xs cursor-pointer"
					>
						Buka Semua
					</Button>
					<Button
						type="button"
						variant="secondary"
						onclick={collapseAllKartu}
						class="h-9 px-3 border-2 font-bold text-xs cursor-pointer"
					>
						Tutup Semua
					</Button>
				</div>
			</div>

			{#if filteredKartuItems.length === 0}
				<div class="bg-card rounded-xl border-[3px] border-border p-8 text-center brutal-shadow">
					<p class="text-xs font-bold text-muted-foreground">
						Tidak ada barang yang ditemukan sesuai kriteria filter/pencarian.
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each paginatedKartuItems as it}
						<div class="bg-card rounded-xl border-[3px] border-border overflow-hidden brutal-shadow transition-all">
							<!-- Header Item Card -->
							<button
								type="button"
								onclick={() => toggleKartuItem(it.itemId)}
								class="w-full flex flex-wrap items-center justify-between p-4 bg-muted/50 hover:bg-muted/80 border-b-2 border-border/40 font-bold text-xs cursor-pointer text-left gap-3"
							>
								<div class="flex items-center gap-2.5 min-w-[280px]">
									{#if expandedKartuItems[it.itemId]}
										<ChevronDown class="size-4 text-primary shrink-0" />
									{:else}
										<ChevronRight class="size-4 text-muted-foreground shrink-0" />
									{/if}
									<div class="space-y-0.5">
										<div class="flex items-center gap-2">
											<span class="font-mono font-black text-sm text-primary">{it.itemId}</span>
											<Badge variant="secondary" class="font-mono text-[10px]">
												{it.movements.length} Transaksi
											</Badge>
										</div>
										<p class="text-xs font-bold text-foreground">
											{it.itemName}
										</p>
									</div>
								</div>

								<!-- Ringkasan Mutasi Barang -->
								<div class="flex flex-wrap items-center gap-4 text-xs font-mono ml-auto">
									<!-- Saldo Awal -->
									<div class="text-right">
										<span class="block text-[10px] font-black uppercase text-muted-foreground">Saldo Awal</span>
										<span class="font-bold">{formatNum(it.saldoAwalKg, 2)} Kg</span>
										<span class="block text-[10px] text-muted-foreground">Rp {formatNum(it.saldoAwalNilai, 0)}</span>
									</div>

									<!-- Total In -->
									<div class="text-right text-emerald-700 dark:text-emerald-400">
										<span class="block text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">Masuk (In)</span>
										<span class="font-bold">+{formatNum(it.totalMasukKg, 2)} Kg</span>
										<span class="block text-[10px]">Rp {formatNum(it.totalMasukNilai, 0)}</span>
									</div>

									<!-- Total Out -->
									<div class="text-right text-rose-700 dark:text-rose-400">
										<span class="block text-[10px] font-black uppercase text-rose-800 dark:text-rose-300">Keluar (Out)</span>
										<span class="font-bold">-{formatNum(it.totalKeluarKg, 2)} Kg</span>
										<span class="block text-[10px]">Rp {formatNum(it.totalKeluarNilai, 0)}</span>
									</div>

									<!-- Saldo Akhir -->
									<div class="text-right bg-primary/10 border-2 border-primary/30 px-3 py-1.5 rounded-lg">
										<span class="block text-[10px] font-black uppercase text-primary">Saldo Akhir</span>
										<span class="font-black text-primary">{formatNum(it.saldoAkhirKg, 2)} Kg</span>
										<span class="block text-[10px] font-bold text-foreground">Rp {formatNum(it.saldoAkhirNilai, 0)}</span>
										<span class="block text-[9px] text-muted-foreground">HPP: Rp {formatNum(it.saldoAkhirHargaAvg, 2)}/Kg</span>
									</div>
								</div>
							</button>

							<!-- Tabel Rincian Pergerakan / Kartu Stock -->
							{#if expandedKartuItems[it.itemId]}
								<div class="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow class="bg-muted/30 text-[11px]">
												<TableHead class="w-24">Tanggal</TableHead>
												<TableHead class="w-16">Kegiatan</TableHead>
												<TableHead class="w-32">No. Bukti</TableHead>
												<TableHead class="w-20">Tipe</TableHead>
												<TableHead class="w-28">Gudang</TableHead>
												<TableHead class="text-right w-24 bg-emerald-500/10">In (Qty)</TableHead>
												<TableHead class="text-right w-28 bg-emerald-500/10">In (Nilai Rp)</TableHead>
												<TableHead class="text-right w-24 bg-rose-500/10">Out (Qty)</TableHead>
												<TableHead class="text-right w-28 bg-rose-500/10">Out (Nilai Rp)</TableHead>
												<TableHead class="text-right w-24 bg-primary/10">Saldo (Qty)</TableHead>
												<TableHead class="text-right w-32 bg-primary/10">Saldo (Nilai Rp)</TableHead>
												<TableHead class="text-right w-28 bg-primary/10">HPP Avg / Kg</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{#each it.movements as m}
												<TableRow class="hover:bg-muted/40 text-xs">
													<TableCell class="font-mono text-muted-foreground">{m.movedate || '-'}</TableCell>
													<TableCell>
														<Badge variant={m.kegiatan === 'SA' ? 'default' : 'secondary'} class="font-mono text-[9px]">
															{m.kegiatan}
														</Badge>
													</TableCell>
													<TableCell class="font-mono font-bold text-primary">{m.transno || '-'}</TableCell>
													<TableCell class="font-mono text-muted-foreground">{m.transtype || '-'}</TableCell>
													<TableCell class="font-medium truncate max-w-[120px]" title={m.locname}>{m.locname || '-'}</TableCell>
													<!-- In -->
													<TableCell class="font-mono text-right bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 font-bold">
														{m.kgI > 0 ? formatNum(m.kgI, 2) : '-'}
													</TableCell>
													<TableCell class="font-mono text-right bg-emerald-500/5 text-emerald-800 dark:text-emerald-300">
														{m.NilaiI > 0 ? formatNum(m.NilaiI, 2) : '-'}
													</TableCell>
													<!-- Out -->
													<TableCell class="font-mono text-right bg-rose-500/5 text-rose-800 dark:text-rose-300 font-bold">
														{m.kgO > 0 ? formatNum(m.kgO, 2) : '-'}
													</TableCell>
													<TableCell class="font-mono text-right bg-rose-500/5 text-rose-800 dark:text-rose-300">
														{m.NilaiO > 0 ? formatNum(m.NilaiO, 2) : '-'}
													</TableCell>
													<!-- Saldo -->
													<TableCell class="font-mono text-right bg-primary/5 font-black text-foreground">
														{formatNum(m.saldoKg, 2)}
													</TableCell>
													<TableCell class="font-mono text-right bg-primary/5 font-black text-primary">
														Rp {formatNum(m.saldoNilai, 2)}
													</TableCell>
													<TableCell class="font-mono text-right bg-primary/5 font-bold text-muted-foreground">
														Rp {formatNum(m.saldoHargaAvg, 2)}
													</TableCell>
												</TableRow>
											{/each}
										</TableBody>
									</Table>
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Pagination Controls -->
				{#if totalKartuPages > 1}
					<div class="flex items-center justify-between bg-card rounded-xl border-[3px] border-border p-3 brutal-shadow">
						<div class="text-xs font-bold text-muted-foreground">
							Halaman <span class="font-black text-foreground">{kartuPage}</span> dari <span class="font-black text-foreground">{totalKartuPages}</span> ({filteredKartuItems.length} total barang)
						</div>
						<div class="flex items-center gap-2">
							<Button
								type="button"
								variant="secondary"
								disabled={kartuPage <= 1}
								onclick={() => (kartuPage = Math.max(1, kartuPage - 1))}
								class="h-8 px-3 border-2 font-bold text-xs"
							>
								<ChevronLeft class="size-4 mr-1" />
								Sebelumnya
							</Button>
							<Button
								type="button"
								variant="secondary"
								disabled={kartuPage >= totalKartuPages}
								onclick={() => (kartuPage = Math.min(totalKartuPages, kartuPage + 1))}
								class="h-8 px-3 border-2 font-bold text-xs"
							>
								Berikutnya
								<ChevronRight class="size-4 ml-1" />
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</div>

	<!-- ========================================== -->
	<!-- TAB 4: MUTASI STOCK HPP (rpHPPMutasiStockBrg2) -->
	<!-- ========================================== -->
	{:else if data.tab === 'mutasi-stock' && data.mutasiStockData}
		<div class="space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-3 bg-card rounded-xl border-[3px] border-border p-3 brutal-shadow">
				<div class="flex items-center gap-2">
					<span class="text-xs font-black uppercase text-foreground">
						Mutasi Stock Per Kategori ({filteredMutasiGroups.length} Kategori, {data.mutasiStockData.totalItems} Barang):
					</span>
					<Badge variant="secondary" class="font-mono text-[10px]">
						{data.mutasiStockData.tgl1} s/d {data.mutasiStockData.tgl2}
					</Badge>
				</div>

				<div class="w-72">
					<Input
						type="text"
						bind:value={searchQuery}
						placeholder="Cari Item ID / Nama / Jenis..."
						class="h-9 text-xs"
					/>
				</div>
			</div>

			{#if filteredMutasiGroups.length === 0}
				<div class="bg-card rounded-xl border-[3px] border-border p-8 text-center brutal-shadow">
					<p class="text-xs font-bold text-muted-foreground">
						Tidak ada data mutasi stock yang sesuai kriteria pencarian.
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each filteredMutasiGroups as grp}
						<div class="bg-card rounded-xl border-[3px] border-border overflow-hidden brutal-shadow">
							<!-- Group Header Collapsible -->
							<button
								type="button"
								onclick={() => toggleMutasiGroup(grp.namaJenis)}
								class="w-full flex flex-wrap items-center justify-between p-3.5 bg-muted/70 hover:bg-muted border-b-2 border-border/40 font-black text-xs uppercase tracking-wide cursor-pointer text-left gap-2"
							>
								<div class="flex items-center gap-2">
									{#if collapsedMutasiGroups[grp.namaJenis]}
										<ChevronRight class="size-4 text-muted-foreground" />
									{:else}
										<ChevronDown class="size-4 text-muted-foreground" />
									{/if}
									<span class="text-sm font-black text-foreground">{grp.namaJenis}</span>
									<Badge variant="secondary" class="text-[10px] ml-2">
										{grp.rows.length} Item
									</Badge>
								</div>

								<div class="flex items-center gap-4 text-xs font-mono ml-auto">
									<div>
										<span class="text-[10px] text-muted-foreground mr-1">SA:</span>
										<span class="font-bold">Rp {formatNum(grp.subtotalSldNilai, 0)}</span>
									</div>
									<div class="text-emerald-700 dark:text-emerald-400">
										<span class="text-[10px] mr-1">In:</span>
										<span class="font-bold">Rp {formatNum(grp.subtotalNilaiI, 0)}</span>
									</div>
									<div class="text-rose-700 dark:text-rose-400">
										<span class="text-[10px] mr-1">Out:</span>
										<span class="font-bold">Rp {formatNum(grp.subtotalNilaiO, 0)}</span>
									</div>
									<div class="text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
										<span class="text-[10px] mr-1">Akhir:</span>
										<span class="font-black">Rp {formatNum(grp.subtotalAkhirNilai, 0)}</span>
									</div>
								</div>
							</button>

							<!-- Group Mutasi Table -->
							{#if !collapsedMutasiGroups[grp.namaJenis]}
								<div class="overflow-x-auto">
									<Table>
										<TableHeader>
											<!-- Header Tingkat 1 (Kategori Kolom Utama Sesuai Template XLS) -->
											<TableRow class="bg-muted/40 text-[11px]">
												<TableHead rowspan={2} class="w-12 text-center border-r border-border/40">No</TableHead>
												<TableHead rowspan={2} class="w-32 border-r border-border/40">Item ID</TableHead>
												<TableHead rowspan={2} class="w-56 border-r border-border/40">Item Name</TableHead>
												<TableHead colspan={3} class="text-center border-r border-border/40 bg-muted/20">Saldo Awal</TableHead>
												<TableHead colspan={3} class="text-center border-r border-border/40 bg-emerald-500/10">In</TableHead>
												<TableHead colspan={3} class="text-center border-r border-border/40 bg-rose-500/10">Out</TableHead>
												<TableHead colspan={3} class="text-center border-r border-border/40 bg-primary/10">Saldo Akhir</TableHead>
												<TableHead rowspan={2} class="text-right w-24">HPP Avg</TableHead>
											</TableRow>
											<!-- Header Tingkat 2 (Pack, Qty, Nilai) -->
											<TableRow class="bg-muted/40 text-[10px]">
												<TableHead class="text-right w-16 bg-muted/20">Pack</TableHead>
												<TableHead class="text-right w-20 bg-muted/20">Qty</TableHead>
												<TableHead class="text-right w-28 border-r border-border/40 bg-muted/20">Nilai (Rp)</TableHead>

												<TableHead class="text-right w-16 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">Pack</TableHead>
												<TableHead class="text-right w-20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">Qty</TableHead>
												<TableHead class="text-right w-28 border-r border-border/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">Nilai (Rp)</TableHead>

												<TableHead class="text-right w-16 bg-rose-500/10 text-rose-800 dark:text-rose-300">Pack</TableHead>
												<TableHead class="text-right w-20 bg-rose-500/10 text-rose-800 dark:text-rose-300">Qty</TableHead>
												<TableHead class="text-right w-28 border-r border-border/40 bg-rose-500/10 text-rose-800 dark:text-rose-300">Nilai (Rp)</TableHead>

												<TableHead class="text-right w-16 bg-primary/10 text-primary">Pack</TableHead>
												<TableHead class="text-right w-20 bg-primary/10 text-primary">Qty</TableHead>
												<TableHead class="text-right w-28 border-r border-border/40 bg-primary/10 text-primary">Nilai (Rp)</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{#each grp.rows as r, idx}
												<TableRow class="hover:bg-muted/40 text-xs">
													<TableCell class="font-mono text-center text-muted-foreground border-r border-border/30">{idx + 1}</TableCell>
													<TableCell class="font-mono font-bold text-primary border-r border-border/30">{r.ItemID}</TableCell>
													<TableCell class="font-medium border-r border-border/30 truncate max-w-[220px]" title={r.ItemName}>
														{r.ItemName}
													</TableCell>

													<!-- Saldo Awal -->
													<TableCell class="font-mono text-right text-muted-foreground">{formatNum(r.SldZak, 0)}</TableCell>
													<TableCell class="font-mono text-right font-medium">{formatNum(r.SldKg, 2)}</TableCell>
													<TableCell class="font-mono text-right font-bold border-r border-border/30">{formatNum(r.SldNilai, 2)}</TableCell>

													<!-- In -->
													<TableCell class="font-mono text-right text-emerald-800 dark:text-emerald-300">{r.ZakI > 0 ? formatNum(r.ZakI, 0) : '-'}</TableCell>
													<TableCell class="font-mono text-right text-emerald-800 dark:text-emerald-300 font-medium">{r.KgI > 0 ? formatNum(r.KgI, 2) : '-'}</TableCell>
													<TableCell class="font-mono text-right text-emerald-800 dark:text-emerald-300 font-bold border-r border-border/30">{r.NilaiI > 0 ? formatNum(r.NilaiI, 2) : '-'}</TableCell>

													<!-- Out -->
													<TableCell class="font-mono text-right text-rose-800 dark:text-rose-300">{r.ZakO > 0 ? formatNum(r.ZakO, 0) : '-'}</TableCell>
													<TableCell class="font-mono text-right text-rose-800 dark:text-rose-300 font-medium">{r.KgO > 0 ? formatNum(r.KgO, 2) : '-'}</TableCell>
													<TableCell class="font-mono text-right text-rose-800 dark:text-rose-300 font-bold border-r border-border/30">{r.NilaiO > 0 ? formatNum(r.NilaiO, 2) : '-'}</TableCell>

													<!-- Saldo Akhir -->
													<TableCell class="font-mono text-right text-foreground">{formatNum(r.AkhirZak, 0)}</TableCell>
													<TableCell class="font-mono text-right font-bold text-foreground">{formatNum(r.AkhirKg, 2)}</TableCell>
													<TableCell class="font-mono text-right font-black text-primary border-r border-border/30">{formatNum(r.AkhirNilai, 2)}</TableCell>

													<!-- HPP Avg -->
													<TableCell class="font-mono text-right text-xs font-bold text-muted-foreground">{formatNum(r.hppavg, 2)}</TableCell>
												</TableRow>
											{/each}

											<!-- Subtotal Baris -->
											<TableRow class="bg-muted/60 font-black text-xs border-t-2 border-border">
												<TableCell colspan={3} class="text-right uppercase tracking-wider border-r border-border/40">
													Subtotal {grp.namaJenis}:
												</TableCell>
												<TableCell colspan={2}></TableCell>
												<TableCell class="font-mono text-right border-r border-border/40">
													Rp {formatNum(grp.subtotalSldNilai, 2)}
												</TableCell>
												<TableCell colspan={2}></TableCell>
												<TableCell class="font-mono text-right text-emerald-700 dark:text-emerald-400 border-r border-border/40">
													Rp {formatNum(grp.subtotalNilaiI, 2)}
												</TableCell>
												<TableCell colspan={2}></TableCell>
												<TableCell class="font-mono text-right text-rose-700 dark:text-rose-400 border-r border-border/40">
													Rp {formatNum(grp.subtotalNilaiO, 2)}
												</TableCell>
												<TableCell colspan={2}></TableCell>
												<TableCell class="font-mono text-right text-primary border-r border-border/40">
													Rp {formatNum(grp.subtotalAkhirNilai, 2)}
												</TableCell>
												<TableCell></TableCell>
											</TableRow>
										</TableBody>
									</Table>
								</div>
							{/if}
						</div>
					{/each}

					<!-- Grand Total Card Mutasi Stock -->
					<div class="bg-primary text-primary-foreground rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-wrap items-center justify-between gap-4">
						<div>
							<span class="text-xs font-black uppercase tracking-wider opacity-90">Grand Total Mutasi Stock HPP</span>
							<p class="text-[11px] opacity-80">
								Total seluruh kategori ({filteredMutasiGroups.length} kategori, {data.mutasiStockData.totalItems} barang)
							</p>
						</div>

						<div class="flex flex-wrap items-center gap-6 text-sm font-mono font-black">
							<div>
								<span class="text-[10px] opacity-75 block uppercase">Saldo Awal</span>
								<span>Rp {formatNum(data.mutasiStockData.grandTotalSldNilai, 0)}</span>
							</div>
							<div>
								<span class="text-[10px] opacity-75 block uppercase">Total In</span>
								<span>Rp {formatNum(data.mutasiStockData.grandTotalNilaiI, 0)}</span>
							</div>
							<div>
								<span class="text-[10px] opacity-75 block uppercase">Total Out</span>
								<span>Rp {formatNum(data.mutasiStockData.grandTotalNilaiO, 0)}</span>
							</div>
							<div class="bg-background text-foreground px-4 py-2 rounded-lg border-2 border-border brutal-shadow-sm">
								<span class="text-[10px] text-primary block uppercase font-black">Saldo Akhir</span>
								<span class="text-lg text-primary">Rp {formatNum(data.mutasiStockData.grandTotalAkhirNilai, 0)}</span>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>

	<!-- ========================================== -->
	<!-- TAB 5: REKAP KUMULATIF YTD (rpHPPYTD)      -->
	<!-- ========================================== -->
	{:else if data.tab === 'ytd' && data.ytdData}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black uppercase tracking-wider text-muted-foreground">
					Rekapitulasi HPP Kumulatif Year-to-Date (YTD) s/d {data.filters.year}-{data.filters.month}:
				</span>
			</div>

			{#each data.ytdData.groups as grp}
				<div class="bg-card rounded-xl border-[3px] border-border overflow-hidden brutal-shadow">
					<button
						type="button"
						onclick={() => toggleGroup(grp.groupName)}
						class="w-full flex items-center justify-between px-4 py-3 bg-muted/60 hover:bg-muted border-b-2 border-border/40 font-black text-xs uppercase tracking-wide cursor-pointer text-left"
					>
						<div class="flex items-center gap-2">
							{#if collapsedGroups[grp.groupName]}
								<ChevronRight class="size-4 text-muted-foreground" />
							{:else}
								<ChevronDown class="size-4 text-muted-foreground" />
							{/if}
							<span>{grp.groupName}</span>
							<Badge variant="secondary" class="text-[10px] ml-2">{grp.items.length} Akun</Badge>
						</div>

						<div class="font-mono text-sm font-black {grp.subtotalRp < 0 ? 'text-rose-600' : 'text-foreground'}">
							Rp {formatNum(grp.subtotalRp, 2)}
						</div>
					</button>

					{#if !collapsedGroups[grp.groupName]}
						<Table>
							<TableHeader>
								<TableRow class="bg-muted/30">
									<TableHead class="w-16">No</TableHead>
									<TableHead class="w-24">Alias</TableHead>
									<TableHead class="w-32">Kode Akun</TableHead>
									<TableHead>Keterangan / Nama Akun</TableHead>
									<TableHead class="text-right w-44">Jumlah YTD (Rp)</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each grp.items as item, idx}
									<TableRow class="hover:bg-muted/40">
										<TableCell class="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
										<TableCell class="font-mono text-xs font-bold">{item.alias}</TableCell>
										<TableCell class="font-mono text-xs font-bold text-primary">{item.acc}</TableCell>
										<TableCell class="text-xs font-medium">{item.remark}</TableCell>
										<TableCell class="font-mono text-xs font-bold text-right {item.totalrp < 0 ? 'text-rose-600' : ''}">
											Rp {formatNum(item.totalrp, 2)}
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					{/if}
				</div>
			{/each}

			<div class="bg-primary text-primary-foreground rounded-xl border-[3px] border-border p-4 brutal-shadow flex items-center justify-between">
				<div>
					<span class="text-xs font-black uppercase tracking-wider opacity-90">Grand Total HPP Kumulatif (YTD)</span>
				</div>
				<div class="font-mono text-2xl font-black">
					Rp {formatNum(data.ytdData.grandTotalHPP, 2)}
				</div>
			</div>
		</div>

	<!-- ========================================== -->
	<!-- TAB 6: TARIF HPP BARANG (rpHargaHPP)       -->
	<!-- ========================================== -->
	{:else if data.tab === 'harga' && data.hargaData}
		<div class="space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<span class="text-xs font-black uppercase tracking-wider text-muted-foreground">
					Daftar Tarif HPP Master Barang ({data.hargaData.length.toLocaleString('id-ID')} Item):
				</span>

				<div class="w-72">
					<Input
						type="text"
						bind:value={searchQuery}
						placeholder="Filter Item ID / Nama..."
						class="h-9 text-xs"
					/>
				</div>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border overflow-x-auto brutal-shadow">
				<Table>
					<TableHeader>
						<TableRow class="bg-muted/60">
							<TableHead class="w-16">No</TableHead>
							<TableHead class="w-44">Item ID</TableHead>
							<TableHead>Nama Barang</TableHead>
							<TableHead class="text-right w-44">Tarif HPP (Rp)</TableHead>
							<TableHead class="w-24 text-center">Periode</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if filteredHarga.length === 0}
							<TableRow>
								<TableCell colspan={5} class="py-8 text-center text-muted-foreground text-xs font-bold">
									Tidak ada tarif barang yang cocok.
								</TableCell>
							</TableRow>
						{:else}
							{#each filteredHarga.slice(0, 300) as row, idx}
								<TableRow class="hover:bg-muted/40">
									<TableCell class="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
									<TableCell class="font-mono text-xs font-black text-primary">{row.ItemID}</TableCell>
									<TableCell class="text-xs font-medium">{row.ItemName}</TableCell>
									<TableCell class="font-mono text-xs font-bold text-right">
										{row.Price != null ? `Rp ${formatNum(row.Price, 2)}` : '-'}
									</TableCell>
									<TableCell class="font-mono text-xs text-center">{row.Periode ?? '-'}</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>

				{#if filteredHarga.length > 300}
					<div class="p-3 text-center border-t-2 border-border/40 text-xs font-bold text-muted-foreground bg-muted/20">
						Menampilkan 300 dari {filteredHarga.length.toLocaleString('id-ID')} item. Gunakan Export Excel untuk mengunduh semua data.
					</div>
				{/if}
			</div>
		</div>

	<!-- ========================================== -->
	<!-- TAB 7: HASIL KALKULASI (rpHasilKalkulasiHPP)-->
	<!-- ========================================== -->
	{:else if data.tab === 'kalkulasi' && data.kalkulasiData}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black uppercase tracking-wider text-muted-foreground">
					Hasil Kalkulasi HPP Barang ({data.kalkulasiData.length} Item):
				</span>
			</div>

			<div class="bg-card rounded-xl border-[3px] border-border overflow-x-auto brutal-shadow">
				<Table>
					<TableHeader>
						<TableRow class="bg-muted/60">
							<TableHead class="w-16">No</TableHead>
							<TableHead class="w-44">Item ID</TableHead>
							<TableHead>Nama Barang</TableHead>
							<TableHead class="w-32 text-center">Default Harga</TableHead>
							<TableHead class="text-right w-44">Harga Kalkulasi (Rp)</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.kalkulasiData.length === 0}
							<TableRow>
								<TableCell colspan={5} class="py-8 text-center text-muted-foreground text-xs font-bold">
									Tidak ada data hasil kalkulasi HPP.
								</TableCell>
							</TableRow>
						{:else}
							{#each data.kalkulasiData as row, idx}
								<TableRow class="hover:bg-muted/40">
									<TableCell class="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
									<TableCell class="font-mono text-xs font-black text-primary">{row.ItemID}</TableCell>
									<TableCell class="text-xs font-medium">{row.ItemName}</TableCell>
									<TableCell class="text-xs text-center font-bold">
										<Badge variant={row.DefaultHarga ? 'default' : 'secondary'} class="text-[10px]">
											{row.DefaultHarga ? 'YA' : 'TIDAK'}
										</Badge>
									</TableCell>
									<TableCell class="font-mono text-xs font-bold text-right text-emerald-700 dark:text-emerald-400">
										Rp {formatNum(row.Price, 2)}
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>
		</div>
	{/if}
</div>

<!-- ========================================== -->
<!-- MODAL PROGRES PEKERJAAN BULLMQ ANTRIAN     -->
<!-- ========================================== -->
{#if showQueueModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
		<div class="bg-card border-border w-full max-w-lg rounded-2xl border-[3px] p-6 brutal-shadow space-y-5 animate-in fade-in zoom-in-95">
			<div class="flex items-center justify-between border-b-2 border-border/40 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="p-2 bg-amber-400 text-black rounded-lg border-2 border-border brutal-shadow-sm">
						<Sparkles class="size-5" />
					</div>
					<div>
						<h3 class="font-black text-base uppercase text-foreground">Background Worker (BullMQ)</h3>
						<p class="text-xs text-muted-foreground font-bold">
							Proses Export Excel Bebas Timeout
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={closeQueueModal}
					class="size-8 rounded-lg border-2 border-border flex items-center justify-center hover:bg-muted font-bold cursor-pointer text-xs"
				>
					✕
				</button>
			</div>

			<!-- Informasi Job -->
			<div class="bg-muted/50 rounded-xl border-2 border-border/60 p-3.5 space-y-2 text-xs">
				<div class="flex justify-between">
					<span class="text-muted-foreground font-bold">Laporan:</span>
					<span class="font-black uppercase">{data.tab}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground font-bold">Periode:</span>
					<span class="font-black font-mono">{data.filters.year}-{data.filters.month}</span>
				</div>
				{#if currentJobId}
					<div class="flex justify-between">
						<span class="text-muted-foreground font-bold">ID Pekerjaan BullMQ:</span>
						<span class="font-black font-mono text-primary">#{currentJobId}</span>
					</div>
				{/if}
				<div class="flex justify-between items-center">
					<span class="text-muted-foreground font-bold">Status:</span>
					<Badge
						variant={jobState === 'completed' ? 'default' : jobState === 'failed' ? 'error' : 'secondary'}
						class="font-mono uppercase text-[10px]"
					>
						{jobState || 'MENUNGGU...'}
					</Badge>
				</div>
			</div>

			<!-- Progress Bar -->
			<div class="space-y-2">
				<div class="flex justify-between text-xs font-black">
					<span>Progres Pemrosesan</span>
					<span class="font-mono">{jobProgress}%</span>
				</div>
				<div class="h-3 w-full rounded-full border-2 border-border bg-muted overflow-hidden">
					<div
						class="h-full bg-primary transition-all duration-300"
						style="width: {jobProgress}%"
					></div>
				</div>
			</div>

			<!-- Pesan Status / Error -->
			{#if jobState === 'failed'}
				<Alert variant="error" title="Gagal Memproses">
					{jobError || 'Worker mengalami kendala saat memproses laporan.'}
				</Alert>
			{:else if jobState === 'completed' && jobResult}
				<div class="bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs space-y-2">
					<div class="flex items-center gap-2 font-black">
						<CheckCircle2 class="size-4" />
						<span>Berkas Excel Berhasil Dibuat!</span>
					</div>
					<p class="font-medium text-[11px] leading-relaxed">
						{jobResult.message}
					</p>
				</div>
			{:else}
				<div class="flex items-center gap-2 text-xs text-muted-foreground justify-center py-2">
					<RefreshCw class="size-4 animate-spin text-primary" />
					<span class="font-bold">Sedang mengeksekusi Stored Procedure & menyusun file Excel...</span>
				</div>
			{/if}

			<!-- Action Buttons -->
			<div class="flex items-center justify-end gap-2 pt-2 border-t-2 border-border/40">
				{#if jobState === 'completed' && currentJobId}
					<a
						href="/api/queue/hpp?jobId={currentJobId}&download=true"
						class="h-10 px-5 inline-flex items-center justify-center rounded-lg border-[3px] bg-primary text-primary-foreground font-black text-xs uppercase tracking-wide brutal-shadow-sm hover:opacity-95"
					>
						<Download class="size-4 mr-2" />
						Unduh Berkas Excel ({jobResult?.fileName || 'Laporan.xlsx'})
					</a>
				{/if}
				<Button
					type="button"
					variant="secondary"
					onclick={closeQueueModal}
					class="h-10 border-[3px] font-bold text-xs uppercase"
				>
					Tutup
				</Button>
			</div>
		</div>
	</div>
{/if}
