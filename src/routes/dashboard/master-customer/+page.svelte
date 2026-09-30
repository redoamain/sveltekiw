<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Badge,
		Button,
		Input,
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
		Users,
		Search,
		Plus,
		Download,
		Printer,
		Edit3,
		Trash2,
		Eye,
		RotateCcw,
		Truck,
		Globe,
		Coins,
		DollarSign,
		CreditCard,
		MapPin,
		Phone,
		Mail,
		User,
		FileText,
		Sparkles,
		RefreshCw,
		CheckCircle2,
		XCircle,
		ShieldAlert,
		Boxes,
		Clock,
		Layers
	} from '@lucide/svelte';

	let { data, form } = $props();

	// Tab Aktif: 'customer' | 'consigne'
	let activeTab = $state<'customer' | 'consigne'>('customer');

	let loading = $state(false);
	let exportLoading = $state(false);

	let lastId = $state('');
	let nextId = $state('');

	// Auto-reset loading saat data halaman diperbarui
	$effect(() => {
		if (data) {
			loading = false;
			lastId = data.lastId || '';
			nextId = data.nextId || '';
		}
	});

	// Handle response actions form (save / delete baik customer maupun consigne)
	$effect(() => {
		if (form?.success) {
			if (form.message) toast.success('Berhasil', form.message);
			isCustomerModalOpen = false;
			isDeleteModalOpen = false;
			isConsigneModalOpen = false;
			isDeleteConsigneModalOpen = false;
		} else if (form?.error) {
			toast.error('Gagal', form.error);
		}
	});

	// ==================== STATE MODAL CREATE & EDIT CUSTOMER ====================
	let isCustomerModalOpen = $state(false);
	let isEditMode = $state(false);
	let customerFormSubmitting = $state(false);
	let isAutoCompanyId = $state(true);
	let fetchingNextId = $state(false);

	async function refreshNextId() {
		fetchingNextId = true;
		try {
			const res = await fetch('/api/master-customer/next-id');
			if (res.ok) {
				const json = await res.json();
				if (json.nextId) {
					nextId = json.nextId;
					lastId = json.lastId || lastId;
					if (isAutoCompanyId && !isEditMode) {
						customerForm.CompanyID = json.nextId;
					}
				}
			}
		} catch (err) {
			console.error('Gagal mengambil nextId customer:', err);
		} finally {
			fetchingNextId = false;
		}
	}

	let customerForm = $state({
		CompanyID: '',
		CompanyName1: '',
		CompanyName2: '',
		Address1: '',
		Address2: '',
		City: '',
		Provinsi: '',
		Negara: 'INDONESIA',
		PostalCode: '',
		Phone1: '',
		Phone2: '',
		Fax1: '',
		Email: '',
		Contact1: '',
		Job1: '',
		TaxID: '',
		Curr: 'IDR',
		Status: 'Lokal',
		Export: false,
		Consigne: false,
		Delisted: false,
		Plafon: '' as string | number,
		Due: '' as string | number,
		NoteMarketing: '',
		NoteFinance: ''
	});

	function openCreateCustomerModal() {
		isEditMode = false;
		isAutoCompanyId = true;
		customerForm = {
			CompanyID: nextId || data.nextId || '',
			CompanyName1: '',
			CompanyName2: '',
			Address1: '',
			Address2: '',
			City: '',
			Provinsi: '',
			Negara: 'INDONESIA',
			PostalCode: '',
			Phone1: '',
			Phone2: '',
			Fax1: '',
			Email: '',
			Contact1: '',
			Job1: '',
			TaxID: '',
			Curr: 'IDR',
			Status: 'Lokal',
			Export: false,
			Consigne: false,
			Delisted: false,
			Plafon: '',
			Due: '',
			NoteMarketing: '',
			NoteFinance: ''
		};
		isCustomerModalOpen = true;
		refreshNextId();
	}

	function openEditCustomerModal(item: any) {
		isEditMode = true;
		customerForm = {
			CompanyID: String(item.CompanyID || ''),
			CompanyName1: String(item.CompanyName1 || ''),
			CompanyName2: String(item.CompanyName2 || ''),
			Address1: String(item.Address1 || ''),
			Address2: String(item.Address2 || ''),
			City: String(item.City || ''),
			Provinsi: String(item.Provinsi || ''),
			Negara: String(item.Negara || 'INDONESIA'),
			PostalCode: String(item.PostalCode || ''),
			Phone1: String(item.Phone1 || ''),
			Phone2: String(item.Phone2 || ''),
			Fax1: String(item.Fax1 || ''),
			Email: String(item.Email || ''),
			Contact1: String(item.Contact1 || ''),
			Job1: String(item.Job1 || ''),
			TaxID: String(item.TaxID || ''),
			Curr: String(item.Curr || 'IDR'),
			Status: String(item.Status || 'Lokal'),
			Export: Boolean(item.Export),
			Consigne: Boolean(item.Consigne),
			Delisted: Boolean(item.Delisted),
			Plafon: item.Plafon != null ? item.Plafon : '',
			Due: item.Due != null ? item.Due : '',
			NoteMarketing: String(item.NoteMarketing || ''),
			NoteFinance: String(item.NoteFinance || '')
		};
		isCustomerModalOpen = true;
	}

	// ==================== STATE MODAL DETAIL CUSTOMER ====================
	let isDetailModalOpen = $state(false);
	let selectedDetail = $state<any>(null);

	function openDetailModal(item: any) {
		selectedDetail = item;
		isDetailModalOpen = true;
	}

	// ==================== STATE MODAL DELETE CUSTOMER ====================
	let isDeleteModalOpen = $state(false);
	let customerToDelete = $state<any>(null);
	let deleteSubmitting = $state(false);

	function openDeleteCustomerModal(item: any) {
		customerToDelete = item;
		isDeleteModalOpen = true;
	}

	// ==================== STATE MODAL CREATE & EDIT CONSIGNE (taConsigne) ====================
	let isConsigneModalOpen = $state(false);
	let isEditConsigneMode = $state(false);
	let consigneFormSubmitting = $state(false);

	let consigneForm = $state({
		oldConsigne: '',
		Consigne: '',
		ConsigneID: '',
		TargetHari: 14
	});

	function openCreateConsigneModal() {
		isEditConsigneMode = false;
		consigneForm = {
			oldConsigne: '',
			Consigne: '',
			ConsigneID: data.nextConsigneId || '005',
			TargetHari: 14
		};
		isConsigneModalOpen = true;
	}

	function openEditConsigneModal(item: any) {
		isEditConsigneMode = true;
		consigneForm = {
			oldConsigne: item.Consigne,
			Consigne: item.Consigne,
			ConsigneID: item.ConsigneID || '',
			TargetHari: item.TargetHari != null ? item.TargetHari : 14
		};
		isConsigneModalOpen = true;
	}

	// ==================== STATE MODAL DELETE CONSIGNE ====================
	let isDeleteConsigneModalOpen = $state(false);
	let consigneToDelete = $state<any>(null);
	let deleteConsigneSubmitting = $state(false);

	function openDeleteConsigneModal(item: any) {
		consigneToDelete = item;
		isDeleteConsigneModalOpen = true;
	}

	function formatDate(val?: string | null): string {
		if (!val) return '-';
		return val.replace('T', ' ').slice(0, 19);
	}

	function formatCurrency(val?: number | null, curr = 'IDR'): string {
		if (val == null || isNaN(val)) return '-';
		return `${curr} ${val.toLocaleString('id-ID')}`;
	}
