<script lang="ts">
	import {
		Badge,
		Button,
		Label,
		PageHeader,
		Pagination,
		Table,
		TableHeader,
		TableRow,
		TableHead,
		TableBody,
		TableCell,
		TableEmpty,
		LoadingOverlay,
		Modal
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		AppWindow,
		Search,
		Download,
		Printer,
		RotateCcw,
		FileCode,
		Layers,
		Eye,
		Database,
		Sparkles,
		RefreshCw,
		Copy,
		Check,
		Code,
		List,
		LayoutGrid,
		FileText,
		Server,
		ExternalLink
	} from '@lucide/svelte';
	import type { RpFormItem } from '$lib/server/rpform';

	let { data } = $props();

	let loading = $state(false);
	let exportLoading = $state(false);
	let viewMode = $state<'table' | 'grouped'>('table');

	$effect(() => {
		if (data?.view === 'grouped') {
			viewMode = 'grouped';
		} else {
			viewMode = 'table';
		}
	});

	// ==================== STATE MODAL DETAIL ====================
	let isDetailModalOpen = $state(false);
	let selectedItem = $state<RpFormItem | null>(null);
	let spDefinition = $state<string | null>(null);
	let loadingDefinition = $state(false);
	let copied = $state(false);

	async function openDetailModal(item: RpFormItem) {
		selectedItem = item;
		isDetailModalOpen = true;
		spDefinition = null;
		copied = false;

		if (item.isStoredProcedure) {
			loadingDefinition = true;
			try {
				const res = await fetch(`/api/laporan-rpform/definition?progName=${encodeURIComponent(item.ProgName)}`);
				if (res.ok) {
					const json = await res.json();
					spDefinition = json.definition || null;
				}
			} catch (err) {
				console.error('Gagal mengambil definisi Stored Procedure:', err);
			} finally {
				loadingDefinition = false;
			}
		}
	}

	async function copySqlCode() {
		if (!spDefinition) return;
		try {
			await navigator.clipboard.writeText(spDefinition);
			copied = true;
			toast.success('Berhasil', 'Kode SQL telah disalin ke clipboard');
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			toast.error('Gagal', 'Tidak dapat menyalin kode ke clipboard');
		}
	}

	// Grouping untuk tampilan 'grouped'
	let groupedData = $derived.by(() => {
		const map = new Map<string, { groupName: string; formName: string | null; formDisplayName: string | null; items: RpFormItem[] }>();
		for (const row of data.rows) {
			const key = row.GroupName;
			if (!map.has(key)) {
				map.set(key, {
					groupName: key,
					formName: row.FormName || null,
					formDisplayName: row.FormDisplayName || null,
					items: []
				});
			}
			map.get(key)!.items.push(row);
		}
		return Array.from(map.values());
	});

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Laporan Program Form (taRpForm) - KIW ERP</title>
</svelte:head>

<LoadingOverlay show={loading} message="Memuat pemetaan program form..." />

