<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
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
		TableEmpty,
		LoadingOverlay,
		Modal
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		Lock,
		Unlock,
		Search,
		Plus,
		Download,
		Printer,
		Edit3,
		Trash2,
		RotateCcw,
		Calendar,
		Filter,
		CheckCircle2,
		XCircle,
		SlidersHorizontal,
		Copy,
		Check,
		FileSpreadsheet,
		ShieldCheck,
		ShieldAlert,
		Boxes,
		Landmark,
		Truck,
		Info,
		Layers
	} from '@lucide/svelte';
	import type { LockFormItem } from '$lib/server/lockform';

	let { data, form } = $props();

	let loading = $state(false);
	let exportLoading = $state(false);
	let copiedKey = $state<string | null>(null);

	// Checkbox multi-select state
	let selectedForms = $state<string[]>([]);

	let allSelected = $derived(
		data.items.length > 0 &&
		data.items.every((item: LockFormItem) => selectedForms.includes(item.Form_Name))
	);

	function toggleSelectAll() {
		if (allSelected) {
			selectedForms = [];
		} else {
			selectedForms = data.items.map((item: LockFormItem) => item.Form_Name);
		}
	}

	function toggleSelect(name: string) {
		if (selectedForms.includes(name)) {
			selectedForms = selectedForms.filter((n) => n !== name);
		} else {
			selectedForms = [...selectedForms, name];
		}
	}

	function selectByCategory(tipe: number) {
		const names = data.items
			.filter((item: LockFormItem) => item.Form_Tipe === tipe)
			.map((item: LockFormItem) => item.Form_Name);
		selectedForms = Array.from(new Set([...selectedForms, ...names]));
		toast.info('Pilihan Ditambahkan', `Memilih ${names.length} form kategori ini`);
	}

	function copyText(val: string, label = 'Teks') {
		if (!val) return;
		navigator.clipboard.writeText(val);
		copiedKey = val;
		toast.success('Disalin', `${label} "${val}" telah disalin`);
		setTimeout(() => {
			if (copiedKey === val) copiedKey = null;
		}, 2000);
	}

	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	// Handle response actions form (success / error)
	$effect(() => {
		if (form?.success) {
			if (form.message) toast.success('Berhasil', form.message);
			isFormModalOpen = false;
			isDeleteModalOpen = false;
			isBatchModalOpen = false;
			selectedForms = [];
		} else if (form?.error) {
			toast.error('Gagal', form.error);
		}
	});

	// ==================== STATE MODAL CREATE / EDIT ====================
	let isFormModalOpen = $state(false);
	let isEditMode = $state(false);
	let formSubmitting = $state(false);

	let lockformForm = $state({
		formName: '',
		formAlias: '',
		formTipe: 0,
		lockDate: ''
	});

	function openCreateModal() {
		isEditMode = false;
		lockformForm = {
			formName: '',
			formAlias: '',
			formTipe: 0,
			lockDate: ''
		};
		isFormModalOpen = true;
	}

	function openEditModal(item: LockFormItem) {
		isEditMode = true;
		lockformForm = {
			formName: item.Form_Name,
			formAlias: item.Form_Alias || item.Form_Name,
			formTipe: item.Form_Tipe,
			lockDate: item.LockDate || ''
		};
		isFormModalOpen = true;
	}

	// ==================== STATE MODAL BATCH LOCK ====================
	let isBatchModalOpen = $state(false);
	let batchLockDate = $state(
		untrack(() => data.stats.latestLockDate) || new Date().toISOString().slice(0, 10)
	);
	let batchActionType = $state<'lock' | 'unlock'>('lock');

	function openBatchModal(type: 'lock' | 'unlock') {
		if (selectedForms.length === 0) {
			toast.warning('Peringatan', 'Pilih minimal satu form terlebih dahulu.');
			return;
		}
		batchActionType = type;
		isBatchModalOpen = true;
	}

	// Preset shortcuts for batch date
	function setBatchDatePreset(preset: 'end_prev_month' | 'today' | 'end_prev_year') {
		const now = new Date();
		if (preset === 'end_prev_month') {
			// Hari terakhir bulan sebelumnya
			const d = new Date(now.getFullYear(), now.getMonth(), 0);
			batchLockDate = d.toISOString().slice(0, 10);
		} else if (preset === 'today') {
			batchLockDate = now.toISOString().slice(0, 10);
		} else if (preset === 'end_prev_year') {
			// 31 Desember tahun lalu
			const d = new Date(now.getFullYear() - 1, 11, 31);
			batchLockDate = d.toISOString().slice(0, 10);
		}
	}

	// ==================== STATE MODAL DELETE ====================
	let isDeleteModalOpen = $state(false);
	let itemToDelete = $state<LockFormItem | null>(null);

	function openDeleteModal(item: LockFormItem) {
		itemToDelete = item;
		isDeleteModalOpen = true;
	}
