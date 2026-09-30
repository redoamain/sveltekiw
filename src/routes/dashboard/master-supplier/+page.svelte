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
		Modal,
		ConfirmModal
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		Building2,
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
		ExternalLink,
		Sparkles,
		RefreshCw
	} from '@lucide/svelte';

	let { data, form } = $props();

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

	// Handle response actions form (save / delete)
	$effect(() => {
		if (form?.success) {
			if (form.message) toast.success('Berhasil', form.message);
			isSupplierModalOpen = false;
			isDeleteModalOpen = false;
		} else if (form?.error) {
			toast.error('Gagal', form.error);
		}
	});

	// ==================== STATE MODAL CREATE & EDIT ====================
	let isSupplierModalOpen = $state(false);
	let isEditMode = $state(false);
	let supplierFormSubmitting = $state(false);
	let isAutoCompanyId = $state(true);
	let fetchingNextId = $state(false);

	async function refreshNextId() {
		fetchingNextId = true;
		try {
			const res = await fetch('/api/master-supplier/next-id');
			if (res.ok) {
				const json = await res.json();
				if (json.nextId) {
					nextId = json.nextId;
					lastId = json.lastId || lastId;
					if (isAutoCompanyId && !isEditMode) {
						supplierForm.CompanyID = json.nextId;
					}
				}
			}
		} catch (err) {
			console.error('Gagal mengambil nextId supplier:', err);
		} finally {
			fetchingNextId = false;
		}
	}

	let supplierForm = $state({
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
		Status: 'TLDDP/Lokal',
		Import: false,
		NonLokal: false,
		Bank: '',
		NoRek: '',
		NamaRek: '',
		NotePurchasing: ''
	});

	function openCreateModal() {
		isEditMode = false;
		isAutoCompanyId = true;
		supplierForm = {
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
			Status: 'TLDDP/Lokal',
			Import: false,
			NonLokal: false,
			Bank: '',
			NoRek: '',
			NamaRek: '',
			NotePurchasing: ''
		};
		isSupplierModalOpen = true;
		refreshNextId();
	}

	function openEditModal(item: any) {
		isEditMode = true;
		supplierForm = {
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
			Status: String(item.Status || 'TLDDP/Lokal'),
			Import: Boolean(item.Import),
			NonLokal: Boolean(item.NonLokal),
			Bank: String(item.Bank || ''),
			NoRek: String(item.NoRek || ''),
			NamaRek: String(item.NamaRek || ''),
			NotePurchasing: String(item.NotePurchasing || '')
		};
		isSupplierModalOpen = true;
	}

	// ==================== STATE MODAL DETAIL ====================
	let isDetailModalOpen = $state(false);
	let selectedDetail = $state<any>(null);

	function openDetailModal(item: any) {
		selectedDetail = item;
		isDetailModalOpen = true;
	}

	// ==================== STATE MODAL DELETE ====================
	let isDeleteModalOpen = $state(false);
	let supplierToDelete = $state<any>(null);
	let deleteSubmitting = $state(false);

	function openDeleteModal(item: any) {
		supplierToDelete = item;
		isDeleteModalOpen = true;
	}

	function formatDate(val?: string | null): string {
		if (!val) return '-';
		return val.replace('T', ' ').slice(0, 19);
	}
</script>

