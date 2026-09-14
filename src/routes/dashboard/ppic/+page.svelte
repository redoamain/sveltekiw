<script lang="ts">
	import {
		Badge,
		Button,
		Input,
		Label,
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
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
		ClipboardList,
		Search,
		Download,
		History,
		RotateCcw,
		Trash2,
		Plus,
		CheckCircle,
		AlertTriangle,
		XCircle,
		ShieldCheck
	} from '@lucide/svelte';

	let { data, form } = $props();

	let activeTab = $state<'spk' | 'history' | 'overrides' | 'committed'>('spk');
	let loading = $state(false);
	let loadingMsg = $state('Memproses...');
	let selectedSpks = $state<string[]>([]);
	let calcName = $state('');
	let userID = $state('system');

	$effect(() => {
		if (data.plan?.spkList && data.plan.spkList.length > 0) {
			selectedSpks = [...data.plan.spkList];
		}
	});

	// Reset loading ketika data halaman selesai diperbarui oleh SvelteKit
	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	let allSelected = $derived(
		data.groups.length > 0 && data.groups.every((g) => selectedSpks.includes(g.No_SPK))
	);

	function toggleSelectAll() {
		if (allSelected) {
			selectedSpks = [];
		} else {
			selectedSpks = data.groups.map((g) => g.No_SPK);
		}
	}

	function toggleSelect(noSpk: string) {
		if (selectedSpks.includes(noSpk)) {
			selectedSpks = selectedSpks.filter((s) => s !== noSpk);
		} else {
			selectedSpks = [...selectedSpks, noSpk];
		}
	}

	const fmt = (n: number) => (Number(n) || 0).toLocaleString('id-ID');
	const fmtDate = (v: any) => {
		if (!v) return '-';
		const d = v instanceof Date ? v : new Date(String(v));
		return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('id-ID');
	};

	let flashMsg = $derived(data.flashMsg || '');
	let flashErr = $derived(form?.error || data.flashErr || data.loadError || '');
</script>

<LoadingOverlay show={loading} message={loadingMsg} submessage="Mohon tunggu, jangan tutup halaman." />