<div class="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
	<!-- Page Header -->
	<PageHeader
		title="Laporan Program Form (taRpForm)"
		description="Monitoring pemetaan fitur sistem ERP, nama program laporan (.rpt / Crystal Report), dan Stored Procedure SQL"
	>
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<!-- Toggle View Button -->
				<div class="inline-flex rounded-lg border-[3px] border-border bg-card p-0.5 brutal-shadow-sm">
					<button
						type="button"
						onclick={() => (viewMode = 'table')}
						class="flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase rounded-md transition-all cursor-pointer {viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
						title="Tampilan Tabel"
					>
						<List class="size-3.5" />
						<span class="hidden sm:inline">Tabel</span>
					</button>
					<button
						type="button"
						onclick={() => (viewMode = 'grouped')}
						class="flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase rounded-md transition-all cursor-pointer {viewMode === 'grouped' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
						title="Tampilan Per Fitur / Group"
					>
						<LayoutGrid class="size-3.5" />
						<span class="hidden sm:inline">Per Fitur</span>
					</button>
				</div>

				<!-- Form Export Excel -->
				<form
					method="post"
					action="/api/laporan-rpform/export"
					class="inline-block"
					onsubmit={() => {
						exportLoading = true;
						setTimeout(() => (exportLoading = false), 2500);
					}}
				>
					<input type="hidden" name="q" value={data.q} />
					<input type="hidden" name="group" value={data.group} />
					<input type="hidden" name="progType" value={data.progType} />

					<Button
						type="submit"
						variant="outline"
						disabled={exportLoading}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export seluruh pemetaan data sesuai filter ke Excel"
					>
						{#if exportLoading}
							<RefreshCw class="size-4 mr-1 animate-spin" />
							Mengunduh...
						{:else}
							<Download class="size-4 mr-1" />
							Export Excel
						{/if}
					</Button>
				</form>

				<!-- Tombol Print / Cetak -->
				<Button
					type="button"
					variant="outline"
					onclick={handlePrint}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer hidden sm:inline-flex"
					title="Cetak laporan program form"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Summary Metrics Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Pemetaan -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Pemetaan</span>
				<AppWindow class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.total.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Baris Konfigurasi taRpForm
				</p>
			</div>
		</div>

		<!-- Fitur / Group Unik -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-blue-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
					Fitur / Group Unik
				</span>
				<Layers class="size-4 text-blue-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-blue-700 dark:text-blue-400">
					{data.stats.totalGroups.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Kelompok GroupName Berbeda
				</p>
			</div>
		</div>

		<!-- Program / Report Unik -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-violet-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-400">
					Program / Report Unik
				</span>
				<FileCode class="size-4 text-violet-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-violet-700 dark:text-violet-400">
					{data.stats.totalPrograms.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					File .rpt & Modul Program
				</p>
			</div>
		</div>

		<!-- SQL Stored Procedures -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
					Stored Procedure SQL
				</span>
				<Database class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
					{data.stats.totalStoredProcedures.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.stats.totalPrograms > 0 ? Math.round((data.stats.totalStoredProcedures / data.stats.totalPrograms) * 100) : 0}% terdaftar di SQL Database
				</p>
			</div>
		</div>
	</div>

	<!-- Filter & Search Form -->
	<form
		method="get"
		action="/dashboard/laporan-rpform"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3"
	>
		<input type="hidden" name="view" value={viewMode} />

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
			<!-- Input Pencarian -->
			<div class="space-y-1.5 lg:col-span-5">
				<Label for="q">Pencarian Fitur & Program</Label>
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<input
						type="text"
						id="q"
						name="q"
						value={data.q}
						placeholder="Cari program (NotaJual...), group (JL), remark, form..."
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] pl-9 pr-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
					/>
				</div>
			</div>

			<!-- Filter Group Fitur -->
			<div class="space-y-1.5 lg:col-span-3">
				<Label for="group">Group / Modul Fitur</Label>
				<select
					id="group"
					name="group"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="" selected={!data.group}>Semua Group ({data.groups.length})</option>
					{#each data.groups as grp (grp.GroupName)}
						<option value={grp.GroupName} selected={data.group === grp.GroupName}>
							{grp.GroupName} ({grp.count} lap) {grp.sampleRemark ? `- ${grp.sampleRemark}` : ''}
						</option>
					{/each}
				</select>
			</div>

			<!-- Filter Tipe Program -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="progType">Tipe Program</Label>
				<select
					id="progType"
					name="progType"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="" selected={!data.progType}>Semua Tipe</option>
					<option value="sp" selected={data.progType === 'sp'}>SQL Stored Procedure</option>
					<option value="report" selected={data.progType === 'report'}>Crystal Report / App</option>
				</select>
			</div>

			<!-- Tombol Terapkan & Reset -->
			<div class="flex items-center gap-2 lg:col-span-2">
				<Button
					type="submit"
					class="h-10 flex-1 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<Search class="size-3.5 mr-1" />
					Filter
				</Button>

				{#if data.q || data.group || data.progType}
					<a
						href="/dashboard/laporan-rpform"
						class="h-10 px-3 bg-muted hover:bg-muted/80 text-foreground border-[3px] border-border rounded-lg inline-flex items-center justify-center brutal-shadow-sm text-xs font-black uppercase"
						title="Reset Filter"
					>
						<RotateCcw class="size-4" />
					</a>
				{/if}
			</div>
		</div>
	</form>

	<!-- KONTEN: TAMPILAN TABEL ATAU GROUPED -->
	{#if viewMode === 'table'}
		<!-- Tabel Pemetaan Program Form -->
		<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
			<div class="flex items-center justify-between p-4 border-b-2 border-border/40 bg-muted/20">
				<div class="flex items-center gap-2">
					<AppWindow class="size-5 text-primary" />
					<h2 class="text-sm font-black uppercase tracking-wide">
						Daftar Pemetaan Program ({data.total.toLocaleString('id-ID')})
					</h2>
				</div>
				<div class="text-xs font-bold text-muted-foreground font-mono">
					Halaman {data.page} dari {data.totalPages || 1}
				</div>
			</div>

			<div class="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow class="bg-muted/60">
							<TableHead class="font-black text-xs uppercase tracking-wider text-center w-12">No</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider w-24">Group</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Form Terkait</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Nama Program / File</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Tipe</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Label Tab / Menu</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Keterangan / Fungsi</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider text-center w-16">Urutan</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider text-center w-24">Aksi</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.rows.length === 0}
							<TableEmpty
								colspan={9}
								message={data.q || data.group || data.progType
									? 'Tidak ada pemetaan program form yang sesuai dengan filter Anda.'
									: 'Belum ada data taRpForm tersimpan di database.'}
							/>
						{:else}
							{#each data.rows as row, idx (row.rjn)}
								<TableRow class="hover:bg-muted/40 transition-colors">
									<!-- No Urut -->
									<TableCell class="text-center font-mono text-xs font-bold text-muted-foreground">
										{(data.page - 1) * data.pageSize + idx + 1}
									</TableCell>

									<!-- Group Name -->
									<TableCell>
										<span
											class="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-black bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30"
										>
											{row.GroupName}
										</span>
									</TableCell>

									<!-- Form Terkait (taFormReport) -->
									<TableCell>
										{#if row.FormName}
											<div class="space-y-0.5">
												<div class="font-mono text-[11px] font-bold text-foreground">
													{row.FormName}
												</div>
												{#if row.FormDisplayName}
													<div class="text-xs text-muted-foreground font-bold">
														{row.FormDisplayName}
													</div>
												{/if}
											</div>
										{:else}
											<span class="text-xs text-muted-foreground italic">-</span>
										{/if}
									</TableCell>

									<!-- ProgName -->
									<TableCell>
										<div class="font-mono font-black text-xs text-foreground flex items-center gap-1.5">
											<span>{row.ProgName}</span>
										</div>
									</TableCell>

									<!-- Tipe: Stored Procedure vs Crystal Report -->
									<TableCell>
										{#if row.isStoredProcedure}
											<span
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
											>
												<Database class="size-3" />
												SQL SP
											</span>
										{:else}
											<span
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-muted text-muted-foreground border border-border"
											>
												<FileCode class="size-3" />
												Report
											</span>
										{/if}
									</TableCell>

									<!-- DisplayName -->
									<TableCell>
										<div class="font-bold text-xs text-foreground">
											{row.DisplayName || '-'}
										</div>
									</TableCell>

									<!-- Remark -->
									<TableCell>
										<div class="text-xs font-bold text-muted-foreground max-w-[280px] truncate" title={row.Remark || ''}>
											{row.Remark || '-'}
										</div>
									</TableCell>

									<!-- Indeks -->
									<TableCell class="text-center font-mono text-xs font-bold text-muted-foreground">
										{row.Indeks !== null ? row.Indeks : '-'}
									</TableCell>

									<!-- Aksi -->
									<TableCell class="text-center">
										<button
											type="button"
											onclick={() => openDetailModal(row)}
											class="p-1.5 rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer border border-border inline-flex items-center gap-1 text-xs font-bold"
											title="Lihat Detail Program & Kode SQL"
										>
											<Eye class="size-3.5" />
											<span class="text-[11px]">Rincian</span>
										</button>
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>

			<!-- Pagination Footer -->
			<div class="border-t-[3px] border-border bg-muted/30 px-3">
				<Pagination
					page={data.page}
					pageSize={data.pageSize}
					total={data.total}
					basePath="/dashboard/laporan-rpform"
					params={{
						q: data.q || undefined,
						group: data.group || undefined,
						progType: data.progType || undefined,
						view: viewMode
					}}
				/>
			</div>
		</div>
	{:else}
		<!-- Grouped / Feature Cards View -->
		<div class="space-y-4">
			{#if groupedData.length === 0}
				<div class="bg-card rounded-xl border-[3px] border-border p-8 brutal-shadow text-center">
					<p class="font-mono text-sm font-bold text-muted-foreground uppercase">
						Tidak ada kelompok fitur yang sesuai dengan filter pencarian.
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					{#each groupedData as group (group.groupName)}
						<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden flex flex-col justify-between">
							<div>
								<!-- Group Header -->
								<div class="p-3.5 bg-muted/40 border-b-2 border-border/40 flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-black bg-primary/20 text-primary border border-primary/40">
											Group: {group.groupName}
										</span>
										{#if group.formDisplayName}
											<span class="text-xs font-black text-foreground">
												{group.formDisplayName}
											</span>
										{/if}
									</div>
									<span class="text-[11px] font-mono font-bold text-muted-foreground">
										{group.items.length} program
									</span>
								</div>

								<!-- Items List -->
								<div class="p-3 divide-y divide-border/30 space-y-2">
									{#each group.items as item (item.rjn)}
										<div class="pt-2 first:pt-0 flex items-start justify-between gap-2">
											<div class="space-y-1">
												<div class="flex items-center gap-2">
													<span class="font-mono text-xs font-black text-foreground">
														{item.ProgName}
													</span>
													{#if item.isStoredProcedure}
														<span class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-mono text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
															SP
														</span>
													{/if}
												</div>
												<div class="flex items-center gap-2 text-[11px] text-muted-foreground font-bold">
													{#if item.DisplayName}
														<span class="text-primary font-black">[{item.DisplayName}]</span>
													{/if}
													{#if item.Remark}
														<span class="truncate max-w-[280px]">{item.Remark}</span>
													{/if}
												</div>
											</div>

											<button
												type="button"
												onclick={() => openDetailModal(item)}
												class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-colors shrink-0"
												title="Lihat Detail"
											>
												<Eye class="size-3.5" />
											</button>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Pagination Footer for Grouped View -->
				<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow p-3">
					<Pagination
						page={data.page}
						pageSize={data.pageSize}
						total={data.total}
						basePath="/dashboard/laporan-rpform"
						params={{
							q: data.q || undefined,
							group: data.group || undefined,
							progType: data.progType || undefined,
							view: viewMode
						}}
					/>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- ==================== MODAL DETAIL & KODE SQL ==================== -->
<Modal
	bind:open={isDetailModalOpen}
	size="2xl"
	title="Detail Pemetaan Program"
	subtitle={selectedItem ? `Program: ${selectedItem.ProgName} (Group ${selectedItem.GroupName})` : 'Informasi Program'}
	icon={AppWindow}
>
	{#if selectedItem}
		<div class="space-y-4">
			<!-- Header Card -->
			<div class="bg-muted/40 border-[3px] border-border rounded-xl p-4 brutal-shadow-sm flex items-start justify-between">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-black bg-primary/20 text-primary border border-primary/40">
							Group: {selectedItem.GroupName}
						</span>
						{#if selectedItem.isStoredProcedure}
							<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
								<Database class="size-3.5" />
								SQL Stored Procedure
							</span>
						{:else}
							<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-bold bg-muted text-muted-foreground border border-border">
								<FileCode class="size-3.5" />
								Crystal Report / Client Program
							</span>
						{/if}
					</div>
					<h3 class="font-mono text-lg font-black text-foreground pt-1">
						{selectedItem.ProgName}
					</h3>
				</div>
				<AppWindow class="size-8 text-primary/60 shrink-0" />
			</div>

			<!-- Grid Informasi Metadata -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
				<!-- Label Tab / Display Name -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<FileText class="size-3.5 text-primary" />
						Label Tab / Display Name
					</div>
					<div class="font-black text-sm text-foreground">
						{selectedItem.DisplayName || '-'}
					</div>
				</div>

				<!-- Keterangan / Fungsi -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Sparkles class="size-3.5 text-violet-500" />
						Keterangan / Fungsi Fitur
					</div>
					<div class="font-bold text-foreground">
						{selectedItem.Remark || 'Tidak ada keterangan'}
					</div>
				</div>

				<!-- Form UI Terkait -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Server class="size-3.5 text-blue-500" />
						Form UI Terkait (taFormReport)
					</div>
					{#if selectedItem.FormName}
						<div class="font-mono font-black text-xs text-blue-700 dark:text-blue-400">
							{selectedItem.FormName} - {selectedItem.FormDisplayName || ''}
						</div>
					{:else}
						<div class="font-bold text-muted-foreground italic">
							Tidak terhubung form report langsung
						</div>
					{/if}
				</div>

				<!-- Urutan Indeks & ID Baris -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Layers class="size-3.5 text-amber-500" />
						Urutan Tab / Baris (rjn)
					</div>
					<div class="font-mono font-bold text-foreground">
						Indeks: {selectedItem.Indeks !== null ? selectedItem.Indeks : '-'} | rjn: #{selectedItem.rjn}
					</div>
				</div>
			</div>

			<!-- Tampilan Kode SQL Stored Procedure (Jika ada) -->
			{#if selectedItem.isStoredProcedure}
				<div class="space-y-2 pt-2 border-t-2 border-border/40">
					<div class="flex items-center justify-between">
						<span class="text-xs font-black uppercase tracking-wide flex items-center gap-1.5">
							<Code class="size-4 text-emerald-600" />
							Definisi SQL Stored Procedure
						</span>

						{#if spDefinition}
							<button
								type="button"
								onclick={copySqlCode}
								class="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
							>
								{#if copied}
									<Check class="size-3.5 text-emerald-600" />
									Tersalin!
								{:else}
									<Copy class="size-3.5" />
									Salin Kode
								{/if}
							</button>
						{/if}
					</div>

					{#if loadingDefinition}
						<div class="bg-muted/40 border-2 border-border/60 rounded-lg p-6 text-center">
							<RefreshCw class="size-5 mx-auto animate-spin text-primary" />
							<p class="text-xs font-bold text-muted-foreground mt-2">
								Mengambil definisi SQL dari database...
							</p>
						</div>
					{:else if spDefinition}
						<pre class="bg-slate-950 text-slate-100 p-4 rounded-xl border-2 border-border font-mono text-xs overflow-x-auto max-h-72 leading-relaxed whitespace-pre-wrap select-all">{spDefinition}</pre>
					{:else}
						<div class="bg-muted/40 border-2 border-border/60 rounded-lg p-3 text-xs text-muted-foreground font-bold italic">
							Definisi SQL tidak dapat dimuat atau dienkripsi.
						</div>
					{/if}
				</div>
			{/if}

			<!-- Footer Modal Detail -->
			<div class="flex items-center justify-end gap-2 pt-3 border-t-2 border-border/40">
				<Button
					type="button"
					onclick={() => (isDetailModalOpen = false)}
					class="h-9 border-[3px] font-black uppercase text-xs cursor-pointer"
				>
					Tutup
				</Button>
			</div>
		</div>
	{/if}
</Modal>
