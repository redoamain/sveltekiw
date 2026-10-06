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
		LoadingOverlay,
		LoadingSpinner,
		Alert
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import type { SpkGroup, SpkPlanTree } from '$lib/domain/material';
	import BOMTreeViewer from './BOMTreeViewer.svelte';
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
		ShieldCheck,
		FolderTree,
		TableProperties,
		ChevronRight,
		ChevronDown
	} from '@lucide/svelte';

	let { data, form } = $props();

	let isSO = $derived(data.source === 'so');
	let docTypeLabel = $derived(isSO ? 'Sales Order' : 'SPK');
	let docTypeShort = $derived(isSO ? 'SO' : 'SPK');

	let activeTab = $state<'spk' | 'hasil' | 'history' | 'overrides' | 'committed'>('spk');
	let planViewMode = $state<'flat' | 'tree'>('tree');
	let selectedExportMode = $state<'full' | 'simple' | 'no-tree' | 'erp-china'>('full');
	let lastHandledPlanId = $state<string | null>(null);

	$effect(() => {
		const currentKey = data.plan?.planId || (data.planFromHistory ? 'history' : null);
		if (currentKey && currentKey !== lastHandledPlanId) {
			lastHandledPlanId = currentKey;
			activeTab = 'hasil';
		}
	});

	// Rincian bahan on-demand langsung di bawah baris (tanpa hitung material)
	let treeCache = new Map<string, SpkPlanTree>();
	let inlineExpandedSpk = $state<string | null>(null);
	let inlineLoading = $state(false);
	let inlineTrees = $state<Record<string, SpkPlanTree[]>>({});

	async function fetchTreesForSpk(g: SpkGroup): Promise<SpkPlanTree[]> {
		const results: SpkPlanTree[] = [];
		for (const line of g.lines) {
			const cacheKey = `${g.No_SPK}_${line.Kode_Barang}_${line.QTY}`;
			if (treeCache.has(cacheKey)) {
				results.push(treeCache.get(cacheKey)!);
				continue;
			}

			const params = new URLSearchParams({
				itemid: line.Kode_Barang,
				qty: String(line.QTY || 1),
				noSPK: g.No_SPK,
				namaPO: g.Nama_PO || '',
				namaBarang: line.Nama_Barang || '',
			});
			if (line.Tanggal_Order) params.set('tanggalOrder', line.Tanggal_Order);
			if (line.Plan_Date) params.set('planDate', line.Plan_Date);

			const res = await fetch(`/api/ppic/tree?${params.toString()}`);
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal memuat rincian bahan');
			const tree = json.tree as SpkPlanTree;
			treeCache.set(cacheKey, tree);
			results.push(tree);
		}
		return results;
	}

	async function toggleInlineTree(g: SpkGroup) {
		if (inlineExpandedSpk === g.No_SPK) {
			inlineExpandedSpk = null;
			return;
		}
		inlineExpandedSpk = g.No_SPK;
		if (!inlineTrees[g.No_SPK]) {
			inlineLoading = true;
			try {
				const trees = await fetchTreesForSpk(g);
				if (trees.length > 0) {
					inlineTrees[g.No_SPK] = trees;
				}
			} catch (err: any) {
				toast.error('Gagal', err?.message || 'Gagal memuat BOM Tree');
			} finally {
				inlineLoading = false;
			}
		}
	}
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
	let lastHandledMsg = $state<string | null>(null);
	let lastHandledErr = $state<string | null>(null);

	$effect(() => {
		if (flashMsg && flashMsg !== lastHandledMsg) {
			lastHandledMsg = flashMsg;
			toast.success('Berhasil', flashMsg);
		}
	});

	$effect(() => {
		if (flashErr && flashErr !== lastHandledErr) {
			lastHandledErr = flashErr;
			toast.error('Gagal', flashErr);
		}
	});
</script>

<LoadingOverlay show={loading} message={loadingMsg} submessage="Mohon tunggu, jangan tutup halaman." />