<div class="space-y-6">
	<PageHeader
		title="Production Plan"
		description="Hitung kebutuhan material, BOM override & commit reservasi stok per SPK."
	>
		{#snippet actions()}
			<Badge variant="secondary" class="border-[3px] font-mono font-black">
				{data.pagedTotal.toLocaleString('id-ID')} SPK AKTIF
			</Badge>
			<Badge variant="primary" class="border-[3px] font-mono font-black">
				{data.pagedTotalQty.toLocaleString('id-ID')} QTY
			</Badge>
		{/snippet}
	</PageHeader>

	{#if flashMsg}
		<div
			class="bg-success text-success-foreground flex items-center gap-2 rounded-xl border-[3px] border-border px-4 py-3 text-sm font-black uppercase tracking-wide brutal-shadow"
			role="alert"
		>
			<span class="bg-card text-success flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border text-xs font-black">
				✓
			</span>
			<span>{flashMsg}</span>
		</div>
	{/if}

	{#if flashErr}
		<div
			class="bg-error text-error-foreground flex items-center gap-2 rounded-xl border-[3px] border-border px-4 py-3 text-sm font-black uppercase tracking-wide brutal-shadow"
			role="alert"
		>
			<span class="bg-card text-error flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border text-xs font-black">
				!
			</span>
			<span>{flashErr}</span>
		</div>
	{/if}

	<!-- Tab navigation brutal -->
	<div class="flex flex-wrap gap-2 border-b-[3px] border-border pb-3">
		<button
			type="button"
			onclick={() => (activeTab = 'spk')}
			class="rounded-xl border-[3px] border-border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer brutal-shadow-sm
				{activeTab === 'spk' ? 'bg-primary text-primary-foreground -translate-x-px -translate-y-px' : 'bg-card text-foreground hover:bg-muted'}"
		>
			SPK & Hitung Material
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'history')}
			class="rounded-xl border-[3px] border-border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer brutal-shadow-sm
				{activeTab === 'history' ? 'bg-primary text-primary-foreground -translate-x-px -translate-y-px' : 'bg-card text-foreground hover:bg-muted'}"
		>
			History Perhitungan ({data.records.length})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'overrides')}
			class="rounded-xl border-[3px] border-border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer brutal-shadow-sm
				{activeTab === 'overrides' ? 'bg-primary text-primary-foreground -translate-x-px -translate-y-px' : 'bg-card text-foreground hover:bg-muted'}"
		>
			BOM Override ({data.overrides.length})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'committed')}
			class="rounded-xl border-[3px] border-border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer brutal-shadow-sm
				{activeTab === 'committed' ? 'bg-primary text-primary-foreground -translate-x-px -translate-y-px' : 'bg-card text-foreground hover:bg-muted'}"
		>
			PO Ter-commit ({data.committed.committedPOs.length})
		</button>
	</div>

	{#if activeTab === 'spk'}
		<!-- Filter bar -->
		<form
			method="get"
			action="/dashboard/ppic"
			class="bg-card flex flex-wrap items-end gap-3 rounded-xl border-[3px] border-border p-4 brutal-shadow"
		>
			<div class="space-y-1">
				<Label for="tgl1">Tgl Awal</Label>
				<Input type="date" id="tgl1" name="tgl1" value={data.tgl1} class="h-11 border-[3px]" />
			</div>
			<div class="space-y-1">
				<Label for="tgl2">Tgl Akhir</Label>
				<Input type="date" id="tgl2" name="tgl2" value={data.tgl2} class="h-11 border-[3px]" />
			</div>
			<div class="min-w-56 flex-1 space-y-1">
				<Label for="q">Cari</Label>
				<div class="relative">
					<Search class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						id="q"
						name="q"
						value={data.q}
						placeholder="No SPK / Kode Barang / Nama PO..."
						class="h-11 border-[3px] pl-9 font-bold"
					/>
				</div>
			</div>
			<div class="space-y-1">
				<Label>Per Halaman</Label>
				<select
					name="pageSize"
					value={String(data.pageSize)}
					class="bg-card border-border h-11 rounded-lg border-[3px] px-3 text-sm font-black brutal-shadow-sm focus:outline-none"
				>
					<option value="25">25</option>
					<option value="50">50</option>
					<option value="100">100</option>
					<option value="200">200</option>
				</select>
			</div>
			<Button type="submit" class="h-11 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm">
				Tampilkan
			</Button>
			{#if data.q || data.tgl1}
				<a
					href="/dashboard/ppic"
					class="border-border bg-card hover:bg-muted inline-flex h-11 items-center rounded-lg border-[3px] px-4 text-sm font-black uppercase tracking-wide brutal-shadow-sm"
				>
					Reset
				</a>
			{/if}
		</form>

		<!-- SPK Table & Hitung Section -->
		<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
			<div class="border-b-[3px] border-border flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-muted/40">
				<div class="flex items-center gap-3">
					<label class="flex items-center gap-2 font-mono text-xs font-black uppercase cursor-pointer">
						<input
							type="checkbox"
							checked={allSelected}
							onchange={toggleSelectAll}
							class="size-4.5 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
						/>
						<span>Pilih Semua di Halaman Ini</span>
					</label>
					{#if selectedSpks.length > 0}
						<Badge variant="primary" class="border-2 font-mono">
							{selectedSpks.length} SPK DIPILIH
						</Badge>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<!-- Hitung Form -->
					<form
						method="post"
						action="?/hitung"
						onsubmit={() => {
							loading = true;
							loadingMsg = 'Menghitung kebutuhan material...';
						}}
						class="inline-flex"
					>
						<input type="hidden" name="tgl1" value={data.tgl1} />
						<input type="hidden" name="tgl2" value={data.tgl2} />
						<input type="hidden" name="q" value={data.q} />
						<input type="hidden" name="page" value={String(data.page)} />
						<input type="hidden" name="pageSize" value={String(data.pageSize)} />
						{#each selectedSpks as spk}
							<input type="hidden" name="spk" value={spk} />
						{/each}
						<Button
							type="submit"
							variant="primary"
							disabled={selectedSpks.length === 0}
							class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						>
							<ClipboardList class="size-4 mr-1" />
							Hitung Kebutuhan Material ({selectedSpks.length})
						</Button>
					</form>

					<!-- Export Excel Form -->
					<form
						method="post"
						action="/api/export"
						onsubmit={() => {
							loading = true;
							loadingMsg = 'Menyiapkan Excel...';
							setTimeout(() => (loading = false), 3000);
						}}
						class="inline-flex"
					>
						<input type="hidden" name="tgl1" value={data.tgl1} />
						<input type="hidden" name="tgl2" value={data.tgl2} />
						<input type="hidden" name="q" value={data.q} />
						{#if data.plan?.planId}
							<input type="hidden" name="planId" value={data.plan.planId} />
						{/if}
						{#each selectedSpks as spk}
							<input type="hidden" name="spk" value={spk} />
						{/each}
						<Button
							type="submit"
							variant="secondary"
							class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						>
							<Download class="size-4 mr-1" />
							Export Excel {selectedSpks.length > 0 ? `(${selectedSpks.length})` : '(semua)'}
						</Button>
					</form>
				</div>
			</div>

			<div class="overflow-x-auto">
				<Table wrapperClass="border-0 shadow-none rounded-none">
					<TableHeader>
						<TableRow class="bg-muted/50">
							<TableHead class="w-10 text-center">✓</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">No SPK</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Nama PO</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Barang & QTY</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Total QTY</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.groups.length === 0}
							<TableRow>
								<TableCell colspan={6} class="h-24 text-center">
									<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
										Tidak ada SPK aktif pada filter ini
									</p>
								</TableCell>
							</TableRow>
						{:else}
							{#each data.groups as g}
								{@const isChecked = selectedSpks.includes(g.No_SPK)}
								{@const isCommitted = data.committedSPKs.includes(g.No_SPK)}
								<TableRow class="hover:bg-primary/5 {isChecked ? 'bg-primary/10' : ''}">
									<TableCell class="text-center">
										<input
											type="checkbox"
											checked={isChecked}
											onchange={() => toggleSelect(g.No_SPK)}
											class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
										/>
									</TableCell>
									<TableCell class="font-mono text-xs font-black">{g.No_SPK}</TableCell>
									<TableCell class="max-w-44 truncate font-bold text-xs">{g.Nama_PO || '-'}</TableCell>
									<TableCell>
										<div class="space-y-0.5">
											{#each g.lines as line}
												<div class="flex items-center gap-2 font-mono text-xs">
													<span class="font-bold">{line.Kode_Barang}</span>
													<span class="text-muted-foreground">× {fmt(line.QTY)}</span>
												</div>
											{/each}
										</div>
									</TableCell>
									<TableCell class="font-mono text-xs font-black">{fmt(g.totalQty)}</TableCell>
									<TableCell>
										{#if isCommitted}
											<Badge variant="primary" class="font-mono text-[10px]">COMMITTED</Badge>
										{:else}
											<Badge variant="outline" class="font-mono text-[10px]">BELUM</Badge>
										{/if}
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>

			<div class="border-t-[3px] border-border bg-muted/30 px-3">
				<Pagination
					page={data.page}
					pageSize={data.pageSize}
					total={data.pagedTotal}
					basePath="/dashboard/ppic"
					pageSizeOptions={[25, 50, 100, 200]}
					params={{
						tgl1: data.tgl1,
						tgl2: data.tgl2,
						q: data.q || undefined
					}}
				/>
			</div>
		</div>

		<!-- Hasil Perhitungan (Plan) Section -->
		{#if data.plan}
			<div class="space-y-4 pt-4 border-t-4 border-border">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 class="text-2xl font-black uppercase tracking-tight" style="font-family: var(--font-display)">
							Hasil Perhitungan Kebutuhan Material
						</h2>
						{#if data.planFromHistory}
							<p class="font-mono text-xs font-black text-warning uppercase">
								★ Dimuat dari History (Read-Only)
							</p>
						{:else}
							<p class="font-mono text-xs font-bold uppercase text-muted-foreground">
								Perhitungan realtime berdasarkan BOM Tree & Stok terkini
							</p>
						{/if}
					</div>

					<div class="flex flex-wrap items-center gap-2">
						{#if !data.planFromHistory && data.plan.planId}
							<!-- Simpan History Form -->
							<form
								method="post"
								action="?/simpan"
								onsubmit={() => {
									loading = true;
									loadingMsg = 'Menyimpan hasil perhitungan...';
								}}
								class="flex items-center gap-1.5"
							>
								<input type="hidden" name="planId" value={data.plan.planId} />
								<Input
									name="calcName"
									bind:value={calcName}
									placeholder="Nama perhitungan..."
									class="h-9 w-40 border-2 text-xs"
								/>
								<Button
									type="submit"
									variant="secondary"
									class="h-9 border-[3px] font-black uppercase text-xs brutal-shadow-sm cursor-pointer"
								>
									Simpan History
								</Button>
							</form>

							<!-- Commit PO Form -->
							<form
								method="post"
								action="?/commit"
								onsubmit={(e) => {
									if (!confirm('Yakin ingin commit dan reservasi stok untuk SPK terpilih?')) {
										e.preventDefault();
										return;
									}
									loading = true;
									loadingMsg = 'Memproses commit PO...';
								}}
								class="flex items-center gap-1.5"
							>
								<input type="hidden" name="planId" value={data.plan.planId} />
								{#each selectedSpks as spk}
									<input type="hidden" name="spk" value={spk} />
								{/each}
								<Input
									name="userID"
									bind:value={userID}
									placeholder="User commit"
									class="h-9 w-28 border-2 text-xs"
								/>
								<Button
									type="submit"
									variant="primary"
									class="h-9 border-[3px] font-black uppercase text-xs brutal-shadow-sm cursor-pointer"
								>
									<ShieldCheck class="size-4 mr-1" /> Commit PO
								</Button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Summary cards brutal -->
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					<StatCard label="Total Material" value={fmt(data.plan.summary.totalMaterials)} tone="primary" />
					<StatCard label="Total Kebutuhan" value={fmt(data.plan.summary.totalNeeded)} tone="muted" />
					<StatCard label="Kekurangan" value={fmt(data.plan.summary.totalShortage)} tone="error" />
					<StatCard label="Status Aman" value={fmt(data.plan.summary.aman)} tone="success" />
					<StatCard label="Status Kurang" value={fmt(data.plan.summary.kurang)} tone="warning" />
					<StatCard label="Status Habis" value={fmt(data.plan.summary.habis)} tone="error" />
				</div>

				<!-- Material Requirements Table -->
				<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
					<div class="overflow-x-auto">
						<Table wrapperClass="border-0 shadow-none rounded-none">
							<TableHeader>
								<TableRow class="bg-muted/50">
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Status</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Level</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Item ID</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Nama Barang</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Dept</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest text-right">Kebutuhan</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest text-right">Stok WinCP</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest text-right">Saldo Akhir</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest text-right">Reserved</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest text-right">Total Butuh</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest text-right">Sisa Stok</TableHead>
									<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest text-right">Kekurangan</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each data.plan.rows as r}
									{@const isAman = r.Status === 'AMAN'}
									{@const isKurang = r.Status === 'KURANG'}
									<TableRow class="hover:bg-primary/5">
										<TableCell>
											<Badge
												variant={isAman ? 'success' : isKurang ? 'warning' : 'error'}
												class="border-2 font-mono text-[10px]"
											>
												{r.Status}
											</Badge>
										</TableCell>
										<TableCell class="font-mono text-xs">{r.Level}</TableCell>
										<TableCell class="font-mono text-xs font-black">{r.ItemID}</TableCell>
										<TableCell class="max-w-56 truncate font-bold text-xs">{r.ItemName || '-'}</TableCell>
										<TableCell>
											<Badge variant="secondary" class="font-mono text-[10px]">{r.Departemen || '-'}</Badge>
										</TableCell>
										<TableCell class="font-mono text-xs font-bold text-primary text-right">{fmt(r.TotalNeeded)}</TableCell>
										<TableCell class="font-mono text-xs text-right">{fmt(r.StockWincp)}</TableCell>
										<TableCell class="font-mono text-xs text-right">{fmt(r.StockAkhir)}</TableCell>
										<TableCell class="font-mono text-xs text-muted-foreground text-right">{fmt(r.QtyReserved)}</TableCell>
										<TableCell class="font-mono text-xs font-bold text-right">{fmt(r.TotalDibutuhkan)}</TableCell>
										<TableCell class="font-mono text-xs font-bold text-right {r.Available < 0 ? 'text-error' : 'text-success'}">
											{fmt(r.Available)}
										</TableCell>
										<TableCell class="font-mono text-xs font-black text-right {r.Shortage > 0 ? 'text-error' : 'text-muted-foreground'}">
											{r.Shortage > 0 ? `-${fmt(r.Shortage)}` : '0'}
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>
				</div>
			</div>
		{/if}
	{:else if activeTab === 'history'}
		<!-- History Tab -->
		<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
			<div class="border-b-[3px] border-border px-4 py-3 bg-muted/40">
				<h3 class="font-black uppercase tracking-tight text-base" style="font-family: var(--font-display)">
					History Perhitungan Kebutuhan Material
				</h3>
			</div>
			<div class="overflow-x-auto">
				<Table wrapperClass="border-0 shadow-none rounded-none">
					<TableHeader>
						<TableRow class="bg-muted/50">
							<TableHead class="font-mono text-[11px] font-black uppercase">ID Perhitungan</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">Nama</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">Tanggal</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">Total PO</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">Total Material</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">Aman / Kurang / Habis</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase text-center">Aksi</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.records.length === 0}
							<TableRow>
								<TableCell colspan={7} class="h-24 text-center">
									<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
										Belum ada history perhitungan tersimpan
									</p>
								</TableCell>
							</TableRow>
						{:else}
							{#each data.records as rec}
								<TableRow class="hover:bg-primary/5">
									<TableCell class="font-mono text-xs font-black">{rec.calculation_id}</TableCell>
									<TableCell class="font-bold text-xs">{rec.calculation_name || '-'}</TableCell>
									<TableCell class="font-mono text-xs">{fmtDate(rec.calculation_date)}</TableCell>
									<TableCell class="font-mono text-xs font-bold">{rec.total_po}</TableCell>
									<TableCell class="font-mono text-xs">{rec.total_materials}</TableCell>
									<TableCell>
										<div class="flex items-center gap-1 font-mono text-[10px]">
											<span class="text-success font-bold">{rec.material_aman}</span> /
											<span class="text-warning font-bold">{rec.material_kurang}</span> /
											<span class="text-error font-bold">{rec.material_habis}</span>
										</div>
									</TableCell>
									<TableCell class="text-center">
										<div class="flex items-center justify-center gap-2">
											<a
												href="/dashboard/ppic?calc={rec.calculation_id}"
												class="rounded-lg border-2 border-border bg-card px-2.5 py-1 font-mono text-[10px] font-black uppercase brutal-shadow-sm hover:bg-muted"
											>
												Lihat
											</a>
											<form
												method="post"
												action="?/hapusCalc"
												onsubmit={(e) => {
													if (!confirm('Yakin ingin menghapus history ini?')) e.preventDefault();
												}}
												class="inline-flex"
											>
												<input type="hidden" name="calculation_id" value={rec.calculation_id} />
												<button
													type="submit"
													class="rounded-lg border-2 border-border bg-error px-2 py-1 text-error-foreground hover:bg-error/90 cursor-pointer"
													title="Hapus"
												>
													<Trash2 class="size-3.5" />
												</button>
											</form>
										</div>
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>
		</div>
	{:else if activeTab === 'overrides'}
		<!-- BOM Overrides Tab -->
		<div class="space-y-5">
			<!-- Tambah Override Form -->
			<Card class="rounded-xl border-[3px] border-border brutal-shadow">
				<CardHeader class="border-b-2 border-border p-4 bg-muted/30">
					<CardTitle class="text-base font-black">Tambah BOM Override</CardTitle>
					<CardDescription>Ganti bahan baku tertentu di BOM dengan bahan substitusi</CardDescription>
				</CardHeader>
				<CardContent class="p-4">
					<form method="post" action="?/tambahOverride" class="flex flex-wrap items-end gap-3">
						<div class="space-y-1">
							<Label for="orig">Original Item ID</Label>
							<Input id="orig" name="originalItemId" placeholder="Misal: BAHAN-A" required class="h-10 border-2 uppercase font-bold" />
						</div>
						<div class="space-y-1">
							<Label for="repl">Replacement Item ID</Label>
							<Input id="repl" name="replacementItemId" placeholder="Misal: BAHAN-B" required class="h-10 border-2 uppercase font-bold" />
						</div>
						<Button type="submit" variant="primary" class="h-10 border-2 font-black uppercase text-xs brutal-shadow-sm cursor-pointer">
							<Plus class="size-4 mr-1" /> Tambah Override
						</Button>
					</form>
				</CardContent>
			</Card>

			<!-- List Overrides Table -->
			<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
				<div class="border-b-[3px] border-border px-4 py-3 bg-muted/40">
					<h3 class="font-black uppercase tracking-tight text-base" style="font-family: var(--font-display)">
						Daftar BOM Overrides
					</h3>
				</div>
				<div class="overflow-x-auto">
					<Table wrapperClass="border-0 shadow-none rounded-none">
						<TableHeader>
							<TableRow class="bg-muted/50">
								<TableHead class="font-mono text-[11px] font-black uppercase">Original Item</TableHead>
								<TableHead class="font-mono text-[11px] font-black uppercase">→</TableHead>
								<TableHead class="font-mono text-[11px] font-black uppercase">Replacement Item</TableHead>
								<TableHead class="font-mono text-[11px] font-black uppercase">Status</TableHead>
								<TableHead class="font-mono text-[11px] font-black uppercase text-center">Aksi</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if data.overrides.length === 0}
								<TableRow>
									<TableCell colspan={5} class="h-24 text-center">
										<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
											Belum ada BOM Override yang disetel
										</p>
									</TableCell>
								</TableRow>
							{:else}
								{#each data.overrides as o}
									<TableRow class="hover:bg-primary/5">
										<TableCell class="font-mono text-xs font-black">{o.originalItemId}</TableCell>
										<TableCell class="font-bold">→</TableCell>
										<TableCell class="font-mono text-xs font-black text-primary">{o.replacementItemId}</TableCell>
										<TableCell>
											<Badge variant={o.isActive ? 'success' : 'outline'} class="font-mono text-[10px]">
												{o.isActive ? 'AKTIF' : 'NONAKTIF'}
											</Badge>
										</TableCell>
										<TableCell class="text-center">
											<div class="flex items-center justify-center gap-2">
												<form method="post" action="?/toggleOverride" class="inline-flex">
													<input type="hidden" name="id" value={o.id} />
													<input type="hidden" name="isActive" value={String(!o.isActive)} />
													<button
														type="submit"
														class="rounded-lg border-2 border-border bg-card px-2.5 py-1 font-mono text-[10px] font-black uppercase brutal-shadow-sm hover:bg-muted cursor-pointer"
													>
														{o.isActive ? 'Nonaktifkan' : 'Aktifkan'}
													</button>
												</form>
												<form
													method="post"
													action="?/hapusOverride"
													onsubmit={(e) => {
														if (!confirm('Hapus override ini?')) e.preventDefault();
													}}
													class="inline-flex"
												>
													<input type="hidden" name="id" value={o.id} />
													<button
														type="submit"
														class="rounded-lg border-2 border-border bg-error px-2 py-1 text-error-foreground hover:bg-error/90 cursor-pointer"
														title="Hapus"
													>
														<Trash2 class="size-3.5" />
													</button>
												</form>
											</div>
										</TableCell>
									</TableRow>
								{/each}
							{/if}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	{:else if activeTab === 'committed'}
		<!-- PO Ter-commit Tab -->
		<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
			<div class="border-b-[3px] border-border px-4 py-3 bg-muted/40">
				<h3 class="font-black uppercase tracking-tight text-base" style="font-family: var(--font-display)">
					Daftar SPK / PO yang Telah di-Commit
				</h3>
			</div>
			<div class="overflow-x-auto">
				<Table wrapperClass="border-0 shadow-none rounded-none">
					<TableHeader>
						<TableRow class="bg-muted/50">
							<TableHead class="font-mono text-[11px] font-black uppercase">No SPK</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">Nama PO</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">Kode Barang</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">QTY</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">User</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">Waktu Commit</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase text-center">Aksi</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.committed.committedPOs.length === 0}
							<TableRow>
								<TableCell colspan={7} class="h-24 text-center">
									<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
										Belum ada PO yang di-commit
									</p>
								</TableCell>
							</TableRow>
						{:else}
							{#each data.committed.committedPOs as p}
								<TableRow class="hover:bg-primary/5">
									<TableCell class="font-mono text-xs font-black">{p.noSPK}</TableCell>
									<TableCell class="max-w-44 truncate font-bold text-xs">{p.namaPO || '-'}</TableCell>
									<TableCell class="max-w-44 truncate font-mono text-xs">{p.kodeBarang || '-'}</TableCell>
									<TableCell class="font-mono text-xs font-black">{fmt(p.qty)}</TableCell>
									<TableCell class="font-mono text-xs text-muted-foreground">{p.userID || '-'}</TableCell>
									<TableCell class="font-mono text-xs">{fmtDate(p.tanggalCommit)}</TableCell>
									<TableCell class="text-center">
										{#if p.status === 'COMMITTED'}
											<form
												method="post"
												action="?/uncommit"
												onsubmit={(e) => {
													if (!confirm(`Yakin uncommit PO ${p.noSPK}? Reservasi stok akan dikembalikan.`)) {
														e.preventDefault();
													}
												}}
												class="inline-flex"
											>
												<input type="hidden" name="noSPK" value={p.noSPK} />
												<button
													type="submit"
													class="rounded-lg border-2 border-border bg-error px-2.5 py-1 font-mono text-[10px] font-black uppercase text-error-foreground hover:bg-error/90 brutal-shadow-sm cursor-pointer"
												>
													Uncommit
												</button>
											</form>
										{:else}
											<Badge variant="outline" class="font-mono text-[10px]">{p.status}</Badge>
										{/if}
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
