<script lang="ts">
	import { page, navigating } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		LayoutDashboard,
		ClipboardList,
		Factory,
		LogOut,
		ChevronUp,
		Sparkles,
		Package,
		ArrowDownToLine,
		ArrowUpFromLine,
		RotateCcw,
		ArrowLeftRight,
		Truck,
		BarChart3,
		Tag,
		History,
		Menu,
		X,
		ShoppingCart,
		UserCheck,
		FileSpreadsheet
	} from '@lucide/svelte';

	let { data, children } = $props();

	let sidebarOpen = $state(true);
	let mobileSidebarOpen = $state(false);
	let userMenuOpen = $state(false);
	let sessionDialogOpen = $state(false);

	const navGroups = [
		{
			label: 'Utama',
			items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
		},
		{
			label: 'Monitoring',
			items: [
				{ href: '/dashboard/monitoring-produksi', label: 'Monitoring Produksi', icon: BarChart3 },
				{ href: '/dashboard/monitoring-pembelian', label: 'Monitoring Pembelian', icon: ShoppingCart }
			]
		},
		{
			label: 'Produksi',
			items: [
				{ href: '/dashboard/ppic', label: 'Production Plan', icon: ClipboardList },
				{ href: '/dashboard/spk', label: 'SPK', icon: Tag }
			]
		},
		{
			label: 'Master Data',
			items: [{ href: '/dashboard/master-barang', label: 'Master Barang', icon: Package }]
		},
		{
			label: 'Gudang',
			items: [
				{ href: '/dashboard/mutasi-departemen', label: 'kiw-sheet', icon: FileSpreadsheet },
				{ href: '/dashboard/lbm', label: 'LBM', icon: ArrowDownToLine },
				{ href: '/dashboard/lbk', label: 'LBK', icon: ArrowUpFromLine },
				{ href: '/dashboard/retur-produksi', label: 'Retur Produksi', icon: RotateCcw },
				{ href: '/dashboard/mutasi-gudang', label: 'Mutasi Gudang', icon: ArrowLeftRight },
				{ href: '/dashboard/pemasukan-gudang', label: 'Pemasukan Gudang', icon: Truck }
			]
		},
		{
			label: 'Audit & Log',
			items: [
				{ href: '/dashboard/log-akses', label: 'Log Akses User', icon: UserCheck },
				{ href: '/dashboard/log', label: 'Log Transaksi ERP', icon: History }
			]
		}
	];

	let pathname = $derived($page.url.pathname.replace(/\/$/, '') || '/dashboard');

	function isActive(href: string): boolean {
		if (href === '/dashboard') return pathname === '/dashboard';
		return pathname === href || pathname.startsWith(href + '/');
	}

	let activeLabel = $derived(
		navGroups.flatMap((g) => g.items).find((n) => isActive(n.href))?.label ?? 'Dashboard'
	);

	let displayName = $derived(
		(data.user?.UserName as string | undefined) ??
			(data.user?.username as string | undefined) ??
			'User'
	);
	let initials = $derived(displayName.slice(0, 2).toUpperCase());
	let userDept = $derived((data.user?.Dept as string | undefined) ?? 'PPIC');
	let isBackup = $derived(data.dbSource === 'backup');

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
		try {
			localStorage.setItem('kiw_sidebar_open', String(sidebarOpen));
		} catch {}
	}

	function handleLogout() {
		try {
			localStorage.removeItem('user');
		} catch {}
		window.location.href = '/api/logout';
	}

	function handleSessionDialogOk() {
		try {
			localStorage.removeItem('user');
		} catch {}
		window.location.href = '/login?error=session_taken';
	}

	onMount(() => {
		try {
			const saved = localStorage.getItem('kiw_sidebar_open');
			if (saved !== null) {
				sidebarOpen = saved === 'true';
			}
		} catch {}

		// Close user menu on outside click
		function onDocClick(e: MouseEvent) {
			const target = e.target as HTMLElement | null;
			if (userMenuOpen && target && !target.closest('#user-menu-container')) {
				userMenuOpen = false;
			}
		}
		document.addEventListener('click', onDocClick);

		let checking = false;
		async function checkSession() {
			if (checking) return;
			checking = true;
			try {
				const res = await fetch('/api/auth/check', {
					headers: { Accept: 'application/json' },
					cache: 'no-store'
				});
				if (res.status === 401) {
					const body = await res.json().catch(() => ({}));
					if (body?.code === 'SESSION_TAKEN') {
						sessionDialogOpen = true;
						clearInterval(timer);
					}
				}
			} catch {}
			checking = false;
		}

		const timer = setInterval(checkSession, 30000);
		const onVisibility = () => {
			if (document.visibilityState === 'visible') checkSession();
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisibility);
			document.removeEventListener('click', onDocClick);
		};
	});
