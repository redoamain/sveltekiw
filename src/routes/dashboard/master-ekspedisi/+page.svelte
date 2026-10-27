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
		Truck,
		Search,
		Plus,
		Download,
		Printer,
		Edit3,
		Trash2,
		Eye,
		RotateCcw,
		FileText,
		CheckCircle2,
		AlertCircle,
		Building2,
		Sparkles,
		RefreshCw,
		Hash,
		User,
		Calendar
	} from '@lucide/svelte';
	import type { MasterEkspedisi } from '$lib/server/master-ekspedisi';

	let { data, form } = $props();

	let loading = $state(false);
	let exportLoading = $state(false);

	let lastId = $state('');
	let nextId = $state('');

	// Sinkronisasi data load
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
			isEkspedisiModalOpen = false;
			isDeleteModalOpen = false;
		} else if (form?.error) {
			toast.error('Gagal', form.error);
		}
	});

	// ==================== STATE MODAL CREATE & EDIT ====================
	let isEkspedisiModalOpen = $state(false);
	let isEditMode = $state(false);
	let ekspedisiFormSubmitting = $state(false);
	let isAutoEkspedisiId = $state(true);
	let fetchingNextId = $state(false);

	let ekspedisiForm = $state({
		ekspedisiID: '',
		Nama: '',
		NoNPWP: '',
		SupplierID: ''
	});

	let nameDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	async function refreshNextId(suggestName?: string) {
		fetchingNextId = true;
		try {
			const query = suggestName ? `?name=${encodeURIComponent(suggestName)}` : '';
			const res = await fetch(`/api/master-ekspedisi/next-id${query}`);
			if (res.ok) {
				const json = await res.json();
				if (json.nextId) {
					nextId = json.nextId;
					lastId = json.lastId || lastId;
					if (isAutoEkspedisiId && !isEditMode) {
						ekspedisiForm.ekspedisiID = json.nextId;
					}
				}
			}
		} catch (err) {
			console.error('Gagal mengambil nextId ekspedisi:', err);
		} finally {
			fetchingNextId = false;
		}
	}

	function handleNameInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		ekspedisiForm.Nama = val;

		if (isAutoEkspedisiId && !isEditMode && val.trim().length >= 2) {
			if (nameDebounceTimer) clearTimeout(nameDebounceTimer);
			nameDebounceTimer = setTimeout(() => {
				refreshNextId(val);
			}, 300);
		}
	}

	function openCreateModal() {
		isEditMode = false;
		isAutoEkspedisiId = true;
		ekspedisiForm = {
			ekspedisiID: nextId || 'EXP01',
			Nama: '',
			NoNPWP: '',
			SupplierID: ''
		};
		isEkspedisiModalOpen = true;
		refreshNextId();
	}

	function openEditModal(item: MasterEkspedisi) {
		isEditMode = true;
		isAutoEkspedisiId = false;
		ekspedisiForm = {
			ekspedisiID: item.ekspedisiID,
			Nama: item.Nama,
			NoNPWP: item.NoNPWP || '',
			SupplierID: item.SupplierID || ''
		};
		isEkspedisiModalOpen = true;
	}

	// ==================== STATE MODAL DETAIL ====================
	let isDetailModalOpen = $state(false);
	let detailItem = $state<MasterEkspedisi | null>(null);

	function openDetailModal(item: MasterEkspedisi) {
		detailItem = item;
		isDetailModalOpen = true;
	}

	// Auto buka modal detail jika ada parameter id di url
	$effect(() => {
		if (data?.detail && !isDetailModalOpen && !isEkspedisiModalOpen) {
			detailItem = data.detail;
			isDetailModalOpen = true;
		}
	});

	// ==================== STATE MODAL DELETE ====================
	let isDeleteModalOpen = $state(false);
	let itemToDelete = $state<MasterEkspedisi | null>(null);
	let deleteSubmitting = $state(false);

	function openDeleteModal(item: MasterEkspedisi) {
		itemToDelete = item;
		isDeleteModalOpen = true;
	}

	// ==================== CETAK & EXPORT ====================
	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Master Data Ekspedisi - KIW ERP</title>