</script>

<LoadingOverlay show={loading} message="Memproses Pengaturan Kunci Form..." submessage="Mohon tunggu sejenak" />

<div class="space-y-6 text-foreground">
	<!-- Page Header -->
	<PageHeader
		title="Pengaturan Kunci Form (taLockform)"
		description="Kelola tanggal batas penguncian (Lock Date) per transaksi: transaksi dengan tanggal sebelum atau sama dengan batas kunci tidak dapat diubah atau dihapus."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					variant="primary"
					onclick={openCreateModal}
					class="h-10 border-[3px] border-border font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
					title="Daftarkan form baru ke taLockform"
				>
					<Plus class="size-4 mr-1.5" />
					Tambah Form
				</Button>

				<!-- Export Excel Button -->
				<form
					method="post"
					action="/api/setting-lockform/export"
					onsubmit={() => {
						exportLoading = true;
						toast.info('Export Excel', 'Menyiapkan berkas Excel status kunci form...');
						setTimeout(() => (exportLoading = false), 3500);
					}}
					class="inline-flex"
				>
					<Button
						type="submit"
						variant="outline"
						disabled={exportLoading}
						class="h-10 border-[3px] border-border bg-card text-foreground hover:bg-muted font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export status penguncian form ke Excel"
					>
						<Download class="size-4 mr-1.5" />
						Export Excel
					</Button>
				</form>

				<Button
					type="button"
					variant="outline"
					onclick={() => window.print()}
					class="h-10 border-[3px] border-border bg-card text-foreground hover:bg-muted font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer hidden sm:inline-flex"
					title="Cetak daftar penguncian form"
				>
					<Printer class="size-4 mr-1.5" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Summary Metrics Cards (5 Cards High Visibility Bar) -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
		<!-- Total Form -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Total Form Terdaftar</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-primary/20 text-primary">
					<Layers class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalForms}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Seluruh Entitas [taLockform]
				</p>
			</div>
		</div>

		<!-- Form Operasional & Logistik (Tipe 0) -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Operasional & Gudang</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-blue-100 text-blue-700">
					<Truck class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalOperasional}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Tipe 0 (PO, SO, SJ, Penerimaan)
				</p>
			</div>
		</div>

		<!-- Form Finance & Akuntansi (Tipe 1) -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Finance & Accounting</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-purple-100 text-purple-700">
					<Landmark class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalFinance}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Tipe 1 (Kas, Bank, Jurnal, Bayar)
				</p>
			</div>
		</div>

		<!-- Form Produksi & PPIC (Tipe 2) -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Produksi & SPK</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-amber-100 text-amber-700">
					<Boxes class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalProduksi}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Tipe 2 (SPK, Produksi, Mutasi)
				</p>
			</div>
		</div>

		<!-- Form Terkunci Aktif -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between col-span-2 sm:col-span-1">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Status Kunci</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-emerald-100 text-emerald-700">
					<ShieldCheck class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalLocked} <span class="text-xs font-normal text-muted-foreground">/ {data.stats.totalForms}</span>
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.stats.totalUnlocked} Form Terbuka (Tanpa Cutoff)
				</p>
			</div>
		</div>
	</div>

	<!-- Bulk Batch Action Bar (Highlighted when forms are selected) -->
	{#if selectedForms.length > 0}
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
			<div class="flex items-center gap-2.5">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-border bg-primary text-primary-foreground font-mono font-black text-xs">
					<CheckCircle2 class="size-3.5" />
					<span>{selectedForms.length} Form Dipilih</span>
				</span>
				<button
					type="button"
					onclick={() => (selectedForms = [])}
					class="text-xs font-bold text-muted-foreground hover:text-foreground underline cursor-pointer"
				>
					Batalkan Pilihan
				</button>
			</div>

			<div class="flex items-center gap-2">
				<Button
					type="button"
					variant="primary"
					size="sm"
					onclick={() => openBatchModal('lock')}
					class="border-2 border-border font-black text-xs uppercase brutal-shadow-xs cursor-pointer"
				>
					<Lock class="size-3.5 mr-1" />
					Set Tanggal Kunci Massal
				</Button>

				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={() => openBatchModal('unlock')}
					class="border-2 border-border bg-card text-foreground hover:bg-muted font-black text-xs uppercase brutal-shadow-xs cursor-pointer"
				>
					<Unlock class="size-3.5 mr-1" />
					Buka Kunci (Unlock)
				</Button>
			</div>
		</div>
	{/if}

	<!-- Filter & Search Bar Form -->
	<form
		method="get"
		action="/dashboard/setting-lockform"
		class="bg-card text-foreground rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
			<!-- Input Pencarian -->
			<div class="space-y-1.5 lg:col-span-5">
				<Label for="q" class="text-xs font-black uppercase tracking-wider text-foreground">Pencarian Form</Label>
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						id="q"
						name="q"
						value={data.q}
						placeholder="Cari Form_Name (prSPK, GLKas...) atau Nama Alias..."
						class="bg-card text-foreground placeholder:text-muted-foreground border-border h-10 w-full rounded-lg border-[3px] pl-9 pr-8 text-xs sm:text-sm font-bold brutal-shadow-sm focus:outline-none"
					/>
					{#if data.q}
						<a
							href="/dashboard/setting-lockform?{new URLSearchParams({ tipe: data.tipe, status: data.status }).toString()}"
							class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							title="Bersihkan pencarian"
						>
							<XCircle class="size-4" />
						</a>
					{/if}
				</div>
			</div>

			<!-- Filter Kategori / Tipe -->
			<div class="space-y-1.5 lg:col-span-3">
				<Label for="tipe" class="text-xs font-black uppercase tracking-wider text-foreground">Kategori Form</Label>
				<select
					id="tipe"
					name="tipe"
					class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 text-xs sm:text-sm font-bold brutal-shadow-sm focus:outline-none font-mono"
				>
					<option value="all" selected={data.tipe === 'all' || !data.tipe}>Semua Kategori</option>
					<option value="0" selected={data.tipe === '0'}>Tipe 0: Operasional & Logistik</option>
					<option value="1" selected={data.tipe === '1'}>Tipe 1: Finance & Akuntansi</option>
					<option value="2" selected={data.tipe === '2'}>Tipe 2: Produksi & PPIC</option>
				</select>
			</div>

			<!-- Filter Status Kunci -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="status" class="text-xs font-black uppercase tracking-wider text-foreground">Status Kunci</Label>
				<select
					id="status"
					name="status"
					class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 text-xs sm:text-sm font-bold brutal-shadow-sm focus:outline-none font-mono"
				>
					<option value="all" selected={data.status === 'all'}>Semua Status</option>
					<option value="locked" selected={data.status === 'locked'}>Terkunci Saja</option>
					<option value="unlocked" selected={data.status === 'unlocked'}>Terbuka (Tanpa Batas)</option>
				</select>
			</div>

			<!-- Tombol Terapkan & Reset -->
			<div class="flex items-center gap-2 lg:col-span-2">
				<Button
					type="submit"
					variant="primary"
					class="h-10 flex-1 border-[3px] border-border font-black uppercase text-xs tracking-wide brutal-shadow-sm cursor-pointer"
				>
					<Filter class="size-3.5 mr-1" />
					Filter
				</Button>
				{#if data.q || data.tipe !== 'all' || data.status !== 'all'}
					<a
						href="/dashboard/setting-lockform"
						class="h-10 px-3 inline-flex items-center justify-center rounded-lg border-[3px] border-border bg-card text-foreground hover:bg-muted font-black text-xs brutal-shadow-sm"
						title="Reset Filter"
					>
						<RotateCcw class="size-4 text-foreground" />
					</a>
				{/if}
			</div>
		</div>

		<!-- Quick Select Category Buttons -->
		<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t-2 border-border/40 text-xs">
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="font-bold text-muted-foreground mr-1">Pilih Cepat:</span>
				<button
					type="button"
					onclick={() => selectByCategory(0)}
					class="px-2.5 py-1 rounded-md border border-border bg-blue-50 text-blue-900 font-bold hover:bg-blue-100 transition-colors cursor-pointer"
				>
					+ Semua Operasional
				</button>
				<button
					type="button"
					onclick={() => selectByCategory(1)}
					class="px-2.5 py-1 rounded-md border border-border bg-purple-50 text-purple-900 font-bold hover:bg-purple-100 transition-colors cursor-pointer"
				>
					+ Semua Finance
				</button>
				<button
					type="button"
					onclick={() => selectByCategory(2)}
					class="px-2.5 py-1 rounded-md border border-border bg-amber-50 text-amber-900 font-bold hover:bg-amber-100 transition-colors cursor-pointer"
				>
					+ Semua Produksi
				</button>
			</div>

			<div class="text-xs font-bold text-foreground">
				Ditemukan <span class="font-black font-mono text-primary text-sm">{data.items.length}</span> form
			</div>
		</div>
	</form>

	<!-- Tabel Data taLockform Neo-Brutalist -->
	<div class="bg-card text-foreground rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
		<div class="overflow-x-auto">
			<Table wrapperClass="border-0 shadow-none rounded-none">
				<TableHeader>
					<TableRow class="bg-muted/70 border-b-[3px] border-border">
						<TableHead class="w-10 text-center font-black text-foreground">
							<input
								type="checkbox"
								checked={allSelected}
								onchange={toggleSelectAll}
								class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
								title="Pilih Semua Form"
							/>
						</TableHead>
						<TableHead class="w-12 text-center font-black text-foreground">No</TableHead>
						<TableHead class="w-48 font-black text-foreground">Nama Form (Internal)</TableHead>
						<TableHead class="font-black text-foreground min-w-[220px]">Alias / Nama Tampilan</TableHead>
						<TableHead class="w-44 font-black text-foreground">Kategori (Tipe)</TableHead>
						<TableHead class="w-32 text-center font-black text-foreground">Status</TableHead>
						<TableHead class="w-64 font-black text-foreground">Tanggal Kunci (LockDate)</TableHead>
						<TableHead class="w-24 text-right font-black text-foreground pr-4">Aksi</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.items.length === 0}
						<TableEmpty colspan={8} message="Tidak ada data form yang sesuai dengan filter pencarian." />
					{:else}
						{#each data.items as item, idx}
							{@const isChecked = selectedForms.includes(item.Form_Name)}
							<TableRow class="hover:bg-muted/30 transition-colors border-b-2 border-border/30 text-foreground {isChecked ? 'bg-primary/5' : ''}">
								<!-- Checkbox -->
								<TableCell class="text-center">
									<input
										type="checkbox"
										checked={isChecked}
										onchange={() => toggleSelect(item.Form_Name)}
										class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
									/>
								</TableCell>

								<!-- No -->
								<TableCell class="text-center font-mono text-xs text-foreground font-black">
									{idx + 1}
								</TableCell>

								<!-- Form_Name (Kode Internal) -->
								<TableCell>
									<div class="flex items-center gap-1.5">
										<span class="font-mono font-black text-sm text-foreground">
											{item.Form_Name}
										</span>
										<button
											type="button"
											onclick={() => copyText(item.Form_Name, 'Form Name')}
											class="text-foreground/70 hover:text-foreground p-0.5 rounded cursor-pointer"
											title="Salin nama form"
										>
											{#if copiedKey === item.Form_Name}
												<Check class="size-3 text-emerald-600" />
											{:else}
												<Copy class="size-3" />
											{/if}
										</button>
									</div>
								</TableCell>

								<!-- Form_Alias (Nama Tampilan) -->
								<TableCell>
									<div class="font-black text-sm text-foreground">
										{item.Form_Alias || item.Form_Name}
									</div>
								</TableCell>

								<!-- Kategori / Tipe -->
								<TableCell>
									{#if item.Form_Tipe === 0}
										<Badge variant="outline" class="font-mono text-[10px] bg-blue-100 text-blue-900 border-border">
											Operasional (0)
										</Badge>
									{:else if item.Form_Tipe === 1}
										<Badge variant="outline" class="font-mono text-[10px] bg-purple-100 text-purple-900 border-border">
											Finance & GL (1)
										</Badge>
									{:else if item.Form_Tipe === 2}
										<Badge variant="outline" class="font-mono text-[10px] bg-amber-100 text-amber-900 border-border">
											Produksi & PPIC (2)
										</Badge>
									{:else}
										<Badge variant="outline" class="font-mono text-[10px] bg-muted text-foreground border-border">
											Tipe {item.Form_Tipe}
										</Badge>
									{/if}
								</TableCell>

								<!-- Status Penguncian -->
								<TableCell class="text-center">
									{#if item.isLocked}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono border-2 border-emerald-500/40 bg-emerald-100 text-emerald-900">
											<Lock class="size-3" />
											<span>TERKUNCI</span>
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono border-2 border-border bg-muted/60 text-muted-foreground">
											<Unlock class="size-3" />
											<span>TERBUKA</span>
										</span>
									{/if}
								</TableCell>

								<!-- Tanggal Kunci (Inline Updater Form) -->
								<TableCell>
									<form
										method="post"
										action="?/updateDate"
										use:enhance={() => {
											loading = true;
											return async ({ update }) => {
												loading = false;
												await update();
											};
										}}
										class="flex items-center gap-1.5"
									>
										<input type="hidden" name="formName" value={item.Form_Name} />
										<input
											type="date"
											name="lockDate"
											value={item.LockDate || ''}
											class="bg-card text-foreground border-border h-8 rounded border-2 px-2 font-mono text-xs font-bold focus:outline-none"
										/>
										<Button
											type="submit"
											variant="outline"
											size="sm"
											class="h-8 px-2.5 border-2 border-border bg-card text-foreground hover:bg-muted font-black text-xs cursor-pointer brutal-shadow-xs"
											title="Simpan tanggal batas kunci"
										>
											Set
										</Button>

										{#if item.isLocked}
											<!-- Tombol Buka Kunci Cepat (Clear Date) -->
											<button
												type="button"
												onclick={() => {
													const f = document.createElement('form');
													f.method = 'post';
													f.action = '?/updateDate';
													const inputName = document.createElement('input');
													inputName.type = 'hidden';
													inputName.name = 'formName';
													inputName.value = item.Form_Name;
													const inputDate = document.createElement('input');
													inputDate.type = 'hidden';
													inputDate.name = 'lockDate';
													inputDate.value = '';
													f.appendChild(inputName);
													f.appendChild(inputDate);
													document.body.appendChild(f);
													f.submit();
												}}
												class="p-1 rounded text-muted-foreground hover:text-amber-700 cursor-pointer"
												title="Buka kunci (kosongkan LockDate)"
											>
												<Unlock class="size-3.5" />
											</button>
										{/if}
									</form>
								</TableCell>

								<!-- Aksi (Edit Metadata & Hapus) -->
								<TableCell class="text-right pr-4">
									<div class="flex items-center justify-end gap-1">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => openEditModal(item)}
											class="h-8 w-8 p-0 cursor-pointer text-primary bg-card border-2 border-border hover:bg-primary/10 brutal-shadow-xs"
											title="Ubah info form"
										>
											<Edit3 class="size-3.5" />
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => openDeleteModal(item)}
											class="h-8 w-8 p-0 cursor-pointer text-error bg-card border-2 border-border hover:bg-error/10 brutal-shadow-xs"
											title="Hapus form dari taLockform"
										>
											<Trash2 class="size-3.5" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						{/each}
					{/if}
				</TableBody>
			</Table>
		</div>

		<!-- Footer Summary -->
		<div class="border-t-[3px] border-border p-3 flex flex-wrap items-center justify-between gap-3 bg-muted/20 text-xs text-foreground font-bold">
			<div>
				Menampilkan <span class="font-black font-mono text-primary">{data.items.length}</span> form di tabel taLockform
			</div>
			<div class="font-mono text-muted-foreground">
				TransID Cutoff &bull; ERP Form Lock Mechanism
			</div>
		</div>
	</div>
</div>

<!-- ==================== MODAL TAMBAH / UBAH FORM ==================== -->
<Modal
	bind:open={isFormModalOpen}
	size="md"
	title={isEditMode ? `Ubah Form: ${lockformForm.formName}` : 'Daftarkan Form Baru ke taLockform'}
	subtitle={isEditMode ? 'Perbarui nama tampilan dan batas tanggal kunci' : 'Tambahkan kontrol penguncian form baru ke sistem'}
	icon={isEditMode ? Edit3 : Plus}
>
	<form
		method="post"
		action="?/save"
		use:enhance={() => {
			formSubmitting = true;
			return async ({ update }) => {
				formSubmitting = false;
				await update();
			};
		}}
		class="space-y-4 py-1 text-foreground"
	>
		<input type="hidden" name="isEdit" value={String(isEditMode)} />

		<!-- Form_Name (Primary Key) -->
		<div class="space-y-1.5">
			<Label for="formName" class="text-xs font-black uppercase text-foreground">Nama Form Internal (Form_Name) *</Label>
			<input
				type="text"
				id="formName"
				name="formName"
				bind:value={lockformForm.formName}
				readonly={isEditMode}
				required
				maxlength="50"
				placeholder="Contoh: prSPK, GLKasMasuk, optrPO"
				class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-black brutal-shadow-sm {isEditMode ? 'bg-muted/50 cursor-not-allowed opacity-80' : ''}"
			/>
			<span class="text-[10px] text-muted-foreground font-semibold">
				Harus sama dengan nama form internal sistem atau identifier modul transaksi.
			</span>
		</div>

		<!-- Form_Alias -->
		<div class="space-y-1.5">
			<Label for="formAlias" class="text-xs font-black uppercase text-foreground">Alias / Nama Tampilan Form</Label>
			<input
				type="text"
				id="formAlias"
				name="formAlias"
				bind:value={lockformForm.formAlias}
				maxlength="50"
				placeholder="Contoh: Surat Perintah Kerja, Kas Masuk"
				class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-black brutal-shadow-sm"
			/>
		</div>

		<!-- Form_Tipe -->
		<div class="space-y-1.5">
			<Label for="formTipe" class="text-xs font-black uppercase text-foreground">Kategori Form (Form_Tipe)</Label>
			<select
				id="formTipe"
				name="formTipe"
				bind:value={lockformForm.formTipe}
				class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-black brutal-shadow-sm font-mono"
			>
				<option value={0}>0 — Operasional, Gudang & Logistik</option>
				<option value={1}>1 — Finance, Kas/Bank & Akuntansi</option>
				<option value={2}>2 — Produksi, SPK & Mutasi</option>
			</select>
		</div>

		<!-- LockDate -->
		<div class="space-y-1.5">
			<Label for="lockDate" class="text-xs font-black uppercase text-foreground">Tanggal Batas Kunci (LockDate)</Label>
			<input
				type="date"
				id="lockDate"
				name="lockDate"
				bind:value={lockformForm.lockDate}
				class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-black brutal-shadow-sm"
			/>
			<span class="text-[10px] text-muted-foreground font-semibold">
				Kosongkan jika form tidak ingin dikunci (terbuka).
			</span>
		</div>

		<!-- Action Footer -->
		<div class="flex items-center justify-end gap-2 pt-3 border-t-2 border-border/40 mt-4">
			<Button
				type="button"
				variant="outline"
				onclick={() => (isFormModalOpen = false)}
				class="border-2 border-border bg-card text-foreground font-black uppercase text-xs px-4"
			>
				Batal
			</Button>
			<Button
				type="submit"
				variant="primary"
				disabled={formSubmitting || !lockformForm.formName}
				class="border-[3px] border-border font-black uppercase text-xs px-5 brutal-shadow-sm"
			>
				{formSubmitting ? 'Menyimpan...' : isEditMode ? 'Perbarui Form' : 'Simpan Form'}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL BATCH UPDATE LOCK DATE ==================== -->
<Modal
	bind:open={isBatchModalOpen}
	size="md"
	title={batchActionType === 'lock' ? 'Kunci Form Massal (Batch Lock)' : 'Buka Kunci Massal (Batch Unlock)'}
	subtitle={`Terapkan perubahan tanggal penguncian ke ${selectedForms.length} form terpilih`}
	icon={batchActionType === 'lock' ? Lock : Unlock}
>
	<form
		method="post"
		action="?/batchUpdate"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				await update();
			};
		}}
		class="space-y-4 py-1 text-foreground"
	>
		<input type="hidden" name="formNames" value={JSON.stringify(selectedForms)} />
		<input type="hidden" name="actionType" value={batchActionType} />

		{#if batchActionType === 'lock'}
			<div class="space-y-2">
				<Label for="batchLockDate" class="text-xs font-black uppercase text-foreground">
					Tanggal Batas Kunci Baru *
				</Label>
				<input
					type="date"
					id="batchLockDate"
					name="lockDate"
					bind:value={batchLockDate}
					required
					class="bg-card text-foreground border-border h-11 w-full rounded-lg border-[3px] px-3 font-mono text-base font-black brutal-shadow-sm"
				/>

				<!-- Preset buttons -->
				<div class="flex items-center gap-1.5 pt-1">
					<span class="text-[10px] font-bold text-muted-foreground">Pilihan Cepat:</span>
					<button
						type="button"
						onclick={() => setBatchDatePreset('end_prev_month')}
						class="px-2 py-0.5 rounded border border-border bg-muted text-[10px] font-mono font-bold hover:bg-muted/80 cursor-pointer"
					>
						Akhir Bulan Lalu
					</button>
					<button
						type="button"
						onclick={() => setBatchDatePreset('today')}
						class="px-2 py-0.5 rounded border border-border bg-muted text-[10px] font-mono font-bold hover:bg-muted/80 cursor-pointer"
					>
						Hari Ini
					</button>
					<button
						type="button"
						onclick={() => setBatchDatePreset('end_prev_year')}
						class="px-2 py-0.5 rounded border border-border bg-muted text-[10px] font-mono font-bold hover:bg-muted/80 cursor-pointer"
					>
						Akhir Tahun Lalu
					</button>
				</div>
			</div>
		{:else}
			<div class="p-3.5 rounded-lg border-2 border-amber-500/40 bg-amber-50 text-amber-950 space-y-1.5 text-xs font-medium">
				<div class="font-black flex items-center gap-1.5">
					<Info class="size-4 text-amber-700" />
					<span>Konfirmasi Pembukaan Kunci</span>
				</div>
				<p>
					Tanggal kunci (LockDate) pada <strong>{selectedForms.length} form terpilih</strong> akan diatur menjadi <strong>NULL</strong>.
					Transaksi pada form-form ini akan dapat diubah tanpa pembatasan tanggal tutup buku.
				</p>
			</div>
		{/if}

		<!-- Daftar Form yang Terkena Dampak -->
		<div class="space-y-1.5">
			<span class="text-[10px] font-black uppercase text-muted-foreground block">
				Daftar Form Terpilih ({selectedForms.length}):
			</span>
			<div class="max-h-36 overflow-y-auto rounded-lg border-2 border-border p-2 bg-muted/20 flex flex-wrap gap-1 font-mono text-xs">
				{#each selectedForms as name}
					<span class="px-2 py-0.5 rounded bg-card border border-border font-bold text-foreground">
						{name}
					</span>
				{/each}
			</div>
		</div>

		<!-- Action Footer -->
		<div class="flex items-center justify-end gap-2 pt-3 border-t-2 border-border/40">
			<Button
				type="button"
				variant="outline"
				onclick={() => (isBatchModalOpen = false)}
				class="border-2 border-border bg-card text-foreground font-black uppercase text-xs px-4 cursor-pointer"
			>
				Batal
			</Button>
			<Button
				type="submit"
				variant={batchActionType === 'lock' ? 'primary' : 'warning'}
				class="border-[3px] border-border font-black uppercase text-xs px-5 brutal-shadow-sm cursor-pointer"
			>
				{batchActionType === 'lock' ? 'Terapkan Tanggal Kunci' : 'Buka Kunci Form'}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL KONFIRMASI HAPUS FORM ==================== -->
<Modal
	bind:open={isDeleteModalOpen}
	size="sm"
	title="Konfirmasi Hapus Form"
	subtitle="Tindakan ini akan menghapus entitas form dari taLockform"
	icon={Trash2}
>
	{#if itemToDelete}
		<form
			method="post"
			action="?/delete"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}
			class="space-y-4 py-1 text-foreground"
		>
			<input type="hidden" name="formName" value={itemToDelete.Form_Name} />

			<div class="p-4 rounded-xl border-2 border-destructive/40 bg-destructive/10 space-y-2">
				<p class="text-sm font-black text-destructive">
					Hapus form <span class="font-mono underline">{itemToDelete.Form_Name}</span> ({itemToDelete.Form_Alias})?
				</p>
				<p class="text-xs text-foreground font-semibold">
					Entitas kontrol penguncian untuk form ini akan dihapus dari tabel <span class="font-mono font-bold">[taLockform]</span>.
				</p>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2 border-t-2 border-border/30">
				<Button
					type="button"
					variant="outline"
					onclick={() => (isDeleteModalOpen = false)}
					class="border-2 border-border bg-card text-foreground font-black uppercase text-xs px-4 cursor-pointer"
				>
					Batal
				</Button>
				<Button
					type="submit"
					variant="error"
					class="border-[3px] border-border font-black uppercase text-xs px-5 cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
				>
					Ya, Hapus Form
				</Button>
			</div>
		</form>
	{/if}
</Modal>