</script>

<svelte:head>
	<title>{activeLabel} — KIW Monitoring Inventori</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
	<!-- Mobile Sidebar Drawer Backdrop -->
	{#if mobileSidebarOpen}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
			onclick={() => (mobileSidebarOpen = false)}
			aria-label="Tutup menu"
		></button>
	{/if}

	<!-- Sidebar (Desktop Sticky, Mobile Slide-over Drawer) -->
	<aside
		class="fixed inset-y-0 left-0 z-50 flex flex-col border-r-[3px] border-border bg-sidebar transition-all duration-200
			md:sticky md:top-0 md:h-screen md:shrink-0
			{mobileSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
			{sidebarOpen ? 'md:w-64' : 'md:w-16'}"
	>
		<!-- Sidebar Header -->
		<div class="flex h-16 shrink-0 items-center border-b-[3px] border-border px-2.5 bg-sidebar {sidebarOpen ? 'justify-between' : 'justify-center'}">
			<a
				href="/dashboard"
				class="flex items-center gap-2.5 overflow-hidden rounded-xl p-1 transition-all hover:bg-sidebar-accent"
				title="KIW Monitoring Inventori"
			>
				<div
					class="flex aspect-square size-10 shrink-0 items-center justify-center rounded-lg border-[3px] border-border bg-sidebar-primary text-sidebar-primary-foreground brutal-shadow-sm"
				>
					<Factory class="size-5" />
				</div>
				{#if sidebarOpen}
					<div class="grid flex-1 text-left text-sm leading-tight">
						<span class="truncate font-black uppercase tracking-tight text-white text-base" style="font-family: var(--font-display)">
							KIW Inventori
						</span>
						<span class="truncate font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
							Monitoring • CP
						</span>
					</div>
				{/if}
			</a>
			<!-- Mobile drawer close button -->
			<button
				type="button"
				class="md:hidden rounded-lg border-2 border-border bg-card p-1 text-foreground cursor-pointer"
				onclick={() => (mobileSidebarOpen = false)}
				aria-label="Tutup menu"
			>
				<X class="size-5" />
			</button>
		</div>

		<!-- Backup status banner in sidebar -->
		{#if isBackup}
			<div class="p-2">
				{#if sidebarOpen}
					<div class="bg-warning text-warning-foreground border-[3px] border-border rounded-lg px-3 py-1.5 text-center brutal-shadow-sm">
						<span class="font-mono text-[10px] font-black uppercase tracking-widest">
							⚠ Server Backup
						</span>
					</div>
				{:else}
					<div class="flex justify-center" title="Server Backup">
						<span class="size-3 rounded-full border-2 border-border bg-warning animate-pulse"></span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Sidebar Nav List -->
		<div class="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin">
			{#each navGroups as group}
				<div>
					{#if sidebarOpen}
						<div class="px-2 pb-1.5 font-mono text-[10px] font-black uppercase tracking-[0.15em] text-white/50">
							{group.label}
						</div>
					{/if}
					<div class="space-y-1">
						{#each group.items as item}
							{@const ItemIcon = item.icon}
							{@const active = isActive(item.href)}
							<a
								href={item.href}
								onclick={() => (mobileSidebarOpen = false)}
								class="flex items-center rounded-xl transition-all border-[3px] text-xs font-black uppercase tracking-wide
									{sidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center p-2.5 mx-auto'}
									{active
										? 'bg-primary text-primary-foreground border-border brutal-shadow-sm -translate-x-px -translate-y-px'
										: 'bg-sidebar text-sidebar-foreground border-transparent hover:bg-sidebar-accent hover:text-white hover:border-border hover:brutal-shadow-sm'}"
								title={item.label}
							>
								<ItemIcon class="size-4.5 shrink-0" />
								{#if sidebarOpen}
									<span class="truncate">{item.label}</span>
								{/if}
							</a>
						{/each}
					</div>
				</div>
			{/each}

			{#if sidebarOpen}
				<!-- Brutal decorative block (matches neokiw) -->
				<div class="mt-4 rounded-xl border-[3px] border-border bg-primary p-3 brutal-shadow-sm text-primary-foreground">
					<p class="font-mono text-[10px] font-black uppercase tracking-widest text-primary-foreground/80">
						System Status
					</p>
					<p class="mt-1 font-display text-xs font-black" style="font-family: var(--font-display)">
						KIW ENGINE ACTIVE
					</p>
					<div class="mt-2 h-2 w-full rounded-full border-2 border-border bg-primary-foreground">
						<div class="bg-success h-full w-[92%] rounded-full"></div>
					</div>
					<p class="mt-1 font-mono text-[9px] font-bold text-primary-foreground/80">
						92% EFFICIENCY
					</p>
				</div>
			{/if}
		</div>

		<!-- Sidebar Footer / User Profile Popover -->
		<div id="user-menu-container" class="relative border-t-[3px] border-border bg-sidebar p-2">
			{#if userMenuOpen}
				<div
					class="absolute z-50 rounded-xl border-[3px] border-border bg-card p-2 brutal-shadow text-foreground min-w-56
						{sidebarOpen ? 'bottom-full left-2 right-2 mb-2' : 'left-full bottom-1 ml-2'}"
				>
					<div class="flex items-center gap-2 border-b-2 border-border p-2">
						<div class="flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-primary font-black text-primary-foreground">
							{initials}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-black uppercase">{displayName}</p>
							<p class="text-muted-foreground font-mono text-[10px] uppercase font-bold">{userDept}</p>
						</div>
					</div>
					<div class="px-2 py-1.5 flex items-center gap-2 font-mono text-[11px] font-bold text-muted-foreground">
						<Sparkles class="size-3.5" /> Profil Aktif
					</div>
					<div class="border-t border-border pt-1">
						<button
							type="button"
							onclick={handleLogout}
							class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border bg-error px-3 py-2 text-xs font-black uppercase tracking-wide text-error-foreground hover:bg-error/90 brutal-shadow-sm cursor-pointer"
						>
							<LogOut class="size-4" /> Keluar
						</button>
					</div>
				</div>
			{/if}

			<button
				type="button"
				onclick={() => (userMenuOpen = !userMenuOpen)}
				class="flex w-full items-center rounded-xl border-[3px] border-border bg-card text-card-foreground brutal-shadow-sm hover:-translate-x-px hover:-translate-y-px transition-all cursor-pointer
					{sidebarOpen ? 'gap-2 p-2' : 'justify-center p-2'}"
				title="{displayName} ({userDept})"
			>
				<div class="flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-primary font-black text-primary-foreground text-xs">
					{initials}
				</div>
				{#if sidebarOpen}
					<div class="grid flex-1 text-left text-xs leading-tight min-w-0">
						<span class="truncate font-black uppercase">{displayName}</span>
						<span class="truncate font-mono text-[10px] font-bold text-muted-foreground uppercase">{userDept}</span>
					</div>
					<ChevronUp class="size-4 shrink-0 transition-transform {userMenuOpen ? 'rotate-180' : ''}" />
				{/if}
			</button>
		</div>
	</aside>

	<!-- Main Inset -->
	<div class="flex flex-1 flex-col min-w-0">
		<!-- Header -->
		<header class="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b-[3px] border-border bg-card px-4 brutal-shadow-sm md:px-6">
			<!-- Mobile hamburger -->
			<button
				type="button"
				class="md:hidden flex size-9 items-center justify-center rounded-lg border-[3px] border-border bg-card text-foreground brutal-shadow-sm hover:bg-muted cursor-pointer"
				onclick={() => (mobileSidebarOpen = true)}
				aria-label="Buka menu"
			>
				<Menu class="size-5" />
			</button>

			<!-- Desktop sidebar toggle -->
			<button
				type="button"
				class="hidden md:flex size-9 items-center justify-center rounded-lg border-[3px] border-border bg-card text-foreground brutal-shadow-sm hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer -ml-1 active:translate-x-px active:translate-y-px"
				onclick={toggleSidebar}
				title="Toggle Sidebar"
			>
				<Menu class="size-5" />
			</button>

			<div class="hidden h-6 w-0.75 bg-border md:block"></div>

			<div class="min-w-0">
				<h2 class="truncate font-black uppercase tracking-tight text-sm md:text-base" style="font-family: var(--font-display)">
					{activeLabel}
				</h2>
				<p class="text-muted-foreground hidden font-mono text-[10px] font-bold uppercase tracking-widest md:block">
					{#if activeLabel === 'Log Akses User'}
						Audit Trail & Aktivitas Pengguna Real-Time
					{:else if activeLabel === 'Monitoring Pembelian'}
						Outstanding PO, PR & Rekap Pembelian
					{:else if activeLabel === 'Log Transaksi ERP'}
						Riwayat Transaksi & Audit Log Database ERP
					{:else if activeLabel === 'Master Barang'}
						Monitoring Inputan Admin — Export Excel
					{:else if activeLabel === 'Monitoring Produksi'}
						Monitoring Inputan Admin — IN/SP/MO/PL/AS • B/H
					{:else if activeLabel === 'Production Plan'}
						Perencanaan Produksi & Jadwal Kerja
					{:else if activeLabel === 'SPK'}
						taPROrder — Bulk Completed/FinishedDate
					{:else if activeLabel === 'LBM'}
						Laporan Barang Masuk Gudang
					{:else if activeLabel === 'LBK'}
						Laporan Barang Keluar Gudang
					{:else if activeLabel === 'Mutasi Gudang'}
						Perpindahan Antar Gudang & Lokasi
					{:else if activeLabel === 'Dashboard'}
						Ringkasan Inventori & Produksi
					{:else}
						Hitung • Commit • Export — Neo-Brutal Edition
					{/if}
				</p>
			</div>

			<div class="ml-auto flex items-center gap-2">
				{#if isBackup}
					<div class="flex items-center gap-2 rounded-full border-[3px] border-border bg-warning px-3 py-1 text-warning-foreground brutal-shadow-sm">
						<span class="size-2 animate-pulse rounded-full border border-border bg-warning-foreground"></span>
						<span class="font-mono text-[10px] font-black uppercase tracking-widest">Backup</span>
					</div>
				{:else}
					<div class="flex items-center gap-2 rounded-full border-[3px] border-border bg-success px-3 py-1 text-success-foreground brutal-shadow-sm">
						<span class="size-2 animate-pulse rounded-full border border-border bg-success-foreground"></span>
						<span class="font-mono text-[10px] font-black uppercase tracking-widest">Live</span>
					</div>
				{/if}
			</div>
		</header>

		<!-- Main Content -->
		<main class="flex flex-1 flex-col p-4 md:p-6">
			{@render children()}
		</main>

		<!-- Footer -->
		<footer class="mt-auto border-t-[3px] border-border bg-card px-4 py-3 text-center brutal-shadow-sm md:px-6">
			<p class="font-mono text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
				KIW Monitoring Inventori — <span class="text-foreground">Neo-Brutal v2</span> •
				Built with SvelteKit Develop by Redo
			</p>
		</footer>
	</div>
</div>

<!-- Global Navigation Loading Feedback -->
{#if $navigating}
	<div class="fixed top-0 left-0 right-0 z-[9999] h-1.5 bg-primary/20 overflow-hidden pointer-events-none">
		<div class="h-full bg-primary animate-pulse w-full"></div>
	</div>
	<div class="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-xl border-[3px] border-border bg-card px-4 py-3 brutal-shadow-lg pointer-events-none">
		<div class="size-4 animate-spin rounded-full border-[3px] border-primary border-t-transparent"></div>
		<div>
			<p class="font-mono text-xs font-black uppercase tracking-wider text-foreground">
				Memuat Data...
			</p>
			<p class="font-mono text-[9px] font-bold text-muted-foreground uppercase">
				Mohon tunggu
			</p>
		</div>
	</div>
{/if}

<!-- Session Taken Dialog -->
{#if sessionDialogOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
		<div class="w-full max-w-md rounded-2xl border-4 border-border bg-card p-0 brutal-shadow-lg animate-in">
			<div class="flex items-center gap-2 border-b-4 border-border bg-error px-5 py-3 text-error-foreground">
				<span class="flex size-7 items-center justify-center rounded-full border-[3px] border-border bg-card font-black text-error">
					!
				</span>
				<h2 class="font-black uppercase tracking-tight text-lg" style="font-family: var(--font-display)">
					Sesi Berakhir
				</h2>
			</div>
			<div class="space-y-3 px-5 py-4">
				<p class="text-sm font-bold leading-relaxed">
					Akun Anda baru saja login di perangkat lain. Sesi di perangkat ini telah diakhiri demi keamanan.
				</p>
				<p class="text-muted-foreground font-mono text-[10px] font-bold uppercase tracking-wide">
					Satu akun hanya boleh aktif di satu perangkat dalam waktu bersamaan.
				</p>
			</div>
			<div class="flex justify-end gap-2 border-t-[3px] border-border bg-muted px-5 py-3">
				<button
					type="button"
					onclick={handleSessionDialogOk}
					class="rounded-xl border-[3px] border-border bg-primary px-5 py-2 text-sm font-black uppercase tracking-wide text-primary-foreground brutal-shadow-sm cursor-pointer hover:bg-primary/90"
				>
					Login Kembali
				</button>
			</div>
		</div>
	</div>
{/if}
