<script lang="ts">
	import {
		Badge,
		Button,
		Input,
		Label,
		PageHeader,
		Pagination,
		StatCard,
		Table,
		TableHeader,
		TableRow,
		TableHead,
		TableBody,
		TableCell,
		LoadingOverlay
	} from '$lib/components';
	import {
		Search,
		Download,
		RotateCcw,
		ChevronDown,
		ChevronRight,
		ShoppingCart,
		Package,
		Truck,
		Layers,
		Calendar,
		Building2,
		Clock,
		CheckCircle,
		AlertCircle
	} from '@lucide/svelte';

	let { data } = $props();

	let loading = $state(false);
	let loadingMsg = $state('Memproses...');
	let expandedPOs = $state<Record<string, boolean>>({});
	let unitProgress = $state<'kg' | 'bags'>('kg');

	// Reset loading ketika data halaman selesai diperbarui oleh SvelteKit
	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	// Kartu stock on-demand state
	let stockData = $state<Record<string, any[]>>({});
	let stockLoading = $state<Record<string, boolean>>({});
	let stockOpen = $state<Record<string, boolean>>({});

	function togglePO(orderId: string) {
		expandedPOs[orderId] = !expandedPOs[orderId];
	}

	function expandAll() {
		const all: Record<string, boolean> = {};
		data.groups.forEach((g: any) => {
			all[g.orderid] = true;
		});
		expandedPOs = all;
	}

	function collapseAll() {
		expandedPOs = {};
	}

	async function loadKartuStock(orderId: string, itemId: string) {
		const key = `${orderId}__${itemId}`;
		stockOpen[key] = !stockOpen[key];

		if (stockOpen[key] && !stockData[key]) {
			stockLoading[key] = true;
			try {
				const p = new URLSearchParams({
					tgl1: data.tgl1,
					tgl2: data.tgl2,
					itemid: itemId
				});
				const res = await fetch(`/api/monitoring-pembelian/kartustock?${p.toString()}`);
				if (res.ok) {
					stockData[key] = await res.json();
				} else {
					stockData[key] = [];
				}
			} catch {
				stockData[key] = [];
			} finally {
				stockLoading[key] = false;
			}
		}
	}

	const fmt = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('id-ID');
</script>

<LoadingOverlay show={loading} message={loadingMsg} submessage="Mohon tunggu" />