</script>

<LoadingOverlay show={loading} message="Memuat Master Customer..." submessage="Mohon tunggu sejenak" />

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Master Data Customer & Consignee"
		description="Kelola direktori pelanggan / pembeli (taCustomer) dan data rekanan konsinyasi / pengapalan (taConsigne)."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				{#if activeTab === 'customer'}
					<Button
						type="button"
						onclick={openCreateCustomerModal}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
						title="Tambah rekanan customer baru"
					>
						<Plus class="size-4 mr-1.5" />
						Tambah Customer
					</Button>

					<!-- Form Export Excel -->
					<form
						method="post"
						action="/api/master-customer/export"
						onsubmit={() => {
							exportLoading = true;
							toast.info('Export Excel', 'Menyiapkan berkas Excel master customer...');
							setTimeout(() => (exportLoading = false), 3500);
						}}
						class="inline-flex"
					>
						<input type="hidden" name="q" value={data.q} />
						<input type="hidden" name="status" value={data.status} />
						<input type="hidden" name="curr" value={data.curr} />

						<Button
							type="submit"
							variant="secondary"
							disabled={exportLoading}
							class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
							title="Export Excel Master Data Customer"
						>
							<Download class="size-4 mr-1.5" />
							Export Excel
						</Button>
					</form>
				{:else}
					<Button
						type="button"
						onclick={openCreateConsigneModal}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
						title="Tambah rekanan consigne baru ke taConsigne"
					>
						<Plus class="size-4 mr-1.5" />
						Tambah Consignee
					</Button>
				{/if}

				<Button
					type="button"
					variant="secondary"
					onclick={() => window.print()}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer hidden sm:inline-flex"
					title="Cetak tampilan"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Tab Switcher (Customer vs Consignee) -->
	<div class="flex items-center gap-2 border-b-[3px] border-border pb-2 overflow-x-auto">
		<button
			type="button"
			onclick={() => (activeTab = 'customer')}
			class="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all cursor-pointer border-[3px] {activeTab === 'customer' ? 'bg-primary text-primary-foreground border-border brutal-shadow-sm' : 'bg-card text-muted-foreground border-transparent hover:border-border/60 hover:text-foreground'}"
		>
			<Users class="size-4" />
			<span>Master Pelanggan (taCustomer)</span>
			<span class="ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono {activeTab === 'customer' ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'}">
				{data.stats.total}
			</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'consigne')}
			class="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all cursor-pointer border-[3px] {activeTab === 'consigne' ? 'bg-primary text-primary-foreground border-border brutal-shadow-sm' : 'bg-card text-muted-foreground border-transparent hover:border-border/60 hover:text-foreground'}"
		>
			<Boxes class="size-4" />
			<span>Master Consignee (taConsigne)</span>
			<span class="ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono {activeTab === 'consigne' ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'}">
				{data.consigneList.length}
			</span>
		</button>
	</div>

	{#if activeTab === 'customer'}
		<!-- ==================== TAB 1: MASTER CUSTOMER ==================== -->

		<!-- Summary Metrics Cards -->
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Total Customer -->
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider">Total Customer</span>
					<Users class="size-4 text-primary" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-2xl font-black text-foreground">
						{data.stats.total.toLocaleString('id-ID')}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
						Pelanggan Terdaftar di ERP
					</p>
				</div>
			</div>

			<!-- Customer Lokal -->
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Pasar Domestik</span>
					<Truck class="size-4 text-emerald-600" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
						{data.stats.totalLokal.toLocaleString('id-ID')}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
						{data.stats.total > 0 ? Math.round((data.stats.totalLokal / data.stats.total) * 100) : 0}% Pelanggan Lokal
					</p>
				</div>
			</div>

			<!-- Customer Ekspor -->
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-blue-500/5">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">Pasar Ekspor</span>
					<Globe class="size-4 text-blue-600" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-2xl font-black text-blue-700 dark:text-blue-400">
						{data.stats.totalExport.toLocaleString('id-ID')}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
						{data.stats.total > 0 ? Math.round((data.stats.totalExport / data.stats.total) * 100) : 0}% Ekspor Luar Negeri
					</p>
				</div>
			</div>

			<!-- Consignee Customer & Status -->
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-purple-500/5">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">Customer Consignee</span>
					<Boxes class="size-4 text-purple-600" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-2xl font-black text-purple-700 dark:text-purple-400">
						{data.stats.totalConsigne.toLocaleString('id-ID')}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
						Ditandai Consignee • {data.stats.totalActive} Aktif
					</p>
				</div>
			</div>
		</div>

		<!-- Filter & Search Form -->
		<form
			method="get"
			action="/dashboard/master-customer"
			class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3"
		>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
				<!-- Input Pencarian -->
				<div class="space-y-1.5 lg:col-span-5">
					<Label for="q">Pencarian Customer</Label>
					<div class="relative">
						<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<input
							type="text"
							id="q"
							name="q"
							value={data.q}
							placeholder="Cari kode (P00...), nama, kontak, kota, NPWP..."
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] pl-9 pr-3 text-sm font-bold brutal-shadow-sm"
						/>
					</div>
				</div>

				<!-- Filter Status & Kategori -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="status">Kategori / Status</Label>
					<select
						id="status"
						name="status"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					>
						<option value="" selected={!data.status}>Semua Status / Pasar</option>
						<option value="LOKAL" selected={data.status === 'LOKAL'}>Pasar Domestik (Lokal)</option>
						<option value="EKSPOR" selected={data.status === 'EKSPOR'}>Pasar Global (Ekspor)</option>
						<option value="CONSIGNE" selected={data.status === 'CONSIGNE'}>Customer Consignee (Consigne = 1)</option>
						<option value="AKTIF" selected={data.status === 'AKTIF'}>Customer Aktif Saja</option>
						<option value="DELISTED" selected={data.status === 'DELISTED'}>Customer Delisted / Non-aktif</option>
					</select>
				</div>

				<!-- Filter Mata Uang -->
				<div class="space-y-1.5 lg:col-span-2">
					<Label for="curr">Mata Uang</Label>
					<select
						id="curr"
						name="curr"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					>
						<option value="" selected={!data.curr}>Semua Valuta</option>
						<option value="IDR" selected={data.curr === 'IDR'}>IDR (Rupiah)</option>
						<option value="USD" selected={data.curr === 'USD'}>USD (Dollar)</option>
						<option value="EUR" selected={data.curr === 'EUR'}>EUR (Euro)</option>
						<option value="SGD" selected={data.curr === 'SGD'}>SGD (Sing Dollar)</option>
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

					{#if data.q || data.status || data.curr}
						<a
							href="/dashboard/master-customer"
							class="h-10 px-3 bg-muted hover:bg-muted/80 text-foreground border-[3px] border-border rounded-lg inline-flex items-center justify-center brutal-shadow-sm text-xs font-black uppercase"
							title="Reset Filter"
						>
							<RotateCcw class="size-4" />
						</a>
					{/if}
				</div>
			</div>
		</form>

		<!-- Tabel Data Master Customer -->
		<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
			<div class="flex items-center justify-between p-4 border-b-2 border-border/40 bg-muted/20">
				<div class="flex items-center gap-2">
					<Users class="size-5 text-primary" />
					<h2 class="text-sm font-black uppercase tracking-wide">Daftar Pelanggan ({data.total.toLocaleString('id-ID')})</h2>
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
							<TableHead class="font-black text-xs uppercase tracking-wider">Kode</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Nama Customer</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Kota / Negara</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Kontak & Telp</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Plafon & TOP</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider text-center">Curr</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider">Pasar</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider text-center">Consignee?</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider text-center">Status</TableHead>
							<TableHead class="font-black text-xs uppercase tracking-wider text-center w-28">Aksi</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.rows.length === 0}
							<TableEmpty colspan={11} message="Tidak ada data customer yang sesuai kriteria pencarian." />
						{:else}
							{#each data.rows as row, idx}
								<TableRow class="hover:bg-muted/30 transition-colors {row.Delisted ? 'opacity-70 bg-rose-500/5' : ''}">
									<!-- No Urut -->
									<TableCell class="text-center font-mono text-xs text-muted-foreground font-bold">
										{(data.page - 1) * data.pageSize + idx + 1}
									</TableCell>

									<!-- Kode Customer -->
									<TableCell>
										<span class="font-mono text-xs font-black bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded">
											{row.CompanyID}
										</span>
									</TableCell>

									<!-- Nama Customer & Inisial -->
									<TableCell>
										<div class="font-black text-sm text-foreground">
											{row.CompanyName1}
										</div>
										{#if row.CompanyName2}
											<div class="text-[11px] font-mono text-muted-foreground font-bold">
												Inisial: {row.CompanyName2}
											</div>
										{/if}
									</TableCell>

									<!-- Kota / Negara -->
									<TableCell>
										<div class="text-xs font-bold flex items-center gap-1 text-foreground">
											<MapPin class="size-3 text-muted-foreground shrink-0" />
											<span>{row.City || '-'}</span>
										</div>
										<div class="text-[11px] text-muted-foreground">
											{row.Negara || 'INDONESIA'}
										</div>
									</TableCell>

									<!-- Kontak & Telepon -->
									<TableCell>
										<div class="text-xs font-bold flex items-center gap-1 text-foreground">
											<User class="size-3 text-muted-foreground shrink-0" />
											<span>{row.Contact1 || '-'}</span>
										</div>
										{#if row.Phone1}
											<div class="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
												<Phone class="size-3 text-muted-foreground shrink-0" />
												<span>{row.Phone1}</span>
											</div>
										{/if}
									</TableCell>

									<!-- Plafon & TOP -->
									<TableCell>
										<div class="text-xs font-mono font-bold text-foreground">
											{row.Plafon ? formatCurrency(row.Plafon, row.Curr || 'IDR') : 'Tanpa Limit'}
										</div>
										<div class="text-[11px] text-muted-foreground font-mono">
											TOP: {row.Due != null ? `${row.Due} Hari` : '-'}
										</div>
									</TableCell>

									<!-- Mata Uang -->
									<TableCell class="text-center">
										<Badge
											variant={row.Curr === 'USD' ? 'default' : 'secondary'}
											class="font-mono font-black text-[11px] border"
										>
											{row.Curr || 'IDR'}
										</Badge>
									</TableCell>

									<!-- Tipe Pasar (Lokal / Ekspor) -->
									<TableCell>
										{#if row.Export}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30">
												<Globe class="size-3" />
												Ekspor
											</span>
										{:else}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
												<Truck class="size-3" />
												Lokal
											</span>
										{/if}
									</TableCell>

									<!-- Consignee Flag -->
									<TableCell class="text-center">
										{#if row.Consigne}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30">
												<Boxes class="size-3" />
												YA
											</span>
										{:else}
											<span class="text-muted-foreground text-xs font-bold">-</span>
										{/if}
									</TableCell>

									<!-- Status Aktif / Delisted -->
									<TableCell class="text-center">
										{#if row.Delisted}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30">
												<XCircle class="size-3" />
												Delisted
											</span>
										{:else}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
												<CheckCircle2 class="size-3" />
												Aktif
											</span>
										{/if}
									</TableCell>

									<!-- Aksi CRUDS -->
									<TableCell class="text-center">
										<div class="inline-flex items-center gap-1">
											<!-- Detail -->
											<button
												type="button"
												onclick={() => openDetailModal(row)}
												class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/50"
												title="Lihat Detail Lengkap Customer"
											>
												<Eye class="size-3.5" />
											</button>

											<!-- Edit -->
											<button
												type="button"
												onclick={() => openEditCustomerModal(row)}
												class="p-1.5 rounded-md hover:bg-primary/20 text-primary transition-colors cursor-pointer border border-primary/30"
												title="Ubah Data Customer"
											>
												<Edit3 class="size-3.5" />
											</button>

											<!-- Hapus -->
											<button
												type="button"
												onclick={() => openDeleteCustomerModal(row)}
												class="p-1.5 rounded-md hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer border border-rose-500/30"
												title="Hapus Customer"
											>
												<Trash2 class="size-3.5" />
											</button>
										</div>
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
					basePath="/dashboard/master-customer"
					params={{
						q: data.q || undefined,
						status: data.status || undefined,
						curr: data.curr || undefined
					}}
				/>
			</div>
		</div>
	{:else}
		<!-- ==================== TAB 2: MASTER CONSIGNEE (taConsigne) ==================== -->
		<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden space-y-4">
			<div class="flex items-center justify-between p-4 border-b-2 border-border/40 bg-muted/20">
				<div class="flex items-center gap-2">
					<Boxes class="size-5 text-primary" />
					<div>
						<h2 class="text-sm font-black uppercase tracking-wide">Daftar Rekanan Consignee (taConsigne)</h2>
						<p class="text-xs text-muted-foreground">Master rekanan konsinyasi / pengapalan ekspor yang terdaftar di database</p>
					</div>
				</div>
				<Button
					type="button"
					onclick={openCreateConsigneModal}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
				>
					<Plus class="size-4 mr-1.5" />
					Tambah Consignee Baru
				</Button>
			</div>

			<div class="p-4 pt-0">
				<div class="overflow-x-auto rounded-lg border-2 border-border">
					<Table>
						<TableHeader>
							<TableRow class="bg-muted/60">
								<TableHead class="font-black text-xs uppercase tracking-wider text-center w-12">No</TableHead>
								<TableHead class="font-black text-xs uppercase tracking-wider w-36">Consigne ID</TableHead>
								<TableHead class="font-black text-xs uppercase tracking-wider">Nama / Rekanan Consignee</TableHead>
								<TableHead class="font-black text-xs uppercase tracking-wider text-center w-36">Target Hari</TableHead>
								<TableHead class="font-black text-xs uppercase tracking-wider text-center w-28">Aksi</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if data.consigneList.length === 0}
								<TableEmpty colspan={5} message="Belum ada data Consignee di tabel taConsigne." />
							{:else}
								{#each data.consigneList as item, idx}
									<TableRow class="hover:bg-muted/30 transition-colors">
										<!-- No Urut -->
										<TableCell class="text-center font-mono text-xs text-muted-foreground font-bold">
											{idx + 1}
										</TableCell>

										<!-- ConsigneID -->
										<TableCell>
											<span class="font-mono text-xs font-black bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded">
												{item.ConsigneID || '-'}
											</span>
										</TableCell>

										<!-- Nama Consignee -->
										<TableCell>
											<div class="font-black text-sm text-foreground flex items-center gap-2">
												<span>{item.Consigne}</span>
											</div>
										</TableCell>

										<!-- Target Hari -->
										<TableCell class="text-center">
											<span class="inline-flex items-center gap-1 font-mono text-xs font-bold text-foreground">
												<Clock class="size-3 text-muted-foreground" />
												{item.TargetHari != null ? `${item.TargetHari} Hari` : '-'}
											</span>
										</TableCell>

										<!-- Aksi Edit & Hapus -->
										<TableCell class="text-center">
											<div class="inline-flex items-center gap-1">
												<!-- Edit -->
												<button
													type="button"
													onclick={() => openEditConsigneModal(item)}
													class="p-1.5 rounded-md hover:bg-primary/20 text-primary transition-colors cursor-pointer border border-primary/30"
													title="Ubah Data Consignee"
												>
													<Edit3 class="size-3.5" />
												</button>

												<!-- Hapus -->
												<button
													type="button"
													onclick={() => openDeleteConsigneModal(item)}
													class="p-1.5 rounded-md hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer border border-rose-500/30"
													title="Hapus Consignee"
												>
													<Trash2 class="size-3.5" />
												</button>
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
	{/if}
</div>

<!-- ==================== MODAL TAMBAH / EDIT CUSTOMER ==================== -->
<Modal
	bind:open={isCustomerModalOpen}
	size="3xl"
	title={isEditMode ? `Ubah Data Customer: ${customerForm.CompanyName1}` : 'Tambah Rekanan Customer Baru'}
	subtitle={isEditMode ? `Kode Customer: ${customerForm.CompanyID}` : 'Masukkan data pembeli / pelanggan baru ke database ERP'}
	icon={Users}
>
	<form
		method="post"
		action="?/save"
		use:enhance={() => {
			customerFormSubmitting = true;
			return async ({ update }) => {
				customerFormSubmitting = false;
				await update();
			};
		}}
		class="space-y-5 py-1"
	>
		<input type="hidden" name="isEdit" value={String(isEditMode)} />

		<!-- Bagian 1: Identitas Pokok & Pasar -->
		<div class="space-y-3">
			<div class="flex items-center gap-2 border-b-2 border-border/40 pb-1.5">
				<span class="text-xs font-black uppercase tracking-wider text-primary">1. Identitas Pokok Rekanan</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
				<!-- Kode Customer -->
				<div class="space-y-1.5 lg:col-span-5">
					<div class="flex items-center justify-between">
						<Label for="CompanyID">Kode Customer (CompanyID) *</Label>
						{#if !isEditMode}
							<div class="flex items-center gap-1.5">
								<button
									type="button"
									onclick={() => {
										isAutoCompanyId = !isAutoCompanyId;
										if (isAutoCompanyId) {
											customerForm.CompanyID = nextId;
										}
									}}
									class="inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors {isAutoCompanyId ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
									title="Beralih antara mode nomor urut otomatis atau input manual"
								>
									<span class="size-1.5 rounded-full {isAutoCompanyId ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}"></span>
									{isAutoCompanyId ? 'Otomatis' : 'Manual'}
								</button>

								{#if isAutoCompanyId}
									<button
										type="button"
										disabled={fetchingNextId}
										onclick={refreshNextId}
										class="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors cursor-pointer"
										title="Refresh nomor urut terbaru dari database"
									>
										<RefreshCw class="size-3 {fetchingNextId ? 'animate-spin text-primary' : ''}" />
									</button>
								{/if}
							</div>
						{/if}
					</div>

					<div class="relative">
						<input
							type="text"
							id="CompanyID"
							name="CompanyID"
							bind:value={customerForm.CompanyID}
							readonly={isEditMode || isAutoCompanyId}
							maxlength="8"
							required
							placeholder="Contoh: P0055"
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-black brutal-shadow-sm uppercase {(isEditMode || isAutoCompanyId) ? 'bg-muted/50 cursor-default' : ''}"
						/>
						{#if !isEditMode && isAutoCompanyId}
							<span class="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
								<Sparkles class="size-3" />
								AUTO
							</span>
						{/if}
					</div>

					{#if !isEditMode}
						<p class="text-[11px] text-muted-foreground font-medium">
							{#if isAutoCompanyId}
								Mengikuti ID terakhir: <strong class="font-mono text-foreground">{lastId || '-'}</strong> ➔ Nomor baru: <strong class="font-mono text-primary">{nextId}</strong>
							{:else}
								Maksimal 8 karakter alphanumeric
							{/if}
						</p>
					{:else}
						<p class="text-[10px] text-muted-foreground font-medium">Kode customer tidak dapat diubah (Primary Key)</p>
					{/if}
				</div>

				<!-- Nama Perusahaan Customer -->
				<div class="space-y-1.5 lg:col-span-7">
					<Label for="CompanyName1">Nama Perusahaan Customer *</Label>
					<input
						type="text"
						id="CompanyName1"
						name="CompanyName1"
						bind:value={customerForm.CompanyName1}
						required
						maxlength="100"
						placeholder="Contoh: PT. DURA FAUCET ASIA"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Singkatan / Inisial -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="CompanyName2">Inisial / Singkatan</Label>
					<input
						type="text"
						id="CompanyName2"
						name="CompanyName2"
						bind:value={customerForm.CompanyName2}
						maxlength="10"
						placeholder="DURA"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm uppercase"
					/>
				</div>

				<!-- Mata Uang -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="Curr">Mata Uang Default</Label>
					<select
						id="Curr"
						name="Curr"
						bind:value={customerForm.Curr}
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					>
						<option value="IDR">IDR (Rupiah)</option>
						<option value="USD">USD (Dollar US)</option>
						<option value="SGD">SGD (Sing Dollar)</option>
						<option value="EUR">EUR (Euro)</option>
						<option value="CNY">CNY (Yuan)</option>
						<option value="JPY">JPY (Yen)</option>
					</select>
				</div>

				<!-- Status Pasar -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="Status">Kategori Pasar</Label>
					<input
						type="text"
						id="Status"
						name="Status"
						bind:value={customerForm.Status}
						maxlength="20"
						placeholder="Lokal / Ekspor / KB"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Toggle Flags: Ekspor, Consigne & Delisted -->
				<div class="space-y-1.5 lg:col-span-12">
					<div class="flex flex-wrap items-center gap-4 py-2 px-3 bg-muted/30 rounded-lg border-2 border-border/50">
						<label class="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
							<input
								type="checkbox"
								name="Export"
								bind:checked={customerForm.Export}
								class="rounded border-2 border-border size-4 text-primary focus:ring-0"
							/>
							<span>Pasar Ekspor</span>
						</label>

						<label class="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-purple-700 dark:text-purple-400">
							<input
								type="checkbox"
								name="Consigne"
								bind:checked={customerForm.Consigne}
								class="rounded border-2 border-border size-4 text-purple-600 focus:ring-0"
							/>
							<span>Customer Consignee (Tandai pembeli sebagai Consignee)</span>
						</label>

						<label class="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-rose-600 dark:text-rose-400">
							<input
								type="checkbox"
								name="Delisted"
								bind:checked={customerForm.Delisted}
								class="rounded border-2 border-border size-4 text-rose-600 focus:ring-0"
							/>
							<span>Non-aktifkan Customer (Delisted)</span>
						</label>
					</div>
				</div>
			</div>
		</div>

		<!-- Bagian 2: Alamat & Lokasi Pabrik / Kantor -->
		<div class="space-y-3">
			<div class="flex items-center gap-2 border-b-2 border-border/40 pb-1.5">
				<span class="text-xs font-black uppercase tracking-wider text-primary">2. Alamat & Lokasi Pengiriman</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
				<!-- Alamat Utama -->
				<div class="space-y-1.5 lg:col-span-6">
					<Label for="Address1">Alamat Kantor / Pabrik Utama</Label>
					<input
						type="text"
						id="Address1"
						name="Address1"
						bind:value={customerForm.Address1}
						maxlength="150"
						placeholder="Jalan, Nomor, Kawasan Industri..."
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Alamat Tambahan -->
				<div class="space-y-1.5 lg:col-span-6">
					<Label for="Address2">Alamat Pengiriman (Gudang / Pelabuhan)</Label>
					<input
						type="text"
						id="Address2"
						name="Address2"
						bind:value={customerForm.Address2}
						maxlength="70"
						placeholder="Gedung, Blok, Pelabuhan Muat..."
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Kota -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="City">Kota</Label>
					<input
						type="text"
						id="City"
						name="City"
						bind:value={customerForm.City}
						maxlength="20"
						placeholder="SURABAYA / JAKARTA"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm uppercase"
					/>
				</div>

				<!-- Provinsi -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="Provinsi">Provinsi / State</Label>
					<input
						type="text"
						id="Provinsi"
						name="Provinsi"
						bind:value={customerForm.Provinsi}
						maxlength="100"
						placeholder="JAWA TIMUR / CALIFORNIA"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm uppercase"
					/>
				</div>

				<!-- Negara -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="Negara">Negara</Label>
					<input
						type="text"
						id="Negara"
						name="Negara"
						bind:value={customerForm.Negara}
						maxlength="20"
						placeholder="INDONESIA / USA"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm uppercase"
					/>
				</div>

				<!-- Kode Pos -->
				<div class="space-y-1.5 lg:col-span-2">
					<Label for="PostalCode">Kode Pos</Label>
					<input
						type="text"
						id="PostalCode"
						name="PostalCode"
						bind:value={customerForm.PostalCode}
						maxlength="5"
						placeholder="60293"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>
			</div>
		</div>

		<!-- Bagian 3: Kontak Person & Komunikasi -->
		<div class="space-y-3">
			<div class="flex items-center gap-2 border-b-2 border-border/40 pb-1.5">
				<span class="text-xs font-black uppercase tracking-wider text-primary">3. Kontak Person & Komunikasi</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
				<!-- PIC Kontak -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Contact1">Nama Kontak / PIC Utama</Label>
					<input
						type="text"
						id="Contact1"
						name="Contact1"
						bind:value={customerForm.Contact1}
						maxlength="15"
						placeholder="Bpk. Hendra"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Jabatan PIC -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Job1">Jabatan PIC</Label>
					<input
						type="text"
						id="Job1"
						name="Job1"
						bind:value={customerForm.Job1}
						maxlength="15"
						placeholder="Purchasing Manager"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Email -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Email">Alamat Email</Label>
					<input
						type="email"
						id="Email"
						name="Email"
						bind:value={customerForm.Email}
						maxlength="40"
						placeholder="purchasing@customer.com"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Telepon 1 -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Phone1">No. Telepon 1</Label>
					<input
						type="text"
						id="Phone1"
						name="Phone1"
						bind:value={customerForm.Phone1}
						maxlength="15"
						placeholder="031-8971234"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Telepon 2 -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Phone2">No. Telepon 2 / HP</Label>
					<input
						type="text"
						id="Phone2"
						name="Phone2"
						bind:value={customerForm.Phone2}
						maxlength="15"
						placeholder="081234567890"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Fax -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Fax1">No. Fax</Label>
					<input
						type="text"
						id="Fax1"
						name="Fax1"
						bind:value={customerForm.Fax1}
						maxlength="15"
						placeholder="031-8971235"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>
			</div>
		</div>

		<!-- Bagian 4: Ketentuan Keuangan, Kredit & Pajak -->
		<div class="space-y-3">
			<div class="flex items-center gap-2 border-b-2 border-border/40 pb-1.5">
				<span class="text-xs font-black uppercase tracking-wider text-primary">4. Ketentuan Kredit, Pajak & Piutang</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
				<!-- NPWP -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="TaxID">NPWP / Tax ID</Label>
					<input
						type="text"
						id="TaxID"
						name="TaxID"
						bind:value={customerForm.TaxID}
						maxlength="25"
						placeholder="01.234.567.8-901.000"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Plafon Kredit -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Plafon">Batas Plafon Kredit (IDR/Valas)</Label>
					<input
						type="number"
						id="Plafon"
						name="Plafon"
						bind:value={customerForm.Plafon}
						step="any"
						min="0"
						placeholder="0 jika tidak dibatasi"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- TOP / Jatuh Tempo -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Due">Term of Payment / Jatuh Tempo (Hari)</Label>
					<input
						type="number"
						id="Due"
						name="Due"
						bind:value={customerForm.Due}
						min="0"
						max="365"
						placeholder="Contoh: 30 atau 60 hari"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
					/>
				</div>
			</div>
		</div>

		<!-- Bagian 5: Catatan Khusus Internal -->
		<div class="space-y-3">
			<div class="flex items-center gap-2 border-b-2 border-border/40 pb-1.5">
				<span class="text-xs font-black uppercase tracking-wider text-primary">5. Catatan Khusus Internal</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="space-y-1.5">
					<Label for="NoteMarketing">Catatan Khusus Marketing / Sales</Label>
					<textarea
						id="NoteMarketing"
						name="NoteMarketing"
						bind:value={customerForm.NoteMarketing}
						rows="2"
						placeholder="Preferensi spesifikasi barang, diskon kontrak, atau jadwal PO khusus..."
						class="bg-card border-border w-full rounded-lg border-[3px] p-2.5 text-sm font-medium brutal-shadow-sm"
					></textarea>
				</div>

				<div class="space-y-1.5">
					<Label for="NoteFinance">Catatan Khusus Finance / Penagihan</Label>
					<textarea
						id="NoteFinance"
						name="NoteFinance"
						bind:value={customerForm.NoteFinance}
						rows="2"
						placeholder="Syarat kelengkapan tukar faktur, jadwal pembayaran, atau rekening khusus..."
						class="bg-card border-border w-full rounded-lg border-[3px] p-2.5 text-sm font-medium brutal-shadow-sm"
					></textarea>
				</div>
			</div>
		</div>

		<!-- Action Buttons: Batal & Simpan -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t-2 border-border/40 mt-6 sticky bottom-0 bg-card py-2 z-10">
			<Button
				type="button"
				variant="secondary"
				onclick={() => (isCustomerModalOpen = false)}
				class="h-10 border-[3px] font-black uppercase brutal-shadow-sm text-xs px-5 cursor-pointer"
			>
				Batal
			</Button>
			<Button
				type="submit"
				disabled={customerFormSubmitting}
				class="h-10 border-[3px] font-black uppercase brutal-shadow-sm text-xs px-6 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
			>
				{customerFormSubmitting ? 'Menyimpan...' : isEditMode ? 'Perbarui Customer' : 'Simpan Customer Baru'}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL DETAIL CUSTOMER ==================== -->
<Modal
	bind:open={isDetailModalOpen}
	size="2xl"
	title="Informasi Detail Rekanan Customer"
	subtitle={selectedDetail ? `${selectedDetail.CompanyID} • ${selectedDetail.CompanyName1}` : ''}
	icon={Eye}
>
	{#if selectedDetail}
		<div class="space-y-4 py-1">
			<!-- Header Card -->
			<div class="p-3.5 bg-muted/40 rounded-xl border-2 border-border space-y-1">
				<div class="flex items-center justify-between">
					<span class="font-mono text-xs font-black bg-primary text-primary-foreground px-2 py-0.5 rounded">
						{selectedDetail.CompanyID}
					</span>
					<div class="flex items-center gap-1.5">
						<Badge variant="secondary" class="font-mono font-bold text-xs border">
							VALAS: {selectedDetail.Curr || 'IDR'}
						</Badge>
						{#if selectedDetail.Export}
							<Badge variant="default" class="bg-blue-600 font-bold text-xs">
								EKSPOR
							</Badge>
						{:else}
							<Badge variant="outline" class="font-bold text-xs">
								LOKAL
							</Badge>
						{/if}
						{#if selectedDetail.Consigne}
							<Badge variant="primary" class="bg-purple-600 text-white font-bold text-xs">
								CONSIGNEE
							</Badge>
						{/if}
						{#if selectedDetail.Delisted}
							<Badge variant="error" class="font-bold text-xs">
								DELISTED
							</Badge>
						{/if}
					</div>
				</div>
				<h3 class="text-base font-black text-foreground">{selectedDetail.CompanyName1}</h3>
				{#if selectedDetail.CompanyName2}
					<p class="text-xs text-muted-foreground font-mono">Inisial / Kode Singkat: {selectedDetail.CompanyName2}</p>
				{/if}
			</div>

			<!-- Grid Informasi -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
				<div class="p-3 rounded-lg border border-border bg-card space-y-1.5">
					<span class="font-black uppercase text-muted-foreground block text-[10px]">Alamat & Lokasi</span>
					<div class="font-bold text-foreground">{selectedDetail.Address1 || '-'}</div>
					{#if selectedDetail.Address2}
						<div class="text-muted-foreground">{selectedDetail.Address2}</div>
					{/if}
					<div class="text-muted-foreground pt-1">
						{selectedDetail.City || '-'}, {selectedDetail.Provinsi || '-'} {selectedDetail.PostalCode || ''}
					</div>
					<div class="text-muted-foreground font-bold">Negara: {selectedDetail.Negara || 'INDONESIA'}</div>
				</div>

				<div class="p-3 rounded-lg border border-border bg-card space-y-1.5">
					<span class="font-black uppercase text-muted-foreground block text-[10px]">Kontak & Komunikasi</span>
					<div class="font-bold text-foreground">PIC: {selectedDetail.Contact1 || '-'} ({selectedDetail.Job1 || 'PIC'})</div>
					<div class="font-mono">Telp 1: {selectedDetail.Phone1 || '-'}</div>
					{#if selectedDetail.Phone2}
						<div class="font-mono">Telp 2: {selectedDetail.Phone2}</div>
					{/if}
					{#if selectedDetail.Fax1}
						<div class="font-mono">Fax: {selectedDetail.Fax1}</div>
					{/if}
					<div class="font-mono">Email: {selectedDetail.Email || '-'}</div>
				</div>

				<div class="p-3 rounded-lg border border-border bg-card space-y-1.5">
					<span class="font-black uppercase text-muted-foreground block text-[10px]">Ketentuan Kredit & TOP</span>
					<div class="font-bold text-foreground">
						Plafon Kredit: {selectedDetail.Plafon ? formatCurrency(selectedDetail.Plafon, selectedDetail.Curr || 'IDR') : 'Tanpa Batasan'}
					</div>
					<div class="font-mono">Jatuh Tempo: {selectedDetail.Due != null ? `${selectedDetail.Due} Hari` : '-'}</div>
					<div class="font-mono">NPWP: {selectedDetail.TaxID || '-'}</div>
					<div>Kategori: {selectedDetail.Status || '-'}</div>
				</div>

				<div class="p-3 rounded-lg border border-border bg-card space-y-1.5">
					<span class="font-black uppercase text-muted-foreground block text-[10px]">Status Perdagangan & Consignee</span>
					<div>Pasar: <strong class="text-foreground">{selectedDetail.Export ? 'EKSPOR / LUAR NEGERI' : 'LOKAL / DOMESTIK'}</strong></div>
					<div>Consignee: <strong class={selectedDetail.Consigne ? 'text-purple-600' : 'text-muted-foreground'}>{selectedDetail.Consigne ? 'YA (CUSTOMER CONSIGNEE)' : 'BUKAN CONSIGNEE'}</strong></div>
					<div>Status Rekanan: <strong class={selectedDetail.Delisted ? 'text-rose-600' : 'text-emerald-600'}>{selectedDetail.Delisted ? 'DELISTED (NON-AKTIF)' : 'AKTIF'}</strong></div>
					<div>Valuta Transaksi: <strong class="font-mono">{selectedDetail.Curr || 'IDR'}</strong></div>
				</div>

				{#if selectedDetail.NoteMarketing}
					<div class="p-3 rounded-lg border border-border bg-card space-y-1 sm:col-span-2">
						<span class="font-black uppercase text-muted-foreground block text-[10px]">Catatan Khusus Marketing / Sales</span>
						<p class="font-medium text-foreground whitespace-pre-wrap">{selectedDetail.NoteMarketing}</p>
					</div>
				{/if}

				{#if selectedDetail.NoteFinance}
					<div class="p-3 rounded-lg border border-border bg-card space-y-1 sm:col-span-2">
						<span class="font-black uppercase text-muted-foreground block text-[10px]">Catatan Khusus Finance / Piutang</span>
						<p class="font-medium text-foreground whitespace-pre-wrap">{selectedDetail.NoteFinance}</p>
					</div>
				{/if}

				<!-- Audit Trail -->
				<div class="p-3 rounded-lg border border-border bg-muted/20 space-y-1 sm:col-span-2 text-[11px] text-muted-foreground font-mono">
					<div>Dibuat oleh: <span class="font-bold text-foreground">{selectedDetail.UserName || '-'}</span> ({formatDate(selectedDetail.UserDatetime)})</div>
					{#if selectedDetail.UserUpdateName}
						<div>Terakhir diubah oleh: <span class="font-bold text-foreground">{selectedDetail.UserUpdateName}</span> ({formatDate(selectedDetail.UserUpdateTime)})</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex items-center justify-end w-full">
			<Button
				type="button"
				variant="secondary"
				onclick={() => (isDetailModalOpen = false)}
				class="border-[3px] font-black uppercase brutal-shadow-sm text-xs cursor-pointer"
			>
				Tutup
			</Button>
		</div>
	{/snippet}
</Modal>

<!-- ==================== MODAL KONFIRMASI HAPUS CUSTOMER ==================== -->
{#if customerToDelete}
	<Modal
		bind:open={isDeleteModalOpen}
		size="md"
		title="Konfirmasi Hapus Customer"
		subtitle="Tindakan ini tidak dapat dibatalkan"
		icon={Trash2}
	>
		<div class="space-y-3 py-2 text-sm">
			<p class="font-bold text-foreground">
				Apakah Anda yakin ingin menghapus data rekanan customer berikut dari Master Data?
			</p>
			<div class="p-3 bg-rose-500/10 border-2 border-rose-500/30 rounded-xl space-y-1">
				<div class="font-mono text-xs font-black text-rose-700 dark:text-rose-300">
					{customerToDelete.CompanyID}
				</div>
				<div class="font-black text-foreground">
					{customerToDelete.CompanyName1}
				</div>
				<div class="text-xs text-muted-foreground">
					Kota: {customerToDelete.City || '-'} • Valuta: {customerToDelete.Curr || 'IDR'}
				</div>
			</div>
			<p class="text-xs text-muted-foreground font-medium">
				Catatan: Sistem akan memvalidasi apakah customer ini pernah memiliki riwayat faktur penjualan, surat jalan (taTransOHD), atau piutang sebelum menghapus demi menjaga integritas data akuntansi ERP.
			</p>
		</div>

		{#snippet footer()}
			<form
				method="post"
				action="?/delete"
				use:enhance={() => {
					deleteSubmitting = true;
					return async ({ update }) => {
						deleteSubmitting = false;
						await update();
					};
				}}
				class="flex items-center justify-end gap-2 w-full pt-1"
			>
				<input type="hidden" name="companyId" value={customerToDelete.CompanyID} />
				<Button
					type="button"
					variant="secondary"
					onclick={() => (isDeleteModalOpen = false)}
					class="border-[3px] font-black uppercase brutal-shadow-sm text-xs cursor-pointer"
				>
					Batal
				</Button>
				<Button
					type="submit"
					disabled={deleteSubmitting}
					class="border-[3px] font-black uppercase brutal-shadow-sm text-xs bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
				>
					{deleteSubmitting ? 'Menghapus...' : 'Ya, Hapus Customer'}
				</Button>
			</form>
		{/snippet}
	</Modal>
{/if}

<!-- ==================== MODAL TAMBAH / EDIT CONSIGNEE (taConsigne) ==================== -->
<Modal
	bind:open={isConsigneModalOpen}
	size="md"
	title={isEditConsigneMode ? `Ubah Consignee: ${consigneForm.Consigne}` : 'Tambah Consignee Baru'}
	subtitle="Kelola master data rekanan konsinyasi / pengapalan di taConsigne"
	icon={Boxes}
>
	<form
		method="post"
		action="?/saveConsigne"
		use:enhance={() => {
			consigneFormSubmitting = true;
			return async ({ update }) => {
				consigneFormSubmitting = false;
				await update();
			};
		}}
		class="space-y-4 py-1"
	>
		<input type="hidden" name="isEdit" value={String(isEditConsigneMode)} />
		<input type="hidden" name="oldConsigne" value={consigneForm.oldConsigne} />

		<!-- ConsigneID -->
		<div class="space-y-1.5">
			<Label for="ConsigneID">Kode Consigne ID (3 Digit)</Label>
			<input
				type="text"
				id="ConsigneID"
				name="ConsigneID"
				bind:value={consigneForm.ConsigneID}
				maxlength="3"
				placeholder="001, 002..."
				class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
			/>
			<p class="text-[11px] text-muted-foreground">Kode identifikasi 3 karakter untuk dokumen impor/ekspor.</p>
		</div>

		<!-- Consigne (Nama / Kode Rekanan) -->
		<div class="space-y-1.5">
			<Label for="Consigne">Nama / Rekanan Consignee *</Label>
			<input
				type="text"
				id="Consigne"
				name="Consigne"
				bind:value={consigneForm.Consigne}
				required
				maxlength="25"
				placeholder="Contoh: SR, MUN, DB, INTRACOM"
				class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm uppercase"
			/>
			<p class="text-[11px] text-muted-foreground">Maksimal 25 karakter.</p>
		</div>

		<!-- Target Hari -->
		<div class="space-y-1.5">
			<Label for="TargetHari">Target Lead Time / Hari</Label>
			<input
				type="number"
				id="TargetHari"
				name="TargetHari"
				bind:value={consigneForm.TargetHari}
				min="0"
				max="365"
				placeholder="14"
				class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
			/>
			<p class="text-[11px] text-muted-foreground">Target estimasi hari pengiriman / pembayaran.</p>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t-2 border-border/40 mt-4">
			<Button
				type="button"
				variant="secondary"
				onclick={() => (isConsigneModalOpen = false)}
				class="h-10 border-[3px] font-black uppercase brutal-shadow-sm text-xs px-5 cursor-pointer"
			>
				Batal
			</Button>
			<Button
				type="submit"
				disabled={consigneFormSubmitting}
				class="h-10 border-[3px] font-black uppercase brutal-shadow-sm text-xs px-6 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
			>
				{consigneFormSubmitting ? 'Menyimpan...' : isEditConsigneMode ? 'Perbarui Consignee' : 'Simpan Consignee'}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL KONFIRMASI HAPUS CONSIGNEE ==================== -->
{#if consigneToDelete}
	<Modal
		bind:open={isDeleteConsigneModalOpen}
		size="md"
		title="Konfirmasi Hapus Consignee"
		subtitle="Tindakan ini tidak dapat dibatalkan"
		icon={Trash2}
	>
		<div class="space-y-3 py-2 text-sm">
			<p class="font-bold text-foreground">
				Apakah Anda yakin ingin menghapus data Consignee berikut dari tabel taConsigne?
			</p>
			<div class="p-3 bg-rose-500/10 border-2 border-rose-500/30 rounded-xl space-y-1">
				<div class="font-mono text-xs font-black text-rose-700 dark:text-rose-300">
					ID: {consigneToDelete.ConsigneID || '-'}
				</div>
				<div class="font-black text-foreground">
					{consigneToDelete.Consigne}
				</div>
				<div class="text-xs text-muted-foreground">
					Target: {consigneToDelete.TargetHari != null ? `${consigneToDelete.TargetHari} Hari` : '-'}
				</div>
			</div>
			<p class="text-xs text-muted-foreground font-medium">
				Catatan: Sistem akan memvalidasi apakah Consignee ini sedang digunakan pada dokumen import atau Sales Order sebelum melakukan penghapusan.
			</p>
		</div>

		{#snippet footer()}
			<form
				method="post"
				action="?/deleteConsigne"
				use:enhance={() => {
					deleteConsigneSubmitting = true;
					return async ({ update }) => {
						deleteConsigneSubmitting = false;
						await update();
					};
				}}
				class="flex items-center justify-end gap-2 w-full pt-1"
			>
				<input type="hidden" name="consigne" value={consigneToDelete.Consigne} />
				<Button
					type="button"
					variant="secondary"
					onclick={() => (isDeleteConsigneModalOpen = false)}
					class="border-[3px] font-black uppercase brutal-shadow-sm text-xs cursor-pointer"
				>
					Batal
				</Button>
				<Button
					type="submit"
					disabled={deleteConsigneSubmitting}
					class="border-[3px] font-black uppercase brutal-shadow-sm text-xs bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
				>
					{deleteConsigneSubmitting ? 'Menghapus...' : 'Ya, Hapus Consignee'}
				</Button>
			</form>
		{/snippet}
	</Modal>
{/if}
