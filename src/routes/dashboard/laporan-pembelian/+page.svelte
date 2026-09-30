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
		ShoppingCart,
		RotateCcw,
		Download,
		Printer,
		Search,
		Calendar,
		Building2,
		Package,
		FileText,
		Coins,
		DollarSign,
		ArrowDownToLine
	} from '@lucide/svelte';

	let { data } = $props();

	let loading = $state(false);
	let exportLoading = $state(false);
	let searchQuery = $state('');

	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	function formatNum(val: number | null | undefined, dec = 2): string {
		if (val == null || isNaN(val)) return '0,00';
		return Number(val).toLocaleString('id-ID', {
			minimumFractionDigits: dec,
			maximumFractionDigits: dec
		});
	}

	function formatDate(dateStr: string | null | undefined): string {
		if (!dateStr) return '-';
		const p = dateStr.split('-');
		if (p.length === 3) {
			return `${p[2]}/${p[1]}/${p[0]}`;
		}
		return dateStr;
	}

	function getDokBadge(dok: string) {
		const d = (dok || '').toUpperCase().trim();
		if (d.includes('4.0')) return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
		if (d.includes('2.3')) return 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30';
		if (d.includes('4.1')) return 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30';
		if (d.includes('2.7')) return 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30';
		return 'bg-muted text-foreground border-border';
	}

	// Filter lokal baris berdasarkan search query
	let filteredRows = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return data.rows || [];
		return (data.rows || []).filter(
			(r) =>
				r.pemasokPengirim.toLowerCase().includes(q) ||
				r.kodeBarang.toLowerCase().includes(q) ||
				r.namaBarang.toLowerCase().includes(q) ||
				r.nomorDokPabean.toLowerCase().includes(q) ||
				(r.nomorBPB && r.nomorBPB.toLowerCase().includes(q)) ||
				(r.nomorSuratJalan && r.nomorSuratJalan.toLowerCase().includes(q)) ||
				(r.nomorPO && r.nomorPO.toLowerCase().includes(q)) ||
				r.nopol.toLowerCase().includes(q)
		);
	});

	function getTabUrl(targetTab: 'pemasukan' | 'retur'): string {
		const p = new URLSearchParams();
		p.set('tab', targetTab);
		if (data.filters.tgl1) p.set('tgl1', data.filters.tgl1);
		if (data.filters.tgl2) p.set('tgl2', data.filters.tgl2);
		if (data.filters.supplier) p.set('supplier', data.filters.supplier);
		if (data.filters.item) p.set('item', data.filters.item);
		if (data.filters.curr) p.set('curr', data.filters.curr);
		if (data.filters.jenisDok) p.set('jenisDok', data.filters.jenisDok);
		return `/dashboard/laporan-pembelian?${p.toString()}`;
	}
</script>

