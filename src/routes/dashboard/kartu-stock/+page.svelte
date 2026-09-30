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
		FileSpreadsheet
	} from '@lucide/svelte';

	let { data } = $props();

	// Filter state
	let tgl1 = $state(untrack(() => data.tgl1) || '');
	let tgl2 = $state(untrack(() => data.tgl2) || '');
	let selectedLoc = $state(untrack(() => data.loc) || '%');
	let selectedItemId = $state(untrack(() => data.itemid) || '');

	// Data state (seperti di monitoring-pembelian)
	let stockData = $state<any[]>(untrack(() => data.initialStockData) || []);
	let stockLoading = $state(false);

	// Modal Pencarian Barang
	let itemSearchOpen = $state(false);
	let itemSearchQuery = $state('');
	let itemSearchResults = $state<any[]>(untrack(() => data.popularItems) || []);
	let isSearchingItems = $state(false);

	const fmt = (n: number | null | undefined) =>
		(Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

	// Fetch kartu stock menggunakan endpoint store procedure persis seperti di monitoring-pembelian
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

			// Mengambil data dari endpoint kartu stock yang sama persis dengan monitoring-pembelian
			const res = await fetch(`/api/monitoring-pembelian/kartustock?${p.toString()}`);
			if (res.ok) {
				stockData = await res.json();
				if (stockData.length > 0) {
					toast.success('Kartu Stock Dimuat', `Ditemukan ${stockData.length} baris pergerakan untuk #${targetId}`);
				} else {
					toast.warning('Data Kosong', `Tidak ada mutasi stok ditemukan untuk #${targetId} pada periode ini`);
				}
				// Update URL tanpa reload penuh agar bisa dibagikan / di-bookmark
				const urlParams = new URLSearchParams({
					tgl1,
					tgl2,
					itemid: targetId,
					loc: selectedLoc
				});
				goto(`/dashboard/kartu-stock?${urlParams.toString()}`, { replaceState: true, keepFocus: true });
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
			const res = await fetch(`/api/kartu-stock/search-items?q=${encodeURIComponent(q.trim())}`);
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
		toast.info('Barang Dipilih', `#${item.itemId} - ${item.itemName || ''}`);
		loadKartuStock(item.itemId);
	}

	function clearItem() {
		selectedItemId = '';
		stockData = [];
		toast.info('Pilihan Direset', 'Filter barang kartu stock telah dikosongkan');
		goto('/dashboard/kartu-stock', { replaceState: true });
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

	// Kalkulasi Statistik Total (IN, OUT, Saldo Awal, Saldo Akhir, Netto) di frontend
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
		const satuan = computedStockRows[0]?.satuan || 'Kg';

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

	let selectedItemName = $derived(
		stockData.length > 0 && stockData[0].ItemName
			? stockData[0].ItemName
			: data.popularItems?.find((it: any) => it.itemId === selectedItemId)?.itemName || ''
	);

	let exportUrl = $derived(
		`/api/kartu-stock/export?itemid=${encodeURIComponent(selectedItemId)}&loc=${encodeURIComponent(
			selectedLoc === '%' ? '' : selectedLoc
		)}&tgl1=${encodeURIComponent(tgl1)}&tgl2=${encodeURIComponent(tgl2)}`
	);
</script>

<svelte:head>
	<title>Laporan Kartu Stock | KIW Inventori</title>
</svelte:head>

<div class="space-y-6 print:m-0 print:p-0">
	<!-- Page Header persis seperti Monitoring Pembelian -->
	<PageHeader
		title="Kartu Stock"
		description="Tracking Kartu Stock Terintegrasi — Lacak pergerakan mutasi stok, penerimaan, pemakaian, dan saldo berjalan per item barang."
	>
		{#snippet actions()}
			<div class="flex items-center gap-2 print:hidden">
				<Badge variant="secondary" class="border-[3px] font-mono font-black">
					{stats.mutationCount > 0 ? stats.mutationCount : computedStockRows.length} Mutasi
				</Badge>
				{#if selectedItemId && computedStockRows.length > 0}
					<a
						href={exportUrl}
						download
						onclick={() => toast.info('Export Excel', 'Mengunduh rekap kartu stock...')}
					>
						<Button
							variant="outline"
							size="sm"
							class="h-9 border-[3px] font-black text-xs uppercase brutal-shadow-sm flex items-center gap-1.5"
						>
							<Download class="size-4" />
							Export Excel
						</Button>
					</a>
				{/if}
				<Button
					variant="outline"
					size="sm"
					class="h-9 border-[3px] font-black text-xs uppercase brutal-shadow-sm flex items-center gap-1.5"
					onclick={() => {
						toast.info('Cetak Laporan', 'Menyiapkan dokumen kartu stock untuk dicetak...');
						window.print();
					}}
				>
					<Printer class="size-4" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	{#if data.error}
		<Alert variant="error" title="Gagal Memuat Data" dismissible class="print:hidden">
			{data.error}
		</Alert>
	{/if}

	<!-- Stat cards brutal dengan hasil kalkulasi frontend -->
	{#if selectedItemId}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<StatCard
				label="Saldo Awal"
				value="{fmt(stats.saldoAwal)} {stats.satuan}"
				tone="primary"
				icon="⚖"
			/>
			<StatCard
				label="Total IN (Masuk)"
				value="+{fmt(stats.totalMasuk)} {stats.satuan}"
				tone="success"
				icon="↓"
			/>
			<StatCard
				label="Total OUT (Keluar)"
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

	<!-- Filter bar brutal seperti di monitoring-pembelian -->
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

			<!-- Kode Barang Picker -->
			<div class="space-y-1 sm:col-span-2">
				<Label for="itemid" class="font-mono text-xs font-black uppercase tracking-wider">
					Kode Barang *
				</Label>
				<div class="flex items-center gap-2">
					<div class="relative flex-1">
						<button
							type="button"
							onclick={() => {
								itemSearchQuery = '';
								itemSearchOpen = true;
							}}
							class="flex h-11 w-full items-center justify-between rounded-lg border-[3px] border-border bg-card px-3 text-left font-mono text-sm font-bold brutal-shadow-sm hover:bg-muted/40"
						>
							{#if selectedItemId}
								<span class="truncate font-black text-foreground">
									{selectedItemId} {selectedItemName ? `— ${selectedItemName}` : ''}
								</span>
							{:else}
								<span class="text-muted-foreground font-sans text-xs">
									-- Klik untuk cari & pilih barang --
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
						class="h-11 border-[3px] font-black text-xs uppercase brutal-shadow-sm shrink-0 px-5"
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

	<!-- ==================== TAMPILAN KARTU STOCK (PERSIS MONITORING PEMBELIAN) ==================== -->
	{#if selectedItemId}
		<div class="space-y-3">
			<!-- Header Card Informasi & Kalkulasi -->
			<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow space-y-3">
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex flex-wrap items-center gap-2">
						<span class="font-mono text-xs font-black uppercase text-foreground">
							Kartu Stock Mutasi:
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
					</div>
					{#if stockLoading}
						<span class="font-mono text-xs text-muted-foreground animate-pulse">Memuat...</span>
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
						<div class="flex items-center gap-2">
							<Badge variant={stats.netto >= 0 ? 'default' : 'error'} class="font-mono text-xs font-black uppercase">
								Netto: {stats.netto >= 0 ? '+' : ''}{fmt(stats.netto)} {stats.satuan}
							</Badge>
						</div>
					</div>
				{/if}
			</div>

			<!-- Tabel Mutasi Kartu Stock dengan Kalkulasi Frontend -->
			{#if stockLoading}
				<div class="rounded-xl border-[3px] border-border bg-card p-12 text-center brutal-shadow">
					<div class="flex flex-col items-center justify-center gap-3">
						<RefreshCw class="size-8 animate-spin text-primary" />
						<p class="font-mono text-sm font-bold text-muted-foreground animate-pulse">
							Memuat data mutasi kartu stock (dbo.rpKartuStockBrgL)...
						</p>
					</div>
				</div>
			{:else if computedStockRows.length === 0}
				<div class="rounded-xl border-[3px] border-border bg-card p-8 text-center brutal-shadow">
					<p class="font-mono text-xs text-muted-foreground">
						Tidak ada pergerakan stock pada rentang tanggal ini.
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
								<TableHead class="font-mono text-[10px] font-black uppercase">Keterangan</TableHead>
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

							<!-- ==================== TOTAL SUMMARY ROW (FRONTEND CALCULATION) ==================== -->
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
									<span class="text-foreground font-bold">Netto: {stats.netto >= 0 ? '+' : ''}{fmt(stats.netto)} {stats.satuan}</span>
									{#if stats.saldoAwal > 0}
										<span class="block text-[10px] text-muted-foreground">
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
		<!-- Kondisi Jika Belum Memilih Barang -->
		<div class="rounded-xl border-[3px] border-border bg-card p-8 text-center brutal-shadow space-y-4">
			<div class="mx-auto flex size-14 items-center justify-center rounded-xl border-[3px] border-border bg-primary text-primary-foreground brutal-shadow-sm">
				<Package class="size-7" />
			</div>
			<div class="space-y-1">
				<h3 class="font-black text-lg uppercase tracking-tight text-foreground">
					Pilih Kode Barang Terlebih Dahulu
				</h3>
				<p class="font-mono text-xs text-muted-foreground max-w-md mx-auto">
					Pilih barang untuk melihat kartu stok dan mutasi transaksinya yang diambil dari stored procedure <code class="bg-muted px-1.5 py-0.5 rounded font-bold">dbo.rpKartuStockBrgL</code>.
				</p>
			</div>

			<div class="pt-2">
				<Button
					onclick={() => {
						itemSearchQuery = '';
						itemSearchOpen = true;
					}}
					class="h-11 border-[3px] font-black text-xs uppercase brutal-shadow-sm px-6"
				>
					<Search class="size-4 mr-2" />
					Cari & Pilih Barang
				</Button>
			</div>

			{#if data.popularItems && data.popularItems.length > 0}
				<div class="border-t border-border pt-6 mt-6 text-left max-w-3xl mx-auto">
					<p class="font-mono text-xs font-black uppercase text-muted-foreground mb-3">
						Rekomendasi Barang Cepat:
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
</div>

<!-- ==================== MODAL PENCARIAN BARANG ==================== -->
<Modal
	bind:open={itemSearchOpen}
	title="PILIH BARANG"
	subtitle="Cari kode atau nama barang dari master data taGoods"
	icon={Package}
	size="2xl"
>
	<div class="space-y-4">
		<SearchInput
			bind:value={itemSearchQuery}
			placeholder="Ketik kode barang atau nama barang..."
			loading={isSearchingItems}
			debounceMs={300}
			onsearch={handleItemSearch}
		/>

		<div class="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
			{#if itemSearchResults.length === 0}
				<div class="py-8 text-center font-mono text-xs text-muted-foreground border-2 border-dashed border-black/20 p-6">
					Tidak ada barang yang cocok dengan kata kunci "{itemSearchQuery}".
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
			<span class="font-mono text-xs font-bold text-slate-500">Ditemukan {itemSearchResults.length} barang</span>
			<Button
				variant="outline"
				size="sm"
				class="border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_#000]"
				onclick={() => (itemSearchOpen = false)}
			>
				Tutup
			</Button>
		</div>
	{/snippet}
</Modal>