<LoadingOverlay show={loading} message="Memuat Master Supplier..." submessage="Mohon tunggu sejenak" />

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Master Data Rekanan Supplier"
		description="Kelola direktori pemasok bahan baku, suku cadang, dan vendor logistik (Lokal & Impor) terintegrasi taSupplier."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					onclick={openCreateModal}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
					title="Tambah supplier rekanan baru"
				>
					<Plus class="size-4 mr-1.5" />
					Tambah Supplier
				</Button>

				<!-- Form Export Excel -->
				<form
					method="post"
					action="/api/master-supplier/export"
					onsubmit={() => {
						exportLoading = true;
						toast.info('Export Excel', 'Menyiapkan berkas Excel master supplier...');
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
						title="Export Excel Master Data Supplier"
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
					title="Cetak daftar supplier"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Summary Metrics Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Supplier -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Supplier</span>
				<Building2 class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.total.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Mitra Terdaftar di Sistem
				</p>
			</div>
		</div>

		<!-- Supplier Lokal -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Pemasok Lokal (TLDDP)</span>
				<Truck class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
					{data.stats.totalLokal.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.stats.total > 0 ? Math.round((data.stats.totalLokal / data.stats.total) * 100) : 0}% dari seluruh rekanan
				</p>
			</div>
		</div>

		<!-- Supplier Impor -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-blue-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">Pemasok Impor (LDP)</span>
				<Globe class="size-4 text-blue-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-blue-700 dark:text-blue-400">
					{data.stats.totalImport.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Vendor Luar Negeri / BC 2.3
				</p>
			</div>
		</div>

		<!-- Supplier Valas -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-purple-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">Transaksi Valas</span>
				<DollarSign class="size-4 text-purple-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-purple-700 dark:text-purple-400">
					{data.stats.totalValas.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Mata Uang USD / SGD / Valas
				</p>
			</div>
		</div>
	</div>

	<!-- Filter & Search Form -->
	<form
		method="get"
		action="/dashboard/master-supplier"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
			<!-- Input Pencarian -->
			<div class="space-y-1.5 lg:col-span-5">
				<Label for="q">Pencarian Supplier</Label>
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<input
						type="text"
						id="q"
						name="q"
						value={data.q}
						placeholder="Cari kode (S00...), nama, kota, telepon, NPWP..."
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] pl-9 pr-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>
			</div>

			<!-- Filter Status -->
			<div class="space-y-1.5 lg:col-span-3">
				<Label for="status">Kategori Pasar</Label>
				<select
					id="status"
					name="status"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
				>
					<option value="" selected={!data.status}>Semua Status / Kategori</option>
					<option value="LOKAL" selected={data.status === 'LOKAL'}>Pemasok Lokal (TLDDP)</option>
					<option value="IMPORT" selected={data.status === 'IMPORT'}>Pemasok Impor (LDP / Luar Negeri)</option>
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
						href="/dashboard/master-supplier"
						class="h-10 px-3 bg-muted hover:bg-muted/80 text-foreground border-[3px] border-border rounded-lg inline-flex items-center justify-center brutal-shadow-sm text-xs font-black uppercase"
						title="Reset Filter"
					>
						<RotateCcw class="size-4" />
					</a>
				{/if}
			</div>
		</div>
	</form>

	<!-- Tabel Data Master Supplier -->
	<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
		<div class="flex items-center justify-between p-4 border-b-2 border-border/40 bg-muted/20">
			<div class="flex items-center gap-2">
				<Building2 class="size-5 text-primary" />
				<h2 class="text-sm font-black uppercase tracking-wide">Daftar Pemasok ({data.total.toLocaleString('id-ID')})</h2>
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
						<TableHead class="font-black text-xs uppercase tracking-wider">Nama Supplier</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider">Kota / Negara</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider">Kontak & Telp</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider">NPWP</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider text-center">Curr</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider">Kategori</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider text-center w-28">Aksi</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableEmpty colspan={9} message="Tidak ada data supplier yang sesuai kriteria pencarian." />
					{:else}
						{#each data.rows as row, idx}
							<TableRow class="hover:bg-muted/30 transition-colors">
								<!-- No Urut -->
								<TableCell class="text-center font-mono text-xs text-muted-foreground font-bold">
									{(data.page - 1) * data.pageSize + idx + 1}
								</TableCell>

								<!-- Kode Supplier -->
								<TableCell>
									<span class="font-mono text-xs font-black bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded">
										{row.CompanyID}
									</span>
								</TableCell>

								<!-- Nama Supplier & Inisial -->
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

								<!-- NPWP -->
								<TableCell>
									<span class="font-mono text-xs font-bold text-foreground">
										{row.TaxID || '-'}
									</span>
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

								<!-- Kategori -->
								<TableCell>
									{#if row.Import || (row.Status && row.Status.toLowerCase().includes('luar'))}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30">
											<Globe class="size-3" />
											Impor / LDP
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
											<Truck class="size-3" />
											Lokal
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
											title="Lihat Detail Lengkap"
										>
											<Eye class="size-3.5" />
										</button>

										<!-- Edit -->
										<button
											type="button"
											onclick={() => openEditModal(row)}
											class="p-1.5 rounded-md hover:bg-primary/20 text-primary transition-colors cursor-pointer border border-primary/30"
											title="Ubah Data Supplier"
										>
											<Edit3 class="size-3.5" />
										</button>

										<!-- Hapus -->
										<button
											type="button"
											onclick={() => openDeleteModal(row)}
											class="p-1.5 rounded-md hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer border border-rose-500/30"
											title="Hapus Supplier"
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
				basePath="/dashboard/master-supplier"
				params={{
					q: data.q || undefined,
					status: data.status || undefined,
					curr: data.curr || undefined
				}}
			/>
		</div>
	</div>
</div>

<!-- ==================== MODAL TAMBAH / EDIT SUPPLIER ==================== -->
<Modal
	bind:open={isSupplierModalOpen}
	size="3xl"
	title={isEditMode ? `Ubah Data Supplier: ${supplierForm.CompanyName1}` : 'Tambah Rekanan Supplier Baru'}
	subtitle={isEditMode ? `Kode Supplier: ${supplierForm.CompanyID}` : 'Masukkan data pemasok vendor baru ke database ERP'}
	icon={Building2}
>
	<form
		method="post"
		action="?/save"
		use:enhance={() => {
			supplierFormSubmitting = true;
			return async ({ update }) => {
				supplierFormSubmitting = false;
				await update();
			};
		}}
		class="space-y-5 py-1"
	>
		<input type="hidden" name="isEdit" value={String(isEditMode)} />

		<!-- Bagian 1: Identitas Pokok -->
		<div class="space-y-3">
			<div class="flex items-center gap-2 border-b-2 border-border/40 pb-1.5">
				<span class="text-xs font-black uppercase tracking-wider text-primary">1. Identitas Pokok Rekanan</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
				<!-- Kode Supplier -->
				<div class="space-y-1.5 lg:col-span-5">
					<div class="flex items-center justify-between">
						<Label for="CompanyID">Kode Supplier (CompanyID) *</Label>
						{#if !isEditMode}
							<div class="flex items-center gap-1.5">
								<button
									type="button"
									onclick={() => {
										isAutoCompanyId = !isAutoCompanyId;
										if (isAutoCompanyId) {
											supplierForm.CompanyID = nextId;
										}
									}}
									class="inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors {isAutoCompanyId ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
									title="Beralih antara mode otomatis nomor urut atau input manual"
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
							bind:value={supplierForm.CompanyID}
							readonly={isEditMode || isAutoCompanyId}
							maxlength="8"
							required
							placeholder="Contoh: S0000197"
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
						<p class="text-[10px] text-muted-foreground font-medium">Kode supplier tidak dapat diubah (Primary Key)</p>
					{/if}
				</div>

				<!-- Nama Perusahaan -->
				<div class="space-y-1.5 lg:col-span-7">
					<Label for="CompanyName1">Nama Perusahaan / Supplier *</Label>
					<input
						type="text"
						id="CompanyName1"
						name="CompanyName1"
						bind:value={supplierForm.CompanyName1}
						required
						maxlength="100"
						placeholder="Contoh: PT. SINAR KIMIA UTAMA"
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
						bind:value={supplierForm.CompanyName2}
						maxlength="5"
						placeholder="SKU"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm uppercase"
					/>
				</div>

				<!-- Mata Uang -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="Curr">Mata Uang Default</Label>
					<select
						id="Curr"
						name="Curr"
						bind:value={supplierForm.Curr}
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
					<Label for="Status">Status Pasar</Label>
					<select
						id="Status"
						name="Status"
						bind:value={supplierForm.Status}
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					>
						<option value="TLDDP/Lokal">TLDDP / Lokal</option>
						<option value="LDP/Luar Negeri">LDP / Luar Negeri</option>
					</select>
				</div>

				<!-- Opsi Centang Impor & NonLokal -->
				<div class="space-y-1.5 lg:col-span-3 flex flex-col justify-end">
					<div class="flex items-center gap-3 pt-2">
						<label class="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
							<input
								type="checkbox"
								name="Import"
								bind:checked={supplierForm.Import}
								class="rounded border-[2px] border-border text-primary focus:ring-primary size-4"
							/>
							<span>Vendor Impor</span>
						</label>
						<label class="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
							<input
								type="checkbox"
								name="NonLokal"
								bind:checked={supplierForm.NonLokal}
								class="rounded border-[2px] border-border text-primary focus:ring-primary size-4"
							/>
							<span>Non-Lokal</span>
						</label>
					</div>
				</div>
			</div>
		</div>

		<!-- Bagian 2: Kontak & Alamat -->
		<div class="space-y-3">
			<div class="flex items-center gap-2 border-b-2 border-border/40 pb-1.5">
				<span class="text-xs font-black uppercase tracking-wider text-primary">2. Kontak & Alamat Perusahaan</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
				<!-- Kontak Person (PIC) -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Contact1">PIC / Kontak Sales</Label>
					<input
						type="text"
						id="Contact1"
						name="Contact1"
						bind:value={supplierForm.Contact1}
						maxlength="15"
						placeholder="Nama penanggung jawab"
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
						bind:value={supplierForm.Job1}
						maxlength="15"
						placeholder="Contoh: Sales Mgr"
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
						bind:value={supplierForm.Email}
						maxlength="40"
						placeholder="sales@supplier.com"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- No Telepon 1 -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Phone1">No. Telepon 1</Label>
					<input
						type="text"
						id="Phone1"
						name="Phone1"
						bind:value={supplierForm.Phone1}
						maxlength="15"
						placeholder="0812xxxx / (031) xxx"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- No Telepon 2 -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Phone2">No. Telepon 2</Label>
					<input
						type="text"
						id="Phone2"
						name="Phone2"
						bind:value={supplierForm.Phone2}
						maxlength="15"
						placeholder="Opsional"
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
						bind:value={supplierForm.Fax1}
						maxlength="15"
						placeholder="Opsional"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Alamat Utama -->
				<div class="space-y-1.5 lg:col-span-12">
					<Label for="Address1">Alamat Kantor / Pabrik Utama</Label>
					<input
						type="text"
						id="Address1"
						name="Address1"
						bind:value={supplierForm.Address1}
						maxlength="255"
						placeholder="Jalan, Nomor, Kawasan Industri..."
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
						bind:value={supplierForm.City}
						maxlength="100"
						placeholder="SURABAYA"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm uppercase"
					/>
				</div>

				<!-- Provinsi -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="Provinsi">Provinsi</Label>
					<input
						type="text"
						id="Provinsi"
						name="Provinsi"
						bind:value={supplierForm.Provinsi}
						maxlength="100"
						placeholder="JAWA TIMUR"
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
						bind:value={supplierForm.Negara}
						maxlength="100"
						placeholder="INDONESIA"
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
						bind:value={supplierForm.PostalCode}
						maxlength="5"
						placeholder="60293"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>
			</div>
		</div>

		<!-- Bagian 3: Pajak, Rekening & Catatan -->
		<div class="space-y-3">
			<div class="flex items-center gap-2 border-b-2 border-border/40 pb-1.5">
				<span class="text-xs font-black uppercase tracking-wider text-primary">3. Pajak, Perbankan & Catatan</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
				<!-- NPWP -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="TaxID">NPWP / Tax ID</Label>
					<input
						type="text"
						id="TaxID"
						name="TaxID"
						bind:value={supplierForm.TaxID}
						maxlength="25"
						placeholder="01.234.567.8-000.000"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Nama Bank -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="Bank">Nama Bank Rekening</Label>
					<input
						type="text"
						id="Bank"
						name="Bank"
						bind:value={supplierForm.Bank}
						maxlength="20"
						placeholder="BCA / Mandiri / BRI"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm uppercase"
					/>
				</div>

				<!-- Nomor Rekening -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="NoRek">Nomor Rekening</Label>
					<input
						type="text"
						id="NoRek"
						name="NoRek"
						bind:value={supplierForm.NoRek}
						maxlength="30"
						placeholder="1234567890"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Atas Nama Rekening -->
				<div class="space-y-1.5 lg:col-span-6">
					<Label for="NamaRek">Atas Nama Rekening</Label>
					<input
						type="text"
						id="NamaRek"
						name="NamaRek"
						bind:value={supplierForm.NamaRek}
						maxlength="50"
						placeholder="PT. NAMA PERUSAHAAN"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm uppercase"
					/>
				</div>

				<!-- Catatan Purchasing -->
				<div class="space-y-1.5 lg:col-span-6">
					<Label for="NotePurchasing">Catatan Tim Purchasing</Label>
					<input
						type="text"
						id="NotePurchasing"
						name="NotePurchasing"
						bind:value={supplierForm.NotePurchasing}
						placeholder="Catatan termin pembayaran, lead time barang..."
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>
			</div>
		</div>

		<!-- Action Buttons: Batal & Simpan -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t-2 border-border/40 mt-6 sticky bottom-0 bg-card py-2 z-10">
			<Button
				type="button"
				variant="secondary"
				onclick={() => (isSupplierModalOpen = false)}
				class="h-10 border-[3px] font-black uppercase brutal-shadow-sm text-xs px-5 cursor-pointer"
			>
				Batal
			</Button>
			<Button
				type="submit"
				disabled={supplierFormSubmitting}
				class="h-10 border-[3px] font-black uppercase brutal-shadow-sm text-xs px-6 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
			>
				{supplierFormSubmitting ? 'Menyimpan...' : isEditMode ? 'Perbarui Supplier' : 'Simpan Supplier Baru'}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL DETAIL SUPPLIER ==================== -->
<Modal
	bind:open={isDetailModalOpen}
	size="2xl"
	title="Informasi Detail Rekanan Supplier"
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
					<Badge variant="secondary" class="font-mono font-bold text-xs border">
						VALAS: {selectedDetail.Curr || 'IDR'}
					</Badge>
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
					<span class="font-black uppercase text-muted-foreground block text-[10px]">Perpajakan & Status</span>
					<div class="font-mono font-bold">NPWP: {selectedDetail.TaxID || '-'}</div>
					<div>Kategori: {selectedDetail.Status || '-'}</div>
					<div>Vendor Impor: {selectedDetail.Import ? 'YA' : 'TIDAK'}</div>
					<div>Non-Lokal: {selectedDetail.NonLokal ? 'YA' : 'TIDAK'}</div>
				</div>

				<div class="p-3 rounded-lg border border-border bg-card space-y-1.5">
					<span class="font-black uppercase text-muted-foreground block text-[10px]">Perbankan Rekanan</span>
					<div class="font-bold">Bank: {selectedDetail.Bank || '-'}</div>
					<div class="font-mono font-bold">No. Rek: {selectedDetail.NoRek || '-'}</div>
					<div>A/N: {selectedDetail.NamaRek || '-'}</div>
				</div>

				{#if selectedDetail.NotePurchasing}
					<div class="p-3 rounded-lg border border-border bg-card space-y-1 sm:col-span-2">
						<span class="font-black uppercase text-muted-foreground block text-[10px]">Catatan Khusus Purchasing</span>
						<p class="font-medium text-foreground whitespace-pre-wrap">{selectedDetail.NotePurchasing}</p>
					</div>
				{/if}

				<!-- Audit Trail -->
				<div class="p-3 rounded-lg border border-border bg-muted/20 space-y-1 sm:col-span-2 text-[11px] text-muted-foreground font-mono">
					<div>Dibuat oleh: <span class="font-bold text-foreground">{selectedDetail.Username || '-'}</span> ({formatDate(selectedDetail.Userdatetime)})</div>
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
				class="border-[3px] font-black uppercase brutal-shadow-sm text-xs"
			>
				Tutup
			</Button>
		</div>
	{/snippet}
</Modal>

<!-- ==================== MODAL KONFIRMASI HAPUS ==================== -->
{#if supplierToDelete}
	<Modal
		bind:open={isDeleteModalOpen}
		size="md"
		title="Konfirmasi Hapus Supplier"
		subtitle="Tindakan ini tidak dapat dibatalkan"
		icon={Trash2}
	>
		<div class="space-y-3 py-2 text-sm">
			<p class="font-bold text-foreground">
				Apakah Anda yakin ingin menghapus data rekanan supplier berikut dari Master Data?
			</p>
			<div class="p-3 bg-rose-500/10 border-2 border-rose-500/30 rounded-xl space-y-1">
				<div class="font-mono text-xs font-black text-rose-700 dark:text-rose-300">
					{supplierToDelete.CompanyID}
				</div>
				<div class="font-black text-foreground">
					{supplierToDelete.CompanyName1}
				</div>
				<div class="text-xs text-muted-foreground">
					Kota: {supplierToDelete.City || '-'} • Valuta: {supplierToDelete.Curr || 'IDR'}
				</div>
			</div>
			<p class="text-xs text-muted-foreground font-medium">
				Catatan: Sistem akan memvalidasi apakah supplier ini sudah pernah memiliki riwayat transaksi (PO, penerimaan barang, atau pembayaran) sebelum menghapus demi menjaga integritas data akuntansi ERP.
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
				<input type="hidden" name="companyId" value={supplierToDelete.CompanyID} />
				<Button
					type="button"
					variant="secondary"
					onclick={() => (isDeleteModalOpen = false)}
					class="border-[3px] font-black uppercase brutal-shadow-sm text-xs"
				>
					Batal
				</Button>
				<Button
					type="submit"
					disabled={deleteSubmitting}
					class="border-[3px] font-black uppercase brutal-shadow-sm text-xs bg-rose-600 text-white hover:bg-rose-700"
				>
					{deleteSubmitting ? 'Menghapus...' : 'Ya, Hapus Supplier'}
				</Button>
			</form>
		{/snippet}
	</Modal>
{/if}
