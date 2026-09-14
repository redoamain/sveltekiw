<script lang="ts">
	import {
		Badge,
		PageHeader,
		Table,
		TableHeader,
		TableRow,
		TableHead,
		TableBody,
		TableCell,
		Pagination
	} from '$lib/components';
	import {
		UserCheck,
		Users,
		Activity,
		Search,
		Download,
		Calendar,
		Filter,
		RotateCcw,
		Shield,
		Globe,
		Laptop,
		TrendingUp,
		Layers
	} from '@lucide/svelte';

	let { data } = $props();

	const fmt = (n: number) => (Number(n) || 0).toLocaleString('id-ID');

	function fmtDateTime(d: string | Date | null | undefined): string {
		if (!d) return '-';
		try {
			const dt = new Date(d);
			return dt.toLocaleDateString('id-ID', {
				day: '2-digit',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
		} catch {
			return String(d);
		}
	}

	function getActionBadgeVariant(action: string): 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'outline' {
		switch (action) {
			case 'LOGIN':
				return 'success';
			case 'LOGOUT':
				return 'warning';
			case 'EXECUTE_ACTION':
				return 'error';
			case 'EXPORT_EXCEL':
				return 'secondary';
			case 'VIEW_PAGE':
			default:
				return 'default';
		}
	}

	function getActionLabel(action: string): string {
		switch (action) {
			case 'LOGIN':
				return 'Login Masuk';
			case 'LOGOUT':
				return 'Logout Keluar';
			case 'EXECUTE_ACTION':
				return 'Aksi / Submit';
			case 'EXPORT_EXCEL':
				return 'Export Excel';
			case 'VIEW_PAGE':
				return 'Buka Halaman';
			default:
				return action;
		}
	}

	// Export link with current filters
	let exportUrl = $derived(() => {
		const params = new URLSearchParams();
		if (data.tgl1) params.set('tgl1', data.tgl1);
		if (data.tgl2) params.set('tgl2', data.tgl2);
		if (data.q) params.set('q', data.q);
		if (data.user) params.set('user', data.user);
		if (data.menu) params.set('menu', data.menu);
		return `/api/log-akses/export?${params.toString()}`;
	});
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Log Akses & Aktivitas User"
		description="Rekaman riwayat siapa yang mengakses aplikasi dan menu apa saja yang dibuka pengguna."
	>
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<a
					href={exportUrl()}
					class="inline-flex items-center gap-1.5 rounded-xl border-[3px] border-border bg-success px-4 py-2 font-mono text-xs font-black uppercase text-success-foreground brutal-shadow-sm transition-all hover:-translate-x-px hover:-translate-y-px cursor-pointer"
				>
					<Download class="size-4" />
					Export Excel
				</a>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Stat Cards Summary -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Akses Hari Ini -->
		<div class="flex items-center gap-3 rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow">
			<div class="flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-primary text-primary-foreground brutal-shadow-xs">
				<Activity class="size-5" />
			</div>
			<div class="min-w-0">
				<p class="font-mono text-[10px] font-black uppercase tracking-widest text-muted-foreground">
					Akses Hari Ini
				</p>
				<p class="truncate text-xl font-black uppercase text-foreground" style="font-family: var(--font-display)">
					{fmt(data.stats.todayTotal)}
				</p>
			</div>
		</div>

		<!-- User Aktif 7 Hari -->
		<div class="flex items-center gap-3 rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow">
			<div class="flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-success text-success-foreground brutal-shadow-xs">
				<Users class="size-5" />
			</div>
			<div class="min-w-0">
				<p class="font-mono text-[10px] font-black uppercase tracking-widest text-muted-foreground">
					User Aktif (7 Hari)
				</p>
				<p class="truncate text-xl font-black uppercase text-foreground" style="font-family: var(--font-display)">
					{fmt(data.stats.activeUsersCount)} User
				</p>
			</div>
		</div>

		<!-- Menu Terpopuler -->
		<div class="flex items-center gap-3 rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow">
			<div class="flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-warning text-warning-foreground brutal-shadow-xs">
				<TrendingUp class="size-5" />
			</div>
			<div class="min-w-0">
				<p class="font-mono text-[10px] font-black uppercase tracking-widest text-muted-foreground">
					Menu Terpopuler
				</p>
				<p class="truncate text-lg font-black uppercase text-foreground" style="font-family: var(--font-display)">
					{data.stats.topMenu || 'Dashboard'}
				</p>
			</div>
		</div>

		<!-- Total Catatan Terfilter -->
		<div class="flex items-center gap-3 rounded-xl border-[3px] border-border bg-secondary text-secondary-foreground p-4 brutal-shadow">
			<div class="flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-white/30 bg-white/10 text-white brutal-shadow-xs">
				<Layers class="size-5" />
			</div>
			<div class="min-w-0">
				<p class="font-mono text-[10px] font-black uppercase tracking-widest text-white/70">
					Total Rekaman
				</p>
				<p class="truncate text-xl font-black uppercase text-white" style="font-family: var(--font-display)">
					{fmt(data.total)}
				</p>
			</div>
		</div>
	</div>

	<!-- Filter Bar (GET Form) -->
	<form
		method="get"
		class="rounded-2xl border-[3px] border-border bg-card p-4 brutal-shadow space-y-4"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Tanggal Dari -->
			<div>
				<label for="tgl1" class="mb-1 block font-mono text-[11px] font-black uppercase tracking-wider text-foreground">
					Dari Tanggal
				</label>
				<input
					id="tgl1"
					type="date"
					name="tgl1"
					value={data.tgl1}
					class="w-full rounded-xl border-[3px] border-border bg-background px-3 py-2 font-mono text-xs font-bold text-foreground brutal-shadow-xs focus:bg-card focus:outline-none"
				/>
			</div>

			<!-- Tanggal Sampai -->
			<div>
				<label for="tgl2" class="mb-1 block font-mono text-[11px] font-black uppercase tracking-wider text-foreground">
					Sampai Tanggal
				</label>
				<input
					id="tgl2"
					type="date"
					name="tgl2"
					value={data.tgl2}
					class="w-full rounded-xl border-[3px] border-border bg-background px-3 py-2 font-mono text-xs font-bold text-foreground brutal-shadow-xs focus:bg-card focus:outline-none"
				/>
			</div>

			<!-- Filter User -->
			<div>
				<label for="user" class="mb-1 block font-mono text-[11px] font-black uppercase tracking-wider text-foreground">
					Username
				</label>
				<input
					id="user"
					type="text"
					name="user"
					value={data.user}
					placeholder="Contoh: testuser, admin..."
					class="w-full rounded-xl border-[3px] border-border bg-background px-3 py-2 font-mono text-xs font-bold text-foreground brutal-shadow-xs focus:bg-card focus:outline-none"
				/>
			</div>

			<!-- Pencarian Global -->
			<div>
				<label for="q" class="mb-1 block font-mono text-[11px] font-black uppercase tracking-wider text-foreground">
					Kata Kunci / Menu
				</label>
				<div class="relative">
					<Search class="absolute left-3 top-2.5 size-4 text-muted-foreground" />
					<input
						id="q"
						type="text"
						name="q"
						value={data.q}
						placeholder="Cari menu, IP, aksi..."
						class="w-full rounded-xl border-[3px] border-border bg-background pl-9 pr-3 py-2 font-mono text-xs font-bold text-foreground brutal-shadow-xs focus:bg-card focus:outline-none"
					/>
				</div>
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-2 border-t-2 border-border pt-3">
			<span class="font-mono text-xs font-bold text-muted-foreground">
				Menampilkan log riwayat akses dan eksekusi modul sistem
			</span>
			<div class="flex items-center gap-2">
				<a
					href="/dashboard/log-akses"
					class="inline-flex items-center gap-1.5 rounded-xl border-2 border-border bg-muted px-3 py-2 font-mono text-xs font-black uppercase text-foreground brutal-shadow-xs hover:bg-card cursor-pointer"
				>
					<RotateCcw class="size-3.5" />
					Reset
				</a>
				<button
					type="submit"
					class="inline-flex items-center gap-1.5 rounded-xl border-[3px] border-border bg-primary px-4 py-2 font-mono text-xs font-black uppercase text-primary-foreground brutal-shadow-sm hover:bg-primary-accent cursor-pointer"
				>
					<Filter class="size-3.5" />
					Tampilkan
				</button>
			</div>
		</div>
	</form>

	<!-- Table Result -->
	<div class="overflow-hidden rounded-2xl border-[3px] border-border bg-card brutal-shadow">
		<Table wrapperClass="border-0 shadow-none rounded-none">
			<TableHeader>
				<TableRow class="bg-muted/50">
					<TableHead class="w-12 text-center font-mono text-[10px] font-black uppercase">No</TableHead>
					<TableHead class="w-44 font-mono text-[10px] font-black uppercase">Waktu Akses</TableHead>
					<TableHead class="w-36 font-mono text-[10px] font-black uppercase">User</TableHead>
					<TableHead class="font-mono text-[10px] font-black uppercase">Menu / Halaman</TableHead>
					<TableHead class="w-32 font-mono text-[10px] font-black uppercase">Tipe Aksi</TableHead>
					<TableHead class="w-32 font-mono text-[10px] font-black uppercase">Alamat IP</TableHead>
					<TableHead class="font-mono text-[10px] font-black uppercase">Detail / Info</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#if data.rows.length === 0}
					<TableRow>
						<TableCell colspan={7} class="h-32 text-center font-mono text-xs font-bold text-muted-foreground">
							{data.error ? data.error : 'Tidak ada catatan aktivitas untuk filter ini'}
						</TableCell>
					</TableRow>
				{:else}
					{#each data.rows as r, idx}
						<TableRow class="hover:bg-muted/30">
							<TableCell class="text-center font-mono text-xs text-muted-foreground">
								{(data.page - 1) * data.pageSize + idx + 1}
							</TableCell>
							<TableCell class="font-mono text-xs font-black text-foreground whitespace-nowrap">
								{fmtDateTime(r.CreatedAt)}
							</TableCell>
							<TableCell>
								<span class="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-black uppercase text-foreground">
									<UserCheck class="size-3 text-primary" />
									{r.UserName}
								</span>
							</TableCell>
							<TableCell class="font-black text-xs text-foreground">
								<span class="block">{r.MenuName}</span>
								<span class="font-mono text-[10px] font-normal text-muted-foreground">{r.Path}</span>
							</TableCell>
							<TableCell>
								<Badge
									variant={getActionBadgeVariant(r.Action)}
									class="border-2 font-mono text-[9px] uppercase tracking-wider"
								>
									{getActionLabel(r.Action)}
								</Badge>
							</TableCell>
							<TableCell class="font-mono text-xs text-muted-foreground whitespace-nowrap">
								{r.IP || '-'}
							</TableCell>
							<TableCell class="max-w-xs truncate font-mono text-[11px] text-muted-foreground" title={r.Details || r.UserAgent || ''}>
								{r.Details || r.UserAgent || '-'}
							</TableCell>
						</TableRow>
					{/each}
				{/if}
			</TableBody>
		</Table>

		<!-- Pagination Footer -->
		{#if data.total > 0}
			<div class="border-t-[3px] border-border bg-card px-4 py-2">
				<Pagination
					page={data.page}
					pageSize={data.pageSize}
					total={data.total}
					basePath="/dashboard/log-akses"
					params={{
						q: data.q,
						user: data.user,
						menu: data.menu,
						tgl1: data.tgl1,
						tgl2: data.tgl2
					}}
					pageSizeOptions={[25, 50, 100, 200]}
				/>
			</div>
		{/if}
	</div>
</div>
