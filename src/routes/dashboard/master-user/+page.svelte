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
		UserCog,
		Search,
		Plus,
		Download,
		Printer,
		Edit3,
		Trash2,
		Eye,
		EyeOff,
		KeyRound,
		ShieldCheck,
		ShieldAlert,
		CheckCircle2,
		XCircle,
		Users,
		Lock,
		Unlock,
		Briefcase,
		SlidersHorizontal,
		Settings,
		HelpCircle,
		HardDrive,
		Sparkles
	} from '@lucide/svelte';

	let { data, form } = $props();

	let loading = $state(false);
	let exportLoading = $state(false);
	let activeTab = $derived(data.activeTab || 'user');

	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	// Handle response actions form (save / delete / toggle / printer / akses)
	$effect(() => {
		if (form?.success) {
			if (form.message) toast.success('Berhasil', form.message);
			isUserModalOpen = false;
			isDeleteModalOpen = false;
			isPrinterModalOpen = false;
			isDeletePrinterModalOpen = false;
			isDetailModalOpen = false;
		} else if (form?.error) {
			toast.error('Gagal', form.error);
		}
	});

	// ==================== STATE MODAL CREATE & EDIT USER ====================
	let isUserModalOpen = $state(false);
	let isEditMode = $state(false);
	let userFormSubmitting = $state(false);
	let showPassword = $state(false);
	let formModalTab = $state<'akun' | 'menucp'>('akun');

	let userForm = $state({
		UserName: '',
		Password: '',
		Bagian: 'ACC',
		GroupID: '70',
		Aktif: true,
		kodeprint: 'global',
		salesID: '99',
		// Setting MenuCP
		groupInputOS: '99',
		groupInputMB: '99',
		groupInputKeluhan: '99',
		KeluhanCustomer: false,
		ApprovedEditRequest: 99,
		SaldoHarian: 99,
		MonitoringDoc: 99,
		ShowKursDBTR: true
	});

	// ==================== STATE MODAL DETAIL USER ====================
	let isDetailModalOpen = $state(false);
	let userDetail = $state<any>(null);

	function openDetailModal(item: any) {
		userDetail = item;
		isDetailModalOpen = true;
	}

	const DEPARTEMEN_OPTIONS = [
		{ value: 'IT', label: 'IT (Superadmin)' },
		{ value: 'ACC', label: 'Accounting & Finance' },
		{ value: 'PCS', label: 'Purchasing / Pembelian' },
		{ value: 'WH', label: 'Gudang & Logistik' },
		{ value: 'PIC', label: 'PPIC / Planning' },
		{ value: 'AS', label: 'Produksi - Assembly' },
		{ value: 'IN', label: 'Produksi - Injection' },
		{ value: 'PL', label: 'Produksi - Platting' },
		{ value: 'SP', label: 'Produksi - Spraying' },
		{ value: 'MO', label: 'Produksi - Molding' },
		{ value: 'MAR', label: 'Marketing' },
		{ value: 'EXP', label: 'Ekspor' },
		{ value: 'IMP', label: 'Impor' },
		{ value: 'BC', label: 'Bea Cukai' },
		{ value: 'RND', label: 'R&D / QC' },
		{ value: 'KONSULTAN', label: 'Konsultan' },
		{ value: 'UMUM', label: 'Operasional Umum' }
	];

	const INPUT_OS_OPTIONS = [
		{ value: '99', label: '99 - Semua Departemen (Bebas Input)' },
		{ value: 'AS', label: 'AS - Hanya Produksi Assembly' },
		{ value: 'IN', label: 'IN - Hanya Produksi Injection' },
		{ value: 'PL', label: 'PL - Hanya Produksi Platting' },
		{ value: 'SP', label: 'SP - Hanya Produksi Spraying / Spindle' },
		{ value: 'MO', label: 'MO - Hanya Produksi Molding' },
		{ value: 'BC', label: 'BC - Bea Cukai / Kawasan Berikat' }
	];

	function openCreateModal() {
		isEditMode = false;
		showPassword = true;
		formModalTab = 'akun';
		userForm = {
			UserName: '',
			Password: '',
			Bagian: 'ACC',
			GroupID: data.groups[0]?.GroupID || '70',
			Aktif: true,
			kodeprint: data.setupPrints[0]?.kode || 'global',
			salesID: '99',
			groupInputOS: '99',
			groupInputMB: '99',
			groupInputKeluhan: '99',
			KeluhanCustomer: false,
			ApprovedEditRequest: 99,
			SaldoHarian: 99,
			MonitoringDoc: 99,
			ShowKursDBTR: true
		};
		isUserModalOpen = true;
	}

	function openEditModal(item: any) {
		isEditMode = true;
		showPassword = false;
		formModalTab = 'akun';
		userForm = {
			UserName: String(item.UserName || ''),
			Password: '', // Dikosongkan jika tidak ingin ubah password
			Bagian: String(item.Bagian || 'ACC'),
			GroupID: String(item.GroupID || '70'),
			Aktif: Boolean(item.Aktif),
			kodeprint: String(item.kodeprint || 'global'),
			salesID: String(item.salesID || '99'),
			groupInputOS: String(item.groupInputOS || '99'),
			groupInputMB: String(item.groupInputMB || '99'),
			groupInputKeluhan: String(item.groupInputKeluhan || '99'),
			KeluhanCustomer: Boolean(item.KeluhanCustomer),
			ApprovedEditRequest: item.ApprovedEditRequest != null ? Number(item.ApprovedEditRequest) : 99,
			SaldoHarian: item.SaldoHarian != null ? Number(item.SaldoHarian) : 99,
			MonitoringDoc: item.MonitoringDoc != null ? Number(item.MonitoringDoc) : 99,
			ShowKursDBTR: Boolean(item.ShowKursDBTR)
		};
		isUserModalOpen = true;
	}

	// ==================== STATE MODAL DELETE USER ====================
	let isDeleteModalOpen = $state(false);
	let userToDelete = $state<any>(null);

	function openDeleteModal(item: any) {
		userToDelete = item;
		isDeleteModalOpen = true;
	}

	// ==================== STATE MODAL PRINTER ====================
	let isPrinterModalOpen = $state(false);
	let isEditPrinter = $state(false);
	let printerSubmitting = $state(false);
	let printerForm = $state({
		kode: '',
		txt: '',
		txtP: ''
	});

	function openCreatePrinterModal() {
		isEditPrinter = false;
		printerForm = { kode: '', txt: '', txtP: '' };
		isPrinterModalOpen = true;
	}

	function openEditPrinterModal(p: any) {
		isEditPrinter = true;
		printerForm = {
			kode: String(p.kode || ''),
			txt: String(p.txt || ''),
			txtP: String(p.txtP || '')
		};
		isPrinterModalOpen = true;
	}

	let isDeletePrinterModalOpen = $state(false);
	let printerToDelete = $state<any>(null);

	function openDeletePrinterModal(p: any) {
		printerToDelete = p;
		isDeletePrinterModalOpen = true;
	}

	function getRoleBadgeColor(role: string): string {
		switch (role) {
			case 'IT':
				return 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30';
			case 'ACC':
				return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
			case 'PCS':
				return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
			case 'WH':
				return 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30';
			case 'BC':
				return 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30';
			case 'MAR':
			case 'EXP':
				return 'bg-pink-500/15 text-pink-800 dark:text-pink-300 border-pink-500/30';
			default:
				return 'bg-muted text-foreground border-border/50';
		}
	}
