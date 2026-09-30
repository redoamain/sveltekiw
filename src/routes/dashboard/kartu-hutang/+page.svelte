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
		EmptyState,
		Combobox
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		CreditCard,
		Download,
		Printer,
		Search,
		ChevronDown,
		ChevronRight,
		ArrowUpRight,
		ArrowDownRight,
		Scale,
		Wallet,
		RotateCcw,
		Calendar,
		Building2,
		Phone,
		MapPin
	} from '@lucide/svelte';

	let { data } = $props();

	let loading = $state(false);
	let exportLoading = $state(false);

	// Collapsible state per supplier
	let collapsedSuppliers = $state<Record<string, boolean>>({});
	let companyIDInput = $state('');

	$effect(() => {
		if (data) {
			loading = false;
			companyIDInput = data.filters.companyID || '%';
		}
	});

	function toggleCollapse(id: string) {
		collapsedSuppliers[id] = !collapsedSuppliers[id];
	}

	function expandAll() {
		collapsedSuppliers = {};
	}

	function collapseAll() {
		const next: Record<string, boolean> = {};
		for (const s of data.suppliers) {
			next[s.companyID] = true;
		}
		collapsedSuppliers = next;
	}

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

	function getStatusBadge(status: string) {
		const s = (status || '').toUpperCase();
		if (s === 'SA') return { label: 'SALDO AWAL', cls: 'bg-muted text-muted-foreground border-border' };
		if (s.startsWith('B')) return { label: 'BELI', cls: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30' };
		if (s.startsWith('P')) return { label: 'BAYAR', cls: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30' };
		if (s.startsWith('R')) return { label: 'RETUR', cls: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30' };
		if (s.startsWith('M')) return { label: 'MEMO', cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30' };
		if (s.startsWith('S')) return { label: 'KURS/BG', cls: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30' };
		return { label: s, cls: 'bg-muted text-foreground border-border' };
	}

	// Options supplier untuk Combobox
	let supplierOptions = $derived([
		{ value: '%', code: '%', name: 'Semua Supplier', label: '% — Semua Supplier' },
		...(data.supplierList || []).map((s) => ({
			value: s.id,
			code: s.id,
			name: s.name,
			label: `${s.id} — ${s.name}`
		}))
	]);
</script>

<LoadingOverlay show={loading} message="Memuat Laporan..." submessage="Mohon tunggu sejenak" />

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Laporan Kartu Hutang (Accounts Payable)"
		description="Rekapitulasi kartu pembantu hutang supplier dari Stored Procedure rpKartuUtangL — saldo awal, mutasi pembelian, pembayaran/retur, dan saldo akhir hutang."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<Badge variant="secondary" class="border-[3px] font-mono font-black text-xs">
					{data.grandTotal.totalSuppliers.toLocaleString('id-ID')} SUPPLIER • {data.grandTotal.totalTransactions.toLocaleString('id-ID')} MUTASI
				</Badge>

				<!-- Tombol Export Excel -->
				<form
					method="post"
					action="/api/kartu-hutang/export"
					onsubmit={() => {
						exportLoading = true;
						toast.info('Export Excel', 'Menyiapkan berkas Excel kartu hutang...');
						setTimeout(() => (exportLoading = false), 4000);
					}}
					class="inline-flex"
				>
					<input type="hidden" name="tgl1" value={data.filters.tgl1} />
					<input type="hidden" name="tgl2" value={data.filters.tgl2} />
					<input type="hidden" name="companyID" value={data.filters.companyID} />
					<input type="hidden" name="curr" value={data.filters.curr} />
					<input type="hidden" name="noTrans" value={data.filters.noTrans} />
					<input type="hidden" name="transtype" value={data.filters.transtype} />
					<input type="hidden" name="company" value={String(data.filters.company)} />
					<input type="hidden" name="hideEmpty" value={String(data.filters.hideEmpty)} />

					<Button
						type="submit"
						variant="secondary"
						disabled={exportLoading}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export Excel Laporan Kartu Hutang"
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
					title="Cetak tampilan kartu hutang"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Summary Metrics Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
		<!-- Total Supplier -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Supplier</span>
				<Building2 class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.grandTotal.totalSuppliers}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.grandTotal.totalTransactions} Baris Mutasi
				</p>
			</div>
		</div>

		<!-- Saldo Awal Hutang -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Saldo Awal Total</span>
				<Wallet class="size-4 text-slate-500" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-foreground">
					Rp {formatNum(data.grandTotal.totalSaldoAwalRp, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Per {formatDate(data.filters.tgl1)}</p>
			</div>
		</div>

		<!-- Total Pembelian / Penambahan Hutang -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-amber-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Beli (+Hutang)</span>
				<ArrowUpRight class="size-4 text-amber-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-amber-700 dark:text-amber-400">
					Rp {formatNum(data.grandTotal.totalBeliRp, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Penambahan Hutang Dagang</p>
			</div>
		</div>

		<!-- Total Pembayaran / Pengurangan Hutang -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Bayar (-Hutang)</span>
				<ArrowDownRight class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-emerald-700 dark:text-emerald-400">
					Rp {formatNum(data.grandTotal.totalBayarRp, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Pelunasan & Pengurangan</p>
			</div>
		</div>

		<!-- Saldo Akhir Total Hutang -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-primary/5 col-span-2 lg:col-span-1">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-primary">Saldo Akhir Hutang</span>
				<Scale class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-primary">
					Rp {formatNum(data.grandTotal.totalSaldoAkhirRp, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Per {formatDate(data.filters.tgl2)}</p>
			</div>
		</div>
	</div>

	<!-- Filter Form Neo-Brutalist -->
	<form
		method="get"
		action="/dashboard/kartu-hutang"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4"
	>
		<div class="flex items-center justify-between pb-2 border-b-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-foreground">Parameter Stored Procedure:</span>
				<code class="text-[11px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
					rpKartuUtangL (@CompanyID, @Tgl1, @Tgl2, @Curr, @NoTrans, @transtype, @PeriodeR, @company)
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

			<!-- Supplier -->
			<div class="space-y-1.5 lg:col-span-4">
				<Label for="companyID">Pilih Supplier (CompanyID)</Label>
				<Combobox
					id="companyID"
					name="companyID"
					bind:value={companyIDInput}
					options={supplierOptions}
					placeholder="Ketik kode / nama supplier..."
					allowCustom={true}
				/>
			</div>

			<!-- Valas -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label>Mata Uang</Label>
				<select
					name="curr"
					value={data.filters.curr}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-black uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="IDR">IDR (Rupiah)</option>
					<option value="USD">USD (Dollar)</option>
					<option value="">Semua Valas</option>
				</select>
			</div>

			<!-- Company Unit -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label>Unit Perusahaan</Label>
				<select
					name="company"
					value={String(data.filters.company)}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-black uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="0">0 - Semua</option>
					<option value="1">1 - DBTR</option>
					<option value="2">2 - MDU</option>
				</select>
			</div>
		</div>

		<!-- Checkbox options & Action Buttons -->
		<div class="flex flex-wrap items-center justify-between gap-4 pt-1 border-t-2 border-border/40">
			<div class="flex flex-wrap items-center gap-5">
				<label class="inline-flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
					<input
						type="checkbox"
						name="hideEmpty"
						value="1"
						checked={data.filters.hideEmpty}
						class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
					/>
					<span>Sembunyikan Supplier Bersaldo 0 & Tanpa Mutasi</span>
				</label>
			</div>

			<div class="flex items-center gap-2">
				{#if data.filters.companyID !== '%' || data.filters.curr !== 'IDR' || data.filters.company !== 0}
					<a
						href="/dashboard/kartu-hutang"
						class="border-border bg-card hover:bg-muted inline-flex h-10 items-center rounded-lg border-[3px] px-4 text-xs font-black uppercase tracking-wide brutal-shadow-sm"
					>
						Reset Filter
					</a>
				{/if}
				<Button type="submit" class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm px-6">
					Tampilkan Kartu Hutang
				</Button>
			</div>
		</div>
	</form>

	{#if data.error}
		<Alert variant="error" title="Terjadi Kesalahan" dismissible>
			{data.error}
		</Alert>
	{/if}

	<!-- Controls Expand / Collapse All -->
	{#if data.suppliers.length > 0}
		<div class="flex items-center justify-between px-1">
			<span class="text-xs font-black uppercase tracking-wide text-muted-foreground">
				Menampilkan {data.suppliers.length} Supplier:
			</span>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={expandAll}
					class="text-[11px] font-black uppercase text-primary hover:underline cursor-pointer"
				>
					Buka Semua
				</button>
				<span class="text-muted-foreground">•</span>
				<button
					type="button"
					onclick={collapseAll}
					class="text-[11px] font-black uppercase text-primary hover:underline cursor-pointer"
				>
					Tutup Semua
				</button>
			</div>
		</div>
	{/if}

	<!-- DAFTAR KARTU HUTANG SUPPLIER -->
	{#if data.suppliers.length === 0}
		<div class="bg-card rounded-xl border-[3px] border-border p-12 text-center brutal-shadow">
			<EmptyState
				icon={CreditCard}
				title="Tidak Ada Data Kartu Hutang"
				description="Tidak ditemukan transaksi atau saldo hutang yang sesuai dengan filter yang dipilih."
			/>
		</div>
	{:else}
		<div class="space-y-5">
			{#each data.suppliers as sup}
				{@const isCollapsed = Boolean(collapsedSuppliers[sup.companyID])}

				<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
					<!-- Supplier Card Header -->
					<button
						type="button"
						class="w-full bg-muted/40 border-b-[3px] border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-muted/60 transition-colors cursor-pointer select-none"
						onclick={() => toggleCollapse(sup.companyID)}
					>
						<div class="flex items-center gap-3">
							<span
								class="inline-flex size-7 items-center justify-center rounded-md border-2 border-border bg-card font-bold brutal-shadow-sm shrink-0"
							>
								{#if isCollapsed}
									<ChevronRight class="size-4" />
								{:else}
									<ChevronDown class="size-4" />
								{/if}
							</span>

							<div>
								<div class="flex items-center gap-2">
									<span class="font-mono text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/30">
										{sup.companyID}
									</span>
									<h3 class="font-black text-sm uppercase tracking-tight text-foreground">
										{sup.companyName}
									</h3>
									<span class="font-mono text-[10px] font-black px-1.5 py-0.2 rounded border border-border bg-card">
										{sup.curr}
									</span>
								</div>
								<div class="text-[11px] font-bold text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3">
									<span>Saldo Awal: <strong class="font-mono font-black text-foreground">Rp {formatNum(sup.saldoAwalRp)}</strong></span>
									<span>•</span>
									<span>Mutasi: <strong class="font-mono">{sup.transactions.length} transaksi</strong></span>
									{#if sup.phone}
										<span>•</span>
										<span class="flex items-center gap-1 font-mono"><Phone class="size-3" /> {sup.phone}</span>
									{/if}
								</div>
							</div>
						</div>

						<!-- Quick Totals Header Badge -->
						<div class="flex flex-wrap items-center gap-3 text-right">
							<div class="hidden sm:block">
								<span class="block text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Total Beli</span>
								<span class="font-mono text-xs font-black text-amber-700 dark:text-amber-400">
									Rp {formatNum(sup.totalBeliRp)}
								</span>
							</div>

							<div class="hidden sm:block">
								<span class="block text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Total Bayar</span>
								<span class="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
									Rp {formatNum(sup.totalBayarRp)}
								</span>
							</div>

							<div class="border-l-2 border-border/50 pl-3">
								<span class="block text-[10px] font-black uppercase text-muted-foreground">Saldo Akhir Hutang</span>
								<span class="font-mono text-sm font-black text-foreground">
									Rp {formatNum(sup.saldoAkhirRp)}
								</span>
							</div>
						</div>
					</button>

					<!-- Table Transaksi Supplier -->
					{#if !isCollapsed}
						<div class="overflow-x-auto">
							<Table wrapperClass="border-0 shadow-none rounded-none">
								<TableHeader>
									<TableRow class="bg-muted/70">
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-24">Tanggal</TableHead>
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-28">No. Bukti</TableHead>
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-16">Tipe</TableHead>
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-24">Jatuh Tempo</TableHead>
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-20 text-center">Status</TableHead>
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest min-w-44">Keterangan / Remark</TableHead>
										<TableHead class="text-right font-mono text-[10px] font-black uppercase tracking-widest w-28 bg-amber-500/5">Beli / Tambah (Rp)</TableHead>
										<TableHead class="text-right font-mono text-[10px] font-black uppercase tracking-widest w-28 bg-emerald-500/5">Bayar / Kurang (Rp)</TableHead>
										<TableHead class="text-right font-mono text-[10px] font-black uppercase tracking-widest w-36 bg-primary/5">Saldo Hutang (Rp)</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									<!-- Baris Saldo Awal -->
									<TableRow class="bg-muted/30 font-bold">
										<TableCell class="font-mono text-xs">{formatDate(data.filters.tgl1)}</TableCell>
										<TableCell class="font-mono text-xs text-muted-foreground">-</TableCell>
										<TableCell class="font-mono text-xs text-muted-foreground">-</TableCell>
										<TableCell class="font-mono text-xs text-muted-foreground">-</TableCell>
										<TableCell class="text-center">
											<span class="px-1.5 py-0.5 rounded text-[10px] font-black border bg-muted text-muted-foreground border-border">
												SA
											</span>
										</TableCell>
										<TableCell class="font-mono text-xs font-black text-primary">SALDO AWAL</TableCell>
										<TableCell class="text-right font-mono text-xs">-</TableCell>
										<TableCell class="text-right font-mono text-xs">-</TableCell>
										<TableCell class="text-right font-mono text-xs font-black bg-primary/5">
											{formatNum(sup.saldoAwalRp)}
										</TableCell>
									</TableRow>

									<!-- Baris Transaksi -->
									{#if sup.transactions.length === 0}
										<TableRow>
											<TableCell colspan={9} class="py-6 text-center text-xs font-bold text-muted-foreground">
												Tidak ada mutasi transaksi pada periode ini.
											</TableCell>
										</TableRow>
									{:else}
										{#each sup.transactions as t}
											{@const b = getStatusBadge(t.status)}
											<TableRow class="hover:bg-primary/5">
												<TableCell class="font-mono text-xs text-muted-foreground">{formatDate(t.transDate)}</TableCell>
												<TableCell class="font-mono text-xs font-bold text-primary">{t.transID}</TableCell>
												<TableCell class="font-mono text-xs font-bold">{t.transType || '-'}</TableCell>
												<TableCell class="font-mono text-xs text-muted-foreground">{formatDate(t.dueDate)}</TableCell>
												<TableCell class="text-center">
													<span class="px-1.5 py-0.5 rounded text-[10px] font-black border {b.cls}">
														{b.label}
													</span>
												</TableCell>
												<TableCell class="text-xs font-semibold">{t.remark || '-'}</TableCell>
												<TableCell class="text-right font-mono text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/5">
													{t.beliRp > 0 ? formatNum(t.beliRp) : '-'}
												</TableCell>
												<TableCell class="text-right font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
													{t.bayarRp > 0 ? formatNum(t.bayarRp) : '-'}
												</TableCell>
												<TableCell class="text-right font-mono text-xs font-black bg-primary/5">
													{formatNum(t.saldoRp)}
												</TableCell>
											</TableRow>
										{/each}
									{/if}

									<!-- Baris Subtotal Supplier -->
									<TableRow class="bg-muted/80 font-black border-t-2 border-border">
										<TableCell colspan={6} class="text-right font-black uppercase text-xs">
											TOTAL SUPPLIER [{sup.companyID}]:
										</TableCell>
										<TableCell class="text-right font-mono text-xs font-black text-amber-700 dark:text-amber-400 bg-amber-500/10">
											{formatNum(sup.totalBeliRp)}
										</TableCell>
										<TableCell class="text-right font-mono text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
											{formatNum(sup.totalBayarRp)}
										</TableCell>
										<TableCell class="text-right font-mono text-xs font-black text-foreground bg-primary/10">
											{formatNum(sup.saldoAkhirRp)}
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</div>
					{/if}
				</div>
			{/each}

			<!-- GRAND TOTAL FOOTER BANNER -->
			<div class="bg-card rounded-xl border-[3px] border-border p-5 brutal-shadow flex flex-wrap items-center justify-between gap-4 bg-muted/20">
				<div>
					<h3 class="font-black uppercase text-base tracking-tight" style="font-family: var(--font-display)">
						GRAND TOTAL LAPORAN KARTU HUTANG
					</h3>
					<p class="text-xs font-bold text-muted-foreground mt-0.5">
						Periode {formatDate(data.filters.tgl1)} s/d {formatDate(data.filters.tgl2)} • Supplier: {data.filters.companyID}
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-6">
					<div>
						<span class="block text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Total Beli (+Hutang)</span>
						<span class="font-mono text-base font-black text-amber-700 dark:text-amber-400">
							Rp {formatNum(data.grandTotal.totalBeliRp)}
						</span>
					</div>

					<div>
						<span class="block text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Total Bayar (-Hutang)</span>
						<span class="font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
							Rp {formatNum(data.grandTotal.totalBayarRp)}
						</span>
					</div>

					<div class="border-l-2 border-border pl-4">
						<span class="block text-[10px] font-black uppercase text-primary">Saldo Akhir Kumulatif</span>
						<span class="font-mono text-base font-black text-primary">
							Rp {formatNum(data.grandTotal.totalSaldoAkhirRp)}
						</span>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
