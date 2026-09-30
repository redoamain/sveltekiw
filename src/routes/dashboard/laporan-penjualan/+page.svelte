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
		TrendingUp,
		Download,
		Printer,
		Search,
		Calendar,
		Building2,
		Package,
		FileText,
		Coins,
		DollarSign,
		Truck
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
		if (d.includes('3.0')) return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
		if (d.includes('4.1')) return 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30';
		if (d.includes('2.5')) return 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30';
		if (d.includes('4.0')) return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
		return 'bg-muted text-foreground border-border';
	}

	// Filter lokal baris berdasarkan search query
	let filteredRows = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return data.rows || [];
		return (data.rows || []).filter(
			(r) =>
				r.pembeliPenerima.toLowerCase().includes(q) ||
				r.kodeBarang.toLowerCase().includes(q) ||
				r.namaBarang.toLowerCase().includes(q) ||
				r.nomorDokPabean.toLowerCase().includes(q) ||
				r.nomorSuratJalan.toLowerCase().includes(q) ||
				r.nopol.toLowerCase().includes(q)
		);
	});
</script>

<LoadingOverlay show={loading} message="Memuat Laporan Penjualan..." submessage="Mohon tunggu sejenak" />

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Laporan Penjualan (Outbound / Bea Cukai)"
		description="Rekapitulasi penjualan dan pengeluaran barang dari Stored Procedure rpPenjualan (rpPengeluaran) — dokumen pabean, surat jalan, pembeli, rincian barang, dan nilai transaksi."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<Badge variant="secondary" class="border-[3px] font-mono font-black text-xs">
					{data.summary.totalRows.toLocaleString('id-ID')} BARIS • {data.summary.totalCustomer.toLocaleString('id-ID')} CUSTOMER
				</Badge>

				<!-- Tombol Export Excel -->
				<form
					method="post"
					action="/api/laporan-penjualan/export"
					onsubmit={() => {
						exportLoading = true;
						toast.info('Export Excel', 'Menyiapkan berkas Excel laporan penjualan...');
						setTimeout(() => (exportLoading = false), 4000);
					}}
					class="inline-flex"
				>
					<input type="hidden" name="tgl1" value={data.filters.tgl1} />
					<input type="hidden" name="tgl2" value={data.filters.tgl2} />
					<input type="hidden" name="customer" value={data.filters.customer || ''} />
					<input type="hidden" name="item" value={data.filters.item || ''} />
					<input type="hidden" name="curr" value={data.filters.curr || ''} />
					<input type="hidden" name="jenisDok" value={data.filters.jenisDok || ''} />

					<Button
						type="submit"
						variant="secondary"
						disabled={exportLoading}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export Excel Laporan Penjualan"
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
					title="Cetak tampilan laporan penjualan"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

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
					{data.summary.totalCustomer} Entitas Pembeli
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

		<!-- Total Penjualan IDR -->
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

		<!-- Total Penjualan USD -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-purple-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">Total Nilai (USD)</span>
				<DollarSign class="size-4 text-purple-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-purple-700 dark:text-purple-400">
					$ {formatNum(data.summary.totalNilaiUSD, 2)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Transaksi Ekspor / Valas</p>
			</div>
		</div>

		<!-- Rata-rata / Customer -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-primary/5 col-span-2 lg:col-span-1">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-primary">Customer Aktif</span>
				<Building2 class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-primary">
					{data.summary.totalCustomer}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Mitra Pembeli</p>
			</div>
		</div>
	</div>

	<!-- Filter Form Neo-Brutalist -->
	<form
		method="get"
		action="/dashboard/laporan-penjualan"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4"
	>
		<div class="flex items-center justify-between pb-2 border-b-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-foreground">Parameter Stored Procedure:</span>
				<code class="text-[11px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
					rpPenjualan (@tgl1, @tgl2) [rpPengeluaran]
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

			<!-- Filter Customer -->
			<div class="space-y-1.5 lg:col-span-3">
				<Label for="customer">Nama Pembeli / Customer</Label>
				<input
					type="text"
					id="customer"
					name="customer"
					value={data.filters.customer || ''}
					placeholder="Filter nama customer..."
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
					<option value="BC 3.0">BC 3.0 (Ekspor)</option>
					<option value="BC 4.1">BC 4.1 (Lokal / TPB)</option>
					<option value="BC 2.5">BC 2.5 (Impor Bayar)</option>
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
			{#if data.filters.customer || data.filters.item || data.filters.curr || data.filters.jenisDok}
				<a
					href="/dashboard/laporan-penjualan"
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
				placeholder="Cari di tabel (customer, barang, no SJ)..."
				class="bg-card border-border h-9 w-full rounded-lg border-2 pl-9 pr-3 text-xs font-bold brutal-shadow-sm"
			/>
		</div>
		<span class="text-xs font-bold text-muted-foreground font-mono">
			Menampilkan {filteredRows.length} dari {data.rows.length} baris
		</span>
	</div>

	<!-- TABEL LAPORAN PENJUALAN -->
	{#if filteredRows.length === 0}
		<div class="bg-card rounded-xl border-[3px] border-border p-12 text-center brutal-shadow">
			<EmptyState
				icon={TrendingUp}
				title="Tidak Ada Data Penjualan"
				description="Tidak ditemukan transaksi penjualan atau pengeluaran barang pada periode yang dipilih."
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
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-32">Surat Jalan</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest min-w-44">Pembeli / Customer</TableHead>
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
									<div class="font-mono text-xs font-bold text-primary">{r.nomorSuratJalan || '-'}</div>
									<div class="text-[10px] text-muted-foreground font-mono">{formatDate(r.tanggalSuratJalan)}</div>
								</TableCell>
								<TableCell class="text-xs font-bold text-foreground">
									{r.pembeliPenerima}
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
