<script lang="ts">
	import {
		Badge,
		Button,
		Input,
		Label,
		PageHeader,
		Pagination,
		Table,
		TableHeader,
		TableRow,
		TableHead,
		TableBody,
		TableCell,
		LoadingOverlay,
		Alert,
		Modal,
		EmptyState
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		Search,
		Download,
		ChevronDown,
		ChevronRight,
		Factory,
		Package,
		Layers,
		CheckCircle2,
		Clock,
		ExternalLink,
		FileSpreadsheet,
		RefreshCw,
		Printer,
		Sparkles,
		Tag
	} from '@lucide/svelte';
	import type { SpkDetailData } from '$lib/server/laporan-produksi';

	let { data } = $props();

	let loading = $state(false);
	let loadingMsg = $state('Memuat...');
	let exportLoading = $state(false);

	// State untuk accordion baris detail
	let expandedSpk = $state<Record<string, boolean>>({});
	let loadingDetails = $state<Record<string, boolean>>({});
	let spkDetailsCache = $state<Record<string, SpkDetailData>>({});

	// State modal detail lengkap
	let activeDetailModal = $state<SpkDetailData | null>(null);
	let isModalOpen = $state(false);

	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	// Toggle expand baris SPK
	async function toggleExpand(orderId: string) {
		const willExpand = !expandedSpk[orderId];
		expandedSpk[orderId] = willExpand;

		if (willExpand && !spkDetailsCache[orderId]) {
			loadingDetails[orderId] = true;
			try {
				const res = await fetch(`/api/laporan-produksi/detail?orderId=${encodeURIComponent(orderId)}`);
				const json = await res.json();
				if (json.success && json.data) {
					spkDetailsCache[orderId] = json.data;
				} else {
					toast.error(json.message || 'Gagal memuat rincian SPK');
				}
			} catch (err: any) {
				toast.error('Terjadi kesalahan memuat detail SPK: ' + err?.message);
			} finally {
				loadingDetails[orderId] = false;
			}
		}
	}

	// Buka modal detail lengkap
	async function openModalDetail(orderId: string) {
		if (spkDetailsCache[orderId]) {
			activeDetailModal = spkDetailsCache[orderId];
			isModalOpen = true;
			return;
		}

		loading = true;
		loadingMsg = `Memuat rincian SPK #${orderId}...`;
		try {
			const res = await fetch(`/api/laporan-produksi/detail?orderId=${encodeURIComponent(orderId)}`);
			const json = await res.json();
			if (json.success && json.data) {
				spkDetailsCache[orderId] = json.data;
				activeDetailModal = json.data;
				isModalOpen = true;
			} else {
				toast.error(json.message || 'Gagal memuat rincian SPK');
			}
		} catch (err: any) {
			toast.error('Gagal memuat rincian SPK: ' + err?.message);
		} finally {
			loading = false;
		}
	}

	function formatNum(val: number | null | undefined, dec = 0): string {
		if (val == null || isNaN(val)) return '0';
		return Number(val).toLocaleString('id-ID', {
			minimumFractionDigits: dec,
			maximumFractionDigits: dec
		});
	}

	function getDeptBadgeColor(dept: string): string {
		switch (dept.toUpperCase()) {
			case 'AS':
				return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-600';
			case 'IN':
				return 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-600';
			case 'PL':
				return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-600';
			case 'SP':
				return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-600';
			case 'MO':
				return 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-600';
			default:
				return 'bg-muted text-foreground border-border';
		}
	}
</script>