</script>

<LoadingOverlay show={loading} message="Memuat Master Pengguna & Setting MenuCP..." submessage="Mohon tunggu sejenak" />

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Master Data Pengguna & Setting Database MenuCP"
		description="Kelola akun operator, konfigurasi setting parameter MenuCP, setup printer jaringan, dan hak akses group."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				{#if activeTab === 'user'}
					<Button
						type="button"
						onclick={openCreateModal}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
						title="Tambah akun pengguna baru"
					>
						<Plus class="size-4 mr-1.5" />
						Tambah Pengguna
					</Button>

					<!-- Form Export Excel -->
					<form
						method="post"
						action="/api/master-user/export"
						onsubmit={() => {
							exportLoading = true;
							toast.info('Export Excel', 'Menyiapkan berkas Excel master user & setting MenuCP...');
							setTimeout(() => (exportLoading = false), 3500);
						}}
						class="inline-flex"
					>
						<input type="hidden" name="q" value={data.q} />
						<input type="hidden" name="bagian" value={data.bagian} />
						<input type="hidden" name="groupId" value={data.groupId} />
						<input type="hidden" name="status" value={data.status} />

						<Button
							type="submit"
							variant="secondary"
							disabled={exportLoading}
							class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
							title="Export Excel Master Pengguna"
						>
							<Download class="size-4 mr-1.5" />
							Export Excel
						</Button>
					</form>
				{:else if activeTab === 'printer'}
					<Button
						type="button"
						onclick={openCreatePrinterModal}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
						title="Tambah profil printer baru"
					>
						<Plus class="size-4 mr-1.5" />
						Tambah Printer
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

	<!-- Navigasi Tab Utama Neo-Brutalist -->
	<div class="flex flex-wrap items-center gap-2 border-b-[3px] border-border pb-3">
		<a
			href="?tab=user"
			class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-[3px] font-black text-xs uppercase tracking-wider transition-all {activeTab === 'user' ? 'bg-primary text-primary-foreground border-border brutal-shadow-sm' : 'bg-card text-muted-foreground border-border/40 hover:border-border hover:text-foreground'}"
		>
			<Users class="size-4" />
			<span>Pengguna & Setting User ({data.total})</span>
		</a>

		<a
			href="?tab=printer"
			class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-[3px] font-black text-xs uppercase tracking-wider transition-all {activeTab === 'printer' ? 'bg-primary text-primary-foreground border-border brutal-shadow-sm' : 'bg-card text-muted-foreground border-border/40 hover:border-border hover:text-foreground'}"
		>
			<Printer class="size-4" />
			<span>Setup Printer MenuCP ({data.setupPrints.length})</span>
		</a>

		<a
			href="?tab=akses&selectedGroupId={data.selectedGroupId || '99'}"
			class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-[3px] font-black text-xs uppercase tracking-wider transition-all {activeTab === 'akses' ? 'bg-primary text-primary-foreground border-border brutal-shadow-sm' : 'bg-card text-muted-foreground border-border/40 hover:border-border hover:text-foreground'}"
		>
			<ShieldCheck class="size-4" />
			<span>Hak Akses Menu Group ({data.groups.length} Group)</span>
		</a>
	</div>

	<!-- TAB 1: DATA PENGGUNA (taUser) -->
	{#if activeTab === 'user'}
		<!-- Summary Metrics Cards -->
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Total User -->
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider">Total Pengguna</span>
					<Users class="size-4 text-primary" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-2xl font-black text-foreground">
						{data.stats.total.toLocaleString('id-ID')}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
						Terdaftar di [MenuCP].[dbo].[taUser]
					</p>
				</div>
			</div>

			<!-- User Aktif -->
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Pengguna Aktif</span>
					<CheckCircle2 class="size-4 text-emerald-600" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
						{data.stats.totalAktif.toLocaleString('id-ID')}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
						{data.stats.total > 0 ? Math.round((data.stats.totalAktif / data.stats.total) * 100) : 0}% Akun Memiliki Izin Login
					</p>
				</div>
			</div>

			<!-- Non-aktif / Diblokir -->
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-rose-500/5">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">Non-Aktif / Blokir</span>
					<XCircle class="size-4 text-rose-600" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-2xl font-black text-rose-700 dark:text-rose-400">
						{data.stats.totalNonAktif.toLocaleString('id-ID')}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
						Akses Login Dinonaktifkan
					</p>
				</div>
			</div>

			<!-- Superadmin / IT -->
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-purple-500/5">
				<div class="flex items-center justify-between text-muted-foreground">
					<span class="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">Hak Akses Admin (IT)</span>
					<ShieldCheck class="size-4 text-purple-600" />
				</div>
				<div class="mt-2">
					<div class="font-mono text-2xl font-black text-purple-700 dark:text-purple-400">
						{data.stats.totalAdmin.toLocaleString('id-ID')}
					</div>
					<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
						Superadmin / Hak Akses Penuh
					</p>
				</div>
			</div>
		</div>

		<!-- Filter & Search Form -->
		<form
			method="get"
			action="/dashboard/master-user"
			class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3"
		>
			<input type="hidden" name="tab" value="user" />

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
				<!-- Input Pencarian -->
				<div class="space-y-1.5 lg:col-span-4">
					<Label for="q">Pencarian Pengguna</Label>
					<div class="relative">
						<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<input
							type="text"
							id="q"
							name="q"
							value={data.q}
							placeholder="Cari username, bagian, print, input OS..."
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] pl-9 pr-3 text-sm font-bold brutal-shadow-sm"
						/>
					</div>
				</div>

				<!-- Filter Departemen / Bagian -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="bagian">Departemen / Bagian</Label>
					<select
						id="bagian"
						name="bagian"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					>
						<option value="">Semua Departemen</option>
						{#each DEPARTEMEN_OPTIONS as dept}
							<option value={dept.value} selected={data.bagian === dept.value}>
								{dept.value} - {dept.label}
							</option>
						{/each}
					</select>
				</div>

				<!-- Filter Group ID (taGroup) -->
				<div class="space-y-1.5 lg:col-span-3">
					<Label for="groupId">Hak Akses Group</Label>
					<select
						id="groupId"
						name="groupId"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					>
						<option value="">Semua Group Role</option>
						{#each data.groups as grp}
							<option value={grp.GroupID} selected={data.groupId === grp.GroupID}>
								[{grp.GroupID}] {grp.GroupName}
							</option>
						{/each}
					</select>
				</div>

				<!-- Filter Status Aktif -->
				<div class="space-y-1.5 lg:col-span-2">
					<Label for="status">Status Login</Label>
					<select
						id="status"
						name="status"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					>
						<option value="">Semua Status</option>
						<option value="AKTIF" selected={data.status === 'AKTIF'}>Aktif Saja</option>
						<option value="NONAKTIF" selected={data.status === 'NONAKTIF'}>Non-Aktif Saja</option>
					</select>
				</div>
			</div>

			<div class="flex items-center justify-between pt-1">
				<span class="text-xs text-muted-foreground font-bold">
					Ditemukan <span class="text-foreground font-black">{data.total}</span> akun pengguna
				</span>
				<div class="flex items-center gap-2">
					{#if data.q || data.bagian || data.groupId || data.status}
						<a
							href="/dashboard/master-user?tab=user"
							class="text-xs font-bold text-muted-foreground hover:text-foreground underline"
						>
							Reset Filter
						</a>
					{/if}
					<Button
						type="submit"
						class="h-9 px-4 border-[3px] font-black uppercase text-xs tracking-wide brutal-shadow-sm cursor-pointer"
					>
						Terapkan Filter
					</Button>
				</div>
			</div>
		</form>

		<!-- Tabel Daftar Pengguna -->
		<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
			<div class="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow class="bg-muted/50 border-b-[3px] border-border">
							<TableHead class="w-12 text-center font-black">No</TableHead>
							<TableHead class="font-black">Username</TableHead>
							<TableHead class="font-black">Departemen</TableHead>
							<TableHead class="font-black">Group Hak Akses</TableHead>
							<TableHead class="font-black">Setting MenuCP</TableHead>
							<TableHead class="font-black text-center">Status Login</TableHead>
							<TableHead class="text-right font-black pr-4">Aksi</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.rows.length === 0}
							<TableEmpty colspan={7} message="Tidak ada data pengguna yang sesuai kriteria pencarian." />
						{:else}
							{#each data.rows as u, index}
								<TableRow class="hover:bg-muted/30 transition-colors border-b-2 border-border/30">
									<!-- No -->
									<TableCell class="text-center font-mono text-xs text-muted-foreground font-bold">
										{(data.page - 1) * data.pageSize + index + 1}
									</TableCell>

									<!-- Username & Role -->
									<TableCell>
										<div class="flex items-center gap-2">
											<div class="size-8 rounded-lg border-2 border-border bg-muted flex items-center justify-center font-black font-mono text-xs uppercase">
												{u.UserName.slice(0, 2)}
											</div>
											<div>
												<div class="font-mono font-bold text-sm text-foreground flex items-center gap-1.5">
													<span>{u.UserName}</span>
													{#if u.isSuperAdmin}
														<Badge class="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] px-1 py-0">
															ADMIN
														</Badge>
													{/if}
													{#if u.UserName.toLowerCase() === data.currentUser.toLowerCase()}
														<span class="text-[10px] font-bold text-primary px-1 border border-primary/40 rounded bg-primary/10">
															(Anda)
														</span>
													{/if}
												</div>
												<div class="text-[11px] text-muted-foreground font-medium">
													{u.roleLabel}
												</div>
											</div>
										</div>
									</TableCell>

									<!-- Departemen -->
									<TableCell>
										<Badge class="{getRoleBadgeColor(u.Bagian)} font-mono font-bold text-xs">
											{u.Bagian || '-'}
										</Badge>
									</TableCell>

									<!-- Group Hak Akses (taGroup) -->
									<TableCell>
										<div class="text-xs">
											<span class="font-mono font-bold bg-muted px-1.5 py-0.5 rounded border border-border/50 text-[11px]">
												[{u.GroupID}]
											</span>
											<span class="font-semibold text-foreground ml-1">
												{u.GroupName || 'Group ' + u.GroupID}
											</span>
										</div>
									</TableCell>

									<!-- Setting MenuCP (Input OS, Kode Print, Kurs, dsb) -->
									<TableCell>
										<div class="flex flex-wrap items-center gap-1 text-[11px]">
											<span
												class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/50 font-mono font-bold bg-blue-500/10 text-blue-800 dark:text-blue-300"
												title="Pembatasan Input OS / SPK"
											>
												<Briefcase class="size-3" />
												OS: {u.groupInputOS || '99'}
											</span>

											<span
												class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/50 font-mono font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300"
												title="Profil Printer MenuCP (taSetupPrint)"
											>
												<Printer class="size-3" />
												{u.kodeprint || 'global'}
											</span>

											{#if u.ShowKursDBTR}
												<span
													class="px-1.5 py-0.5 rounded border border-emerald-500/40 font-mono font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
													title="Tampilkan Kurs DBTR"
												>
													Kurs: ON
												</span>
											{/if}

											{#if u.salesID && u.salesID !== '99'}
												<span
													class="px-1.5 py-0.5 rounded border border-purple-500/40 font-mono font-bold bg-purple-500/10 text-purple-800 dark:text-purple-300"
													title="Sales ID"
												>
													Sales: {u.salesID}
												</span>
											{/if}
										</div>
									</TableCell>

									<!-- Status Aktif / Blokir -->
									<TableCell class="text-center">
										<form
											method="post"
											action="?/toggleStatus"
											use:enhance={() => {
												return async ({ update }) => {
													await update();
												};
											}}
											class="inline-block"
										>
											<input type="hidden" name="username" value={u.UserName} />
											<input type="hidden" name="aktif" value={String(!u.Aktif)} />

											<button
												type="submit"
												class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border-2 transition-all cursor-pointer {u.Aktif ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25' : 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/25'}"
												title={u.Aktif ? 'Klik untuk blokir pengguna ini' : 'Klik untuk mengaktifkan pengguna ini'}
											>
												{#if u.Aktif}
													<Unlock class="size-3 text-emerald-600" />
													<span>Aktif</span>
												{:else}
													<Lock class="size-3 text-rose-600" />
													<span>Diblokir</span>
												{/if}
											</button>
										</form>
									</TableCell>

									<!-- Aksi (Detail, Edit, Hapus) -->
									<TableCell class="text-right pr-4">
										<div class="flex items-center justify-end gap-1.5">
											<!-- Tombol Detail Setting MenuCP -->
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() => openDetailModal(u)}
												class="h-8 w-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
												title="Lihat seluruh setting MenuCP pengguna ini"
											>
												<Eye class="size-4" />
											</Button>

											<!-- Tombol Edit Pengguna -->
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() => openEditModal(u)}
												class="h-8 w-8 p-0 cursor-pointer text-primary hover:bg-primary/10"
												title="Ubah data dan setting pengguna"
											>
												<Edit3 class="size-4" />
											</Button>

											<!-- Tombol Hapus Pengguna -->
											{#if !['it', 'administrator', 'sa'].includes(u.UserName.toLowerCase()) && u.UserName.toLowerCase() !== data.currentUser.toLowerCase()}
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onclick={() => openDeleteModal(u)}
													class="h-8 w-8 p-0 cursor-pointer text-destructive hover:bg-destructive/10"
													title="Hapus pengguna"
												>
													<Trash2 class="size-4" />
												</Button>
											{/if}
										</div>
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>

			<!-- Pagination Footer -->
			<div class="border-t-[3px] border-border p-3 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
				<div class="text-xs text-muted-foreground font-bold">
					Menampilkan <span class="text-foreground font-black">{data.rows.length}</span> dari <span class="text-foreground font-black">{data.total}</span> pengguna (Halaman {data.page} dari {data.totalPages || 1})
				</div>

				<Pagination
					page={data.page}
					pageSize={data.pageSize}
					total={data.total}
					basePath="/dashboard/master-user"
					params={{
						tab: 'user',
						q: data.q,
						bagian: data.bagian,
						groupId: data.groupId,
						status: data.status
					}}
				/>
			</div>
		</div>
	{/if}

	<!-- TAB 2: SETUP PRINTER (taSetupPrint) -->
	{#if activeTab === 'printer'}
		<div class="space-y-4">
			<div class="bg-card rounded-xl border-[3px] border-border p-5 brutal-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h3 class="text-base font-black uppercase text-foreground flex items-center gap-2">
						<Printer class="size-5 text-primary" />
						<span>Konfigurasi Setup Printer Database MenuCP</span>
					</h3>
					<p class="text-xs text-muted-foreground mt-1 max-w-2xl font-medium">
						Tabel <span class="bg-muted px-1.5 py-0.5 rounded border border-border/50 font-mono font-bold text-[11px]">taSetupPrint</span> mengatur jalur alamat UNC printer jaringan (dot-matrix / slip printer) yang digunakan sistem untuk mencetak nota, SPK, dan voucher kas/bank.
					</p>
				</div>
				<Button
					type="button"
					onclick={openCreatePrinterModal}
					class="border-[3px] font-black uppercase text-xs brutal-shadow-sm cursor-pointer bg-primary text-primary-foreground"
				>
					<Plus class="size-4 mr-1.5" />
					Tambah Printer
				</Button>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each data.setupPrints as p}
					<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between space-y-4">
						<div class="space-y-3">
							<div class="flex items-center justify-between border-b-2 border-border/40 pb-2">
								<div class="flex items-center gap-2">
									<div class="size-8 rounded-lg bg-primary/10 border-2 border-border flex items-center justify-center">
										<Printer class="size-4 text-primary" />
									</div>
									<div>
										<h4 class="font-mono font-black text-sm text-foreground uppercase">{p.kode}</h4>
										<p class="text-[10px] text-muted-foreground font-bold">Kode Setup Print</p>
									</div>
								</div>
								<Badge class="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 text-xs font-mono font-bold">
									{p.userCount || 0} Pengguna
								</Badge>
							</div>

							<div class="space-y-2 text-xs">
								<div class="p-2 rounded-lg bg-muted/40 border border-border/40">
									<span class="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
										Printer Utama (txt):
									</span>
									<span class="font-mono font-bold text-foreground break-all">
										{p.txt || '(Default Windows / Kosong)'}
									</span>
								</div>

								<div class="p-2 rounded-lg bg-muted/40 border border-border/40">
									<span class="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
										Printer Slip / Kedua (txtP):
									</span>
									<span class="font-mono font-bold text-foreground break-all">
										{p.txtP || '(Default Windows / Kosong)'}
									</span>
								</div>
							</div>
						</div>

						<div class="flex items-center justify-end gap-2 pt-2 border-t-2 border-border/30">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onclick={() => openEditPrinterModal(p)}
								class="h-8 border-2 font-black text-xs cursor-pointer"
							>
								<Edit3 class="size-3.5 mr-1" />
								Edit
							</Button>

							{#if (p.userCount || 0) === 0 && !['global', 'exim'].includes(p.kode.toLowerCase())}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onclick={() => openDeletePrinterModal(p)}
									class="h-8 text-destructive hover:bg-destructive/10 cursor-pointer"
								>
									<Trash2 class="size-3.5 mr-1" />
									Hapus
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- TAB 3: HAK AKSES GROUP (taHakAkses) -->
	{#if activeTab === 'akses'}
		<div class="space-y-4">
			<!-- Header & Selector Group -->
			<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<h3 class="text-base font-black uppercase text-foreground flex items-center gap-2">
							<ShieldCheck class="size-5 text-primary" />
							<span>Setting Hak Akses Menu Group (taHakAkses & taMenus)</span>
						</h3>
						<p class="text-xs text-muted-foreground mt-0.5 font-medium">
							Pilih group role untuk memeriksa dan mengatur otorisasi menu di database MenuCP.
						</p>
					</div>
				</div>

				<form method="get" action="/dashboard/master-user" class="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 items-end">
					<input type="hidden" name="tab" value="akses" />

					<!-- Pilih Group -->
					<div class="space-y-1.5 sm:col-span-6 lg:col-span-5">
						<Label for="selectedGroupId">Pilih Hak Akses Group (taGroup)</Label>
						<select
							id="selectedGroupId"
							name="selectedGroupId"
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
							onchange={(e) => e.currentTarget.form?.submit()}
						>
							{#each data.groups as grp}
								<option value={grp.GroupID} selected={data.selectedGroupId === grp.GroupID}>
									[{grp.GroupID}] {grp.GroupName}
								</option>
							{/each}
						</select>
					</div>

					<!-- Filter DeptID Menu -->
					<div class="space-y-1.5 sm:col-span-4 lg:col-span-4">
						<Label for="selectedDeptId">Filter Modul / Departemen Menu</Label>
						<select
							id="selectedDeptId"
							name="selectedDeptId"
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
							onchange={(e) => e.currentTarget.form?.submit()}
						>
							<option value="ALL" selected={data.selectedDeptId === 'ALL'}>Semua Modul Menu</option>
							<option value="FN" selected={data.selectedDeptId === 'FN'}>FN - Modul Keuangan & Akuntansi</option>
							<option value="OP" selected={data.selectedDeptId === 'OP'}>OP - Modul Operasional & Pembelian</option>
							<option value="PD" selected={data.selectedDeptId === 'PD'}>PD - Modul Produksi & Gudang</option>
							<option value="MN" selected={data.selectedDeptId === 'MN'}>MN - Menu Utama & Pengaturan</option>
							<option value="LG" selected={data.selectedDeptId === 'LG'}>LG - Login & Keamanan</option>
						</select>
					</div>

					<div class="sm:col-span-2 lg:col-span-3">
						<Button type="submit" class="h-10 w-full border-[3px] font-black uppercase text-xs cursor-pointer">
							Tampilkan Menu
						</Button>
					</div>
				</form>
			</div>

			<!-- Tabel Hak Akses Menu -->
			<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
				<div class="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow class="bg-muted/50 border-b-[3px] border-border">
								<TableHead class="w-12 text-center font-black">No</TableHead>
								<TableHead class="font-black">Menu ID</TableHead>
								<TableHead class="font-black">Caption / Nama Menu</TableHead>
								<TableHead class="font-black">Modul (DeptID)</TableHead>
								<TableHead class="text-center font-black">Diaktifkan (Enabled)</TableHead>
								<TableHead class="text-center font-black">Terlihat (Visible)</TableHead>
								<TableHead class="text-center font-black">Tambah (Append)</TableHead>
								<TableHead class="text-center font-black">Ubah (Edit)</TableHead>
								<TableHead class="text-center font-black">Hapus (Delete)</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if data.groupHakAkses.length === 0}
								<TableEmpty colspan={9} message="Pilih group untuk melihat daftar hak akses menu." />
							{:else}
								{#each data.groupHakAkses as h, idx}
									<TableRow class="hover:bg-muted/30 transition-colors border-b-2 border-border/30">
										<TableCell class="text-center font-mono text-xs text-muted-foreground font-bold">
											{idx + 1}
										</TableCell>

										<TableCell class="font-mono text-xs font-bold text-foreground">
											{h.MenuID}
										</TableCell>

										<TableCell>
											<span class="font-bold text-sm text-foreground">
												{h.MenuCaption || '-'}
											</span>
											{#if h.MenuLevel}
												<span class="text-[10px] text-muted-foreground font-mono ml-1.5">
													(Lv: {h.MenuLevel})
												</span>
											{/if}
										</TableCell>

										<TableCell>
											<Badge class="font-mono font-bold text-xs bg-muted text-foreground border-border/60">
												{h.DeptID}
											</Badge>
										</TableCell>

										<!-- Toggle IsEnabled -->
										<TableCell class="text-center">
											<form method="post" action="?/toggleHakAkses" use:enhance class="inline-block">
												<input type="hidden" name="groupId" value={h.GroupID} />
												<input type="hidden" name="menuId" value={h.MenuID} />
												<input type="hidden" name="field" value="IsEnabled" />
												<input type="hidden" name="value" value={String(!h.IsEnabled)} />
												<button
													type="submit"
													class="p-1 rounded cursor-pointer transition-colors {h.IsEnabled ? 'text-emerald-600 hover:bg-emerald-500/10' : 'text-muted-foreground/40 hover:text-muted-foreground'}"
													title="Klik untuk ubah IsEnabled"
												>
													{#if h.IsEnabled}
														<CheckCircle2 class="size-5" />
													{:else}
														<XCircle class="size-5" />
													{/if}
												</button>
											</form>
										</TableCell>

										<!-- Toggle IsVisible -->
										<TableCell class="text-center">
											<form method="post" action="?/toggleHakAkses" use:enhance class="inline-block">
												<input type="hidden" name="groupId" value={h.GroupID} />
												<input type="hidden" name="menuId" value={h.MenuID} />
												<input type="hidden" name="field" value="IsVisible" />
												<input type="hidden" name="value" value={String(!h.IsVisible)} />
												<button
													type="submit"
													class="p-1 rounded cursor-pointer transition-colors {h.IsVisible ? 'text-emerald-600 hover:bg-emerald-500/10' : 'text-muted-foreground/40 hover:text-muted-foreground'}"
													title="Klik untuk ubah IsVisible"
												>
													{#if h.IsVisible}
														<CheckCircle2 class="size-5" />
													{:else}
														<XCircle class="size-5" />
													{/if}
												</button>
											</form>
										</TableCell>

										<!-- Toggle IsAppend -->
										<TableCell class="text-center">
											<form method="post" action="?/toggleHakAkses" use:enhance class="inline-block">
												<input type="hidden" name="groupId" value={h.GroupID} />
												<input type="hidden" name="menuId" value={h.MenuID} />
												<input type="hidden" name="field" value="IsAppend" />
												<input type="hidden" name="value" value={String(!h.IsAppend)} />
												<button
													type="submit"
													class="p-1 rounded cursor-pointer transition-colors {h.IsAppend ? 'text-blue-600 hover:bg-blue-500/10' : 'text-muted-foreground/40 hover:text-muted-foreground'}"
													title="Klik untuk ubah IsAppend"
												>
													{#if h.IsAppend}
														<CheckCircle2 class="size-5" />
													{:else}
														<XCircle class="size-5" />
													{/if}
												</button>
											</form>
										</TableCell>

										<!-- Toggle IsEdit -->
										<TableCell class="text-center">
											<form method="post" action="?/toggleHakAkses" use:enhance class="inline-block">
												<input type="hidden" name="groupId" value={h.GroupID} />
												<input type="hidden" name="menuId" value={h.MenuID} />
												<input type="hidden" name="field" value="IsEdit" />
												<input type="hidden" name="value" value={String(!h.IsEdit)} />
												<button
													type="submit"
													class="p-1 rounded cursor-pointer transition-colors {h.IsEdit ? 'text-amber-600 hover:bg-amber-500/10' : 'text-muted-foreground/40 hover:text-muted-foreground'}"
													title="Klik untuk ubah IsEdit"
												>
													{#if h.IsEdit}
														<CheckCircle2 class="size-5" />
													{:else}
														<XCircle class="size-5" />
													{/if}
												</button>
											</form>
										</TableCell>

										<!-- Toggle IsDelete -->
										<TableCell class="text-center">
											<form method="post" action="?/toggleHakAkses" use:enhance class="inline-block">
												<input type="hidden" name="groupId" value={h.GroupID} />
												<input type="hidden" name="menuId" value={h.MenuID} />
												<input type="hidden" name="field" value="IsDelete" />
												<input type="hidden" name="value" value={String(!h.IsDelete)} />
												<button
													type="submit"
													class="p-1 rounded cursor-pointer transition-colors {h.IsDelete ? 'text-rose-600 hover:bg-rose-500/10' : 'text-muted-foreground/40 hover:text-muted-foreground'}"
													title="Klik untuk ubah IsDelete"
												>
													{#if h.IsDelete}
														<CheckCircle2 class="size-5" />
													{:else}
														<XCircle class="size-5" />
													{/if}
												</button>
											</form>
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

<!-- ==================== MODAL TAMBAH / EDIT PENGGUNA DENGAN SETTING MENUP ==================== -->
<Modal
	bind:open={isUserModalOpen}
	size="lg"
	title={isEditMode ? `Ubah Pengguna: ${userForm.UserName}` : 'Tambah Pengguna Baru'}
	subtitle={isEditMode ? 'Perbarui data akun dan konfigurasi parameter MenuCP' : 'Daftarkan akun operator baru untuk akses login ERP MenuCP'}
	icon={UserCog}
>
	<form
		method="post"
		action="?/save"
		use:enhance={() => {
			userFormSubmitting = true;
			return async ({ update }) => {
				userFormSubmitting = false;
				await update();
			};
		}}
		class="space-y-4 py-1"
	>
		<input type="hidden" name="isEdit" value={String(isEditMode)} />

		<!-- Tabs di Dalam Modal: Akun vs Setting MenuCP -->
		<div class="flex items-center gap-2 border-b-2 border-border/50 pb-2">
			<button
				type="button"
				onclick={() => (formModalTab = 'akun')}
				class="px-3 py-1.5 rounded-lg border-2 font-black text-xs uppercase tracking-wide cursor-pointer transition-all {formModalTab === 'akun' ? 'bg-primary text-primary-foreground border-border brutal-shadow-sm' : 'bg-muted/40 text-muted-foreground border-border/40 hover:text-foreground'}"
			>
				1. Akun & Kredensial
			</button>
			<button
				type="button"
				onclick={() => (formModalTab = 'menucp')}
				class="px-3 py-1.5 rounded-lg border-2 font-black text-xs uppercase tracking-wide cursor-pointer transition-all {formModalTab === 'menucp' ? 'bg-primary text-primary-foreground border-border brutal-shadow-sm' : 'bg-muted/40 text-muted-foreground border-border/40 hover:text-foreground'}"
			>
				2. Setting Database MenuCP
			</button>
		</div>

		<!-- SEKSI 1: AKUN & KREDENSIAL UTAMA -->
		{#if formModalTab === 'akun'}
			<div class="space-y-3.5">
				<!-- Username -->
				<div class="space-y-1.5">
					<Label for="UserName">Username Login *</Label>
					<input
						type="text"
						id="UserName"
						name="UserName"
						bind:value={userForm.UserName}
						readonly={isEditMode}
						required
						maxlength="50"
						placeholder="Contoh: acc.hendra atau wh.budi"
						class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm {isEditMode ? 'bg-muted/50 cursor-default' : ''}"
					/>
					{#if isEditMode}
						<p class="text-[11px] text-muted-foreground">Username tidak dapat diubah (Primary Key akun).</p>
					{:else}
						<p class="text-[11px] text-muted-foreground">Gunakan huruf kecil, angka, titik, atau underscore.</p>
					{/if}
				</div>

				<!-- Password -->
				<div class="space-y-1.5">
					<div class="flex items-center justify-between">
						<Label for="Password">{isEditMode ? 'Password Baru (Opsional)' : 'Password Login *'}</Label>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="text-[11px] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
						>
							{#if showPassword}
								<EyeOff class="size-3" />
								<span>Sembunyikan</span>
							{:else}
								<Eye class="size-3" />
								<span>Lihat Password</span>
							{/if}
						</button>
					</div>

					<div class="relative">
						<input
							type={showPassword ? 'text' : 'password'}
							id="Password"
							name="Password"
							bind:value={userForm.Password}
							required={!isEditMode}
							maxlength="50"
							placeholder={isEditMode ? 'Biarkan kosong jika tidak ingin mengubah password' : 'Masukkan password login'}
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
						/>
					</div>
				</div>

				<!-- Grid: Departemen & Group Hak Akses -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<!-- Departemen / Bagian -->
					<div class="space-y-1.5">
						<Label for="Bagian">Departemen / Bagian *</Label>
						<select
							id="Bagian"
							name="Bagian"
							bind:value={userForm.Bagian}
							required
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
						>
							{#each DEPARTEMEN_OPTIONS as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>

					<!-- Group Hak Akses (taGroup) -->
					<div class="space-y-1.5">
						<Label for="GroupID">Group Hak Akses *</Label>
						<select
							id="GroupID"
							name="GroupID"
							bind:value={userForm.GroupID}
							required
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
						>
							{#each data.groups as g}
								<option value={g.GroupID}>[{g.GroupID}] {g.GroupName}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Checkbox Status Aktif -->
				<div class="pt-2">
					<label class="inline-flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border-2 border-border/50 bg-muted/30 w-full">
						<input
							type="checkbox"
							name="Aktif"
							bind:checked={userForm.Aktif}
							class="rounded border-2 border-border size-4 text-primary focus:ring-0"
						/>
						<div class="text-xs">
							<span class="font-bold text-foreground block">Akun Pengguna Aktif</span>
							<span class="text-muted-foreground text-[11px]">Jika tidak dicentang, pengguna tidak dapat login ke sistem ERP.</span>
						</div>
					</label>
				</div>
			</div>
		{/if}

		<!-- SEKSI 2: PENGATURAN DATABASE MENUP (taUser & taSetupPrint) -->
		{#if formModalTab === 'menucp'}
			<div class="space-y-3.5">
				<!-- Grid: Setup Print & Pembatasan Input OS -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<!-- Kode Print (taSetupPrint) -->
					<div class="space-y-1.5">
						<Label for="kodeprint">Setup Printer Jaringan (kodeprint)</Label>
						<select
							id="kodeprint"
							name="kodeprint"
							bind:value={userForm.kodeprint}
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
						>
							{#each data.setupPrints as p}
								<option value={p.kode}>{p.kode} - {p.txt || '(Default)'}</option>
							{/each}
						</select>
						<p class="text-[10px] text-muted-foreground">Profil printer dari tabel taSetupPrint MenuCP.</p>
					</div>

					<!-- Pembatasan Input OS / SPK -->
					<div class="space-y-1.5">
						<Label for="groupInputOS">Hak Input OS / SPK (groupInputOS)</Label>
						<select
							id="groupInputOS"
							name="groupInputOS"
							bind:value={userForm.groupInputOS}
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
						>
							{#each INPUT_OS_OPTIONS as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
						<p class="text-[10px] text-muted-foreground">Membatasi departemen order yang dapat diinput oleh user ini.</p>
					</div>
				</div>

				<!-- Grid: Sales ID, Input MB, Input Keluhan -->
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div class="space-y-1.5">
						<Label for="salesID">Sales ID (salesID)</Label>
						<input
							type="text"
							id="salesID"
							name="salesID"
							bind:value={userForm.salesID}
							maxlength="3"
							placeholder="99"
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
						/>
					</div>

					<div class="space-y-1.5">
						<Label for="groupInputMB">Input Mutasi (MB)</Label>
						<input
							type="text"
							id="groupInputMB"
							name="groupInputMB"
							bind:value={userForm.groupInputMB}
							maxlength="2"
							placeholder="99"
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
						/>
					</div>

					<div class="space-y-1.5">
						<Label for="groupInputKeluhan">Input Keluhan</Label>
						<input
							type="text"
							id="groupInputKeluhan"
							name="groupInputKeluhan"
							bind:value={userForm.groupInputKeluhan}
							maxlength="2"
							placeholder="99"
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
						/>
					</div>
				</div>

				<!-- Grid Parameter Otorisasi: ApprovedEditRequest, SaldoHarian, MonitoringDoc -->
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div class="space-y-1.5">
						<Label for="ApprovedEditRequest">Approve Edit Req</Label>
						<input
							type="number"
							id="ApprovedEditRequest"
							name="ApprovedEditRequest"
							bind:value={userForm.ApprovedEditRequest}
							placeholder="99"
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
						/>
					</div>

					<div class="space-y-1.5">
						<Label for="SaldoHarian">Izin Saldo Harian</Label>
						<input
							type="number"
							id="SaldoHarian"
							name="SaldoHarian"
							bind:value={userForm.SaldoHarian}
							placeholder="99"
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
						/>
					</div>

					<div class="space-y-1.5">
						<Label for="MonitoringDoc">Monitoring Dokumen</Label>
						<input
							type="number"
							id="MonitoringDoc"
							name="MonitoringDoc"
							bind:value={userForm.MonitoringDoc}
							placeholder="99"
							class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
						/>
					</div>
				</div>

				<!-- Checkboxes: ShowKursDBTR & KeluhanCustomer -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
					<label class="inline-flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border-2 border-border/50 bg-muted/30">
						<input
							type="checkbox"
							name="ShowKursDBTR"
							bind:checked={userForm.ShowKursDBTR}
							class="rounded border-2 border-border size-4 text-primary focus:ring-0"
						/>
						<div class="text-xs">
							<span class="font-bold text-foreground block">Tampilkan Kurs DB/TR</span>
							<span class="text-muted-foreground text-[10px]">Menampilkan kurs debit/transfer di menu transaksi.</span>
						</div>
					</label>

					<label class="inline-flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border-2 border-border/50 bg-muted/30">
						<input
							type="checkbox"
							name="KeluhanCustomer"
							bind:checked={userForm.KeluhanCustomer}
							class="rounded border-2 border-border size-4 text-primary focus:ring-0"
						/>
						<div class="text-xs">
							<span class="font-bold text-foreground block">Akses Keluhan Customer</span>
							<span class="text-muted-foreground text-[10px]">Izin mengakses modul keluhan pelanggan.</span>
						</div>
					</label>
				</div>
			</div>
		{/if}

		<!-- Action Buttons: Batal & Simpan -->
		<div class="flex items-center justify-between pt-4 border-t-2 border-border/40 mt-6 sticky bottom-0 bg-card py-2 z-10">
			<div class="text-xs text-muted-foreground font-bold">
				{#if formModalTab === 'akun'}
					<button
						type="button"
						onclick={() => (formModalTab = 'menucp')}
						class="text-primary hover:underline font-black inline-flex items-center gap-1 cursor-pointer"
					>
						<span>Buka Setting MenuCP &rarr;</span>
					</button>
				{:else}
					<button
						type="button"
						onclick={() => (formModalTab = 'akun')}
						class="text-primary hover:underline font-black inline-flex items-center gap-1 cursor-pointer"
					>
						<span>&larr; Kembali ke Akun</span>
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				<Button
					type="button"
					variant="secondary"
					onclick={() => (isUserModalOpen = false)}
					class="h-10 border-[3px] font-black uppercase brutal-shadow-sm text-xs px-4 cursor-pointer"
				>
					Batal
				</Button>
				<Button
					type="submit"
					disabled={userFormSubmitting}
					class="h-10 border-[3px] font-black uppercase brutal-shadow-sm text-xs px-5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
				>
					{userFormSubmitting ? 'Menyimpan...' : isEditMode ? 'Perbarui Pengguna' : 'Simpan Pengguna'}
				</Button>
			</div>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL DETAIL LENGKAP SETTING MENUP ==================== -->
<Modal
	bind:open={isDetailModalOpen}
	size="md"
	title="Detail Setting Pengguna MenuCP"
	subtitle={userDetail ? `Konfigurasi lengkap untuk operator "${userDetail.UserName}"` : ''}
	icon={SlidersHorizontal}
>
	{#if userDetail}
		<div class="space-y-4 py-1 text-xs">
			<div class="p-3 rounded-lg border-2 border-border bg-muted/30 flex items-center justify-between">
				<div>
					<span class="text-[10px] text-muted-foreground font-black uppercase">Username Login</span>
					<div class="font-mono text-base font-black text-foreground">{userDetail.UserName}</div>
				</div>
				<Badge class="{getRoleBadgeColor(userDetail.Bagian)} font-mono font-bold text-xs">
					Dept: {userDetail.Bagian}
				</Badge>
			</div>

			<div class="grid grid-cols-2 gap-2.5">
				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Group Hak Akses</span>
					<span class="font-mono font-bold text-foreground">[{userDetail.GroupID}] {userDetail.GroupName || '-'}</span>
				</div>

				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Setup Printer (taSetupPrint)</span>
					<span class="font-mono font-bold text-primary">{userDetail.kodeprint || 'global'}</span>
				</div>

				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Hak Input OS / SPK</span>
					<span class="font-mono font-bold text-foreground">{userDetail.groupInputOS || '99 (Semua)'}</span>
				</div>

				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Sales ID</span>
					<span class="font-mono font-bold text-foreground">{userDetail.salesID || '99'}</span>
				</div>

				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Group Input Mutasi (MB)</span>
					<span class="font-mono font-bold text-foreground">{userDetail.groupInputMB || '99'}</span>
				</div>

				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Group Input Keluhan</span>
					<span class="font-mono font-bold text-foreground">{userDetail.groupInputKeluhan || '99'}</span>
				</div>

				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Approved Edit Request</span>
					<span class="font-mono font-bold text-foreground">{userDetail.ApprovedEditRequest ?? 99}</span>
				</div>

				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Izin Saldo Harian</span>
					<span class="font-mono font-bold text-foreground">{userDetail.SaldoHarian ?? 99}</span>
				</div>

				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Monitoring Dokumen</span>
					<span class="font-mono font-bold text-foreground">{userDetail.MonitoringDoc ?? 99}</span>
				</div>

				<div class="p-2.5 rounded-lg border-2 border-border/50 bg-card">
					<span class="text-[10px] text-muted-foreground font-black uppercase block">Tampilkan Kurs DB/TR</span>
					<span class="font-mono font-bold {userDetail.ShowKursDBTR ? 'text-emerald-600' : 'text-rose-600'}">
						{userDetail.ShowKursDBTR ? 'AKTIF (ON)' : 'TIDAK AKTIF (OFF)'}
					</span>
				</div>
			</div>

			<div class="flex items-center justify-end pt-3 border-t-2 border-border/30">
				<Button
					type="button"
					variant="secondary"
					onclick={() => (isDetailModalOpen = false)}
					class="border-2 font-black uppercase text-xs px-4"
				>
					Tutup
				</Button>
			</div>
		</div>
	{/if}
</Modal>

<!-- ==================== MODAL TAMBAH / EDIT PRINTER (taSetupPrint) ==================== -->
<Modal
	bind:open={isPrinterModalOpen}
	size="md"
	title={isEditPrinter ? `Ubah Profil Printer: ${printerForm.kode}` : 'Tambah Profil Printer MenuCP'}
	subtitle="Konfigurasi UNC printer jaringan untuk tabel taSetupPrint"
	icon={Printer}
>
	<form
		method="post"
		action="?/savePrinter"
		use:enhance={() => {
			printerSubmitting = true;
			return async ({ update }) => {
				printerSubmitting = false;
				await update();
			};
		}}
		class="space-y-3.5 py-1"
	>
		<div class="space-y-1.5">
			<Label for="kode">Kode Printer *</Label>
			<input
				type="text"
				id="kode"
				name="kode"
				bind:value={printerForm.kode}
				readonly={isEditPrinter}
				required
				maxlength="10"
				placeholder="Contoh: yuni, exim, kasir"
				class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm {isEditPrinter ? 'bg-muted/50 cursor-default' : ''}"
			/>
			<p class="text-[11px] text-muted-foreground">Maksimal 10 karakter (huruf kecil tanpa spasi).</p>
		</div>

		<div class="space-y-1.5">
			<Label for="txt">Alamat UNC Printer Utama (txt)</Label>
			<input
				type="text"
				id="txt"
				name="txt"
				bind:value={printerForm.txt}
				maxlength="50"
				placeholder="Contoh: \\192.168.1.123\epsonl3"
				class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
			/>
			<p class="text-[11px] text-muted-foreground">Jalur printer jaringan untuk pencetakan dokumen utama.</p>
		</div>

		<div class="space-y-1.5">
			<Label for="txtP">Alamat UNC Printer Slip / Kedua (txtP)</Label>
			<input
				type="text"
				id="txtP"
				name="txtP"
				bind:value={printerForm.txtP}
				maxlength="50"
				placeholder="Contoh: \\192.168.1.223\epsonl3"
				class="bg-card border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
			/>
			<p class="text-[11px] text-muted-foreground">Jalur printer slip / duplikat (opsional).</p>
		</div>

		<div class="flex items-center justify-end gap-2 pt-4 border-t-2 border-border/40">
			<Button
				type="button"
				variant="secondary"
				onclick={() => (isPrinterModalOpen = false)}
				class="border-2 font-black uppercase text-xs px-4"
			>
				Batal
			</Button>
			<Button
				type="submit"
				disabled={printerSubmitting}
				class="border-[3px] font-black uppercase text-xs px-5 bg-primary text-primary-foreground"
			>
				{printerSubmitting ? 'Menyimpan...' : 'Simpan Printer'}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL KONFIRMASI HAPUS PENGGUNA ==================== -->
<Modal
	bind:open={isDeleteModalOpen}
	size="sm"
	title="Konfirmasi Hapus Pengguna"
	subtitle="Tindakan ini tidak dapat dibatalkan"
	icon={Trash2}
>
	{#if userToDelete}
		<form
			method="post"
			action="?/delete"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4 py-1"
		>
			<input type="hidden" name="username" value={userToDelete.UserName} />

			<div class="p-3.5 rounded-lg border-2 border-destructive/30 bg-destructive/5 space-y-2">
				<p class="text-sm font-bold text-foreground">
					Apakah Anda yakin ingin menghapus akun <span class="font-mono text-destructive underline">{userToDelete.UserName}</span>?
				</p>
				<p class="text-xs text-muted-foreground">
					Akun ini akan dihapus secara permanen dari tabel <span class="font-mono font-bold">[MenuCP].[dbo].[taUser]</span>.
				</p>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2 border-t-2 border-border/30">
				<Button
					type="button"
					variant="secondary"
					onclick={() => (isDeleteModalOpen = false)}
					class="border-2 font-black uppercase text-xs px-4"
				>
					Batal
				</Button>
				<Button
					type="submit"
					variant="error"
					class="border-[3px] font-black uppercase text-xs px-5"
				>
					Ya, Hapus Akun
				</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- ==================== MODAL KONFIRMASI HAPUS PRINTER ==================== -->
<Modal
	bind:open={isDeletePrinterModalOpen}
	size="sm"
	title="Konfirmasi Hapus Printer"
	subtitle="Hapus profil dari tabel taSetupPrint"
	icon={Trash2}
>
	{#if printerToDelete}
		<form
			method="post"
			action="?/deletePrinter"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4 py-1"
		>
			<input type="hidden" name="kode" value={printerToDelete.kode} />

			<div class="p-3.5 rounded-lg border-2 border-destructive/30 bg-destructive/5 space-y-2">
				<p class="text-sm font-bold text-foreground">
					Hapus profil printer <span class="font-mono text-destructive font-bold">{printerToDelete.kode}</span>?
				</p>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2 border-t-2 border-border/30">
				<Button
					type="button"
					variant="secondary"
					onclick={() => (isDeletePrinterModalOpen = false)}
					class="border-2 font-black uppercase text-xs px-4"
				>
					Batal
				</Button>
				<Button
					type="submit"
					variant="error"
					class="border-[3px] font-black uppercase text-xs px-5"
				>
					Hapus Printer
				</Button>
			</div>
		</form>
	{/if}
</Modal>
