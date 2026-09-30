<script lang="ts">
	import { page, navigating } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		LayoutDashboard,
		ClipboardList,
		Factory,
		LogOut,
		ChevronUp,
		ChevronDown,
		Sparkles,
		Package,
		ArrowDownToLine,
		ArrowUpFromLine,
		RotateCcw,
		ArrowLeftRight,
		Truck,
		Building2,
		BarChart3,
		Tag,
		History,
		Menu,
		X,
		ShoppingCart,
		UserCheck,
		FileSpreadsheet,
		Layers,
		Search,
		BookOpen,
		Scale,
		TrendingUp,
		Calculator,
		FileText,
		Coins,
		CreditCard,
		Receipt,
		PanelLeftClose,
		Users,
		UserCog,
		Workflow,
		Lock
	} from '@lucide/svelte';
	import { Toaster, NotificationCenter } from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import { hasMenuAccess, resolveUserRole, MENU_NAME_MAP } from '$lib/permissions';

	let { data, children } = $props();

	let sidebarOpen = $state(true);
	let mobileSidebarOpen = $state(false);
	let userMenuOpen = $state(false);
	let sessionDialogOpen = $state(false);

	// Collapsed state for groups
	let collapsedGroups = $state<Record<string, boolean>>({});

	// Quick search
	let searchQuery = $state('');
	let searchInputEl = $state<HTMLInputElement | null>(null);

	interface NavItem {
		href: string;
		label: string;
		icon: any;
	}

	interface NavGroup {
		key: string;
		label: string;
		items: NavItem[];
	}

	const navGroups: NavGroup[] = [
		{
			key: 'utama',
			label: 'Utama',
			items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
		},
		{
			key: 'transaksi',
			label: 'Input Transaksi',
			items: [
				{ href: '/dashboard/input-po', label: 'Input Purchase Order', icon: ShoppingCart },
				{ href: '/dashboard/input-spk', label: 'Input SPK', icon: Tag },
				{ href: '/dashboard/input-produksi', label: 'Input Produksi', icon: Factory },
				{ href: '/dashboard/input-penerimaan', label: 'Input Penerimaan', icon: Truck },
				{ href: '/dashboard/input-lbm', label: 'Input LBM', icon: ArrowDownToLine },
				{ href: '/dashboard/input-lbk', label: 'Input LBK', icon: ArrowUpFromLine },
				{ href: '/dashboard/input-mutasi', label: 'Input Mutasi', icon: ArrowLeftRight },
				{ href: '/dashboard/input-retur', label: 'Input Retur', icon: RotateCcw }
			]
		},
		{
			key: 'produksi',
			label: 'Produksi & PPIC',
			items: [
				{ href: '/dashboard/laporan-produksi', label: 'Laporan Produksi', icon: FileSpreadsheet },
				{ href: '/dashboard/monitoring-produksi', label: 'Monitoring Produksi', icon: BarChart3 },
				{ href: '/dashboard/ppic', label: 'Production Plan', icon: ClipboardList },
				{ href: '/dashboard/spk', label: 'SPK', icon: Tag }
			]
		},
		{
			key: 'gudang',
			label: 'Gudang & Logistik',
			items: [
				{ href: '/dashboard/lbm', label: 'LBM', icon: ArrowDownToLine },
				{ href: '/dashboard/lbk', label: 'LBK', icon: ArrowUpFromLine },
				{ href: '/dashboard/pemasukan-gudang', label: 'Pemasukan Gudang', icon: Truck },
				{ href: '/dashboard/retur-produksi', label: 'Retur Produksi', icon: RotateCcw },
				{ href: '/dashboard/mutasi-gudang', label: 'Mutasi Gudang', icon: ArrowLeftRight },
				{ href: '/dashboard/kartu-stock', label: 'Kartu Stock', icon: Layers },
				{ href: '/dashboard/mutasi-departemen', label: 'kiw-sheet', icon: FileSpreadsheet }
			]
		},
		{
			key: 'pembelian',
			label: 'Pembelian',
			items: [
				{ href: '/dashboard/input-po', label: 'Input Purchase Order', icon: ShoppingCart },
				{ href: '/dashboard/monitoring-pembelian', label: 'Monitoring Pembelian', icon: ShoppingCart },
				{ href: '/dashboard/laporan-pembelian', label: 'Laporan Pembelian', icon: ArrowDownToLine }
			]
		},
		{
			key: 'master',
			label: 'Master Data',
			items: [
				{ href: '/dashboard/master-barang', label: 'Master Barang', icon: Package },
				{ href: '/dashboard/master-bom', label: 'Master BOM', icon: Workflow },
				{ href: '/dashboard/master-supplier', label: 'Master Supplier', icon: Building2 },
				{ href: '/dashboard/master-customer', label: 'Master Customer', icon: Users },
				{ href: '/dashboard/master-user', label: 'Master User', icon: UserCog }
			]
		},
		{
			key: 'finance',
			label: 'Finance & Keuangan',
			items: [
				{ href: '/dashboard/jurnal', label: 'Jurnal Transaksi', icon: FileText },
				{ href: '/dashboard/buku-besar', label: 'Buku Besar (GL)', icon: BookOpen },
				{ href: '/dashboard/trial-balance', label: 'Neraca Saldo', icon: Calculator },
				{ href: '/dashboard/neraca', label: 'Laporan Neraca', icon: Scale },
				{ href: '/dashboard/laba-rugi', label: 'Laba Rugi', icon: TrendingUp },
				{ href: '/dashboard/hpp', label: 'Laporan HPP', icon: Coins },
				{ href: '/dashboard/kartu-hutang', label: 'Kartu Hutang (AP)', icon: CreditCard },
				{ href: '/dashboard/kartu-piutang', label: 'Kartu Piutang (AR)', icon: Receipt },
				{ href: '/dashboard/laporan-penjualan', label: 'Laporan Penjualan', icon: TrendingUp }
			]
		},
		{
			key: 'audit',
			label: 'Sistem & Audit',
			items: [
				{ href: '/dashboard/setting-lockform', label: 'Kunci Form (Lock)', icon: Lock },
				{ href: '/dashboard/log-akses', label: 'Log Akses User', icon: UserCheck },
				{ href: '/dashboard/log', label: 'Log Transaksi ERP', icon: History }
			]
		}
	];

	// Filter menu groups and items based on user's role
	let visibleNavGroups = $derived.by(() => {
		return navGroups
			.map((group) => ({
				...group,
				items: group.items.filter((item) => hasMenuAccess(item.href, data.user))
			}))
			.filter((group) => group.items.length > 0);
	});

	let allItems = $derived(
		visibleNavGroups.flatMap((g) => g.items.map((i) => ({ ...i, groupLabel: g.label })))
	);

	let pathname = $derived($page.url.pathname.replace(/\/$/, '') || '/dashboard');

	function isActive(href: string): boolean {
		if (href === '/dashboard') return pathname === '/dashboard';
		return pathname === href || pathname.startsWith(href + '/');
	}

	let activeItem = $derived(allItems.find((n) => isActive(n.href)));
	let activeLabel = $derived(activeItem?.label ?? MENU_NAME_MAP[pathname] ?? 'Dashboard');
	let activeGroup = $derived(visibleNavGroups.find((g) => g.items.some((i) => isActive(i.href))));
	let activeGroupLabel = $derived(activeGroup?.label ?? 'Utama');

	// Auto-expand group that contains active item
	$effect(() => {
		if (activeGroup && collapsedGroups[activeGroup.key]) {
			collapsedGroups[activeGroup.key] = false;
		}
	});

	function toggleGroup(key: string) {
		collapsedGroups[key] = !collapsedGroups[key];
		try {
			localStorage.setItem('kiw_collapsed_groups', JSON.stringify(collapsedGroups));
		} catch {}
	}

	// Filtered items when searching
	let filteredItems = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return [];
		return allItems.filter(
			(item) => item.label.toLowerCase().includes(q) || item.groupLabel.toLowerCase().includes(q)
		);
	});

	let resolvedRole = $derived(resolveUserRole(data.user));
	let displayName = $derived(
		(data.user?.UserName as string | undefined) ??
			(data.user?.username as string | undefined) ??
			'User'
	);
	let initials = $derived(displayName.slice(0, 2).toUpperCase());
	let userDept = $derived(resolvedRole.roleLabel);
	let isBackup = $derived(data.dbSource === 'backup');

	// Notification when redirected due to unauthorized access
	$effect(() => {
		const err = $page.url.searchParams.get('error');
		if (err === 'unauthorized') {
			const from = $page.url.searchParams.get('from');
			const fromName = from ? (MENU_NAME_MAP[from] || from) : '';
			toast.error('Akses Terbatas', {
				description: fromName
					? `Role '${userDept}' tidak memiliki izin membuka menu '${fromName}'.`
					: `Role '${userDept}' tidak memiliki izin membuka halaman tersebut.`
			});
			try {
				const cleanUrl = new URL(window.location.href);
				cleanUrl.searchParams.delete('error');
				cleanUrl.searchParams.delete('from');
				window.history.replaceState({}, '', cleanUrl.toString());
			} catch {}
		}
	});

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
			const savedCollapsed = localStorage.getItem('kiw_collapsed_groups');
			if (savedCollapsed) {
				collapsedGroups = JSON.parse(savedCollapsed);
			}
		} catch {}

		// Keyboard shortcut '/' to search
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
				e.preventDefault();
				if (!sidebarOpen) sidebarOpen = true;
				searchInputEl?.focus();
			}
			if (e.key === 'Escape' && searchQuery) {
				searchQuery = '';
			}
		}
		window.addEventListener('keydown', onKeyDown);

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
			window.removeEventListener('keydown', onKeyDown);
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
		<div
			class="flex h-16 shrink-0 items-center border-b-[3px] border-border px-3 bg-sidebar {sidebarOpen
				? 'justify-between'
				: 'justify-center'}"
		>
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
					<div class="grid flex-1 text-left text-sm leading-tight min-w-0">
						<span
							class="truncate font-black uppercase tracking-tight text-white text-base"
							style="font-family: var(--font-display)"
						>
							KIW Inventori
						</span>
						<span
							class="truncate font-mono text-[10px] font-bold uppercase tracking-widest text-primary"
						>
							Monitoring • CP
						</span>
					</div>
				{/if}
			</a>

			<!-- Desktop collapse button inside sidebar -->
			{#if sidebarOpen}
				<button
					type="button"
					class="hidden md:flex size-7 items-center justify-center rounded-md border border-white/20 text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
					onclick={toggleSidebar}
					title="Ciutkan Sidebar"
				>
					<PanelLeftClose class="size-3.5" />
				</button>
			{/if}

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
			<div class="p-2 border-b-2 border-border/30">
				{#if sidebarOpen}
					<div
						class="bg-warning text-warning-foreground border-2 border-border rounded-lg px-2.5 py-1 text-center"
					>
						<span class="font-mono text-[10px] font-black uppercase tracking-wider">
							⚠ Server Backup
						</span>
					</div>
				{:else}
					<div class="flex justify-center" title="Server Backup">
						<span class="size-2.5 rounded-full bg-warning animate-pulse"></span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Quick Search Input (When Sidebar Open) -->
		{#if sidebarOpen}
			<div class="p-2 border-b border-white/10">
				<div class="relative">
					<Search
						class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/40 pointer-events-none"
					/>
					<input
						bind:this={searchInputEl}
						bind:value={searchQuery}
						type="text"
						placeholder="Cari menu... (/)"
						class="w-full bg-white/5 border border-white/15 focus:border-primary focus:bg-white/10 text-white placeholder:text-white/40 text-xs font-mono rounded-lg pl-8 pr-7 py-1.5 outline-none transition-all"
					/>
					{#if searchQuery}
						<button
							type="button"
							onclick={() => (searchQuery = '')}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
						>
							<X class="size-3.5" />
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Sidebar Nav List -->
		<div class="flex-1 overflow-y-auto px-2 py-2.5 space-y-3 scrollbar-thin">
			<!-- A. Search Results Active -->
			{#if searchQuery.trim().length > 0}
				<div>
					<div class="px-2 pb-1.5 flex items-center justify-between">
						<span class="font-mono text-[10px] font-black uppercase tracking-wider text-primary">
							Hasil ({filteredItems.length})
						</span>
						<button
							type="button"
							onclick={() => (searchQuery = '')}
							class="font-mono text-[9px] text-white/50 hover:text-white uppercase underline cursor-pointer"
						>
							Reset
						</button>
					</div>

					{#if filteredItems.length === 0}
						<div class="p-3 text-center text-white/40 font-mono text-xs">
							Menu tidak ditemukan
						</div>
					{:else}
						<div class="space-y-0.5">
							{#each filteredItems as item}
								{@const ItemIcon = item.icon}
								{@const active = isActive(item.href)}
								<a
									href={item.href}
									onclick={() => {
										mobileSidebarOpen = false;
										searchQuery = '';
									}}
									class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all
										{active
										? 'bg-primary text-primary-foreground brutal-shadow-sm font-black'
										: 'text-white/80 hover:bg-white/10 hover:text-white'}"
								>
									<ItemIcon class="size-4 shrink-0" />
									<span class="truncate flex-1">{item.label}</span>
									<span class="font-mono text-[9px] text-white/40 uppercase">{item.groupLabel}</span>
								</a>
							{/each}
						</div>
					{/if}
				</div>

				<!-- B. Normal Grouped View -->
			{:else}
				{#each visibleNavGroups as group}
					{@const isCollapsed = collapsedGroups[group.key]}
					{@const hasActive = group.items.some((i) => isActive(i.href))}

					<div>
						<!-- Group Header -->
						{#if sidebarOpen}
							{#if group.key === 'utama'}
								<!-- Utama no header needed, render items directly -->
							{:else}
								<button
									type="button"
									onclick={() => toggleGroup(group.key)}
									class="w-full flex items-center justify-between px-2 pt-2.5 pb-1 text-left transition-colors cursor-pointer group {hasActive ? 'text-primary' : 'text-white/45 hover:text-white/80'}"
								>
									<div class="flex items-center gap-1.5 min-w-0">
										<span class="font-mono text-[10px] font-black uppercase tracking-wider truncate">
											{group.label}
										</span>
										{#if hasActive && isCollapsed}
											<span class="size-1.5 rounded-full bg-primary shrink-0 animate-pulse" title="Menu aktif di dalam grup ini"></span>
										{/if}
									</div>
									<div class="flex items-center gap-1.5 shrink-0">
										<span class="text-[9px] font-mono opacity-50 px-1 py-0.2 rounded bg-white/5">{group.items.length}</span>
										<ChevronDown
											class="size-3 transition-transform duration-150 {isCollapsed
												? '-rotate-90 text-white/30'
												: 'rotate-0'} {hasActive ? 'text-primary' : 'text-white/40 group-hover:text-white/70'}"
										/>
									</div>
								</button>
							{/if}
						{:else if group.key !== 'utama'}
							<div class="my-1.5 border-t border-white/10 mx-1"></div>
						{/if}

						<!-- Group Items -->
						{#if !isCollapsed || !sidebarOpen}
							<div class="space-y-0.5">
								{#each group.items as item}
									{@const ItemIcon = item.icon}
									{@const active = isActive(item.href)}
									<a
										href={item.href}
										onclick={() => (mobileSidebarOpen = false)}
										class="flex items-center rounded-lg transition-all text-xs font-bold
											{sidebarOpen ? 'gap-2.5 px-2.5 py-1.5' : 'justify-center p-2 mx-auto'}
											{active
											? 'bg-primary text-primary-foreground border-2 border-border brutal-shadow-sm font-black -translate-x-px -translate-y-px'
											: 'text-white/75 hover:bg-white/10 hover:text-white border-2 border-transparent'}"
										title="{item.label} — {group.label}"
									>
										<ItemIcon class="size-4 shrink-0" />
										{#if sidebarOpen}
											<span class="truncate flex-1">{item.label}</span>
											{#if active}
												<span class="size-1.5 rounded-full bg-white shrink-0"></span>
											{/if}
										{/if}
									</a>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
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
						<div
							class="flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-primary font-black text-primary-foreground"
						>
							{initials}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-black uppercase">{displayName}</p>
							<p class="text-muted-foreground font-mono text-[10px] uppercase font-bold">
								{userDept}
							</p>
						</div>
					</div>
					<div
						class="px-2 py-1.5 flex items-center gap-2 font-mono text-[11px] font-bold text-muted-foreground"
					>
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
				<div
					class="flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-primary font-black text-primary-foreground text-xs"
				>
					{initials}
				</div>
				{#if sidebarOpen}
					<div class="grid flex-1 text-left text-xs leading-tight min-w-0">
						<span class="truncate font-black uppercase">{displayName}</span>
						<span
							class="truncate font-mono text-[10px] font-bold text-muted-foreground uppercase"
						>
							{userDept}
						</span>
					</div>
					<ChevronUp
						class="size-4 shrink-0 transition-transform {userMenuOpen ? 'rotate-180' : ''}"
					/>
				{/if}
			</button>
		</div>
	</aside>

	<!-- Main Inset -->
	<div class="flex flex-1 flex-col min-w-0">
		<!-- Header -->
		<header
			class="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b-[3px] border-border bg-card px-4 brutal-shadow-sm md:px-6"
		>
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
				title={sidebarOpen ? 'Ciutkan Sidebar' : 'Buka Sidebar'}
			>
				<Menu class="size-5" />
			</button>

			<div class="hidden h-6 w-0.75 bg-border md:block"></div>

			<!-- Breadcrumb & Page Title -->
			<div class="min-w-0">
				<div
					class="hidden items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-muted-foreground md:flex"
				>
					<a href="/dashboard" class="hover:text-primary transition-colors">KIW</a>
					<span class="text-border/60">/</span>
					<span class="text-muted-foreground">{activeGroupLabel}</span>
					<span class="text-border/60">/</span>
					<span class="text-primary">{activeLabel}</span>
				</div>
				<h2
					class="truncate font-black uppercase tracking-tight text-sm md:text-base"
					style="font-family: var(--font-display)"
				>
					{activeLabel}
				</h2>
			</div>

			<div class="ml-auto flex items-center gap-2">
				<NotificationCenter />

				{#if isBackup}
					<div
						class="flex items-center gap-2 rounded-full border-[3px] border-border bg-warning px-3 py-1 text-warning-foreground brutal-shadow-sm"
					>
						<span class="size-2 animate-pulse rounded-full border border-border bg-warning-foreground"
						></span>
						<span class="font-mono text-[10px] font-black uppercase tracking-widest">Backup</span>
					</div>
				{:else}
					<div
						class="flex items-center gap-2 rounded-full border-[3px] border-border bg-success px-3 py-1 text-success-foreground brutal-shadow-sm"
					>
						<span class="size-2 animate-pulse rounded-full border border-border bg-success-foreground"
						></span>
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
		<footer
			class="mt-auto border-t-[3px] border-border bg-card px-4 py-3 text-center brutal-shadow-sm md:px-6"
		>
			<p class="font-mono text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
				KIW Monitoring Inventori — <span class="text-foreground">Neo-Brutal v2</span> • Built with SvelteKit
				Develop by Redo
			</p>
		</footer>
	</div>
</div>

<!-- Global Navigation Loading Feedback -->
{#if $navigating}
	<div
		class="fixed top-0 left-0 right-0 z-[9999] h-1.5 bg-primary/20 overflow-hidden pointer-events-none"
	>
		<div class="h-full bg-primary animate-pulse w-full"></div>
	</div>
	<div
		class="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-xl border-[3px] border-border bg-card px-4 py-3 brutal-shadow-lg pointer-events-none"
	>
		<div
			class="size-4 animate-spin rounded-full border-[3px] border-primary border-t-transparent"
		></div>
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
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
	>
		<div
			class="w-full max-w-md rounded-2xl border-4 border-border bg-card p-0 brutal-shadow-lg animate-in"
		>
			<div
				class="flex items-center gap-2 border-b-4 border-border bg-error px-5 py-3 text-error-foreground"
			>
				<span
					class="flex size-7 items-center justify-center rounded-full border-[3px] border-border bg-card font-black text-error"
				>
					!
				</span>
				<h2
					class="font-black uppercase tracking-tight text-lg"
					style="font-family: var(--font-display)"
				>
					Sesi Berakhir
				</h2>
			</div>
			<div class="space-y-3 px-5 py-4">
				<p class="text-sm font-bold leading-relaxed">
					Akun Anda baru saja login di perangkat lain. Sesi di perangkat ini telah diakhiri demi
					keamanan.
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

<!-- Global Toast Notifications -->
<Toaster position="bottom-right" />