<LoadingOverlay show={loading} message={loadingMsg} submessage="Mohon tunggu sejenak" />

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Laporan Produksi Berdasarkan SPK"
		description="Analisis menyeluruh alur produksi per SPK: perbandingan bahan baku yang digunakan dengan hasil jadi yang diproduksi."
	>
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<Badge variant="secondary" class="border-[3px] font-mono font-black text-xs">
					{data.total.toLocaleString('id-ID')} SPK TERDATA
				</Badge>
				<form
					method="post"
					action="/api/laporan-produksi/export"
					onsubmit={() => {
						exportLoading = true;
						toast.info('Export Excel', 'Menyiapkan file Excel 3-sheet (SPK, Bahan, Hasil)...');
						setTimeout(() => (exportLoading = false), 3500);
					}}
					class="inline-flex"
				>
					<input type="hidden" name="dept" value={data.filters.dept} />
					<input type="hidden" name="q" value={data.filters.q} />
					<input type="hidden" name="tgl1" value={data.filters.tgl1} />
					<input type="hidden" name="tgl2" value={data.filters.tgl2} />
					<input type="hidden" name="status" value={data.filters.status} />
					<Button
						type="submit"
						variant="secondary"
						disabled={exportLoading}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
					>
						<Download class="size-4 mr-1.5" />
						Export Excel (3-Sheet)
					</Button>
				</form>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Summary Metrics Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
		<!-- Total SPK -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total SPK</span>
				<Tag class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{formatNum(data.metrics.totalSpk)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">SPK Aktif / Diproses</p>
			</div>
		</div>

		<!-- Target SPK -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Target Qty</span>
				<Package class="size-4 text-blue-500" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{formatNum(data.metrics.totalTargetQty)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Rencana Target Order</p>
			</div>
		</div>

		<!-- Realisasi Hasil -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Hasil (H)</span>
				<CheckCircle2 class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
					{formatNum(data.metrics.totalHasilKgs)} <span class="text-xs font-bold">Kg/Pcs</span>
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{formatNum(data.metrics.totalHasilBags)} Bags / Karung
				</p>
			</div>
		</div>

		<!-- Total Bahan -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-amber-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Bahan (B)</span>
				<Layers class="size-4 text-amber-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-amber-700 dark:text-amber-400">
					{formatNum(data.metrics.totalBahanKgs)} <span class="text-xs font-bold">Kg</span>
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{formatNum(data.metrics.totalBahanBags)} Bags Terpakai
				</p>
			</div>
		</div>

		<!-- Rata-rata Capaian -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-primary/5 col-span-2 lg:col-span-1">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-primary">Capaian Target</span>
				<Factory class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-primary">
					{formatNum(data.metrics.avgCompletionPct, 1)}%
				</div>
				<div class="w-full bg-muted rounded-full h-2 mt-1.5 overflow-hidden border border-border">
					<div
						class="bg-primary h-full rounded-full transition-all"
						style={`width: ${Math.min(100, data.metrics.avgCompletionPct)}%`}
					></div>
				</div>
			</div>
		</div>
	</div>

	<!-- Form Filter Neo-Brutalist -->
	<form
		method="get"
		action="/dashboard/laporan-produksi"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
			<!-- Departemen -->
			<div class="space-y-1.5">
				<Label>Departemen</Label>
				<select
					name="dept"
					value={data.filters.dept}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase tracking-wide brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					{#each data.departemenOptions as o}
						<option value={o.value}>{o.label}</option>
					{/each}
				</select>
			</div>

			<!-- Status SPK -->
			<div class="space-y-1.5">
				<Label>Status SPK</Label>
				<select
					name="status"
					value={data.filters.status}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase tracking-wide brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="all">Semua Status</option>
					<option value="ongoing">Sedang Berjalan</option>
					<option value="completed">Selesai (Completed)</option>
				</select>
			</div>

			<!-- Tgl Awal Produksi -->
			<div class="space-y-1.5">
				<Label for="tgl1">Tgl Awal Produksi</Label>
				<input
					type="date"
					id="tgl1"
					name="tgl1"
					value={data.filters.tgl1}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
				/>
			</div>

			<!-- Tgl Akhir Produksi -->
			<div class="space-y-1.5">
				<Label for="tgl2">Tgl Akhir Produksi</Label>
				<input
					type="date"
					id="tgl2"
					name="tgl2"
					value={data.filters.tgl2}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
				/>
			</div>

			<!-- Cari Keyword -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="q">Cari SPK / Barang / PO</Label>
				<div class="relative">
					<Search class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						id="q"
						name="q"
						value={data.filters.q}
						placeholder="No SPK / Kode Item / Nama Barang / PO..."
						class="h-11 border-[3px] pl-9 font-bold"
					/>
				</div>
			</div>
		</div>

		<!-- Action buttons row -->
		<div class="flex flex-wrap items-center justify-between gap-3 pt-1 border-t-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-muted-foreground">Tampilkan:</span>
				<select
					name="pageSize"
					value={String(data.filters.pageSize)}
					class="bg-card border-border h-9 rounded-lg border-[3px] px-2 text-xs font-black brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="25">25 SPK</option>
					<option value="50">50 SPK</option>
					<option value="100">100 SPK</option>
					<option value="250">250 SPK</option>
				</select>
			</div>

			<div class="flex items-center gap-2">
				{#if data.filters.dept || data.filters.q || data.filters.tgl1 || data.filters.tgl2 || data.filters.status !== 'all'}
					<a
						href="/dashboard/laporan-produksi"
						class="border-border bg-card hover:bg-muted inline-flex h-10 items-center rounded-lg border-[3px] px-4 text-xs font-black uppercase tracking-wide brutal-shadow-sm"
					>
						Reset Filter
					</a>
				{/if}
				<Button type="submit" class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm px-6">
					Tampilkan Laporan
				</Button>
			</div>
		</div>
	</form>

	{#if data.error}
		<Alert variant="error" title="Terjadi Kesalahan" dismissible>
			{data.error}
		</Alert>
	{/if}

	<!-- Tabel Utama SPK -->
	<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
		<div class="bg-card border-b-[3px] border-border flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<div class="flex items-center gap-2">
				<Factory class="size-5 text-primary" />
				<h3 class="font-black uppercase tracking-tight text-base" style="font-family: var(--font-display)">
					Daftar SPK & Pemakaian Bahan / Hasil
				</h3>
			</div>
			<div class="flex items-center gap-2">
				<span class="bg-muted border-border hidden rounded-full border-2 px-3 py-1 font-mono text-[10px] font-black uppercase md:inline-flex">
					{data.total.toLocaleString('id-ID')} SPK • Hal {data.page}
				</span>
			</div>
		</div>

		<div class="overflow-x-auto">
			<Table wrapperClass="border-0 shadow-none rounded-none">
				<TableHeader>
					<TableRow class="bg-muted/50">
						<TableHead class="w-10 text-center font-mono text-[11px] font-black uppercase tracking-widest">Detail</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest min-w-36">No SPK & Tgl</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest w-20 text-center">Dept</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest min-w-56">Barang Target SPK</TableHead>
						<TableHead class="text-right font-mono text-[11px] font-black uppercase tracking-widest min-w-28">Target Qty</TableHead>
						<TableHead class="text-right font-mono text-[11px] font-black uppercase tracking-widest min-w-32 bg-emerald-500/5">Hasil (H)</TableHead>
						<TableHead class="text-right font-mono text-[11px] font-black uppercase tracking-widest min-w-32 bg-amber-500/5">Bahan (B)</TableHead>
						<TableHead class="text-center font-mono text-[11px] font-black uppercase tracking-widest min-w-28">% Capai</TableHead>
						<TableHead class="text-center font-mono text-[11px] font-black uppercase tracking-widest w-24">Status</TableHead>
						<TableHead class="text-center font-mono text-[11px] font-black uppercase tracking-widest w-20">Aksi</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableRow>
							<TableCell colspan={10} class="h-40 text-center">
								<EmptyState
									icon={Factory}
									title="Tidak Ada Data SPK Produksi"
									description="Belum ada transaksi produksi yang sesuai dengan filter pencarian ini."
								/>
							</TableCell>
						</TableRow>
					{:else}
						{#each data.rows as r}
							{@const isExpanded = Boolean(expandedSpk[r.orderId])}
							{@const detail = spkDetailsCache[r.orderId]}
							{@const isDetLoading = Boolean(loadingDetails[r.orderId])}

							<TableRow class="hover:bg-primary/5 transition-colors {isExpanded ? 'bg-primary/5 border-b-0' : ''}">
								<!-- Toggle expand -->
								<TableCell class="text-center">
									<button
										type="button"
										onclick={() => toggleExpand(r.orderId)}
										class="inline-flex size-7 items-center justify-center rounded-md border-2 border-border bg-card hover:bg-muted font-bold transition-all cursor-pointer brutal-shadow-sm"
										title={isExpanded ? 'Tutup rincian bahan & hasil' : 'Buka rincian bahan & hasil'}
									>
										{#if isExpanded}
											<ChevronDown class="size-4" />
										{:else}
											<ChevronRight class="size-4" />
										{/if}
									</button>
								</TableCell>

								<!-- No SPK & Tgl -->
								<TableCell>
									<div class="font-mono text-xs font-black text-primary">
										{r.orderId}
									</div>
									<div class="text-[11px] font-bold text-muted-foreground">
										{r.orderDate ?? '-'}
									</div>
									{#if r.spkRemark}
										<div class="text-[10px] text-muted-foreground truncate max-w-44" title={r.spkRemark}>
											PO: {r.spkRemark}
										</div>
									{/if}
								</TableCell>

								<!-- Dept -->
								<TableCell class="text-center">
									<span class={`inline-block px-2 py-0.5 rounded border-2 font-mono text-[11px] font-black ${getDeptBadgeColor(r.deptId)}`}>
										{r.deptId}
									</span>
								</TableCell>

								<!-- Barang Target SPK -->
								<TableCell>
									<div class="font-mono text-xs font-black">{r.targetItemId}</div>
									<div class="text-xs font-bold text-muted-foreground max-w-xs truncate" title={r.targetItemName ?? ''}>
										{r.targetItemName ?? '-'}
									</div>
								</TableCell>

								<!-- Target Qty -->
								<TableCell class="text-right">
									<div class="font-mono text-xs font-black">
										{r.targetQty > 0 ? formatNum(r.targetQty) : '-'}
									</div>
									<div class="text-[10px] font-bold text-muted-foreground uppercase">
										{r.targetSatuan ?? 'PCS'}
									</div>
								</TableCell>

								<!-- Realisasi Hasil (H) -->
								<TableCell class="text-right bg-emerald-500/5">
									<div class="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
										{formatNum(r.totalHasilKgs)}
									</div>
									{#if r.totalHasilBags > 0}
										<div class="text-[10px] font-bold text-emerald-600/80">
											{formatNum(r.totalHasilBags)} Bags
										</div>
									{/if}
								</TableCell>

								<!-- Realisasi Bahan (B) -->
								<TableCell class="text-right bg-amber-500/5">
									<div class="font-mono text-xs font-black text-amber-700 dark:text-amber-400">
										{formatNum(r.totalBahanKgs)}
									</div>
									{#if r.totalBahanBags > 0}
										<div class="text-[10px] font-bold text-amber-600/80">
											{formatNum(r.totalBahanBags)} Bags
										</div>
									{/if}
								</TableCell>

								<!-- % Capai Target & Rasio -->
								<TableCell class="text-center">
									{#if r.targetQty > 0}
										<div class="font-mono text-xs font-black {r.completionPct >= 100 ? 'text-emerald-600' : 'text-primary'}">
											{formatNum(r.completionPct, 1)}%
										</div>
										<div class="w-16 mx-auto bg-muted rounded-full h-1.5 mt-1 overflow-hidden border border-border">
											<div
												class="bg-primary h-full rounded-full"
												style={`width: ${Math.min(100, r.completionPct)}%`}
											></div>
										</div>
									{:else}
										<span class="font-mono text-xs text-muted-foreground">-</span>
									{/if}
								</TableCell>

								<!-- Status SPK -->
								<TableCell class="text-center">
									{#if r.isCompleted}
										<Badge variant="success" class="font-mono text-[10px] font-black border-2">
											SELESAI
										</Badge>
									{:else}
										<Badge variant="warning" class="font-mono text-[10px] font-black border-2">
											BERJALAN
										</Badge>
									{/if}
								</TableCell>

								<!-- Aksi Drill Down -->
								<TableCell class="text-center">
									<Button
										variant="ghost"
										size="sm"
										onclick={() => openModalDetail(r.orderId)}
										class="h-8 px-2 border-2 border-border font-bold text-xs brutal-shadow-sm cursor-pointer"
										title="Buka rincian lengkap & modal analisis SPK"
									>
										Detail
									</Button>
								</TableCell>
							</TableRow>

							<!-- Sub-row Accordion Expanded -->
							{#if isExpanded}
								<TableRow class="bg-muted/20 border-t-0 border-b-[3px] border-border">
									<TableCell colspan={10} class="p-4 sm:p-5">
										{#if isDetLoading}
											<div class="py-8 text-center font-mono text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
												<RefreshCw class="size-4 animate-spin text-primary" />
												Memuat data rincian bahan dan hasil untuk SPK {r.orderId}...
											</div>
										{:else if detail}
											<div class="space-y-4">
												<!-- Summary Header Sub-row -->
												<div class="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-lg border-2 border-border brutal-shadow-sm">
													<div class="flex flex-wrap items-center gap-4 text-xs font-bold">
														<span>
															<strong class="font-black uppercase text-muted-foreground">No SPK:</strong> {detail.orderId}
														</span>
														<span>
															<strong class="font-black uppercase text-muted-foreground">Departemen:</strong> {detail.deptName}
														</span>
														<span>
															<strong class="font-black uppercase text-muted-foreground">Target Order:</strong> {detail.targetItemId} ({formatNum(detail.targetQty)} {detail.targetSatuan})
														</span>
														<span>
															<strong class="font-black uppercase text-muted-foreground">Bukti Produksi:</strong> {detail.bukti.length} Bukti
														</span>
													</div>
													<div class="flex items-center gap-2">
														<a
															href={`/dashboard/input-produksi`}
															class="inline-flex items-center gap-1 text-[11px] font-black uppercase text-primary hover:underline"
														>
															Form Input Produksi <ExternalLink class="size-3" />
														</a>
													</div>
												</div>

												<!-- Grid 2 Kolom: Bahan (B) vs Hasil (H) -->
												<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
													<!-- KOLOM 1: BAHAN (ItemType = 'B') -->
													<div class="bg-card rounded-lg border-2 border-border overflow-hidden brutal-shadow-sm">
														<div class="bg-amber-500/10 border-b-2 border-border px-3 py-2 flex items-center justify-between">
															<div class="flex items-center gap-2">
																<Layers class="size-4 text-amber-600" />
																<h4 class="font-black text-xs uppercase tracking-wide text-amber-800 dark:text-amber-300">
																	Bahan Baku Terpakai (Input B)
																</h4>
															</div>
															<span class="font-mono text-xs font-black text-amber-800 dark:text-amber-300">
																{formatNum(detail.totalBahanKgs)} Kg
															</span>
														</div>

														<div class="max-h-64 overflow-y-auto">
															{#if detail.bahan.length === 0}
																<div class="p-6 text-center text-xs font-bold text-muted-foreground">
																	Belum ada pemakaian bahan baku yang tercatat pada SPK ini.
																</div>
															{:else}
																<table class="w-full text-left text-xs">
																	<thead class="bg-muted/60 border-b border-border font-mono text-[10px] font-black uppercase">
																		<tr>
																			<th class="p-2">Kode Bahan</th>
																			<th class="p-2">Nama Bahan</th>
																			<th class="p-2 text-right">Bags</th>
																			<th class="p-2 text-right">Qty (Kg)</th>
																			<th class="p-2 text-center">Bukti</th>
																		</tr>
																	</thead>
																	<tbody class="divide-y divide-border/40">
																		{#each detail.bahan as b}
																			<tr class="hover:bg-muted/30">
																				<td class="p-2 font-mono font-bold text-primary">{b.itemId}</td>
																				<td class="p-2 font-semibold truncate max-w-44" title={b.itemName ?? ''}>
																					{b.itemName ?? '-'}
																				</td>
																				<td class="p-2 text-right font-mono font-bold">
																					{b.totalBags > 0 ? formatNum(b.totalBags) : '-'}
																				</td>
																				<td class="p-2 text-right font-mono font-black text-amber-700 dark:text-amber-400">
																					{formatNum(b.totalKgs)}
																				</td>
																				<td class="p-2 text-center font-mono text-[10px]">
																					{b.buktiCount}x
																				</td>
																			</tr>
																		{/each}
																	</tbody>
																</table>
															{/if}
														</div>
													</div>

													<!-- KOLOM 2: HASIL (ItemType = 'H') -->
													<div class="bg-card rounded-lg border-2 border-border overflow-hidden brutal-shadow-sm">
														<div class="bg-emerald-500/10 border-b-2 border-border px-3 py-2 flex items-center justify-between">
															<div class="flex items-center gap-2">
																<CheckCircle2 class="size-4 text-emerald-600" />
																<h4 class="font-black text-xs uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
																	Hasil Jadi / WIP (Output H)
																</h4>
															</div>
															<span class="font-mono text-xs font-black text-emerald-800 dark:text-emerald-300">
																{formatNum(detail.totalHasilKgs)} Kg/Pcs
															</span>
														</div>

														<div class="max-h-64 overflow-y-auto">
															{#if detail.hasil.length === 0}
																<div class="p-6 text-center text-xs font-bold text-muted-foreground">
																	Belum ada hasil produksi yang dicatat untuk SPK ini.
																</div>
															{:else}
																<table class="w-full text-left text-xs">
																	<thead class="bg-muted/60 border-b border-border font-mono text-[10px] font-black uppercase">
																		<tr>
																			<th class="p-2">Kode Hasil</th>
																			<th class="p-2">Nama Barang</th>
																			<th class="p-2 text-right">Bags</th>
																			<th class="p-2 text-right">Qty (Kg/Pcs)</th>
																			<th class="p-2 text-center">Bukti</th>
																		</tr>
																	</thead>
																	<tbody class="divide-y divide-border/40">
																		{#each detail.hasil as h}
																			<tr class="hover:bg-muted/30">
																				<td class="p-2 font-mono font-bold text-primary">{h.itemId}</td>
																				<td class="p-2 font-semibold truncate max-w-44" title={h.itemName ?? ''}>
																					{h.itemName ?? '-'}
																				</td>
																				<td class="p-2 text-right font-mono font-bold">
																					{h.totalBags > 0 ? formatNum(h.totalBags) : '-'}
																				</td>
																				<td class="p-2 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
																					{formatNum(h.totalKgs)}
																				</td>
																				<td class="p-2 text-center font-mono text-[10px]">
																					{h.buktiCount}x
																				</td>
																			</tr>
																		{/each}
																	</tbody>
																</table>
															{/if}
														</div>
													</div>
												</div>

												<!-- Ringkasan Bukti Transaksi Produksi -->
												{#if detail.bukti.length > 0}
													<div class="bg-card rounded-lg border-2 border-border p-3 brutal-shadow-sm">
														<div class="flex items-center justify-between mb-2">
															<span class="text-xs font-black uppercase tracking-wide text-muted-foreground">
																Bukti Transaksi Produksi Terkait ({detail.bukti.length} Bukti):
															</span>
															<span class="text-[11px] font-mono font-bold text-muted-foreground">
																Periode: {detail.bukti[detail.bukti.length - 1]?.prodDate ?? '-'} s/d {detail.bukti[0]?.prodDate ?? '-'}
															</span>
														</div>
														<div class="flex flex-wrap gap-2">
															{#each detail.bukti as bk}
																<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted border border-border font-mono text-xs">
																	<span class="font-black text-primary">{bk.prodId}</span>
																	<span class="text-[10px] text-muted-foreground">({bk.prodDate})</span>
																	<span class="text-[10px] font-bold text-amber-700 dark:text-amber-400">B:{formatNum(bk.totalBahanKgs)}</span>
																	<span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">H:{formatNum(bk.totalHasilKgs)}</span>
																</span>
															{/each}
														</div>
													</div>
												{/if}
											</div>
										{/if}
									</TableCell>
								</TableRow>
							{/if}
						{/each}
					{/if}
				</TableBody>
			</Table>
		</div>

		<!-- Pagination Footer -->
		<div class="border-t-[3px] border-border bg-muted/30 px-3 py-2">
			<Pagination
				page={data.page}
				pageSize={data.pageSize}
				total={data.total}
				basePath="/dashboard/laporan-produksi"
				pageSizeOptions={[25, 50, 100, 250]}
				params={{
					dept: data.filters.dept || undefined,
					q: data.filters.q || undefined,
					tgl1: data.filters.tgl1 || undefined,
					tgl2: data.filters.tgl2 || undefined,
					status: data.filters.status !== 'all' ? data.filters.status : undefined
				}}
			/>
		</div>
	</div>
</div>

<!-- MODAL DRILL-DOWN ANALISIS LENGKAP SPK -->
{#if isModalOpen && activeDetailModal}
	<Modal
		title={`Analisis Produksi SPK: ${activeDetailModal.orderId}`}
		open={isModalOpen}
		onclose={() => (isModalOpen = false)}
		size="3xl"
	>
		<div class="space-y-5">
			<!-- Header Info Modal -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 bg-muted/30 p-3 rounded-lg border-2 border-border text-xs">
				<div>
					<span class="block text-[10px] font-black uppercase text-muted-foreground">Nomor SPK</span>
					<span class="font-mono font-black text-primary text-sm">{activeDetailModal.orderId}</span>
				</div>
				<div>
					<span class="block text-[10px] font-black uppercase text-muted-foreground">Departemen</span>
					<span class="font-bold">{activeDetailModal.deptName} ({activeDetailModal.deptId})</span>
				</div>
				<div>
					<span class="block text-[10px] font-black uppercase text-muted-foreground">Target SPK</span>
					<span class="font-mono font-black">{formatNum(activeDetailModal.targetQty)} {activeDetailModal.targetSatuan}</span>
				</div>
				<div>
					<span class="block text-[10px] font-black uppercase text-muted-foreground">Status</span>
					{#if activeDetailModal.isCompleted}
						<span class="font-mono font-black text-emerald-600">SELESAI (COMPLETED)</span>
					{:else}
						<span class="font-mono font-black text-amber-600">SEDANG BERJALAN</span>
					{/if}
				</div>
			</div>

			<!-- Target Item Description -->
			<div class="bg-card p-3 rounded-lg border-2 border-border text-xs flex items-center justify-between">
				<div>
					<span class="block text-[10px] font-black uppercase text-muted-foreground">Barang Target Produksi</span>
					<span class="font-mono font-bold text-primary">{activeDetailModal.targetItemId}</span> — 
					<span class="font-semibold">{activeDetailModal.targetItemName ?? '-'}</span>
				</div>
				{#if activeDetailModal.spkRemark}
					<div class="text-right">
						<span class="block text-[10px] font-black uppercase text-muted-foreground">Keterangan / PO</span>
						<span class="font-semibold">{activeDetailModal.spkRemark}</span>
					</div>
				{/if}
			</div>

			<!-- Komparasi Metrik Hasil vs Bahan -->
			<div class="grid grid-cols-3 gap-3">
				<div class="bg-amber-500/10 p-3 rounded-lg border-2 border-border text-center">
					<span class="block text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">Total Bahan Terpakai</span>
					<span class="font-mono text-lg font-black text-amber-700 dark:text-amber-400">
						{formatNum(activeDetailModal.totalBahanKgs)} Kg
					</span>
					<span class="block text-[10px] font-bold text-muted-foreground mt-0.5">
						{formatNum(activeDetailModal.totalBahanBags)} Bags
					</span>
				</div>

				<div class="bg-emerald-500/10 p-3 rounded-lg border-2 border-border text-center">
					<span class="block text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">Total Hasil Jadi</span>
					<span class="font-mono text-lg font-black text-emerald-700 dark:text-emerald-400">
						{formatNum(activeDetailModal.totalHasilKgs)} Kg/Pcs
					</span>
					<span class="block text-[10px] font-bold text-muted-foreground mt-0.5">
						{formatNum(activeDetailModal.totalHasilBags)} Bags
					</span>
				</div>

				<div class="bg-primary/10 p-3 rounded-lg border-2 border-border text-center">
					<span class="block text-[10px] font-black uppercase text-primary">Capaian Target SPK</span>
					<span class="font-mono text-lg font-black text-primary">
						{formatNum(activeDetailModal.completionPct, 1)}%
					</span>
					<span class="block text-[10px] font-bold text-muted-foreground mt-0.5">
						Rasio H/B: {formatNum(activeDetailModal.yieldPct, 1)}%
					</span>
				</div>
			</div>

			<!-- Rincian Bahan Tabel -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h4 class="font-black text-xs uppercase tracking-wide flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
						<Layers class="size-4" /> Rincian Bahan Baku Terpakai ({activeDetailModal.bahan.length} Item)
					</h4>
				</div>
				<div class="max-h-48 overflow-y-auto rounded-lg border-2 border-border">
					<table class="w-full text-left text-xs">
						<thead class="bg-muted font-mono text-[10px] font-black uppercase sticky top-0 border-b border-border">
							<tr>
								<th class="p-2">Kode Bahan</th>
								<th class="p-2">Nama Bahan</th>
								<th class="p-2 text-right">Bags</th>
								<th class="p-2 text-right">Qty (Kg)</th>
								<th class="p-2 text-center">Frekuensi</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each activeDetailModal.bahan as b}
								<tr>
									<td class="p-2 font-mono font-bold text-primary">{b.itemId}</td>
									<td class="p-2 font-medium">{b.itemName ?? '-'}</td>
									<td class="p-2 text-right font-mono">{b.totalBags > 0 ? formatNum(b.totalBags) : '-'}</td>
									<td class="p-2 text-right font-mono font-black text-amber-700 dark:text-amber-400">{formatNum(b.totalKgs)}</td>
									<td class="p-2 text-center font-mono text-[10px]">{b.buktiCount} Bukti</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Rincian Hasil Tabel -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h4 class="font-black text-xs uppercase tracking-wide flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
						<CheckCircle2 class="size-4" /> Rincian Hasil Produksi ({activeDetailModal.hasil.length} Item)
					</h4>
				</div>
				<div class="max-h-48 overflow-y-auto rounded-lg border-2 border-border">
					<table class="w-full text-left text-xs">
						<thead class="bg-muted font-mono text-[10px] font-black uppercase sticky top-0 border-b border-border">
							<tr>
								<th class="p-2">Kode Hasil</th>
								<th class="p-2">Nama Barang</th>
								<th class="p-2 text-right">Bags</th>
								<th class="p-2 text-right">Qty (Kg/Pcs)</th>
								<th class="p-2 text-center">Frekuensi</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each activeDetailModal.hasil as h}
								<tr>
									<td class="p-2 font-mono font-bold text-primary">{h.itemId}</td>
									<td class="p-2 font-medium">{h.itemName ?? '-'}</td>
									<td class="p-2 text-right font-mono">{h.totalBags > 0 ? formatNum(h.totalBags) : '-'}</td>
									<td class="p-2 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">{formatNum(h.totalKgs)}</td>
									<td class="p-2 text-center font-mono text-[10px]">{h.buktiCount} Bukti</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Bukti Transaksi Produksi Terkait -->
			<div class="space-y-2">
				<h4 class="font-black text-xs uppercase tracking-wide text-muted-foreground">
					Riwayat Bukti Transaksi Produksi ({activeDetailModal.bukti.length} Transaksi)
				</h4>
				<div class="max-h-40 overflow-y-auto rounded-lg border-2 border-border">
					<table class="w-full text-left text-xs">
						<thead class="bg-muted font-mono text-[10px] font-black uppercase sticky top-0 border-b border-border">
							<tr>
								<th class="p-2">No Bukti</th>
								<th class="p-2">Tanggal</th>
								<th class="p-2">Shift</th>
								<th class="p-2">Gudang</th>
								<th class="p-2 text-right">Bahan (Kg)</th>
								<th class="p-2 text-right">Hasil (Kg)</th>
								<th class="p-2">Petugas</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each activeDetailModal.bukti as bk}
								<tr>
									<td class="p-2 font-mono font-bold text-primary">{bk.prodId}</td>
									<td class="p-2 font-mono text-[11px]">{bk.prodDate ?? '-'}</td>
									<td class="p-2 font-mono text-[11px]">{bk.shift ?? '-'}</td>
									<td class="p-2 font-medium">{bk.locName ?? bk.locId ?? '-'}</td>
									<td class="p-2 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
										{formatNum(bk.totalBahanKgs)}
									</td>
									<td class="p-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
										{formatNum(bk.totalHasilKgs)}
									</td>
									<td class="p-2 font-mono text-[10px] text-muted-foreground">{bk.userName ?? '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Footer Modal -->
			<div class="pt-3 border-t-2 border-border flex items-center justify-between">
				<span class="text-xs text-muted-foreground font-bold">
					*Data dihitung secara agregat langsung dari tabel `taPRProdHd` dan `taPRProdDt`.
				</span>
				<Button variant="secondary" onclick={() => (isModalOpen = false)} class="border-2 font-black text-xs">
					Tutup
				</Button>
			</div>
		</div>
	</Modal>
{/if}