<LoadingOverlay show={loading} message="Memuat Laporan Pembelian..." submessage="Mohon tunggu sejenak" />

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Laporan Pembelian & Pemasukan Barang"
		description="Rekapitulasi pemasukan barang pembelian dan retur pembelian ke supplier dari Stored Procedure rpPemasukan dan rpReturPembelian."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<Badge variant="secondary" class="border-[3px] font-mono font-black text-xs">
					{data.summary.totalRows.toLocaleString('id-ID')} BARIS • {data.summary.totalSupplier.toLocaleString('id-ID')} SUPPLIER
				</Badge>

				<!-- Tombol Export Excel -->
				<form
					method="post"
					action="/api/laporan-pembelian/export"
					onsubmit={() => {
						exportLoading = true;
						toast.info('Export Excel', 'Menyiapkan berkas Excel laporan pembelian...');
						setTimeout(() => (exportLoading = false), 4000);
					}}
					class="inline-flex"
				>
					<input type="hidden" name="tgl1" value={data.filters.tgl1} />
					<input type="hidden" name="tgl2" value={data.filters.tgl2} />
					<input type="hidden" name="tab" value={data.tab} />
					<input type="hidden" name="supplier" value={data.filters.supplier || ''} />
					<input type="hidden" name="item" value={data.filters.item || ''} />
					<input type="hidden" name="curr" value={data.filters.curr || ''} />
					<input type="hidden" name="jenisDok" value={data.filters.jenisDok || ''} />

					<Button
						type="submit"
						variant="secondary"
						disabled={exportLoading}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export Excel Laporan Pembelian"
					>
						<Download class="size-4 mr-1.5" />
						Export Excel
					</Button>
				</form>

				<Button
					type="button"
					variant="secondary"
					onclick={() => window.print()}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer hidden sm:inline-flex"
					title="Cetak tampilan laporan pembelian"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- TAB NAVIGATION NEO-BRUTALIST -->
	<div class="bg-card rounded-2xl border-[3px] border-border p-2 sm:p-2.5 brutal-shadow">
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
			<!-- Tab 1: Pemasukan Barang (rpPemasukan) -->
			<a
				href={getTabUrl('pemasukan')}
				class="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-[3px] transition-all brutal-shadow-sm {data.tab === 'pemasukan'
					? 'bg-primary text-primary-foreground border-border ring-2 ring-primary/20'
					: 'bg-card hover:bg-muted/70 text-foreground border-border/60 hover:border-border'}"
			>
				<div class="flex items-center gap-3 min-w-0">
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-lg border-2 transition-transform group-hover:scale-105 {data.tab === 'pemasukan'
							? 'bg-white/20 border-white/40 text-white'
							: 'bg-primary/10 border-primary/30 text-primary'}"
					>
						<ArrowDownToLine class="size-5" />
					</div>
					<div class="min-w-0 text-left">
						<div class="flex items-center gap-2">
							<span class="text-sm font-black uppercase tracking-wide truncate">
								Pemasukan Barang
							</span>
							{#if data.tab === 'pemasukan'}
								<span class="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black text-emerald-100 border border-emerald-300/40">
									<span class="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
									AKTIF
								</span>
							{/if}
						</div>
						<p class="text-xs truncate {data.tab === 'pemasukan' ? 'text-primary-foreground/80 font-medium' : 'text-muted-foreground font-medium'}">
							Penerimaan barang dari supplier & impor
						</p>
					</div>
				</div>

				<div class="flex flex-col items-end gap-1 shrink-0">
					<code class="text-[10px] font-mono font-bold px-2 py-0.5 rounded border {data.tab === 'pemasukan'
						? 'bg-black/20 text-white border-white/20'
						: 'bg-muted text-muted-foreground border-border'}">
						rpPemasukan
					</code>
					{#if data.tab === 'pemasukan'}
						<span class="text-[11px] font-mono font-bold text-white/90">
							{data.summary.totalRows.toLocaleString('id-ID')} baris
						</span>
					{/if}
				</div>
			</a>

			<!-- Tab 2: Retur Pembelian (rpReturPembelian) -->
			<a
				href={getTabUrl('retur')}
				class="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-[3px] transition-all brutal-shadow-sm {data.tab === 'retur'
					? 'bg-primary text-primary-foreground border-border ring-2 ring-primary/20'
					: 'bg-card hover:bg-muted/70 text-foreground border-border/60 hover:border-border'}"
			>
				<div class="flex items-center gap-3 min-w-0">
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-lg border-2 transition-transform group-hover:scale-105 {data.tab === 'retur'
							? 'bg-white/20 border-white/40 text-white'
							: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'}"
					>
						<RotateCcw class="size-5" />
					</div>
					<div class="min-w-0 text-left">
						<div class="flex items-center gap-2">
							<span class="text-sm font-black uppercase tracking-wide truncate">
								Retur Pembelian
							</span>
							{#if data.tab === 'retur'}
								<span class="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black text-emerald-100 border border-emerald-300/40">
									<span class="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
									AKTIF
								</span>
							{/if}
						</div>
						<p class="text-xs truncate {data.tab === 'retur' ? 'text-primary-foreground/80 font-medium' : 'text-muted-foreground font-medium'}">
							Pengembalian barang kembali ke supplier
						</p>
					</div>
				</div>

				<div class="flex flex-col items-end gap-1 shrink-0">
					<code class="text-[10px] font-mono font-bold px-2 py-0.5 rounded border {data.tab === 'retur'
						? 'bg-black/20 text-white border-white/20'
						: 'bg-muted text-muted-foreground border-border'}">
						rpReturPembelian
					</code>
					{#if data.tab === 'retur'}
						<span class="text-[11px] font-mono font-bold text-white/90">
							{data.summary.totalRows.toLocaleString('id-ID')} baris
						</span>
					{/if}
				</div>
			</a>
		</div>
	</div>

	<!-- Summary Metrics Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
		<!-- Total Transaksi -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Baris</span>
				<FileText class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.summary.totalRows.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.summary.totalSupplier} Entitas Pemasok
				</p>
			</div>
		</div>

		<!-- Total Kuantum / Jumlah -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Kuantum</span>
				<Package class="size-4 text-blue-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-foreground">
					{formatNum(data.summary.totalJumlah, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Total unit/kg barang</p>
			</div>
		</div>

		<!-- Total Pembelian IDR -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Nilai (IDR)</span>
				<Coins class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-emerald-700 dark:text-emerald-400">
					Rp {formatNum(data.summary.totalNilaiIDR, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Transaksi Rupiah</p>
			</div>
		</div>

		<!-- Total Pembelian USD -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-purple-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">Total Nilai (USD)</span>
				<DollarSign class="size-4 text-purple-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-purple-700 dark:text-purple-400">
					$ {formatNum(data.summary.totalNilaiUSD, 2)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Transaksi Impor / Valas</p>
			</div>
		</div>

		<!-- Supplier Aktif -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-primary/5 col-span-2 lg:col-span-1">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-primary">Pemasok Aktif</span>
				<Building2 class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-primary">
					{data.summary.totalSupplier}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Mitra Supplier</p>
			</div>
		</div>
	</div>

	<!-- Filter Form Neo-Brutalist -->
	<form
		method="get"
		action="/dashboard/laporan-pembelian"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4"
	>
		<input type="hidden" name="tab" value={data.tab} />

		<div class="flex items-center justify-between pb-2 border-b-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-foreground">Parameter Stored Procedure:</span>
				<code class="text-[11px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
					{data.tab === 'retur' ? 'rpReturPembelian (@tgl1, @tgl2)' : 'rpPemasukan (@tgl1, @tgl2)'}
				</code>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
			<!-- Tgl Awal -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="tgl1">Periode Awal</Label>
				<input
					type="date"
					id="tgl1"
					name="tgl1"
					value={data.filters.tgl1}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
				/>
			</div>

			<!-- Tgl Akhir -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="tgl2">Periode Akhir</Label>
				<input
					type="date"
					id="tgl2"
					name="tgl2"
					value={data.filters.tgl2}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
				/>
			</div>

			<!-- Filter Supplier -->
			<div class="space-y-1.5 lg:col-span-3">
				<Label for="supplier">Nama Pemasok / Supplier</Label>
				<input
					type="text"
					id="supplier"
					name="supplier"
					value={data.filters.supplier || ''}
					placeholder="Filter nama supplier..."
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
				/>
			</div>

			<!-- Filter Barang -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="item">Kode / Nama Barang</Label>
				<input
					type="text"
					id="item"
					name="item"
					value={data.filters.item || ''}
					placeholder="Kode / nama barang..."
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
				/>
			</div>

			<!-- Filter Dokumen Pabean -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label>Dokumen Pabean</Label>
				<select
					name="jenisDok"
					value={data.filters.jenisDok || ''}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-black uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="">Semua Dokumen</option>
					<option value="BC 4.0">BC 4.0 (Pemasukan Lokal)</option>
					<option value="BC 2.3">BC 2.3 (Impor Bahan)</option>
					<option value="BC 4.1">BC 4.1 (Retur / Pengeluaran)</option>
					<option value="BC 2.7">BC 2.7 (Subkontrak)</option>
				</select>
			</div>

			<!-- Filter Valas -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label>Valas</Label>
				<select
					name="curr"
					value={data.filters.curr || ''}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-black uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="">Semua</option>
					<option value="IDR">IDR</option>
					<option value="USD">USD</option>
				</select>
			</div>
		</div>

		<div class="flex items-center justify-end gap-2 pt-1 border-t-2 border-border/40">
			{#if data.filters.supplier || data.filters.item || data.filters.curr || data.filters.jenisDok}
				<a
					href="/dashboard/laporan-pembelian?tab={data.tab}"
					class="border-border bg-card hover:bg-muted inline-flex h-10 items-center rounded-lg border-[3px] px-4 text-xs font-black uppercase tracking-wide brutal-shadow-sm"
				>
					Reset Filter
				</a>
			{/if}
			<Button type="submit" class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm px-6">
				Tampilkan Laporan
			</Button>
		</div>
	</form>

	{#if data.error}
		<Alert variant="error" title="Terjadi Kesalahan" dismissible>
			{data.error}
		</Alert>
	{/if}

	<!-- Quick Search Bar & Count -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="relative w-full max-w-xs">
			<Search class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Cari di tabel (supplier, barang, no BPB/PO)..."
				class="bg-card border-border h-9 w-full rounded-lg border-2 pl-9 pr-3 text-xs font-bold brutal-shadow-sm"
			/>
		</div>
		<span class="text-xs font-bold text-muted-foreground font-mono">
			Menampilkan {filteredRows.length} dari {data.rows.length} baris
		</span>
	</div>

	<!-- TABEL LAPORAN PEMBELIAN / RETUR -->
	{#if filteredRows.length === 0}
		<div class="bg-card rounded-xl border-[3px] border-border p-12 text-center brutal-shadow">
			<EmptyState
				icon={data.tab === 'retur' ? RotateCcw : ShoppingCart}
				title={data.tab === 'retur' ? 'Tidak Ada Data Retur Pembelian' : 'Tidak Ada Data Pemasukan Pembelian'}
				description="Tidak ditemukan transaksi pada rentang periode yang dipilih."
			/>
		</div>
	{:else}
		<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
			<div class="overflow-x-auto">
				<Table wrapperClass="border-0 shadow-none rounded-none">
					<TableHeader>
						<TableRow class="bg-muted/70">
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-12 text-center">No</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-24">Dokumen Pabean</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-28">No & Tgl Dok</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-32">
								{data.tab === 'retur' ? 'Surat Jalan' : 'No. BPB / PO'}
							</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest min-w-44">
								{data.tab === 'retur' ? 'Penerima Retur / Supplier' : 'Pemasok / Supplier'}
							</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest min-w-40">Kode & Nama Barang</TableHead>
							<TableHead class="text-right font-mono text-[10px] font-black uppercase tracking-widest w-24">Jumlah</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-16 text-center">Satuan</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-14 text-center">Valas</TableHead>
							<TableHead class="text-right font-mono text-[10px] font-black uppercase tracking-widest w-32 bg-emerald-500/5">Nilai Barang</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-28">No. Polisi</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each filteredRows as r, idx}
							<TableRow class="hover:bg-primary/5">
								<TableCell class="font-mono text-xs text-center text-muted-foreground">{idx + 1}</TableCell>
								<TableCell>
									<span class="px-2 py-0.5 rounded text-[10px] font-black border font-mono {getDokBadge(r.jenisDokPabean)}">
										{r.jenisDokPabean || '-'}
									</span>
								</TableCell>
								<TableCell>
									<div class="font-mono text-xs font-bold">{r.nomorDokPabean || '-'}</div>
									<div class="text-[10px] text-muted-foreground font-mono">{formatDate(r.tanggalDokPabean)}</div>
								</TableCell>
								<TableCell>
									<div class="font-mono text-xs font-bold text-primary">
										{r.nomorBPB || r.nomorSuratJalan || '-'}
									</div>
									<div class="text-[10px] text-muted-foreground font-mono">
										{formatDate(r.tanggalBPB || r.tanggalSuratJalan)}
										{#if r.nomorPO}
											• PO: {r.nomorPO}
										{/if}
									</div>
								</TableCell>
								<TableCell class="text-xs font-bold text-foreground">
									{r.pemasokPengirim}
								</TableCell>
								<TableCell>
									<div class="font-mono text-xs font-black text-primary">{r.kodeBarang}</div>
									<div class="text-xs font-medium text-muted-foreground truncate max-w-xs" title={r.namaBarang}>{r.namaBarang}</div>
								</TableCell>
								<TableCell class="text-right font-mono text-xs font-bold">
									{formatNum(r.jumlah, 2)}
								</TableCell>
								<TableCell class="font-mono text-xs text-center font-bold text-muted-foreground">
									{r.satuan}
								</TableCell>
								<TableCell class="font-mono text-xs text-center font-black">
									{r.curr}
								</TableCell>
								<TableCell class="text-right font-mono text-xs font-black bg-emerald-500/5 text-emerald-800 dark:text-emerald-300">
									{r.curr === 'USD' ? '$ ' : 'Rp '}{formatNum(r.nilaiBarang, 2)}
								</TableCell>
								<TableCell class="font-mono text-xs text-muted-foreground">
									{r.nopol || '-'}
								</TableCell>
							</TableRow>
						{/each}

						<!-- Subtotal Baris -->
						<TableRow class="bg-muted/80 font-black border-t-2 border-border">
							<TableCell colspan={6} class="text-right font-black uppercase text-xs">
								TOTAL KESELURUHAN:
							</TableCell>
							<TableCell class="text-right font-mono text-xs font-black">
								{formatNum(data.summary.totalJumlah, 2)}
							</TableCell>
							<TableCell colspan={2}></TableCell>
							<TableCell class="text-right font-mono text-xs font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/10">
								<div>Rp {formatNum(data.summary.totalNilaiIDR, 0)}</div>
								{#if data.summary.totalNilaiUSD > 0}
									<div class="text-purple-700 dark:text-purple-400">$ {formatNum(data.summary.totalNilaiUSD, 2)}</div>
								{/if}
							</TableCell>
							<TableCell></TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</div>
		</div>
	{/if}
</div>