</svelte:head>

<LoadingOverlay show={loading} message="Memuat data master ekspedisi..." />

<div class="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
	<!-- Page Header -->
	<PageHeader
		title="Master Ekspedisi"
		description="Kelola data rekanan ekspedisi dan kargo pengiriman (tabel taEkspedisi)"
	>
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<!-- Tombol Tambah Ekspedisi -->
				<Button
					type="button"
					onclick={openCreateModal}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<Plus class="size-4 mr-1" />
					Tambah Ekspedisi
				</Button>

				<!-- Form Export Excel -->
				<form
					method="post"
					action="/api/master-ekspedisi/export"
					class="inline-block"
					onsubmit={() => {
						exportLoading = true;
						setTimeout(() => (exportLoading = false), 2500);
					}}
				>
					<input type="hidden" name="q" value={data.q} />
					<input type="hidden" name="hasNpwp" value={data.hasNpwp} />
					<input type="hidden" name="hasSupplier" value={data.hasSupplier} />

					<Button
						type="submit"
						variant="outline"
						disabled={exportLoading}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export Excel seluruh data sesuai filter"
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
					title="Cetak daftar ekspedisi"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Summary Metrics Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Ekspedisi -->
		<div
			class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between"
		>
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Ekspedisi</span>
				<Truck class="size-4 text-primary" />
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

		<!-- Memiliki NPWP -->
		<div
			class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5"
		>
			<div class="flex items-center justify-between text-muted-foreground">
				<span
					class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
				>
					Memiliki NPWP
				</span>
				<CheckCircle2 class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
					{data.stats.totalWithNPWP.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.stats.total > 0
						? Math.round((data.stats.totalWithNPWP / data.stats.total) * 100)
						: 0}% ber-NPWP sah
				</p>
			</div>
		</div>

		<!-- Terhubung Supplier -->
		<div
			class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-violet-500/5"
		>
			<div class="flex items-center justify-between text-muted-foreground">
				<span
					class="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-400"
				>
					Rekanan Supplier
				</span>
				<Building2 class="size-4 text-violet-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-violet-700 dark:text-violet-400">
					{data.stats.totalWithSupplier.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Terkait vendor di taSupplier
				</p>
			</div>
		</div>

		<!-- Tanpa NPWP -->
		<div
			class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-amber-500/5"
		>
			<div class="flex items-center justify-between text-muted-foreground">
				<span
					class="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400"
				>
					Tanpa NPWP
				</span>
				<AlertCircle class="size-4 text-amber-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-amber-700 dark:text-amber-400">
					{data.stats.totalWithoutNPWP.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Belum melengkapi NPWP
				</p>
			</div>
		</div>
	</div>

	<!-- Filter & Search Form -->
	<form
		method="get"
		action="/dashboard/master-ekspedisi"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
			<!-- Input Pencarian -->
			<div class="space-y-1.5 lg:col-span-5">
				<Label for="q">Pencarian Ekspedisi</Label>
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<input
						type="text"
						id="q"
						name="q"
						value={data.q}
						placeholder="Cari kode (AG001), nama kargo, NPWP, supplier..."
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] pl-9 pr-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
					/>
				</div>
			</div>

			<!-- Filter NPWP -->
			<div class="space-y-1.5 lg:col-span-3">
				<Label for="hasNpwp">Status NPWP</Label>
				<select
					id="hasNpwp"
					name="hasNpwp"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="" selected={!data.hasNpwp}>Semua Status NPWP</option>
					<option value="yes" selected={data.hasNpwp === 'yes'}>Memiliki NPWP</option>
					<option value="no" selected={data.hasNpwp === 'no'}>Tanpa NPWP</option>
				</select>
			</div>

			<!-- Filter Relasi Supplier -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="hasSupplier">Relasi Supplier</Label>
				<select
					id="hasSupplier"
					name="hasSupplier"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="" selected={!data.hasSupplier}>Semua Relasi</option>
					<option value="yes" selected={data.hasSupplier === 'yes'}>Terhubung Supplier</option>
					<option value="no" selected={data.hasSupplier === 'no'}>Bukan Supplier</option>
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

				{#if data.q || data.hasNpwp || data.hasSupplier}
					<a
						href="/dashboard/master-ekspedisi"
						class="h-10 px-3 bg-muted hover:bg-muted/80 text-foreground border-[3px] border-border rounded-lg inline-flex items-center justify-center brutal-shadow-sm text-xs font-black uppercase"
						title="Reset Filter"
					>
						<RotateCcw class="size-4" />
					</a>
				{/if}
			</div>
		</div>
	</form>

	<!-- Tabel Data Master Ekspedisi -->
	<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
		<div
			class="flex items-center justify-between p-4 border-b-2 border-border/40 bg-muted/20"
		>
			<div class="flex items-center gap-2">
				<Truck class="size-5 text-primary" />
				<h2 class="text-sm font-black uppercase tracking-wide">
					Daftar Ekspedisi ({data.total.toLocaleString('id-ID')})
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
						<TableHead class="font-black text-xs uppercase tracking-wider text-center w-12"
							>No</TableHead
						>
						<TableHead class="font-black text-xs uppercase tracking-wider w-32">Kode</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider">Nama Ekspedisi</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider">Nomor NPWP</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider"
							>Rekanan Supplier</TableHead
						>
						<TableHead class="font-black text-xs uppercase tracking-wider"
							>Audit / Pembuat</TableHead
						>
						<TableHead class="font-black text-xs uppercase tracking-wider text-center w-28"
							>Aksi</TableHead
						>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableEmpty
							colspan={7}
							message={data.q || data.hasNpwp || data.hasSupplier
								? 'Tidak ada ekspedisi yang cocok dengan kriteria pencarian / filter Anda.'
								: 'Belum ada data ekspedisi tersimpan di database.'}
						/>
					{:else}
						{#each data.rows as row, idx (row.ekspedisiID)}
							<TableRow class="hover:bg-muted/40 transition-colors">
								<!-- No Urut -->
								<TableCell class="text-center font-mono text-xs font-bold text-muted-foreground">
									{(data.page - 1) * data.pageSize + idx + 1}
								</TableCell>

								<!-- Kode Ekspedisi -->
								<TableCell>
									<span
										class="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-black bg-primary/10 text-primary border border-primary/30"
									>
										{row.ekspedisiID}
									</span>
								</TableCell>

								<!-- Nama Ekspedisi -->
								<TableCell>
									<div class="font-black text-sm text-foreground">
										{row.Nama}
									</div>
								</TableCell>

								<!-- NPWP -->
								<TableCell>
									{#if row.NoNPWP}
										<div class="font-mono text-xs font-bold text-foreground">
											{row.NoNPWP}
										</div>
									{:else}
										<span class="text-xs text-muted-foreground italic">-</span>
									{/if}
								</TableCell>

								<!-- Rekanan Supplier -->
								<TableCell>
									{#if row.SupplierID}
										<div class="space-y-0.5">
											<div class="flex items-center gap-1.5">
												<span
													class="inline-flex items-center px-1.5 py-0.2 rounded font-mono text-[11px] font-bold bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20"
												>
													{row.SupplierID}
												</span>
											</div>
											{#if row.SupplierName}
												<div class="text-xs font-bold text-muted-foreground truncate max-w-[220px]">
													{row.SupplierName}
												</div>
											{/if}
										</div>
									{:else}
										<span class="text-xs text-muted-foreground italic">-</span>
									{/if}
								</TableCell>

								<!-- Audit / User -->
								<TableCell>
									<div class="text-xs space-y-0.5">
										<div class="font-bold text-foreground">
											{row.UserName || '-'}
										</div>
										<div class="text-[11px] text-muted-foreground font-mono">
											{row.UserDateTime
												? row.UserDateTime.replace('T', ' ').slice(0, 16)
												: '-'}
										</div>
									</div>
								</TableCell>

								<!-- Kolom Aksi -->
								<TableCell class="text-center">
									<div class="flex items-center justify-center gap-1">
										<!-- Detail View -->
										<button
											type="button"
											onclick={() => openDetailModal(row)}
											class="p-1.5 rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer border border-border"
											title="Lihat Detail Ekspedisi"
										>
											<Eye class="size-3.5" />
										</button>

										<!-- Edit Button -->
										<button
											type="button"
											onclick={() => openEditModal(row)}
											class="p-1.5 rounded-md hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer border border-amber-500/30"
											title="Ubah Ekspedisi"
										>
											<Edit3 class="size-3.5" />
										</button>

										<!-- Delete Button -->
										<button
											type="button"
											onclick={() => openDeleteModal(row)}
											class="p-1.5 rounded-md hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer border border-rose-500/30"
											title="Hapus Ekspedisi"
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
				basePath="/dashboard/master-ekspedisi"
				params={{
					q: data.q || undefined,
					hasNpwp: data.hasNpwp || undefined,
					hasSupplier: data.hasSupplier || undefined
				}}
			/>
		</div>
	</div>
</div>

<!-- ==================== MODAL TAMBAH / EDIT EKSPEDISI ==================== -->
<Modal
	bind:open={isEkspedisiModalOpen}
	size="xl"
	title={isEditMode
		? `Ubah Data Ekspedisi: ${ekspedisiForm.Nama}`
		: 'Tambah Rekanan Ekspedisi Baru'}
	subtitle={isEditMode
		? `Kode Ekspedisi: ${ekspedisiForm.ekspedisiID}`
		: 'Masukkan data kargo / armada pengiriman ke database ERP'}
	icon={Truck}
>
	<form
		method="post"
		action="?/save"
		use:enhance={() => {
			ekspedisiFormSubmitting = true;
			return async ({ update }) => {
				ekspedisiFormSubmitting = false;
				await update();
			};
		}}
		class="space-y-4"
	>
		<input type="hidden" name="isEdit" value={isEditMode ? 'true' : 'false'} />

		<!-- Form Row: Kode Ekspedisi -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between">
				<Label for="modal_ekspedisiID" class="text-xs font-black uppercase">
					Kode Ekspedisi (Maks. 5 Karakter) <span class="text-rose-500">*</span>
				</Label>
				{#if !isEditMode}
					<div class="flex items-center gap-2">
						<label class="text-[11px] font-bold text-muted-foreground flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={isAutoEkspedisiId}
								onchange={() => {
									if (isAutoEkspedisiId) refreshNextId(ekspedisiForm.Nama);
								}}
								class="rounded border-border"
							/>
							Otomatis Sesuai Nama
						</label>
						<button
							type="button"
							onclick={() => refreshNextId(ekspedisiForm.Nama)}
							disabled={fetchingNextId}
							class="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
						>
							<RefreshCw class="size-3 {fetchingNextId ? 'animate-spin' : ''}" />
							Tebak Kode
						</button>
					</div>
				{/if}
			</div>

			<div class="relative">
				<input
					type="text"
					id="modal_ekspedisiID"
					name="ekspedisiID"
					maxlength={5}
					bind:value={ekspedisiForm.ekspedisiID}
					readonly={isEditMode}
					required
					placeholder="Contoh: AG001, JNT01"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-black uppercase brutal-shadow-sm focus:outline-hidden {isEditMode
						? 'bg-muted cursor-not-allowed opacity-80'
						: ''}"
				/>
			</div>
			<p class="text-[11px] font-bold text-muted-foreground">
				{#if isEditMode}
					Kode ekspedisi bersifat unik dan tidak dapat diubah setelah dibuat.
				{:else}
					Kode unik maksimal 5 karakter alfanumerik (misal: AN1, BEN01, EXP01).
				{/if}
			</p>
		</div>

		<!-- Form Row: Nama Ekspedisi -->
		<div class="space-y-1.5">
			<Label for="modal_Nama" class="text-xs font-black uppercase">
				Nama Ekspedisi / Kargo <span class="text-rose-500">*</span>
			</Label>
			<input
				type="text"
				id="modal_Nama"
				name="Nama"
				maxlength={50}
				value={ekspedisiForm.Nama}
				oninput={handleNameInput}
				required
				placeholder="Contoh: PT. ANDALAN PACIFIC SAMUDRA"
				class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
			/>
			<p class="text-[11px] font-bold text-muted-foreground">
				Nama lengkap perusahaan kargo atau ekspedisi (maks. 50 karakter).
			</p>
		</div>

		<!-- Form Row: Nomor NPWP -->
		<div class="space-y-1.5">
			<Label for="modal_NoNPWP" class="text-xs font-black uppercase">
				Nomor Pokok Wajib Pajak (NPWP)
			</Label>
			<div class="relative">
				<FileText class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
				<input
					type="text"
					id="modal_NoNPWP"
					name="NoNPWP"
					maxlength={20}
					bind:value={ekspedisiForm.NoNPWP}
					placeholder="Contoh: 01.715.936.9-605.000"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] pl-9 pr-3 font-mono text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				/>
			</div>
			<p class="text-[11px] font-bold text-muted-foreground">
				Opsional. Format NPWP 15 atau 16 digit sesuai administrasi perpajakan.
			</p>
		</div>

		<!-- Form Row: Relasi Rekanan Supplier -->
		<div class="space-y-1.5">
			<Label for="modal_SupplierID" class="text-xs font-black uppercase">
				Tautkan ke Rekanan Supplier (taSupplier)
			</Label>
			<div class="relative">
				<select
					id="modal_SupplierID"
					name="SupplierID"
					bind:value={ekspedisiForm.SupplierID}
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="">-- Tidak Terhubung / Bukan Supplier --</option>
					{#each data.suppliers as sup (sup.CompanyID)}
						<option value={sup.CompanyID}>
							{sup.CompanyID} - {sup.CompanyName1}
						</option>
					{/each}
				</select>
			</div>
			<p class="text-[11px] font-bold text-muted-foreground">
				Pilih jika ekspedisi ini juga tercatat sebagai vendor/supplier pembayaran tagihan freight.
			</p>
		</div>

		<!-- Action Footer -->
		<div class="flex items-center justify-end gap-2 pt-4 border-t-2 border-border/40">
			<Button
				type="button"
				variant="outline"
				onclick={() => (isEkspedisiModalOpen = false)}
				class="h-10 border-[3px] font-black uppercase tracking-wide text-xs cursor-pointer"
			>
				Batal
			</Button>

			<Button
				type="submit"
				disabled={ekspedisiFormSubmitting}
				class="h-10 border-[3px] font-black uppercase tracking-wide text-xs cursor-pointer min-w-[120px]"
			>
				{#if ekspedisiFormSubmitting}
					<RefreshCw class="size-4 mr-1 animate-spin" />
					Menyimpan...
				{:else}
					<Sparkles class="size-4 mr-1" />
					{isEditMode ? 'Simpan Perubahan' : 'Tambah Ekspedisi'}
				{/if}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL DETAIL EKSPEDISI ==================== -->
<Modal
	bind:open={isDetailModalOpen}
	size="lg"
	title="Detail Ekspedisi"
	subtitle={detailItem ? `${detailItem.Nama} (${detailItem.ekspedisiID})` : 'Informasi Lengkap'}
	icon={Truck}
>
	{#if detailItem}
		<div class="space-y-4">
			<!-- Banner Utama -->
			<div class="bg-muted/40 border-[3px] border-border rounded-xl p-4 brutal-shadow-sm flex items-start justify-between">
				<div>
					<span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-black bg-primary/20 text-primary border border-primary/40">
						{detailItem.ekspedisiID}
					</span>
					<h3 class="text-base font-black text-foreground mt-1">
						{detailItem.Nama}
					</h3>
				</div>
				<Truck class="size-8 text-primary/60 shrink-0" />
			</div>

			<!-- Grid Informasi -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
				<!-- NPWP -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<FileText class="size-3.5 text-primary" />
						Nomor NPWP
					</div>
					<div class="font-mono font-black text-sm text-foreground">
						{detailItem.NoNPWP || 'Tidak ada NPWP'}
					</div>
				</div>

				<!-- Relasi Supplier -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Building2 class="size-3.5 text-violet-500" />
						Relasi Supplier
					</div>
					{#if detailItem.SupplierID}
						<div class="font-mono font-black text-xs text-violet-700 dark:text-violet-400">
							{detailItem.SupplierID}
						</div>
						{#if detailItem.SupplierName}
							<div class="font-bold text-foreground">
								{detailItem.SupplierName}
							</div>
						{/if}
					{:else}
						<div class="font-bold text-muted-foreground italic">
							Tidak terhubung supplier
						</div>
					{/if}
				</div>

				<!-- User Pembuat -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<User class="size-3.5 text-muted-foreground" />
						Dibuat Oleh
					</div>
					<div class="font-bold text-foreground">
						{detailItem.UserName || '-'}
					</div>
					<div class="font-mono text-[11px] text-muted-foreground">
						{detailItem.UserDateTime ? detailItem.UserDateTime.replace('T', ' ').slice(0, 19) : '-'}
					</div>
				</div>

				<!-- User Pengubah -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Calendar class="size-3.5 text-muted-foreground" />
						Terakhir Diperbarui
					</div>
					<div class="font-bold text-foreground">
						{detailItem.UserUpdateName || '-'}
					</div>
					<div class="font-mono text-[11px] text-muted-foreground">
						{detailItem.UserUpdateDate ? detailItem.UserUpdateDate.replace('T', ' ').slice(0, 19) : '-'}
					</div>
				</div>
			</div>

			<!-- Footer Modal Detail -->
			<div class="flex items-center justify-end gap-2 pt-3 border-t-2 border-border/40">
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						isDetailModalOpen = false;
						if (detailItem) openEditModal(detailItem);
					}}
					class="h-9 border-[3px] font-black uppercase text-xs cursor-pointer"
				>
					<Edit3 class="size-3.5 mr-1" />
					Ubah Data
				</Button>

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

<!-- ==================== MODAL KONFIRMASI HAPUS ==================== -->
<ConfirmModal
	bind:open={isDeleteModalOpen}
	title="Hapus Ekspedisi?"
	message={`Apakah Anda yakin ingin menghapus ekspedisi "${itemToDelete?.Nama}" (${itemToDelete?.ekspedisiID})? Sistem akan mengecek apakah ekspedisi ini pernah digunakan dalam surat jalan atau mutasi.`}
	confirmLabel="Ya, Hapus Ekspedisi"
	cancelLabel="Batal"
	confirmVariant="danger"
	loading={deleteSubmitting}
	onconfirm={async () => {
		if (!itemToDelete) return;
		deleteSubmitting = true;
		const formData = new FormData();
		formData.append('ekspedisiID', itemToDelete.ekspedisiID);

		try {
			const res = await fetch('?/delete', {
				method: 'POST',
				body: formData
			});
			if (res.ok) {
				toast.success('Berhasil', `Ekspedisi "${itemToDelete.Nama}" telah dihapus.`);
				isDeleteModalOpen = false;
				window.location.reload();
			} else {
				const json = await res.json().catch(() => ({}));
				toast.error('Gagal', json?.error || 'Gagal menghapus ekspedisi.');
			}
		} catch (err: any) {
			toast.error('Gagal', err?.message || 'Gagal menghapus ekspedisi.');
		} finally {
			deleteSubmitting = false;
		}
	}}
/>