<div class="space-y-6">
	<PageHeader
		title="Production Plan"
		description="Hitung kebutuhan material, BOM override & commit reservasi stok per {docTypeShort}."
	>
		{#snippet actions()}
			<Badge variant="secondary" class="border-[3px] font-mono font-black">
				{data.pagedTotal.toLocaleString('id-ID')} {docTypeShort} AKTIF
			</Badge>
			<Badge variant="primary" class="border-[3px] font-mono font-black">
				{data.pagedTotalQty.toLocaleString('id-ID')} QTY
			</Badge>
		{/snippet}
	</PageHeader>

	{#if flashMsg}
		<Alert variant="success" dismissible>
			{flashMsg}
		</Alert>
	{/if}

	{#if flashErr}
		<Alert variant="error" dismissible>
			{flashErr}
		</Alert>
	{/if}

	<!-- Tab navigation brutal -->
	<div class="flex flex-wrap gap-2 border-b-[3px] border-border pb-3">
		<button
			type="button"
			onclick={() => (activeTab = 'spk')}
			class="rounded-xl border-[3px] border-border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer brutal-shadow-sm flex items-center gap-1.5
				{activeTab === 'spk' ? 'bg-primary text-primary-foreground -translate-x-px -translate-y-px' : 'bg-card text-foreground hover:bg-muted'}"
		>
			<ClipboardList class="size-4" />
			Pilih {docTypeShort}
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'hasil')}
			class="rounded-xl border-[3px] border-border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer brutal-shadow-sm flex items-center gap-1.5
				{activeTab === 'hasil' ? 'bg-primary text-primary-foreground -translate-x-px -translate-y-px' : 'bg-card text-foreground hover:bg-muted'}"
		>
			<FolderTree class="size-4" />
			Hasil Kebutuhan Bahan
			{#if data.plan}
				<span class="rounded bg-warning text-black px-1.5 py-0.5 font-mono text-[10px] font-black">
					AKTIF
				</span>
			{/if}
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'history')}
			class="rounded-xl border-[3px] border-border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer brutal-shadow-sm flex items-center gap-1.5
				{activeTab === 'history' ? 'bg-primary text-primary-foreground -translate-x-px -translate-y-px' : 'bg-card text-foreground hover:bg-muted'}"
		>
			<History class="size-4" />
			Riwayat Perhitungan ({data.records.length})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'overrides')}
			class="rounded-xl border-[3px] border-border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer brutal-shadow-sm flex items-center gap-1.5
				{activeTab === 'overrides' ? 'bg-primary text-primary-foreground -translate-x-px -translate-y-px' : 'bg-card text-foreground hover:bg-muted'}"
		>
			<Plus class="size-4" />
			Penyesuaian Bahan ({data.overrides.length})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'committed')}
			class="rounded-xl border-[3px] border-border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer brutal-shadow-sm flex items-center gap-1.5
				{activeTab === 'committed' ? 'bg-primary text-primary-foreground -translate-x-px -translate-y-px' : 'bg-card text-foreground hover:bg-muted'}"
		>
			<ShieldCheck class="size-4" />
			Sudah Direservasi ({data.committed.committedPOs.length})
		</button>
	</div>

	{#if activeTab === 'spk'}
		<!-- Petunjuk Sederhana untuk Pengguna -->
		<div class="rounded-xl border-2 border-primary/40 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2 text-xs brutal-shadow-xs">
			<div class="flex items-center gap-2">
				<span class="text-base select-none">💡</span>
				<p class="font-medium text-foreground">
					<strong>Cara Cepat:</strong> Klik tombol <strong>"Rincian Bahan"</strong> pada baris mana pun untuk langsung memeriksa stok komponennya di bawah baris tersebut. Atau centang beberapa baris lalu klik <strong>"Hitung Kebutuhan Material"</strong> untuk perhitungan massal.
				</p>
			</div>
		</div>

		<!-- Source selector (SPK vs Sales Order) -->
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-1.5 bg-card p-1.5 rounded-xl border-[3px] border-border brutal-shadow">
				<span class="px-2 font-mono text-[11px] font-black uppercase text-muted-foreground">Basis Perencanaan:</span>
				<a
					href="/dashboard/ppic?source=spk"
					class="rounded-lg border-2 border-border px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-all {data.source !== 'so' ? 'bg-primary text-primary-foreground brutal-shadow-sm -translate-y-0.5' : 'bg-background hover:bg-muted text-foreground'}"
				>
					📋 SPK (Work Order)
				</a>
				<a
					href="/dashboard/ppic?source=so"
					class="rounded-lg border-2 border-border px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-all {data.source === 'so' ? 'bg-primary text-primary-foreground brutal-shadow-sm -translate-y-0.5' : 'bg-background hover:bg-muted text-foreground'}"
				>
					🛒 Sales Order (SO)
				</a>
			</div>
			{#if isSO}
				<Badge variant="secondary" class="border-2 border-dashed font-mono text-xs text-primary">
					Mode Sales Order: Sumber tabel taSOhd & taSodt (Aktif)
				</Badge>
			{/if}
		</div>

		{#if data.plan}
			<div class="border-border bg-primary/10 brutal-shadow-xs flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-3">
				<div class="flex items-center gap-2">
					<FolderTree class="text-primary size-5" />
					<span class="font-bold text-xs">
						Hasil perhitungan aktif untuk <strong>{data.plan.spkList?.length || 0} {docTypeShort}</strong> ({data.plan.summary?.totalMaterials || 0} material) siap ditampilkan.
					</span>
				</div>
				<Button
					type="button"
					variant="primary"
					size="sm"
					onclick={() => (activeTab = 'hasil')}
					class="border-2 text-xs font-black uppercase cursor-pointer"
				>
					<FolderTree class="mr-1.5 size-3.5" /> Buka Tab Hasil Hitung & BOM Tree &rarr;
				</Button>
			</div>
		{/if}

		<!-- Filter bar -->
		<form
			method="get"
			action="/dashboard/ppic"
			class="bg-card flex flex-wrap items-end gap-3 rounded-xl border-[3px] border-border p-4 brutal-shadow"
		>
			<input type="hidden" name="source" value={data.source} />
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
						placeholder={isSO ? "No SO / Kode Barang / Customer..." : "No SPK / Kode Barang / Nama PO..."}
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
			{#if data.q || data.tgl1 || data.tgl2}
				<a
					href="/dashboard/ppic?source={data.source}"
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
							{selectedSpks.length} {docTypeShort} DIPILIH
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
						<input type="hidden" name="source" value={data.source} />
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
						class="inline-flex items-center gap-1.5"
					>
						<input type="hidden" name="source" value={data.source} />
						<input type="hidden" name="tgl1" value={data.tgl1} />
						<input type="hidden" name="tgl2" value={data.tgl2} />
						<input type="hidden" name="q" value={data.q} />
						{#if data.plan?.planId}
							<input type="hidden" name="planId" value={data.plan.planId} />
						{/if}
						{#each selectedSpks as spk}
							<input type="hidden" name="spk" value={spk} />
						{/each}
						<select
							name="mode"
							bind:value={selectedExportMode}
							aria-label="Format Template Excel"
							title="Pilih Format Template Excel"
							class="h-10 px-2.5 bg-background border-[3px] border-border font-mono text-xs font-black uppercase tracking-wider brutal-shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
						>
							<option value="full">Format: Detail (Tree Hierarki)</option>
							<option value="simple">Format: Simpel (Tree Hierarki)</option>
							<option value="no-tree">Format: Tanpa Tree (Daftar Material)</option>
							<option value="erp-china">Format: ERP China (生产单)</option>
						</select>
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
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">{isSO ? 'No SO' : 'No SPK'}</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">{isSO ? 'Customer & Ket.' : 'Nama PO'}</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Barang & QTY</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Total QTY</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Status</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest text-center">Bahan & Komponen</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.groups.length === 0}
							<TableRow>
								<TableCell colspan={7} class="h-24 text-center">
									<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
										Tidak ada {docTypeLabel} aktif pada filter ini
									</p>
								</TableCell>
							</TableRow>
						{:else}
							{#each data.groups as g}
								{@const isChecked = selectedSpks.includes(g.No_SPK)}
								{@const isCommitted = data.committedSPKs.includes(g.No_SPK)}
								{@const isExpanded = inlineExpandedSpk === g.No_SPK}
								<TableRow class="hover:bg-primary/5 {isChecked ? 'bg-primary/10' : ''} {isExpanded ? 'border-b-0 bg-muted/20' : ''}">
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
									<TableCell class="text-center">
										<button
											type="button"
											onclick={() => toggleInlineTree(g)}
											class="inline-flex items-center gap-1.5 rounded-lg border-2 border-border px-2.5 py-1 font-mono text-xs font-black uppercase transition-all cursor-pointer brutal-shadow-xs
												{isExpanded ? 'bg-primary text-primary-foreground -translate-y-0.5' : 'bg-background hover:bg-muted text-foreground'}"
											title={isExpanded ? 'Tutup rincian bahan' : 'Buka rincian kebutuhan bahan di bawah'}
										>
											{#if isExpanded}
												<ChevronDown class="size-3.5 stroke-[3]" />
												<span>Tutup</span>
											{:else}
												<FolderTree class="size-3.5 text-primary" />
												<span>Rincian</span>
											{/if}
										</button>
									</TableCell>
								</TableRow>
								{#if isExpanded}
									<TableRow class="border-b-2 border-border bg-muted/10">
										<TableCell colspan={7} class="bg-muted/20 p-2 sm:p-3">
											<div class="space-y-2 rounded-lg border-2 border-border bg-card p-2.5 sm:p-3 shadow-xs">
												<div class="flex items-center justify-between border-b border-border/50 pb-1.5">
													<div class="flex items-center gap-2">
														<FolderTree class="size-3.5 text-primary" />
														<span class="font-mono text-xs font-black uppercase text-foreground">
															Rincian Kebutuhan Bahan: {g.No_SPK} ({g.Nama_PO || '-'})
														</span>
													</div>
													<button
														type="button"
														onclick={() => toggleInlineTree(g)}
														class="rounded border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
													>
														✕ Tutup
													</button>
												</div>

												{#if inlineLoading && !inlineTrees[g.No_SPK]}
													<div class="flex items-center justify-center gap-2 py-6">
														<LoadingSpinner class="size-4 text-primary" />
														<span class="font-mono text-xs text-muted-foreground animate-pulse">
															Memeriksa stok bahan...
														</span>
													</div>
												{:else if inlineTrees[g.No_SPK] && inlineTrees[g.No_SPK].length > 0}
													<BOMTreeViewer
														trees={inlineTrees[g.No_SPK]}
														source={data.source}
														bind:exportMode={selectedExportMode}
													/>
												{:else}
													<p class="py-3 text-center font-mono text-xs text-muted-foreground">
														Tidak ada data bahan untuk dokumen ini.
													</p>
												{/if}
											</div>
										</TableCell>
									</TableRow>
								{/if}
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
						tgl1: data.tgl1 || undefined,
						tgl2: data.tgl2 || undefined,
						q: data.q || undefined,
						source: data.source
					}}
				/>
			</div>
		</div>
	{:else if activeTab === 'hasil'}
		<!-- Tab Hasil Perhitungan & BOM Tree -->
		{#if data.plan}
			<div class="space-y-4">
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
						<!-- Toggle Mode: Flat vs Tree -->
						{#if data.plan.trees && data.plan.trees.length > 0}
							<div class="border-border bg-card flex rounded-lg border-2 p-0.5 brutal-shadow-xs">
								<button
									type="button"
									onclick={() => (planViewMode = 'flat')}
									class="flex items-center gap-1.5 rounded-md px-3 py-1 font-mono text-xs font-black uppercase transition-all cursor-pointer {planViewMode === 'flat' ? 'bg-primary text-primary-foreground brutal-shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
								>
									<TableProperties class="size-3.5" /> Tabel Rekapitulasi
								</button>
								<button
									type="button"
									onclick={() => (planViewMode = 'tree')}
									class="flex items-center gap-1.5 rounded-md px-3 py-1 font-mono text-xs font-black uppercase transition-all cursor-pointer {planViewMode === 'tree' ? 'bg-primary text-primary-foreground brutal-shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
								>
									<FolderTree class="size-3.5" /> Pohon Komponen ({data.plan.trees.length})
								</button>
							</div>
						{/if}

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
									if (!confirm(`Yakin ingin commit dan reservasi stok untuk ${docTypeShort} terpilih?`)) {
										e.preventDefault();
										return;
									}
									loading = true;
									loadingMsg = `Memproses commit ${docTypeShort}...`;
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
									<ShieldCheck class="size-4 mr-1" /> Commit {docTypeShort}
								</Button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Summary cards brutal -->
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					<StatCard label="Total Jenis Bahan" value={fmt(data.plan.summary.totalMaterials)} tone="primary" />
					<StatCard label="Total Butuh (pcs)" value={fmt(data.plan.summary.totalNeeded)} tone="muted" />
					<StatCard label="Total Kekurangan" value={fmt(data.plan.summary.totalShortage)} tone="error" />
					<StatCard label="Bahan Cukup" value={fmt(data.plan.summary.aman)} tone="success" />
					<StatCard label="Bahan Kurang" value={fmt(data.plan.summary.kurang)} tone="warning" />
					<StatCard label="Bahan Kosong" value={fmt(data.plan.summary.habis)} tone="error" />
				</div>

				{#if planViewMode === 'tree' && data.plan.trees && data.plan.trees.length > 0}
					<BOMTreeViewer
						trees={data.plan.trees}
						planId={data.plan.planId}
						source={data.source}
						bind:exportMode={selectedExportMode}
					/>
				{:else}
					<!-- Material Requirements Table (Flat) -->
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
				{/if}
			</div>
		{:else}
			<div class="border-border bg-card brutal-shadow rounded-xl border-[3px] p-12 text-center space-y-4">
				<FolderTree class="text-muted-foreground mx-auto size-12" />
				<h3 class="font-black text-lg uppercase" style="font-family: var(--font-display)">Belum Ada Perhitungan Aktif</h3>
				<p class="text-muted-foreground text-xs max-w-md mx-auto">
					Silakan pilih satu atau beberapa {docTypeShort} pada tab <strong>Daftar {docTypeShort} & Pilih</strong>, lalu klik tombol <strong>Hitung Kebutuhan Material</strong>.
				</p>
				<Button
					type="button"
					variant="primary"
					onclick={() => (activeTab = 'spk')}
					class="border-2 text-xs font-black uppercase cursor-pointer"
				>
					<ClipboardList class="mr-1.5 size-3.5" /> Menuju Daftar {docTypeShort}
				</Button>
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
		<!-- Dokumen Ter-commit Tab -->
		<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
			<div class="border-b-[3px] border-border px-4 py-3 bg-muted/40">
				<h3 class="font-black uppercase tracking-tight text-base" style="font-family: var(--font-display)">
					Daftar Dokumen (SPK / SO) yang Telah di-Commit
				</h3>
			</div>
			<div class="overflow-x-auto">
				<Table wrapperClass="border-0 shadow-none rounded-none">
					<TableHeader>
						<TableRow class="bg-muted/50">
							<TableHead class="font-mono text-[11px] font-black uppercase">No Dokumen</TableHead>
							<TableHead class="font-mono text-[11px] font-black uppercase">Nama PO / Customer</TableHead>
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
										Belum ada SPK atau SO yang di-commit
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
													if (!confirm(`Yakin uncommit dokumen ${p.noSPK}? Reservasi stok akan dikembalikan.`)) {
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