<div class="space-y-6">
	<PageHeader
		title="Monitoring Pembelian"
		description="Tracking Purchase Order (PO) & Kartu Stock Terintegrasi — Lacak kedatangan DTM & Memo per item."
	>
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<Badge variant="secondary" class="border-[3px] font-mono font-black">
					{data.total.toLocaleString('id-ID')} PO
				</Badge>
				<Button
					variant="outline"
					size="sm"
					class="h-9 border-[3px] font-black text-xs uppercase brutal-shadow-sm"
					onclick={Object.keys(expandedPOs).length > 0 ? collapseAll : expandAll}
				>
					{Object.keys(expandedPOs).length > 0 ? 'Tutup Semua' : 'Buka Semua'}
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Stat cards brutal -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
		<StatCard label="Total PO" value={fmt(data.stats.totalPOs)} tone="primary" icon="PO" />
		<StatCard label="Selesai" value={fmt(data.stats.totalCompleted)} tone="success" icon="✓" />
		<StatCard label="Parsial" value={fmt(data.stats.totalPartial)} tone="warning" icon="½" />
		<StatCard label="Menunggu" value={fmt(data.stats.totalPending)} tone="error" icon="⏳" />
		<StatCard label="Lokal (IDR)" value={fmt(data.stats.totalLocal)} tone="warning" icon="Rp" />
		<StatCard label="Impor (USD)" value={fmt(data.stats.totalImport)} tone="primary" icon="$" />
	</div>

	<!-- Filter bar brutal -->
	<form
		method="get"
		action="/dashboard/monitoring-pembelian"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
			<div class="space-y-1">
				<Label for="tgl1" class="font-mono text-xs font-black uppercase tracking-wider">Tgl Mulai</Label>
				<Input type="date" id="tgl1" name="tgl1" value={data.tgl1} class="h-11 border-[3px] font-bold" />
			</div>

			<div class="space-y-1">
				<Label for="tgl2" class="font-mono text-xs font-black uppercase tracking-wider">Tgl Akhir</Label>
				<Input type="date" id="tgl2" name="tgl2" value={data.tgl2} class="h-11 border-[3px] font-bold" />
			</div>

			<div class="space-y-1">
				<Label class="font-mono text-xs font-black uppercase tracking-wider">Status PO</Label>
				<select
					name="status"
					value={data.status}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase brutal-shadow-sm focus:outline-none"
				>
					<option value="all">Semua Status</option>
					<option value="pending">Menunggu (Belum Masuk)</option>
					<option value="partial">Parsial (Sebagian)</option>
					<option value="completed">Selesai Diterima</option>
				</select>
			</div>

			<div class="space-y-1">
				<Label class="font-mono text-xs font-black uppercase tracking-wider">Mata Uang</Label>
				<select
					name="currency"
					value={data.currency}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase brutal-shadow-sm focus:outline-none"
				>
					<option value="ALL">Semua (Lokal & Impor)</option>
					<option value="IDR">Lokal (IDR)</option>
					<option value="USD">Impor (USD)</option>
				</select>
			</div>

			<div class="space-y-1">
				<Label for="q" class="font-mono text-xs font-black uppercase tracking-wider">Cari</Label>
				<div class="relative">
					<Search class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						id="q"
						name="q"
						value={data.q}
						placeholder="No PO / Supplier / Item..."
						class="h-11 border-[3px] pl-9 font-bold"
					/>
				</div>
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t-2 border-border/40">
			<div class="flex items-center gap-2">
				<Button type="submit" class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer">
					Tampilkan
				</Button>
				{#if data.q || data.status !== 'all' || data.currency !== 'ALL'}
					<a
						href="/dashboard/monitoring-pembelian"
						class="border-border bg-card hover:bg-muted inline-flex h-10 items-center gap-1 rounded-lg border-[3px] px-3 text-xs font-black uppercase tracking-wide brutal-shadow-sm"
					>
						<RotateCcw class="size-3.5" /> Reset
					</a>
				{/if}
			</div>

			<div class="flex items-center gap-3">
				<div class="flex items-center gap-1 border-2 border-border rounded-lg bg-muted/50 p-1">
					<span class="font-mono text-[10px] font-black uppercase px-1 text-muted-foreground">Unit:</span>
					<button
						type="button"
						onclick={() => (unitProgress = 'kg')}
						class="px-2 py-0.5 text-xs font-black rounded cursor-pointer transition-colors {unitProgress === 'kg' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
					>
						Kg
					</button>
					<button
						type="button"
						onclick={() => (unitProgress = 'bags')}
						class="px-2 py-0.5 text-xs font-black rounded cursor-pointer transition-colors {unitProgress === 'bags' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
					>
						Zak
					</button>
				</div>

				<!-- Export Button -->
				<Button
					type="button"
					variant="secondary"
					onclick={() => {
						const form = document.getElementById('export-po-form') as HTMLFormElement;
						if (form) {
							loading = true;
							loadingMsg = 'Menyiapkan file Excel...';
							form.submit();
							setTimeout(() => (loading = false), 2500);
						}
					}}
					class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<Download class="size-4 mr-1" /> Export Excel
				</Button>
			</div>
		</div>
	</form>

	<!-- Hidden form for Excel export POST outside the filter form -->
	<form id="export-po-form" method="post" action="/api/monitoring-pembelian/export" class="hidden">
		<input type="hidden" name="tgl1" value={data.tgl1} />
		<input type="hidden" name="tgl2" value={data.tgl2} />
		<input type="hidden" name="q" value={data.q} />
		<input type="hidden" name="status" value={data.status} />
		<input type="hidden" name="currency" value={data.currency} />
	</form>

	{#if data.error}
		<div
			class="bg-error text-error-foreground flex items-center gap-2 rounded-xl border-[3px] border-border px-4 py-3 text-sm font-black uppercase tracking-wide brutal-shadow"
			role="alert"
		>
			<span class="bg-card text-error flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border text-xs font-black">
				!
			</span>
			<span>{data.error}</span>
		</div>
	{/if}

	<!-- Daftar PO Accordion Cards -->
	{#if data.groups.length === 0}
		<div class="bg-card rounded-xl border-[3px] border-border p-12 text-center brutal-shadow space-y-3">
			<div class="bg-muted border-border inline-flex size-14 items-center justify-center rounded-2xl border-[3px] brutal-shadow-sm mx-auto">
				<ShoppingCart class="size-7 text-muted-foreground" />
			</div>
			<p class="font-black uppercase tracking-tight text-lg" style="font-family: var(--font-display)">
				Tidak Ada Purchase Order (PO)
			</p>
			<p class="font-mono text-xs font-bold uppercase text-muted-foreground max-w-md mx-auto">
				Tidak ditemukan data PO untuk periode tanggal dan filter yang dipilih. Coba perlebar rentang tanggal atau reset filter.
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.groups as po}
				{@const isExpanded = Boolean(expandedPOs[po.orderid])}
				{@const pct = unitProgress === 'kg' ? po.progressKg : po.progressBags}
				{@const totalOrd = unitProgress === 'kg' ? po.totalOrderedKg : po.totalOrderedBags}
				{@const totalRcv = unitProgress === 'kg' ? po.totalReceivedKg : po.totalReceivedBags}
				{@const unitLabel = unitProgress === 'kg' ? 'kg' : 'zak'}

				<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden transition-all">
					<!-- PO Header Bar -->
					<div
						class="flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors border-b-[3px] {isExpanded ? 'border-border bg-muted/20' : 'border-transparent'}"
						onclick={() => togglePO(po.orderid)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && togglePO(po.orderid)}
					>
						<div class="flex items-center gap-3 min-w-48">
							<div class="bg-card border-2 border-border size-7 flex items-center justify-center rounded-lg brutal-shadow-xs">
								{#if isExpanded}
									<ChevronDown class="size-4" />
								{:else}
									<ChevronRight class="size-4" />
								{/if}
							</div>
							<div>
								<div class="flex items-center gap-2">
									<span class="font-mono text-sm font-black tracking-tight">{po.orderid}</span>
									<Badge
										variant={po.currency === 'USD' ? 'success' : 'secondary'}
										class="font-mono text-[10px] border-2"
									>
										{po.currency}
									</Badge>
									<Badge
										variant={po.status === 'completed' ? 'success' : po.status === 'partial' ? 'warning' : 'secondary'}
										class="border-2 font-mono text-[10px]"
									>
										{po.status === 'completed' ? 'SELESAI' : po.status === 'partial' ? 'PARSIAL' : 'MENUNGGU'}
									</Badge>
								</div>
								<div class="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
									<span class="font-mono font-bold">{po.orderdate || '-'}</span>
									<span>•</span>
									<span class="font-bold text-foreground truncate max-w-64">{po.companyname1 || '-'}</span>
								</div>
							</div>
						</div>

						<!-- Progress Bar & Metrics -->
						<div class="flex items-center gap-4 ml-auto">
							<div class="text-right min-w-36">
								<div class="font-mono text-xs font-black">
									<span class="text-primary font-black">{fmt(totalRcv)}</span> / {fmt(totalOrd)} {unitLabel}
								</div>
								<div class="flex items-center gap-2 mt-1">
									<div class="bg-muted h-2.5 w-28 rounded-full border border-border overflow-hidden">
										<div
											class="h-full rounded-full transition-all {pct >= 100 ? 'bg-success' : pct > 0 ? 'bg-warning' : 'bg-muted-foreground/30'}"
											style="width: {Math.min(100, pct)}%"
										></div>
									</div>
									<span class="font-mono text-[10px] font-black">{pct}%</span>
								</div>
							</div>
						</div>
					</div>

					<!-- PO Expanded Body -->
					{#if isExpanded}
						<div class="p-4 space-y-4 bg-muted/10">
							<!-- Item List & Kartu Stock Section -->
							<div class="space-y-2">
								<p class="font-mono text-xs font-black uppercase tracking-wider text-muted-foreground">
									Daftar Item ({po.items.length} Item)
								</p>
								<div class="bg-card rounded-lg border-2 border-border overflow-hidden">
									<Table wrapperClass="border-0 shadow-none rounded-none">
										<TableHeader>
											<TableRow class="bg-muted/50">
												<TableHead class="font-mono text-[11px] font-black uppercase">Kode Item</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase">Nama Item</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase text-right">Harga</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase text-right">Total PO</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase text-right">Diterima</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase text-right">Sisa</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase text-center">Aksi</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{#each po.items as it}
												{@const stockKey = `${po.orderid}__${it.itemid}`}
												{@const sisaKg = Math.max(0, it.pokgs - it.receivedKg)}
												{@const sisaBags = Math.max(0, it.pobags - it.receivedBags)}
												<TableRow class="hover:bg-primary/5">
													<TableCell class="font-mono text-xs font-black">{it.itemid}</TableCell>
													<TableCell class="font-bold text-xs max-w-64 truncate">{it.itemname}</TableCell>
													<TableCell class="font-mono text-xs text-right font-bold">
														{po.currency === 'USD' ? `$${it.poprice.toLocaleString('en-US')}` : `Rp ${fmt(it.poprice)}`}
													</TableCell>
													<TableCell class="font-mono text-xs text-right">
														<span class="font-bold">{fmt(it.pobags)}</span> zak / <span class="font-black">{fmt(it.pokgs)}</span> kg
													</TableCell>
													<TableCell class="font-mono text-xs text-right text-success font-bold">
														{fmt(it.receivedBags)} zak / {fmt(it.receivedKg)} kg
													</TableCell>
													<TableCell class="font-mono text-xs text-right font-bold {sisaKg > 0 ? 'text-error' : 'text-muted-foreground'}">
														{fmt(sisaBags)} zak / {fmt(sisaKg)} kg
													</TableCell>
													<TableCell class="text-center">
														<Button
															variant="outline"
															size="sm"
															class="h-7 border-2 font-mono text-[10px] font-black uppercase brutal-shadow-xs cursor-pointer"
															onclick={() => loadKartuStock(po.orderid, it.itemid)}
														>
															<Layers class="size-3 mr-1" />
															{stockOpen[stockKey] ? 'Tutup Stock' : 'Kartu Stock'}
														</Button>
													</TableCell>
												</TableRow>

												<!-- Inline Kartu Stock Drawer -->
												{#if stockOpen[stockKey]}
													<TableRow class="bg-muted/30">
														<TableCell colspan={7} class="p-3">
															<div class="bg-card rounded-lg border-2 border-border p-3 space-y-2">
																<div class="flex items-center justify-between border-b pb-2">
																	<div class="flex items-center gap-2">
																		<span class="font-mono text-xs font-black uppercase text-primary">
																			Kartu Stock: {it.itemid} ({it.itemname})
																		</span>
																		<Badge variant="secondary" class="font-mono text-[10px]">
																			{data.tgl1} s/d {data.tgl2}
																		</Badge>
																	</div>
																	{#if stockLoading[stockKey]}
																		<span class="font-mono text-xs text-muted-foreground animate-pulse">Memuat...</span>
																	{/if}
																</div>

																{#if stockLoading[stockKey]}
																	<div class="py-4 text-center font-mono text-xs text-muted-foreground">
																		Memuat data mutasi kartu stock...
																	</div>
																{:else if (stockData[stockKey] || []).length === 0}
																	<div class="py-2 text-center font-mono text-xs text-muted-foreground">
																		Tidak ada pergerakan stock pada rentang tanggal ini.
																	</div>
																{:else}
																	<div class="overflow-x-auto max-h-56">
																		<Table wrapperClass="border-0 shadow-none rounded-none">
																			<TableHeader>
																				<TableRow class="bg-muted/60">
																					<TableHead class="font-mono text-[10px] font-black uppercase">Tanggal</TableHead>
																					<TableHead class="font-mono text-[10px] font-black uppercase">Gudang</TableHead>
																					<TableHead class="font-mono text-[10px] font-black uppercase">Kegiatan</TableHead>
																					<TableHead class="font-mono text-[10px] font-black uppercase text-right">Masuk (Kg)</TableHead>
																					<TableHead class="font-mono text-[10px] font-black uppercase text-right">Keluar (Kg)</TableHead>
																					<TableHead class="font-mono text-[10px] font-black uppercase text-right">Saldo (Kg)</TableHead>
																					<TableHead class="font-mono text-[10px] font-black uppercase">No Memo / Doc</TableHead>
																				</TableRow>
																			</TableHeader>
																			<TableBody>
																				{#each stockData[stockKey] as st}
																					<TableRow class="hover:bg-primary/5">
																						<TableCell class="font-mono text-xs">{st.MoveDate || '-'}</TableCell>
																						<TableCell class="font-mono text-xs">{st.LocName}</TableCell>
																						<TableCell>
																							<Badge variant="secondary" class="font-mono text-[10px]">{st.Kegiatan}</Badge>
																						</TableCell>
																						<TableCell class="font-mono text-xs text-right font-bold text-success">
																							{st.KgI > 0 ? fmt(st.KgI) : '-'}
																						</TableCell>
																						<TableCell class="font-mono text-xs text-right font-bold text-error">
																							{st.KgO > 0 ? fmt(st.KgO) : '-'}
																						</TableCell>
																						<TableCell class="font-mono text-xs text-right font-black">
																							{fmt(st.SaldoKg)}
																						</TableCell>
																						<TableCell class="font-mono text-xs text-muted-foreground">
																							{st.NoMemo || st.NoDoc || '-'}
																						</TableCell>
																					</TableRow>
																				{/each}
																			</TableBody>
																		</Table>
																	</div>
																{/if}
															</div>
														</TableCell>
													</TableRow>
												{/if}
											{/each}
										</TableBody>
									</Table>
								</div>
							</div>

							<!-- Delivery & Receipts History -->
							<div class="space-y-2">
								<p class="font-mono text-xs font-black uppercase tracking-wider text-muted-foreground">
									Riwayat Penerimaan Gudang (DTM & Memo Masuk)
								</p>
								<div class="bg-card rounded-lg border-2 border-border overflow-hidden">
									<Table wrapperClass="border-0 shadow-none rounded-none">
										<TableHeader>
											<TableRow class="bg-muted/50">
												<TableHead class="font-mono text-[11px] font-black uppercase">No DTM</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase">Tgl DTM</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase text-right">Qty DTM</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase">No Memo</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase">Tgl Memo</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase text-right">Qty Memo</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase">Inv Supplier</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase">Tgl SJ</TableHead>
												<TableHead class="font-mono text-[11px] font-black uppercase">Penerima</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{@const allReceipts = po.items.flatMap((i: any) => i.receipts)}
											{#if allReceipts.length === 0}
												<TableRow>
													<TableCell colspan={9} class="h-16 text-center text-muted-foreground font-mono text-xs">
														Belum ada catatan penerimaan / DTM untuk PO ini
													</TableCell>
												</TableRow>
											{:else}
												{#each allReceipts as rc}
													<TableRow class="hover:bg-primary/5">
														<TableCell class="font-mono text-xs font-black text-primary">{rc.moveid}</TableCell>
														<TableCell class="font-mono text-xs">{rc.movedate || '-'}</TableCell>
														<TableCell class="font-mono text-xs text-right font-bold text-success">
															{fmt(rc.mbags)} zak / {fmt(rc.mkgs)} kg
														</TableCell>
														<TableCell class="font-mono text-xs font-bold">{rc.transid}</TableCell>
														<TableCell class="font-mono text-xs">{rc.transdate || '-'}</TableCell>
														<TableCell class="font-mono text-xs text-right">
															{fmt(rc.nbags)} zak / {fmt(rc.nkgs)} kg
														</TableCell>
														<TableCell class="font-mono text-xs">{rc.CompanyInvNo || '-'}</TableCell>
														<TableCell class="font-mono text-xs">{rc.TglSJSupplier || '-'}</TableCell>
														<TableCell class="font-mono text-xs text-muted-foreground">{rc.userpb || '-'}</TableCell>
													</TableRow>
												{/each}
											{/if}
										</TableBody>
									</Table>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
			<Pagination
				page={data.page}
				pageSize={data.pageSize}
				total={data.total}
				basePath="/dashboard/monitoring-pembelian"
				pageSizeOptions={[10, 25, 50, 100]}
				params={{
					tgl1: data.tgl1,
					tgl2: data.tgl2,
					q: data.q || undefined,
					status: data.status !== 'all' ? data.status : undefined,
					currency: data.currency !== 'ALL' ? data.currency : undefined
				}}
			/>
		</div>
	{/if}
</div>
