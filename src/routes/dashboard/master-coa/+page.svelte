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
		FolderTree,
		Search,
		Plus,
		Download,
		Printer,
		Edit3,
		Trash2,
		Eye,
		RotateCcw,
		Landmark,
		Wallet,
		Coins,
		Scale,
		Receipt,
		CreditCard,
		TrendingUp,
		Sparkles,
		RefreshCw,
		FileText,
		CheckCircle2,
		XCircle,
		Ban,
		Layers,
		Building2,
		Check,
		AlertCircle
	} from '@lucide/svelte';
	import type { MasterCOA } from '$lib/server/master-coa';

	let { data, form } = $props();

	let loading = $state(false);
	let exportLoading = $state(false);

	// Handle response actions form (save / delete / toggleStatus)
	$effect(() => {
		if (form?.success) {
			if (form.message) toast.success('Berhasil', form.message);
			isCOAModalOpen = false;
			isDeleteModalOpen = false;
		} else if (form?.error) {
			toast.error('Gagal', form.error);
		}
	});

	// ==================== STATE MODAL CREATE & EDIT ====================
	let isCOAModalOpen = $state(false);
	let isEditMode = $state(false);
	let coaFormSubmitting = $state(false);

	let coaForm = $state({
		Acc: '',
		AccName: '',
		AccName2: '',
		AccGroup: '1',
		AccType: '2',
		AccPos: 'D',
		AccParent: '',
		AccCurr: 'IDR',
		AccountBank: '',
		Remark: '',
		Delisted: false
	});

	function openCreateModal() {
		isEditMode = false;
		coaForm = {
			Acc: '',
			AccName: '',
			AccName2: '',
			AccGroup: '1',
			AccType: '2',
			AccPos: 'D',
			AccParent: '',
			AccCurr: 'IDR',
			AccountBank: '',
			Remark: '',
			Delisted: false
		};
		isCOAModalOpen = true;
	}

	function openEditModal(item: MasterCOA) {
		isEditMode = true;
		coaForm = {
			Acc: item.Acc,
			AccName: item.AccName,
			AccName2: item.AccName2 || '',
			AccGroup: item.AccGroup || '1',
			AccType: item.AccType || '2',
			AccPos: item.AccPos || 'D',
			AccParent: item.AccParent || '',
			AccCurr: item.AccCurr || 'IDR',
			AccountBank: item.AccountBank || '',
			Remark: item.Remark || '',
			Delisted: item.Delisted
		};
		isCOAModalOpen = true;
	}

	// ==================== STATE MODAL DETAIL ====================
	let isDetailModalOpen = $state(false);
	let detailItem = $state<MasterCOA | null>(null);

	function openDetailModal(item: MasterCOA) {
		detailItem = item;
		isDetailModalOpen = true;
	}

	// Auto buka modal detail jika ada parameter id di url
	$effect(() => {
		if (data?.detail && !isDetailModalOpen && !isCOAModalOpen) {
			detailItem = data.detail;
			isDetailModalOpen = true;
		}
	});

	// ==================== STATE MODAL DELETE ====================
	let isDeleteModalOpen = $state(false);
	let itemToDelete = $state<MasterCOA | null>(null);
	let deleteSubmitting = $state(false);

	function openDeleteModal(item: MasterCOA) {
		itemToDelete = item;
		isDeleteModalOpen = true;
	}

	// Helper label tipe akun
	function getAccTypeBadge(type: string | null) {
		switch (type) {
			case '1':
				return { label: 'Header', class: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' };
			case '3':
				return { label: 'Kas', class: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
			case '4':
				return { label: 'Bank', class: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' };
			default:
				return { label: 'Detail', class: 'bg-muted text-muted-foreground border-border' };
		}
	}

	// Helper warna badge group akun
	function getGroupBadgeClass(groupId: string | null) {
		switch (groupId) {
			case '1':
				return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
			case '2':
				return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30';
			case '3':
				return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
			case '4':
				return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
			case '5':
			case '6':
				return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30';
			default:
				return 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30';
		}
	}

	function formatRupiah(val: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(val || 0);
	}

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Bagan Akun (COA) - KIW ERP</title>
</svelte:head>

<LoadingOverlay show={loading} message="Memuat data bagan akun (taGLAcc)..." />

<div class="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
	<!-- Page Header -->
	<PageHeader
		title="Bagan Akun / COA (taGLAcc)"
		description="Kelola daftar kode perkiraan akuntansi, posisi normal debit/kredit, dan struktur hierarki akun"
	>
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<!-- Tombol Tambah Akun -->
				<Button
					type="button"
					onclick={openCreateModal}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<Plus class="size-4 mr-1" />
					Tambah Akun
				</Button>

				<!-- Form Export Excel -->
				<form
					method="post"
					action="/api/master-coa/export"
					class="inline-block"
					onsubmit={() => {
						exportLoading = true;
						setTimeout(() => (exportLoading = false), 2500);
					}}
				>
					<input type="hidden" name="q" value={data.q} />
					<input type="hidden" name="group" value={data.group} />
					<input type="hidden" name="type" value={data.type} />
					<input type="hidden" name="pos" value={data.pos} />
					<input type="hidden" name="curr" value={data.curr} />
					<input type="hidden" name="status" value={data.status} />

					<Button
						type="submit"
						variant="outline"
						disabled={exportLoading}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export seluruh bagan akun sesuai filter ke Excel"
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
					title="Cetak daftar bagan akun"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Summary Metrics Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Akun -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Bagan Akun</span>
				<FolderTree class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.total.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.stats.totalActive} Aktif, {data.stats.totalDelisted} Nonaktif
				</p>
			</div>
		</div>

		<!-- Akun Aktiva & Kas/Bank -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-blue-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
					Aset / Aktiva (1)
				</span>
				<Landmark class="size-4 text-blue-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-blue-700 dark:text-blue-400">
					{data.stats.totalAktiva.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Termasuk {data.stats.totalKasBank} Akun Kas & Bank
				</p>
			</div>
		</div>

		<!-- Kewajiban & Ekuitas -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-rose-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
					Hutang & Modal (2,3)
				</span>
				<Scale class="size-4 text-rose-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-rose-700 dark:text-rose-400">
					{(data.stats.totalHutang + data.stats.totalModal).toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.stats.totalHutang} Hutang, {data.stats.totalModal} Modal
				</p>
			</div>
		</div>

		<!-- Pendapatan & Beban -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
					Laba / Rugi (4,5,6)
				</span>
				<TrendingUp class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
					{(data.stats.totalPendapatan + data.stats.totalBiaya).toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.stats.totalPendapatan} Pendapatan, {data.stats.totalBiaya} Beban / HPP
				</p>
			</div>
		</div>
	</div>

	<!-- Filter & Search Form -->
	<form
		method="get"
		action="/dashboard/master-coa"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
			<!-- Input Pencarian -->
			<div class="space-y-1.5 lg:col-span-4">
				<Label for="q">Pencarian Akun</Label>
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<input
						type="text"
						id="q"
						name="q"
						value={data.q}
						placeholder="Cari kode (1101...), nama perkiraan, rekening bank..."
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] pl-9 pr-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
					/>
				</div>
			</div>

			<!-- Filter Kelompok Akun -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="group">Kelompok</Label>
				<select
					id="group"
					name="group"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="" selected={!data.group}>Semua Kelompok</option>
					{#each data.groups as grp (grp.GroupID)}
						<option value={grp.GroupID} selected={data.group === grp.GroupID}>
							{grp.GroupID} - {grp.GroupName}
						</option>
					{/each}
				</select>
			</div>

			<!-- Filter Tipe Akun -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="type">Tipe Akun</Label>
				<select
					id="type"
					name="type"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="" selected={!data.type}>Semua Tipe</option>
					<option value="1" selected={data.type === '1'}>Header / Induk</option>
					<option value="2" selected={data.type === '2'}>Detail / Umum</option>
					<option value="3" selected={data.type === '3'}>Kas Tunai</option>
					<option value="4" selected={data.type === '4'}>Rekening Bank</option>
				</select>
			</div>

			<!-- Filter Posisi Normal -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="pos">Posisi</Label>
				<select
					id="pos"
					name="pos"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-2 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="" selected={!data.pos}>Semua</option>
					<option value="D" selected={data.pos === 'D'}>Debit</option>
					<option value="K" selected={data.pos === 'K'}>Kredit</option>
				</select>
			</div>

			<!-- Filter Status -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="status">Status</Label>
				<select
					id="status"
					name="status"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-2 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="" selected={!data.status}>Semua</option>
					<option value="active" selected={data.status === 'active'}>Aktif</option>
					<option value="delisted" selected={data.status === 'delisted'}>Nonaktif</option>
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

				{#if data.q || data.group || data.type || data.pos || data.curr || data.status}
					<a
						href="/dashboard/master-coa"
						class="h-10 px-3 bg-muted hover:bg-muted/80 text-foreground border-[3px] border-border rounded-lg inline-flex items-center justify-center brutal-shadow-sm text-xs font-black uppercase"
						title="Reset Filter"
					>
						<RotateCcw class="size-4" />
					</a>
				{/if}
			</div>
		</div>
	</form>

	<!-- Tabel Data Master COA -->
	<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
		<div class="flex items-center justify-between p-4 border-b-2 border-border/40 bg-muted/20">
			<div class="flex items-center gap-2">
				<FolderTree class="size-5 text-primary" />
				<h2 class="text-sm font-black uppercase tracking-wide">
					Daftar Bagan Akun ({data.total.toLocaleString('id-ID')})
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
						<TableHead class="font-black text-xs uppercase tracking-wider w-36">Kode Akun</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider">Nama Perkiraan</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider">Kelompok</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider">Tipe</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider text-center">Posisi</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider text-center">Valuta</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider text-right">Saldo Berjalan (IDR)</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider text-center">Status</TableHead>
						<TableHead class="font-black text-xs uppercase tracking-wider text-center w-28">Aksi</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableEmpty
							colspan={10}
							message={data.q || data.group || data.type || data.pos || data.status
								? 'Tidak ada akun perkiraan yang sesuai dengan kriteria filter Anda.'
								: 'Belum ada data bagan akun tersimpan di database.'}
						/>
					{:else}
						{#each data.rows as row, idx (row.Acc)}
							{@const typeBadge = getAccTypeBadge(row.AccType)}
							{@const isHeader = row.AccType === '1'}
							<TableRow class="hover:bg-muted/40 transition-colors {row.Delisted ? 'opacity-60 bg-muted/10' : ''} {isHeader ? 'bg-primary/5 font-black' : ''}">
								<!-- No Urut -->
								<TableCell class="text-center font-mono text-xs font-bold text-muted-foreground">
									{(data.page - 1) * data.pageSize + idx + 1}
								</TableCell>

								<!-- Kode Akun (Acc) -->
								<TableCell>
									<span
										class="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-black bg-primary/10 text-primary border border-primary/30"
									>
										{row.Acc}
									</span>
								</TableCell>

								<!-- Nama Perkiraan -->
								<TableCell>
									<div class="space-y-0.5">
										<div class="font-black text-sm text-foreground {isHeader ? 'text-primary font-black' : ''}">
											{row.AccName}
										</div>
										{#if row.AccName2}
											<div class="text-[11px] font-bold text-muted-foreground italic">
												{row.AccName2}
											</div>
										{/if}
										{#if row.AccountBank}
											<div class="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">
												Rek: {row.AccountBank}
											</div>
										{/if}
									</div>
								</TableCell>

								<!-- Kelompok -->
								<TableCell>
									<span
										class="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-bold border {getGroupBadgeClass(row.AccGroup)}"
									>
										{row.AccGroup} - {row.GroupName || 'Group ' + row.AccGroup}
									</span>
								</TableCell>

								<!-- Tipe Akun -->
								<TableCell>
									<span
										class="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-bold border {typeBadge.class}"
									>
										{typeBadge.label}
									</span>
								</TableCell>

								<!-- Posisi Normal -->
								<TableCell class="text-center">
									{#if row.AccPos === 'D'}
										<span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
											[D] Debit
										</span>
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-black bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
											[K] Kredit
										</span>
									{/if}
								</TableCell>

								<!-- Valuta -->
								<TableCell class="text-center font-mono text-xs font-bold text-foreground">
									{row.AccCurr || 'IDR'}
								</TableCell>

								<!-- Saldo Berjalan IDR -->
								<TableCell class="text-right font-mono text-xs font-bold text-foreground">
									{formatRupiah(row.AmountRp)}
								</TableCell>

								<!-- Status -->
								<TableCell class="text-center">
									{#if row.Delisted}
										<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
											Nonaktif
										</span>
									{:else}
										<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
											Aktif
										</span>
									{/if}
								</TableCell>

								<!-- Kolom Aksi -->
								<TableCell class="text-center">
									<div class="flex items-center justify-center gap-1">
										<!-- Detail View -->
										<button
											type="button"
											onclick={() => openDetailModal(row)}
											class="p-1.5 rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer border border-border"
											title="Lihat Detail Akun"
										>
											<Eye class="size-3.5" />
										</button>

										<!-- Edit Button -->
										<button
											type="button"
											onclick={() => openEditModal(row)}
											class="p-1.5 rounded-md hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer border border-amber-500/30"
											title="Ubah Akun"
										>
											<Edit3 class="size-3.5" />
										</button>

										<!-- Delete Button -->
										<button
											type="button"
											onclick={() => openDeleteModal(row)}
											class="p-1.5 rounded-md hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer border border-rose-500/30"
											title="Hapus Akun"
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
				basePath="/dashboard/master-coa"
				params={{
					q: data.q || undefined,
					group: data.group || undefined,
					type: data.type || undefined,
					pos: data.pos || undefined,
					curr: data.curr || undefined,
					status: data.status || undefined
				}}
			/>
		</div>
	</div>
</div>

<!-- ==================== MODAL TAMBAH / EDIT AKUN COA ==================== -->
<Modal
	bind:open={isCOAModalOpen}
	size="xl"
	title={isEditMode ? `Ubah Data Akun: ${coaForm.AccName}` : 'Tambah Akun Perkiraan Baru'}
	subtitle={isEditMode ? `Kode Akun: ${coaForm.Acc}` : 'Masukkan data kode perkiraan ke Bagan Akun (taGLAcc)'}
	icon={FolderTree}
>
	<form
		method="post"
		action="?/save"
		use:enhance={() => {
			coaFormSubmitting = true;
			return async ({ update }) => {
				coaFormSubmitting = false;
				await update();
			};
		}}
		class="space-y-4"
	>
		<input type="hidden" name="isEdit" value={isEditMode ? 'true' : 'false'} />

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<!-- Kode Akun (Acc) -->
			<div class="space-y-1.5">
				<Label for="modal_Acc" class="text-xs font-black uppercase">
					Nomor / Kode Akun <span class="text-rose-500">*</span>
				</Label>
				<input
					type="text"
					id="modal_Acc"
					name="Acc"
					maxlength={15}
					bind:value={coaForm.Acc}
					readonly={isEditMode}
					required
					placeholder="Contoh: 1101.15, 2101.01"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-black brutal-shadow-sm focus:outline-hidden {isEditMode ? 'bg-muted cursor-not-allowed opacity-80' : ''}"
				/>
				<p class="text-[11px] font-bold text-muted-foreground">
					Format kode akun maksimal 15 karakter alfanumerik.
				</p>
			</div>

			<!-- Kelompok Akun (AccGroup) -->
			<div class="space-y-1.5">
				<Label for="modal_AccGroup" class="text-xs font-black uppercase">
					Kelompok Akun <span class="text-rose-500">*</span>
				</Label>
				<select
					id="modal_AccGroup"
					name="AccGroup"
					bind:value={coaForm.AccGroup}
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					{#each data.groups as grp (grp.GroupID)}
						<option value={grp.GroupID}>
							{grp.GroupID} - {grp.GroupName}
						</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Nama Perkiraan (AccName) -->
		<div class="space-y-1.5">
			<Label for="modal_AccName" class="text-xs font-black uppercase">
				Nama Perkiraan <span class="text-rose-500">*</span>
			</Label>
			<input
				type="text"
				id="modal_AccName"
				name="AccName"
				maxlength={100}
				bind:value={coaForm.AccName}
				required
				placeholder="Contoh: Kas Kecil Operasional"
				class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
			/>
		</div>

		<!-- Nama Alias / English (AccName2) -->
		<div class="space-y-1.5">
			<Label for="modal_AccName2" class="text-xs font-black uppercase">
				Nama Alias / Bahasa Inggris (Opsional)
			</Label>
			<input
				type="text"
				id="modal_AccName2"
				name="AccName2"
				maxlength={50}
				bind:value={coaForm.AccName2}
				placeholder="Contoh: Petty Cash"
				class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
			/>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
			<!-- Tipe Akun (AccType) -->
			<div class="space-y-1.5">
				<Label for="modal_AccType" class="text-xs font-black uppercase">
					Tipe Akun
				</Label>
				<select
					id="modal_AccType"
					name="AccType"
					bind:value={coaForm.AccType}
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="1">Header / Induk</option>
					<option value="2">Detail / Umum</option>
					<option value="3">Kas Tunai</option>
					<option value="4">Rekening Bank</option>
				</select>
			</div>

			<!-- Posisi Normal (AccPos) -->
			<div class="space-y-1.5">
				<Label for="modal_AccPos" class="text-xs font-black uppercase">
					Posisi Normal
				</Label>
				<select
					id="modal_AccPos"
					name="AccPos"
					bind:value={coaForm.AccPos}
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="D">[D] Debit</option>
					<option value="K">[K] Kredit</option>
				</select>
			</div>

			<!-- Mata Uang (AccCurr) -->
			<div class="space-y-1.5">
				<Label for="modal_AccCurr" class="text-xs font-black uppercase">
					Mata Uang
				</Label>
				<select
					id="modal_AccCurr"
					name="AccCurr"
					bind:value={coaForm.AccCurr}
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="IDR">IDR (Rupiah)</option>
					<option value="USD">USD (US Dollar)</option>
				</select>
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<!-- Akun Induk (AccParent) -->
			<div class="space-y-1.5">
				<Label for="modal_AccParent" class="text-xs font-black uppercase">
					Akun Induk / Parent (Opsional)
				</Label>
				<select
					id="modal_AccParent"
					name="AccParent"
					bind:value={coaForm.AccParent}
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				>
					<option value="">-- Tanpa Induk (Tingkat Teratas) --</option>
					{#each data.parents as par (par.Acc)}
						<option value={par.Acc}>
							{par.Acc} - {par.AccName}
						</option>
					{/each}
				</select>
			</div>

			<!-- Nomor Rekening Bank (AccountBank) -->
			<div class="space-y-1.5">
				<Label for="modal_AccountBank" class="text-xs font-black uppercase">
					Nomor Rekening Bank (Jika Kas/Bank)
				</Label>
				<input
					type="text"
					id="modal_AccountBank"
					name="AccountBank"
					maxlength={25}
					bind:value={coaForm.AccountBank}
					placeholder="Contoh: 863 0108188"
					class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm focus:outline-hidden"
				/>
			</div>
		</div>

		<!-- Status Delisted (Nonaktif) -->
		<div class="flex items-center gap-2 pt-1">
			<label class="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					name="Delisted"
					value="true"
					bind:checked={coaForm.Delisted}
					class="rounded border-border"
				/>
				Tandai Akun sebagai Nonaktif (Delisted)
			</label>
		</div>

		<!-- Action Footer -->
		<div class="flex items-center justify-end gap-2 pt-4 border-t-2 border-border/40">
			<Button
				type="button"
				variant="outline"
				onclick={() => (isCOAModalOpen = false)}
				class="h-10 border-[3px] font-black uppercase tracking-wide text-xs cursor-pointer"
			>
				Batal
			</Button>

			<Button
				type="submit"
				disabled={coaFormSubmitting}
				class="h-10 border-[3px] font-black uppercase tracking-wide text-xs cursor-pointer min-w-[120px]"
			>
				{#if coaFormSubmitting}
					<RefreshCw class="size-4 mr-1 animate-spin" />
					Menyimpan...
				{:else}
					<Sparkles class="size-4 mr-1" />
					{isEditMode ? 'Simpan Perubahan' : 'Tambah Akun'}
				{/if}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL DETAIL AKUN ==================== -->
<Modal
	bind:open={isDetailModalOpen}
	size="lg"
	title="Detail Akun Perkiraan"
	subtitle={detailItem ? `${detailItem.AccName} (${detailItem.Acc})` : 'Informasi Akun'}
	icon={FolderTree}
>
	{#if detailItem}
		<div class="space-y-4">
			<!-- Banner Utama -->
			<div class="bg-muted/40 border-[3px] border-border rounded-xl p-4 brutal-shadow-sm flex items-start justify-between">
				<div>
					<span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-black bg-primary/20 text-primary border border-primary/40">
						Kode: {detailItem.Acc}
					</span>
					<h3 class="text-base font-black text-foreground mt-1">
						{detailItem.AccName}
					</h3>
					{#if detailItem.AccName2}
						<p class="text-xs text-muted-foreground italic">
							{detailItem.AccName2}
						</p>
					{/if}
				</div>
				<FolderTree class="size-8 text-primary/60 shrink-0" />
			</div>

			<!-- Grid Informasi -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
				<!-- Kelompok -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Layers class="size-3.5 text-blue-500" />
						Kelompok Akun
					</div>
					<div class="font-black text-sm text-foreground">
						{detailItem.AccGroup} - {detailItem.GroupName || 'Group ' + detailItem.AccGroup}
					</div>
				</div>

				<!-- Tipe & Posisi -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Scale class="size-3.5 text-emerald-500" />
						Tipe & Posisi Normal
					</div>
					<div class="font-bold text-foreground flex items-center gap-2">
						<span>{getAccTypeBadge(detailItem.AccType).label}</span>
						<span>•</span>
						<span class="font-mono font-black">{detailItem.AccPos === 'D' ? '[D] Debit' : '[K] Kredit'}</span>
					</div>
				</div>

				<!-- Saldo Berjalan IDR -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Coins class="size-3.5 text-amber-500" />
						Saldo Berjalan (IDR)
					</div>
					<div class="font-mono font-black text-sm text-foreground">
						{formatRupiah(detailItem.AmountRp)}
					</div>
				</div>

				<!-- Saldo Awal IDR -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Receipt class="size-3.5 text-primary" />
						Saldo Awal (IDR)
					</div>
					<div class="font-mono font-black text-sm text-foreground">
						{formatRupiah(detailItem.SAmountRp)}
					</div>
				</div>

				<!-- Akun Induk & Level -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<FolderTree class="size-3.5 text-violet-500" />
						Akun Induk (Parent)
					</div>
					<div class="font-mono font-bold text-foreground">
						{detailItem.AccParent || 'Tidak ada (Tingkat Teratas)'}
					</div>
				</div>

				<!-- Rekening Bank -->
				<div class="bg-card border-2 border-border/60 rounded-lg p-3 space-y-1">
					<div class="text-muted-foreground font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
						<Building2 class="size-3.5 text-primary" />
						Rekening Bank
					</div>
					<div class="font-mono font-bold text-foreground">
						{detailItem.AccountBank || '-'}
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
					Ubah Akun
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
	title="Hapus Akun Perkiraan?"
	message={`Apakah Anda yakin ingin menghapus akun "${itemToDelete?.AccName}" (${itemToDelete?.Acc})? Sistem akan mengecek apakah akun ini pernah memiliki transaksi di buku besar atau jurnal.`}
	confirmLabel="Ya, Hapus Akun"
	cancelLabel="Batal"
	confirmVariant="danger"
	loading={deleteSubmitting}
	onconfirm={async () => {
		if (!itemToDelete) return;
		deleteSubmitting = true;
		const formData = new FormData();
		formData.append('acc', itemToDelete.Acc);

		try {
			const res = await fetch('?/delete', {
				method: 'POST',
				body: formData
			});
			if (res.ok) {
				toast.success('Berhasil', `Akun "${itemToDelete.AccName}" telah dihapus.`);
				isDeleteModalOpen = false;
				window.location.reload();
			} else {
				const json = await res.json().catch(() => ({}));
				toast.error('Gagal', json?.error || 'Gagal menghapus akun.');
			}
		} catch (err: any) {
			toast.error('Gagal', err?.message || 'Gagal menghapus akun.');
		} finally {
			deleteSubmitting = false;
		}
	}}
/>
