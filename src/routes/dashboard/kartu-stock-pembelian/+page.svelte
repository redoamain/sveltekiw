<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		Badge,
		Button,
		Input,
		Label,
		PageHeader,
		StatCard,
		Table,
		TableHeader,
		TableRow,
		TableHead,
		TableBody,
		TableCell,
		LoadingOverlay,
		Modal,
		SearchInput,
		Alert
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		Search,
		Download,
		Printer,
		RotateCcw,
		Calendar,
		Building2,
		Package,
		Layers,
		X,
		RefreshCw,
		FileSpreadsheet,
		ShoppingCart,
		ChevronLeft,
		ChevronRight,
		Eye,
		SlidersHorizontal
	} from '@lucide/svelte';

	let { data } = $props();

	// Tab state: 'detail' | 'rekap'
	let activeTab = $state<'detail' | 'rekap'>(untrack(() => (data.tab as 'detail' | 'rekap')) || 'detail');

	// ==================== STATE TAB 1: KARTU STOCK DETAIL ====================
	let tgl1 = $state(untrack(() => data.tgl1) || '');
	let tgl2 = $state(untrack(() => data.tgl2) || '');
	let selectedLoc = $state(untrack(() => data.loc) || '%');
	let selectedItemId = $state(untrack(() => data.itemid) || '');

	let stockData = $state<any[]>(untrack(() => data.initialStockData) || []);
	let stockLoading = $state(false);

	// Modal Pencarian Barang Pembelian
	let itemSearchOpen = $state(false);
	let itemSearchQuery = $state('');
	let itemSearchResults = $state<any[]>(untrack(() => data.popularItems) || []);
	let isSearchingItems = $state(false);

	// ==================== STATE TAB 2: REKAP MUTASI SEMUA BARANG ====================
	let rekapTgl1 = $state(untrack(() => data.tgl1) || '');
	let rekapTgl2 = $state(untrack(() => data.tgl2) || '');
	let rekapLoc = $state(untrack(() => data.loc) || '%');
	let rekapHideZero = $state(true);
	let rekapSearch = $state('');
	let rekapLoading = $state(false);
	let rekapData = $state<any>(null);
	let rekapPage = $state(1);
	let rekapPageSize = $state(25);

	const fmt = (n: number | null | undefined) =>
		(Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

	// ==================== TAB 1 METHODS ====================
	async function loadKartuStock(itemIdToLoad?: string) {
		const targetId = (itemIdToLoad ?? selectedItemId).trim();
		if (!targetId) {
			stockData = [];
			return;
		}

		stockLoading = true;
		try {
			const p = new URLSearchParams({
				tgl1: tgl1,
				tgl2: tgl2,
				itemid: targetId,
				loc: selectedLoc || '%'
			});

			const res = await fetch(`/api/monitoring-pembelian/kartustock?${p.toString()}`);
			if (res.ok) {
				stockData = await res.json();
				if (stockData.length > 0) {
					toast.success('Kartu Stock Dimuat', `Ditemukan ${stockData.length} baris pergerakan untuk #${targetId}`);
				} else {
					toast.warning('Data Kosong', `Tidak ada mutasi stok ditemukan untuk #${targetId} pada periode ini`);
				}
				const urlParams = new URLSearchParams({
					tab: 'detail',
					tgl1,
					tgl2,
					itemid: targetId,
					loc: selectedLoc
				});
				goto(`/dashboard/kartu-stock-pembelian?${urlParams.toString()}`, { replaceState: true, keepFocus: true });
			} else {
				stockData = [];
				toast.error('Gagal Memuat Data', 'Tidak dapat mengambil kartu stock dari server');
			}
		} catch (err: any) {
			stockData = [];
			toast.error('Kesalahan Jaringan', err?.message || 'Gagal memuat kartu stock');
		} finally {
			stockLoading = false;
		}
	}

	async function handleItemSearch(q: string) {
		isSearchingItems = true;
		try {
			const res = await fetch(`/api/kartu-stock-pembelian/search-items?q=${encodeURIComponent(q.trim())}`);
			const json = await res.json();
			if (json.items) {
				itemSearchResults = json.items;
			}
		} catch {
			itemSearchResults = [];
		} finally {
			isSearchingItems = false;
		}
	}

	function selectItem(item: any) {
		selectedItemId = item.itemId;
		itemSearchOpen = false;
		toast.info('Barang Pembelian Dipilih', `#${item.itemId} - ${item.itemName || ''}`);
		loadKartuStock(item.itemId);
	}

	function clearItem() {
		selectedItemId = '';
		stockData = [];
		toast.info('Pilihan Direset', 'Filter barang kartu stock pembelian telah dikosongkan');
		goto('/dashboard/kartu-stock-pembelian?tab=detail', { replaceState: true });
	}

	// Kalkulasi running balance & per baris kartu stock di frontend
	let computedStockRows = $derived.by(() => {
		if (!stockData || stockData.length === 0) return [];
		let runningSaldoKg = 0;
		let runningSaldoZak = 0;

		return stockData.map((row) => {
			const kgi = Number(row.KgI) || 0;
			const kgo = Number(row.KgO) || 0;
			const zaki = Number(row.ZakI) || 0;
			const zako = Number(row.ZakO) || 0;

			runningSaldoKg += kgi - kgo;
			runningSaldoZak += zaki - zako;

			return {
				...row,
				KgI: kgi,
				KgO: kgo,
				ZakI: zaki,
				ZakO: zako,
				calculatedSaldoKg: Math.round(runningSaldoKg * 100) / 100,
				calculatedSaldoZak: Math.round(runningSaldoZak * 100) / 100
			};
		});
	});

	// Kalkulasi Statistik Total Tab 1 di frontend
	let stats = $derived.by(() => {
		if (!computedStockRows || computedStockRows.length === 0) {
			return {
				saldoAwal: 0,
				totalMasuk: 0,
				totalKeluar: 0,
				saldoAkhir: 0,
				saldoAwalZak: 0,
				totalMasukZak: 0,
				totalKeluarZak: 0,
				saldoAkhirZak: 0,
				netto: 0,
				nettoZak: 0,
				mutationCount: 0,
				satuan: 'Kg'
			};
		}

		let saldoAwal = 0;
		let totalMasuk = 0;
		let totalKeluar = 0;
		let saldoAwalZak = 0;
		let totalMasukZak = 0;
		let totalKeluarZak = 0;
		let mutationCount = 0;

		for (const row of computedStockRows) {
			const isAwal = (row.Kegiatan || '').trim().toUpperCase() === 'S';
			if (isAwal) {
				saldoAwal += row.KgI;
				saldoAwalZak += row.ZakI;
			} else {
				totalMasuk += row.KgI;
				totalMasukZak += row.ZakI;
				totalKeluar += row.KgO;
				totalKeluarZak += row.ZakO;
				mutationCount++;
			}
		}

		const lastRow = computedStockRows[computedStockRows.length - 1];
		const saldoAkhir = lastRow
			? lastRow.calculatedSaldoKg
			: Math.round((saldoAwal + totalMasuk - totalKeluar) * 100) / 100;
		const saldoAkhirZak = lastRow
			? lastRow.calculatedSaldoZak
			: saldoAwalZak + totalMasukZak - totalKeluarZak;
		const netto = Math.round((totalMasuk - totalKeluar) * 100) / 100;
		const nettoZak = totalMasukZak - totalKeluarZak;
		const satuan = selectedItemSatuan || computedStockRows[0]?.satuan || 'Pcs';

		return {
			saldoAwal: Math.round(saldoAwal * 100) / 100,
			totalMasuk: Math.round(totalMasuk * 100) / 100,
			totalKeluar: Math.round(totalKeluar * 100) / 100,
			saldoAkhir: Math.round(saldoAkhir * 100) / 100,
			saldoAwalZak: Math.round(saldoAwalZak * 100) / 100,
			totalMasukZak: Math.round(totalMasukZak * 100) / 100,
			totalKeluarZak: Math.round(totalKeluarZak * 100) / 100,
			saldoAkhirZak: Math.round(saldoAkhirZak * 100) / 100,
			netto,
			nettoZak,
			mutationCount,
			satuan
		};
	});

	let currentWarehouseName = $derived(
		selectedLoc && selectedLoc !== '%'
			? data.warehouses.find((w: any) => w.locId === selectedLoc)?.locName || selectedLoc
			: 'Semua Gudang'
	);

	let selectedItem = $derived(
		data.popularItems?.find((it: any) => it.itemId === selectedItemId)
	);

	let selectedItemName = $derived(
		stockData.length > 0 && stockData[0].ItemName
			? stockData[0].ItemName
			: selectedItem?.itemName || ''
	);

	let selectedItemSatuan = $derived(
		stockData.length > 0 && stockData[0].satuan
			? stockData[0].satuan
			: selectedItem?.satuan || 'Pcs'
	);

	let exportDetailUrl = $derived(
		`/api/kartu-stock-pembelian/export?itemid=${encodeURIComponent(selectedItemId)}&loc=${encodeURIComponent(
			selectedLoc === '%' ? '' : selectedLoc
		)}&tgl1=${encodeURIComponent(tgl1)}&tgl2=${encodeURIComponent(tgl2)}`
	);

	// ==================== TAB 2 (REKAP) METHODS & COMPUTED ====================
	async function loadRekapMutasi() {
		rekapLoading = true;
		rekapPage = 1;
		try {
			const p = new URLSearchParams({
				tgl1: rekapTgl1,
				tgl2: rekapTgl2,
				loc: rekapLoc || '%',
				hideZero: String(rekapHideZero)
			});

			const res = await fetch(`/api/kartu-stock-pembelian/rekap?${p.toString()}`);
			if (res.ok) {
				rekapData = await res.json();
				toast.success(
					'Rekap Mutasi Dimuat',
					`Berhasil memuat ${rekapData.totalRows.toLocaleString('id-ID')} jenis barang pembelian`
				);
			} else {
				const errJson = await res.json().catch(() => ({}));
				toast.error('Gagal Memuat Rekap', errJson.error || 'Terjadi kesalahan pada server');
			}
		} catch (err: any) {
			toast.error('Kesalahan Jaringan', err?.message || 'Gagal memuat data rekap');
		} finally {
			rekapLoading = false;
		}
	}

	// Filter pencarian client-side di Tab 2
	let filteredRekapRows = $derived.by(() => {
		if (!rekapData?.rows) return [];
		const q = rekapSearch.trim().toLowerCase();
		if (!q) return rekapData.rows;
		return rekapData.rows.filter(
			(r: any) =>
				(r.itemId && r.itemId.toLowerCase().includes(q)) ||
				(r.itemName && r.itemName.toLowerCase().includes(q)) ||
				(r.satuan && r.satuan.toLowerCase().includes(q))
		);
	});

	let totalRekapPages = $derived(
		Math.max(1, Math.ceil(filteredRekapRows.length / rekapPageSize))
	);

	let paginatedRekapRows = $derived.by(() => {
		const start = (rekapPage - 1) * rekapPageSize;
		return filteredRekapRows.slice(start, start + rekapPageSize);
	});

	let exportRekapUrl = $derived(
		`/api/kartu-stock-pembelian/export-rekap?tgl1=${encodeURIComponent(rekapTgl1)}&tgl2=${encodeURIComponent(
			rekapTgl2
		)}&loc=${encodeURIComponent(rekapLoc)}&hideZero=${rekapHideZero}`
	);

	function drillDownToDetail(itemId: string) {
		selectedItemId = itemId;
		activeTab = 'detail';
		tgl1 = rekapTgl1;
		tgl2 = rekapTgl2;
		selectedLoc = rekapLoc;
		toast.info('Beralih ke Kartu Stock', `Memuat mutasi untuk #${itemId}`);
		loadKartuStock(itemId);
	}
</script>

<svelte:head>
	<title>Kartu Stock Barang Pembelian | KIW Inventori</title>
</svelte:head>

<div class="space-y-6 print:m-0 print:p-0">
	<!-- Page Header -->
	<PageHeader
		title="Kartu Stock Barang Pembelian"
		description="Monitoring Stok Khusus Barang Pembelian (taTransIDT) — Kartu mutasi individual per barang dan rekapitulasi mutasi seluruh stok barang pembelian."
	>
		{#snippet actions()}
			<div class="flex items-center gap-2 print:hidden">
				{#if activeTab === 'detail'}
					<Badge variant="primary" class="border-[3px] font-mono font-black">
						{stats.mutationCount > 0 ? stats.mutationCount : computedStockRows.length} Mutasi
					</Badge>
					{#if selectedItemId && computedStockRows.length > 0}
						<a
							href={exportDetailUrl}
							download
							onclick={() => toast.info('Export Excel', 'Mengunduh kartu stock per item...')}
						>
							<Button
								variant="outline"
								size="sm"
								class="h-9 border-[3px] font-black text-xs uppercase brutal-shadow-sm flex items-center gap-1.5 cursor-pointer"
							>
								<Download class="size-4" />
								Export Excel
							</Button>
						</a>
					{/if}
					<Button
						variant="outline"
						size="sm"
						class="h-9 border-[3px] font-black text-xs uppercase brutal-shadow-sm flex items-center gap-1.5 cursor-pointer"
						onclick={() => {
							toast.info('Cetak Laporan', 'Menyiapkan dokumen kartu stock untuk dicetak...');
							window.print();
						}}
					>
						<Printer class="size-4" />
						Cetak
					</Button>
				{:else}
					{#if rekapData?.summary}
						<Badge variant="primary" class="border-[3px] font-mono font-black">
							{filteredRekapRows.length} / {rekapData.totalRows} Barang
						</Badge>
						<a
							href={exportRekapUrl}
							download
							onclick={() => toast.info('Export Excel', 'Mengunduh rekap mutasi seluruh barang pembelian...')}
						>
							<Button
								variant="outline"
								size="sm"
								class="h-9 border-[3px] font-black text-xs uppercase brutal-shadow-sm flex items-center gap-1.5 cursor-pointer"
							>
								<FileSpreadsheet class="size-4 text-emerald-600" />
								Export Excel Rekap
							</Button>
						</a>
					{/if}
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	{#if data.error}
		<Alert variant="error" title="Gagal Memuat Data" dismissible class="print:hidden">
			{data.error}
		</Alert>
	{/if}

	<!-- Tab Switcher Navigation -->
	<div class="flex items-center gap-2 border-b-2 border-border pb-3 print:hidden">
		<button
			type="button"
			onclick={() => (activeTab = 'detail')}
			class="flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs font-black uppercase transition cursor-pointer border-[3px] {activeTab === 'detail'
				? 'bg-primary text-primary-foreground border-black brutal-shadow-sm'
				: 'bg-card text-muted-foreground border-border hover:bg-muted/60'}"
		>
			<Package class="size-4" />
			<span>Kartu Stock Detail (Per Item)</span>
			{#if selectedItemId}
				<Badge variant="outline" class="font-mono text-[10px] ml-1 bg-white text-black border-black font-black">
					#{selectedItemId}
				</Badge>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => {
				activeTab = 'rekap';
				if (!rekapData && !rekapLoading) {
					loadRekapMutasi();
				}
			}}
			class="flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs font-black uppercase transition cursor-pointer border-[3px] {activeTab === 'rekap'
				? 'bg-primary text-primary-foreground border-black brutal-shadow-sm'
				: 'bg-card text-muted-foreground border-border hover:bg-muted/60'}"
		>
			<Layers class="size-4" />
			<span>Rekap Mutasi Semua Barang (taTransIDT)</span>
			{#if rekapData?.totalRows}
				<Badge variant="outline" class="font-mono text-[10px] ml-1 bg-white text-black border-black font-black">
					{rekapData.totalRows} Barang
				</Badge>
			{/if}
		</button>
	</div>

	<!-- ========================================================================= -->
	<!--                             TAB 1: DETAIL PER ITEM                        -->
	<!-- ========================================================================= -->
	{#if activeTab === 'detail'}
		<!-- Stat cards brutal per item -->
		{#if selectedItemId}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatCard
					label="Saldo Awal"
					value="{fmt(stats.saldoAwal)} {stats.satuan}"
					tone="primary"
					icon="⚖"
				/>
				<StatCard
					label="Total Masuk (IN)"
					value="+{fmt(stats.totalMasuk)} {stats.satuan}"
					tone="success"
					icon="↓"
				/>
				<StatCard
					label="Total Keluar (OUT)"
					value="-{fmt(stats.totalKeluar)} {stats.satuan}"
					tone="error"
					icon="↑"
				/>
				<StatCard
					label="Saldo Akhir"
					value="{fmt(stats.saldoAkhir)} {stats.satuan}"
					tone="warning"
					icon="✓"
				/>
			</div>
		{/if}

		<!-- Filter bar Tab 1 -->
		<form
			onsubmit={(e) => {
				e.preventDefault();
				loadKartuStock();
			}}
			class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3 print:hidden"
		>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<!-- Tgl Mulai -->
				<div class="space-y-1">
					<Label for="tgl1" class="font-mono text-xs font-black uppercase tracking-wider">Tgl Mulai</Label>
					<Input
						type="date"
						id="tgl1"
						name="tgl1"
						bind:value={tgl1}
						class="h-11 border-[3px] font-bold"
					/>
				</div>

				<!-- Tgl Akhir -->
				<div class="space-y-1">
					<Label for="tgl2" class="font-mono text-xs font-black uppercase tracking-wider">Tgl Akhir</Label>
					<Input
						type="date"
						id="tgl2"
						name="tgl2"
						bind:value={tgl2}
						class="h-11 border-[3px] font-bold"
					/>
				</div>

				<!-- Gudang / Lokasi -->
				<div class="space-y-1">
					<Label class="font-mono text-xs font-black uppercase tracking-wider">Gudang</Label>
					<select
						bind:value={selectedLoc}
						class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase brutal-shadow-sm focus:outline-none"
					>
						<option value="%">Semua Gudang</option>
						{#each data.warehouses as w}
							<option value={w.locId}>{w.locName} ({w.locId})</option>
						{/each}
					</select>
				</div>

				<!-- Kode Barang Pembelian Picker (taTransIDT) -->
				<div class="space-y-1 sm:col-span-2">
					<div class="flex items-center justify-between">
						<Label for="itemid" class="font-mono text-xs font-black uppercase tracking-wider">
							Kode Barang Pembelian *
						</Label>
						<span class="text-[10px] font-mono text-muted-foreground uppercase font-bold">Sumber: taTransIDT</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="relative flex-1">
							<button
								type="button"
								onclick={() => {
									itemSearchQuery = '';
									itemSearchOpen = true;
								}}
								class="flex h-11 w-full items-center justify-between rounded-lg border-[3px] border-border bg-card px-3 text-left font-mono text-sm font-bold brutal-shadow-sm hover:bg-muted/40 cursor-pointer"
							>
								{#if selectedItemId}
									<span class="truncate font-black text-foreground">
										{selectedItemId} {selectedItemName ? `— ${selectedItemName}` : ''}
									</span>
								{:else}
									<span class="text-muted-foreground font-sans text-xs">
										-- Klik untuk cari barang dari riwayat taTransIDT --
									</span>
								{/if}
								<Search class="size-4 shrink-0 text-muted-foreground ml-2" />
							</button>
						</div>

						{#if selectedItemId}
							<button
								type="button"
								onclick={clearItem}
								title="Hapus pilihan"
								class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-[3px] border-border bg-error text-error-foreground brutal-shadow-sm hover:bg-error/90 cursor-pointer"
							>
								<X class="size-5" />
							</button>
						{/if}

						<Button
							type="submit"
							class="h-11 border-[3px] font-black text-xs uppercase brutal-shadow-sm shrink-0 px-5 cursor-pointer"
							disabled={stockLoading || !selectedItemId.trim()}
						>
							{#if stockLoading}
								<RefreshCw class="size-4 animate-spin" />
							{:else}
								Cari
							{/if}
						</Button>
					</div>
				</div>
			</div>
		</form>

		<!-- Detail Table / Empty State -->
		{#if selectedItemId}
			<div class="space-y-3">
				<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow space-y-3">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex flex-wrap items-center gap-2">
							<span class="font-mono text-xs font-black uppercase text-foreground">
								Kartu Stock Pembelian:
							</span>
							<Badge variant="secondary" class="border-[2px] font-mono text-xs font-black">
								#{selectedItemId}
							</Badge>
							{#if selectedItemName}
								<span class="text-sm font-bold text-foreground">
									{selectedItemName}
								</span>
							{/if}
							<Badge variant="outline" class="font-mono text-[10px]">
								{tgl1} s/d {tgl2}
							</Badge>
							<Badge variant="outline" class="font-mono text-[10px]">
								{currentWarehouseName}
							</Badge>
							<Badge variant="outline" class="font-mono text-[10px] border-primary text-primary font-black bg-primary/5">
								Satuan: {stats.satuan}
							</Badge>
						</div>
						{#if stockLoading}
							<span class="font-mono text-xs text-muted-foreground animate-pulse">Memuat data mutasi...</span>
						{/if}
					</div>

					{#if computedStockRows.length > 0}
						<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t-2 border-border/40 text-xs font-mono">
							<div class="flex flex-wrap items-center gap-1.5">
								<span class="font-bold text-muted-foreground uppercase text-[11px]">Kalkulasi Mutasi:</span>
								<span class="font-bold text-foreground bg-muted/70 px-2 py-0.5 rounded border border-border">
									Saldo Awal ({fmt(stats.saldoAwal)}) + Masuk ({fmt(stats.totalMasuk)}) - Keluar ({fmt(stats.totalKeluar)}) = Saldo Akhir ({fmt(stats.saldoAkhir)} {stats.satuan})
								</span>
							</div>
						</div>
					{/if}
				</div>

				{#if stockLoading}
					<div class="rounded-xl border-[3px] border-border bg-card p-12 text-center brutal-shadow">
						<div class="flex flex-col items-center justify-center gap-3">
							<RefreshCw class="size-8 animate-spin text-primary" />
							<p class="font-mono text-sm font-bold text-muted-foreground animate-pulse">
								Memuat mutasi kartu stock barang pembelian...
							</p>
						</div>
					</div>
				{:else if computedStockRows.length === 0}
					<div class="rounded-xl border-[3px] border-border bg-card p-8 text-center brutal-shadow">
						<p class="font-mono text-xs text-muted-foreground">
							Tidak ada pergerakan stock pada rentang tanggal ini untuk barang #{selectedItemId}.
						</p>
					</div>
				{:else}
					<div class="overflow-x-auto rounded-xl border-[3px] border-border bg-card brutal-shadow">
						<Table wrapperClass="border-0 shadow-none rounded-none">
							<TableHeader>
								<TableRow class="bg-muted/60">
									<TableHead class="font-mono text-[10px] font-black uppercase">Tanggal</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase">Gudang</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase">Kegiatan</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase text-right">Masuk ({stats.satuan})</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase text-right">Keluar ({stats.satuan})</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase text-right">Saldo ({stats.satuan})</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase">No Memo / Doc</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase">Keterangan / Supplier</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each computedStockRows as st}
									{@const isSaldoAwal = (st.Kegiatan || '').trim().toUpperCase() === 'S'}
									<TableRow class="hover:bg-primary/5 {isSaldoAwal ? 'bg-muted/40 font-bold' : ''}">
										<TableCell class="font-mono text-xs whitespace-nowrap">{st.MoveDate || '-'}</TableCell>
										<TableCell class="font-mono text-xs whitespace-nowrap">{st.LocName}</TableCell>
										<TableCell>
											{#if isSaldoAwal}
												<Badge variant="outline" class="font-mono text-[10px] font-black border-primary text-primary bg-primary/10">
													SALDO AWAL (S)
												</Badge>
											{:else if st.Kegiatan === 'B'}
												<Badge variant="default" class="font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-800 border-emerald-600">
													PEMBELIAN (B)
												</Badge>
											{:else}
												<Badge variant="secondary" class="font-mono text-[10px] font-bold">
													{st.Kegiatan}
												</Badge>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-bold {isSaldoAwal ? 'text-primary' : 'text-success'}">
											{#if isSaldoAwal}
												<span title="Saldo Awal">{fmt(st.KgI)}</span>
											{:else if st.KgI > 0}
												+{fmt(st.KgI)}
											{:else}
												<span class="text-muted-foreground font-normal">-</span>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-bold text-error">
											{#if st.KgO > 0}
												-{fmt(st.KgO)}
											{:else}
												<span class="text-muted-foreground font-normal">-</span>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-black">
											{fmt(st.calculatedSaldoKg)}
										</TableCell>
										<TableCell class="font-mono text-xs text-muted-foreground whitespace-nowrap">
											{st.NoMemo || st.NoDoc || '-'}
										</TableCell>
										<TableCell class="font-mono text-xs text-muted-foreground max-w-xs truncate">
											{st.Keterangan || (isSaldoAwal ? 'Saldo Awal Periode' : '-')}
										</TableCell>
									</TableRow>
								{/each}

								<!-- TOTAL SUMMARY ROW -->
								<TableRow class="bg-muted/90 border-t-[3px] border-border font-black text-foreground hover:bg-muted">
									<TableCell colspan={3} class="font-mono text-xs font-black uppercase text-right tracking-wider py-3.5">
										TOTAL MUTASI ({stats.mutationCount} MUTASI):
									</TableCell>
									<TableCell class="font-mono text-xs text-right font-black text-success py-3.5">
										+{fmt(stats.totalMasuk)}
									</TableCell>
									<TableCell class="font-mono text-xs text-right font-black text-error py-3.5">
										-{fmt(stats.totalKeluar)}
									</TableCell>
									<TableCell class="font-mono text-xs text-right font-black text-foreground bg-primary/10 py-3.5 border-x-2 border-border">
										{fmt(stats.saldoAkhir)}
									</TableCell>
									<TableCell colspan={2} class="font-mono text-[11px] text-muted-foreground font-bold py-3.5">
										{#if stats.saldoAwal > 0}
											<span class="block text-[11px] text-muted-foreground">
												(Saldo Awal: {fmt(stats.saldoAwal)} {stats.satuan})
											</span>
										{/if}
									</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Belum Memilih Barang Tab 1 -->
			<div class="rounded-xl border-[3px] border-border bg-card p-8 text-center brutal-shadow space-y-4">
				<div class="mx-auto flex size-14 items-center justify-center rounded-xl border-[3px] border-border bg-primary text-primary-foreground brutal-shadow-sm">
					<ShoppingCart class="size-7" />
				</div>
				<div class="space-y-1">
					<h3 class="font-black text-lg uppercase tracking-tight text-foreground">
						Pilih Barang Pembelian (taTransIDT)
					</h3>
					<p class="font-mono text-xs text-muted-foreground max-w-md mx-auto">
						Halaman ini khusus memuat pergerakan kartu stok untuk barang-barang yang memiliki riwayat transaksi pembelian di tabel <code class="bg-muted px-1.5 py-0.5 rounded font-bold">taTransIDT</code>. Anda juga dapat melihat ringkasan seluruh barang di tab <b>Rekap Mutasi Semua Barang</b>.
					</p>
				</div>

				<div class="pt-2 flex flex-wrap items-center justify-center gap-3">
					<Button
						onclick={() => {
							itemSearchQuery = '';
							itemSearchOpen = true;
						}}
						class="h-11 border-[3px] font-black text-xs uppercase brutal-shadow-sm px-6 cursor-pointer"
					>
						<Search class="size-4 mr-2" />
						Cari Barang Pembelian
					</Button>

					<Button
						variant="outline"
						onclick={() => {
							activeTab = 'rekap';
							if (!rekapData && !rekapLoading) {
								loadRekapMutasi();
							}
						}}
						class="h-11 border-[3px] font-black text-xs uppercase brutal-shadow-sm px-6 cursor-pointer"
					>
						<Layers class="size-4 mr-2" />
						Lihat Rekap Semua Barang
					</Button>
				</div>

				{#if data.popularItems && data.popularItems.length > 0}
					<div class="border-t border-border pt-6 mt-6 text-left max-w-3xl mx-auto">
						<p class="font-mono text-xs font-black uppercase text-muted-foreground mb-3 flex items-center justify-between">
							<span>Barang Pembelian Populer (taTransIDT):</span>
							<span class="text-[10px] text-muted-foreground">Klik item untuk langsung memuat kartu stok</span>
						</p>
						<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
							{#each data.popularItems as item}
								<button
									type="button"
									onclick={() => selectItem(item)}
									class="flex items-center justify-between rounded-lg border-2 border-border bg-background p-2.5 text-left brutal-shadow-sm hover:bg-primary/10 transition cursor-pointer"
								>
									<div class="min-w-0 flex-1">
										<div class="font-mono text-xs font-black text-foreground truncate">#{item.itemId}</div>
										<div class="text-[11px] text-muted-foreground truncate">{item.itemName || '-'}</div>
									</div>
									<Badge variant="outline" class="font-mono text-[10px] ml-2 shrink-0">
										{item.satuan}
									</Badge>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

	<!-- ========================================================================= -->
	<!--                 TAB 2: REKAP MUTASI SEMUA BARANG PEMBELIAN                -->
	<!-- ========================================================================= -->
	{:else if activeTab === 'rekap'}
		<!-- Stat cards Tab 2 (Rekapitulasi) -->
		{#if rekapData?.summary}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatCard
					label="Total Saldo Awal"
					value="{fmt(rekapData.summary.totalSaldoAwalKg)} Qty"
					tone="primary"
					icon="⚖"
				/>
				<StatCard
					label="Total Masuk (IN)"
					value="+{fmt(rekapData.summary.totalMasukKg)} Qty"
					tone="success"
					icon="↓"
				/>
				<StatCard
					label="Total Keluar (OUT)"
					value="-{fmt(rekapData.summary.totalKeluarKg)} Qty"
					tone="error"
					icon="↑"
				/>
				<StatCard
					label="Total Saldo Akhir"
					value="{fmt(rekapData.summary.totalSaldoAkhirKg)} Qty"
					tone="warning"
					icon="✓"
				/>
			</div>
		{/if}

		<!-- Filter bar Tab 2 -->
		<form
			onsubmit={(e) => {
				e.preventDefault();
				loadRekapMutasi();
			}}
			class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3 print:hidden"
		>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
				<!-- Tgl Mulai -->
				<div class="space-y-1">
					<Label for="rekapTgl1" class="font-mono text-xs font-black uppercase tracking-wider">Tgl Mulai</Label>
					<Input
						type="date"
						id="rekapTgl1"
						bind:value={rekapTgl1}
						class="h-11 border-[3px] font-bold"
					/>
				</div>

				<!-- Tgl Akhir -->
				<div class="space-y-1">
					<Label for="rekapTgl2" class="font-mono text-xs font-black uppercase tracking-wider">Tgl Akhir</Label>
					<Input
						type="date"
						id="rekapTgl2"
						bind:value={rekapTgl2}
						class="h-11 border-[3px] font-bold"
					/>
				</div>

				<!-- Gudang / Lokasi -->
				<div class="space-y-1">
					<Label class="font-mono text-xs font-black uppercase tracking-wider">Gudang</Label>
					<select
						bind:value={rekapLoc}
						class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase brutal-shadow-sm focus:outline-none"
					>
						<option value="%">Semua Gudang</option>
						{#each data.warehouses as w}
							<option value={w.locId}>{w.locName} ({w.locId})</option>
						{/each}
					</select>
				</div>

				<!-- Sembunyikan Saldo Nol Checkbox -->
				<div class="flex items-center gap-2 h-11 px-3 border-[3px] border-border bg-background rounded-lg brutal-shadow-sm">
					<input
						type="checkbox"
						id="hideZeroCheck"
						bind:checked={rekapHideZero}
						class="size-4 accent-primary cursor-pointer"
					/>
					<label for="hideZeroCheck" class="font-mono text-xs font-black uppercase tracking-tight text-foreground cursor-pointer select-none">
						Sembunyikan Saldo Nol (0)
					</label>
				</div>

				<!-- Tombol Eksekusi -->
				<div class="flex items-center gap-2">
					<Button
						type="submit"
						class="h-11 w-full border-[3px] font-black text-xs uppercase brutal-shadow-sm cursor-pointer"
						disabled={rekapLoading}
					>
						{#if rekapLoading}
							<RefreshCw class="size-4 mr-2 animate-spin" />
							Memuat...
						{:else}
							<RefreshCw class="size-4 mr-2" />
							Muat Rekap
						{/if}
					</Button>
				</div>
			</div>
		</form>

		<!-- Konten Data Rekap -->
		{#if rekapLoading}
			<div class="rounded-xl border-[3px] border-border bg-card p-12 text-center brutal-shadow">
				<div class="flex flex-col items-center justify-center gap-3">
					<RefreshCw class="size-8 animate-spin text-primary" />
					<p class="font-mono text-sm font-bold text-foreground">
						Mengkalkulasi rekapitulasi mutasi stok semua barang pembelian...
					</p>
					<p class="font-mono text-xs text-muted-foreground">
						Menghubungkan data pergerakan gudang dengan riwayat transaksi taTransIDT.
					</p>
				</div>
			</div>
		{:else if !rekapData}
			<div class="rounded-xl border-[3px] border-border bg-card p-10 text-center brutal-shadow space-y-3">
				<div class="mx-auto flex size-14 items-center justify-center rounded-xl border-[3px] border-border bg-primary text-primary-foreground brutal-shadow-sm">
					<Layers class="size-7" />
				</div>
				<h3 class="font-black text-lg uppercase tracking-tight text-foreground">
					Rekap Mutasi Stok Semua Barang Pembelian
				</h3>
				<p class="font-mono text-xs text-muted-foreground max-w-lg mx-auto">
					Tampilkan ringkasan mutasi (Saldo Awal, Masuk, Keluar, Saldo Akhir) untuk seluruh barang pembelian yang tercatat di <code class="bg-muted px-1.5 py-0.5 rounded font-bold">taTransIDT</code>.
				</p>
				<div class="pt-2">
					<Button
						onclick={loadRekapMutasi}
						class="h-11 border-[3px] font-black text-xs uppercase brutal-shadow-sm px-6 cursor-pointer"
					>
						<RefreshCw class="size-4 mr-2" />
						Muat Rekap Sekarang
					</Button>
				</div>
			</div>
		{:else}
			<!-- Tabel Rekapitulasi dengan Pagination & Search Bar Instant -->
			<div class="space-y-3">
				<!-- Search Filter & Summary Bar -->
				<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<div class="flex items-center gap-2 flex-1 max-w-md">
						<SearchInput
							bind:value={rekapSearch}
							placeholder="Cari kode atau nama barang di tabel rekap..."
							class="w-full"
						/>
						{#if rekapSearch}
							<Button
								variant="outline"
								size="sm"
								onclick={() => (rekapSearch = '')}
								class="h-10 border-[2px] font-bold text-xs"
							>
								Reset
							</Button>
						{/if}
					</div>

					<div class="flex items-center gap-3 justify-between sm:justify-end">
						<span class="font-mono text-xs text-muted-foreground font-bold">
							Menampilkan {filteredRekapRows.length} dari {rekapData.totalRows} barang
						</span>
						<a
							href={exportRekapUrl}
							download
							onclick={() => toast.info('Export Excel', 'Mengunduh rekap mutasi seluruh barang...')}
						>
							<Button
								variant="outline"
								size="sm"
								class="h-9 border-[3px] font-black text-xs uppercase brutal-shadow-sm flex items-center gap-1.5 cursor-pointer"
							>
								<FileSpreadsheet class="size-4 text-emerald-600" />
								Export Excel
							</Button>
						</a>
					</div>
				</div>

				{#if filteredRekapRows.length === 0}
					<div class="rounded-xl border-[3px] border-border bg-card p-8 text-center brutal-shadow">
						<p class="font-mono text-xs text-muted-foreground">
							Tidak ada barang pembelian yang cocok dengan kata kunci "{rekapSearch}".
						</p>
					</div>
				{:else}
					<div class="overflow-x-auto rounded-xl border-[3px] border-border bg-card brutal-shadow">
						<Table wrapperClass="border-0 shadow-none rounded-none">
							<TableHeader>
								<TableRow class="bg-muted/60">
									<TableHead class="font-mono text-[10px] font-black uppercase w-12 text-center">No</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase">Kode Barang</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase min-w-[220px]">Nama Barang</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase">Satuan</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase text-right">Saldo Awal</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase text-right">Masuk (+)</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase text-right">Keluar (-)</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase text-right">Saldo Akhir</TableHead>
									<TableHead class="font-mono text-[10px] font-black uppercase text-center w-28">Aksi</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each paginatedRekapRows as row, idx}
									<TableRow class="hover:bg-primary/5">
										<TableCell class="font-mono text-xs text-center text-muted-foreground">
											{(rekapPage - 1) * rekapPageSize + idx + 1}
										</TableCell>
										<TableCell class="font-mono text-xs font-black whitespace-nowrap text-foreground">
											#{row.itemId}
										</TableCell>
										<TableCell class="text-xs font-bold text-foreground">
											<div class="truncate max-w-sm" title={row.itemName}>
												{row.itemName || '-'}
											</div>
										</TableCell>
										<TableCell>
											<Badge variant="outline" class="font-mono text-[10px] font-bold">
												{row.satuan}
											</Badge>
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-bold text-foreground">
											{fmt(row.saldoAwalKg)}
											<span class="text-[10px] text-muted-foreground uppercase font-black ml-1">{row.satuan}</span>
											{#if row.saldoAwalZak > 0}
												<span class="block text-[10px] text-muted-foreground font-normal">
													({fmt(row.saldoAwalZak)} Zak)
												</span>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-bold text-success">
											{#if row.masukKg > 0}
												+{fmt(row.masukKg)}
												<span class="text-[10px] text-emerald-700/80 uppercase font-black ml-1">{row.satuan}</span>
												{#if row.masukZak > 0}
													<span class="block text-[10px] text-muted-foreground font-normal">
														(+{fmt(row.masukZak)} Zak)
													</span>
												{/if}
											{:else}
												<span class="text-muted-foreground font-normal">-</span>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-bold text-error">
											{#if row.keluarKg > 0}
												-{fmt(row.keluarKg)}
												<span class="text-[10px] text-red-700/80 uppercase font-black ml-1">{row.satuan}</span>
												{#if row.keluarZak > 0}
													<span class="block text-[10px] text-muted-foreground font-normal">
														(-{fmt(row.keluarZak)} Zak)
													</span>
												{/if}
											{:else}
												<span class="text-muted-foreground font-normal">-</span>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-black text-foreground bg-primary/5">
											{fmt(row.saldoAkhirKg)}
											<span class="text-[10px] text-muted-foreground uppercase font-black ml-1">{row.satuan}</span>
											{#if row.saldoAkhirZak !== 0}
												<span class="block text-[10px] text-muted-foreground font-normal">
													({fmt(row.saldoAkhirZak)} Zak)
												</span>
											{/if}
										</TableCell>
										<TableCell class="text-center">
											<Button
												variant="outline"
												size="sm"
												onclick={() => drillDownToDetail(row.itemId)}
												title="Lihat riwayat kartu stock item ini"
												class="h-8 border-[2px] font-black text-[11px] uppercase brutal-shadow-sm px-2.5 cursor-pointer hover:bg-primary hover:text-primary-foreground transition"
											>
												<Eye class="size-3.5 mr-1" />
												Detail
											</Button>
										</TableCell>
									</TableRow>
								{/each}

								<!-- TOTAL SUMMARY BAR ROW -->
								{#if rekapData?.summary}
									<TableRow class="bg-muted/90 border-t-[3px] border-border font-black text-foreground hover:bg-muted">
										<TableCell colspan={4} class="font-mono text-xs font-black uppercase text-right tracking-wider py-3.5">
											TOTAL SEMUA ({rekapData.summary.totalItems} BARANG):
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-black text-foreground py-3.5">
											{fmt(rekapData.summary.totalSaldoAwalKg)}
											{#if rekapData.summary.totalSaldoAwalZak > 0}
												<span class="block text-[10px] text-muted-foreground font-normal">
													({fmt(rekapData.summary.totalSaldoAwalZak)} Zak)
												</span>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-black text-success py-3.5">
											+{fmt(rekapData.summary.totalMasukKg)}
											{#if rekapData.summary.totalMasukZak > 0}
												<span class="block text-[10px] text-muted-foreground font-normal">
													(+{fmt(rekapData.summary.totalMasukZak)} Zak)
												</span>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-black text-error py-3.5">
											-{fmt(rekapData.summary.totalKeluarKg)}
											{#if rekapData.summary.totalKeluarZak > 0}
												<span class="block text-[10px] text-muted-foreground font-normal">
													(-{fmt(rekapData.summary.totalKeluarZak)} Zak)
												</span>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs text-right font-black text-foreground bg-primary/10 py-3.5 border-x-2 border-border">
											{fmt(rekapData.summary.totalSaldoAkhirKg)}
											{#if rekapData.summary.totalSaldoAkhirZak !== 0}
												<span class="block text-[10px] text-muted-foreground font-normal">
													({fmt(rekapData.summary.totalSaldoAkhirZak)} Zak)
												</span>
											{/if}
										</TableCell>
										<TableCell class="py-3.5 text-center">
											<Badge variant="default" class="font-mono text-[10px] font-black uppercase">
												REKAP
											</Badge>
										</TableCell>
									</TableRow>
								{/if}
							</TableBody>
						</Table>
					</div>

					<!-- Pagination Bar -->
					<div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 font-mono text-xs print:hidden">
						<div class="flex items-center gap-2 text-muted-foreground">
							<span>Baris per halaman:</span>
							<select
								bind:value={rekapPageSize}
								onchange={() => (rekapPage = 1)}
								class="bg-card border-2 border-border rounded px-2 py-1 font-bold text-foreground focus:outline-none"
							>
								<option value={25}>25</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
								<option value={200}>200</option>
							</select>
							<span>
								Halaman {rekapPage} dari {totalRekapPages} ({filteredRekapRows.length} total)
							</span>
						</div>

						<div class="flex items-center gap-1.5">
							<Button
								variant="outline"
								size="sm"
								onclick={() => (rekapPage = Math.max(1, rekapPage - 1))}
								disabled={rekapPage <= 1}
								class="h-9 border-2 font-bold px-3 cursor-pointer"
							>
								<ChevronLeft class="size-4 mr-1" />
								Sebelumnya
							</Button>

							<span class="px-3 py-1.5 rounded border-2 border-border bg-card font-black">
								{rekapPage} / {totalRekapPages}
							</span>

							<Button
								variant="outline"
								size="sm"
								onclick={() => (rekapPage = Math.min(totalRekapPages, rekapPage + 1))}
								disabled={rekapPage >= totalRekapPages}
								class="h-9 border-2 font-bold px-3 cursor-pointer"
							>
								Berikutnya
								<ChevronRight class="size-4 ml-1" />
							</Button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- ==================== MODAL PENCARIAN BARANG PEMBELIAN ==================== -->
<Modal
	bind:open={itemSearchOpen}
	title="PILIH BARANG PEMBELIAN (taTransIDT)"
	subtitle="Daftar item diambil khusus dari histori transaksi pembelian taTransIDT"
	icon={ShoppingCart}
	size="2xl"
>
	<div class="space-y-4">
		<SearchInput
			bind:value={itemSearchQuery}
			placeholder="Ketik kode atau nama barang pembelian..."
			loading={isSearchingItems}
			debounceMs={300}
			onsearch={handleItemSearch}
		/>

		<div class="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
			{#if itemSearchResults.length === 0}
				<div class="py-8 text-center font-mono text-xs text-muted-foreground border-2 border-dashed border-black/20 p-6">
					Tidak ada barang pembelian yang cocok dengan kata kunci "{itemSearchQuery}".
				</div>
			{:else}
				{#each itemSearchResults as item}
					<button
						type="button"
						onclick={() => selectItem(item)}
						class="flex w-full items-center justify-between border-2 border-black bg-white p-3 text-left shadow-[2px_2px_0px_0px_#000] hover:bg-amber-50 active:translate-x-0.5 active:translate-y-0.5 transition cursor-pointer"
					>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="font-mono text-xs sm:text-sm font-black text-black">#{item.itemId}</span>
								<Badge variant="outline" class="font-mono text-[10px] border border-black">
									{item.satuan}
								</Badge>
								{#if item.departemen}
									<Badge variant="secondary" class="font-mono text-[10px]">
										{item.departemen}
									</Badge>
								{/if}
							</div>
							<div class="mt-0.5 font-bold text-xs text-slate-700 truncate">
								{item.itemName || '-'}
							</div>
						</div>
						<span class="border-2 border-black bg-[#FFD43B] px-2.5 py-1 text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#000] shrink-0 ml-2">
							PILIH
						</span>
					</button>
				{/each}
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<div class="flex w-full items-center justify-between">
			<span class="font-mono text-xs font-bold text-slate-500">Ditemukan {itemSearchResults.length} barang pembelian</span>
			<Button
				variant="outline"
				size="sm"
				class="border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
				onclick={() => (itemSearchOpen = false)}
			>
				Tutup
			</Button>
		</div>
	{/snippet}
</Modal>
