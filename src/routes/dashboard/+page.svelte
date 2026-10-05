<script lang="ts">
	import {
		Badge,
		Table,
		TableHeader,
		TableRow,
		TableHead,
		TableBody,
		TableCell
	} from '$lib/components';
	import {
		Tag,
		Package,
		BarChart3,
		ClipboardList,
		Factory,
		ShoppingCart,
		Truck,
		CheckCircle2,
		Clock,
		ArrowRight,
		Database,
		Layers,
		Calendar,
		TrendingUp,
		Cpu,
		PieChart,
		Activity,
		ExternalLink
	} from '@lucide/svelte';

	import { resolveUserRole, hasMenuAccess } from '$lib/permissions';

	let { data } = $props();

	// Active tab for Recent Activities
	let activeTab = $state<'spk' | 'prod' | 'master'>('spk');

	const fmt = (n: number) => (Number(n) || 0).toLocaleString('id-ID');

	const todayFormatted = new Date().toLocaleDateString('id-ID', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});

	function fmtDate(d: string | null | undefined): string {
		if (!d) return '-';
		try {
			return new Date(d).toLocaleDateString('id-ID', {
				day: '2-digit',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return String(d);
		}
	}

	let resolvedRole = $derived(resolveUserRole(data.user));
	let userName = $derived(
		(data.user?.UserName as string | undefined) ??
		(data.user?.username as string | undefined) ??
		'Pengguna'
	);
	let userDept = $derived(resolvedRole.roleLabel);
	let isBackup = $derived(data.dbSource === 'backup');

	// SPK Completion Metrics
	let completionRateNumber = $derived(
		data.spkTotal > 0 ? (data.spkCompleted / data.spkTotal) * 100 : 0
	);
	let completionRate = $derived(completionRateNumber.toFixed(1));
	let activeRateNumber = $derived(
		data.spkTotal > 0 ? (data.spkActive / data.spkTotal) * 100 : 0
	);
	let activeRate = $derived(activeRateNumber.toFixed(1));

	// Primary and secondary shortcut buttons
	let primaryShortcut = $derived.by(() => {
		if (hasMenuAccess('/dashboard/ppic', data.user)) {
			return { href: '/dashboard/ppic', label: 'Hitung PPIC', icon: ClipboardList };
		}
		if (hasMenuAccess('/dashboard/input-produksi', data.user)) {
			return { href: '/dashboard/input-produksi', label: 'Input Produksi', icon: Factory };
		}
		if (resolvedRole.role === 'WH') {
			return { href: '/dashboard/input-lbm', label: 'Input LBM Gudang', icon: Truck };
		}
		if (resolvedRole.role === 'PCS') {
			return { href: '/dashboard/monitoring-pembelian', label: 'Pembelian', icon: ShoppingCart };
		}
		return { href: '/dashboard/kartu-stock', label: 'Kartu Stock', icon: Layers };
	});

	const candidateShortcuts = [
		{ href: '/dashboard/monitoring-produksi', label: 'Produksi', icon: Factory, color: 'text-primary' },
		{ href: '/dashboard/monitoring-pembelian', label: 'Pembelian', icon: ShoppingCart, color: 'text-warning' },
		{ href: '/dashboard/kartu-stock', label: 'Kartu Stock', icon: Layers, color: 'text-success' },
		{ href: '/dashboard/master-barang', label: 'Master Part', icon: Package, color: 'text-foreground' }
	];

	let visibleShortcuts = $derived(
		candidateShortcuts
			.filter((s) => hasMenuAccess(s.href, data.user) && s.href !== primaryShortcut.href)
			.slice(0, 3)
	);

	// Production Department Stats for Bar Chart
	let deptStats = $derived(data.deptStats || []);
	let maxDeptCount = $derived(
		Math.max(...deptStats.map((d: any) => d.count), 1)
	);
	let totalDeptProduction = $derived(
		deptStats.reduce((acc: number, d: any) => acc + d.count, 0)
	);

	const deptColorMap: Record<string, { bg: string; text: string; fill: string; border: string }> = {
		IN: { bg: 'bg-primary', text: 'text-primary', fill: '#2563EB', border: 'border-primary' },
		SP: { bg: 'bg-info', text: 'text-info-foreground', fill: '#00D1FF', border: 'border-info' },
		MO: { bg: 'bg-warning', text: 'text-warning-foreground', fill: '#FF9100', border: 'border-warning' },
		PL: { bg: 'bg-purple-600', text: 'text-white', fill: '#9333EA', border: 'border-purple-600' },
		AS: { bg: 'bg-success', text: 'text-success-foreground', fill: '#00E676', border: 'border-success' }
	};
</script>

<div class="space-y-6">
	<!-- ========================================================================= -->
	<!-- 1. STREAMLINED HERO BANNER                                                -->
	<!-- ========================================================================= -->
	<div class="relative overflow-hidden rounded-2xl border-[3px] border-border bg-card p-5 brutal-shadow sm:p-6">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<!-- User info & greetings -->
			<div class="space-y-2">
				<div class="flex flex-wrap items-center gap-2">
					{#if isBackup}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-warning px-2.5 py-0.5 font-mono text-[10px] font-black uppercase text-warning-foreground brutal-shadow-xs"
						>
							<span class="size-2 animate-ping rounded-full bg-warning-foreground"></span>
							Server Backup Aktif
						</span>
					{:else}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-success px-2.5 py-0.5 font-mono text-[10px] font-black uppercase text-success-foreground brutal-shadow-xs"
						>
							<span class="size-2 rounded-full bg-success-foreground animate-pulse"></span>
							MSSQL Live Connected
						</span>
					{/if}

					<span
						class="inline-flex items-center gap-1 rounded-full border-2 border-border bg-muted px-2.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground uppercase"
					>
						<Calendar class="size-3" />
						{todayFormatted}
					</span>

					<span class="rounded-full border-2 border-border bg-muted/60 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase text-foreground">
						Dept: {userDept}
					</span>
				</div>

				<div>
					<h1
						class="text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl"
						style="font-family: var(--font-display)"
					>
						Halo, <span class="text-primary">{userName}</span>!
					</h1>
					<p class="text-xs font-bold text-muted-foreground sm:text-sm">
						Ringkasan operasional manufaktur, pergerakan inventori gudang, dan progres pengerjaan SPK hari ini.
					</p>
				</div>
			</div>

			<!-- Quick action shortcuts -->
			<div class="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
				{#if primaryShortcut}
					{@const PrimaryIcon = primaryShortcut.icon}
					<a
						href={primaryShortcut.href}
						class="inline-flex items-center gap-2 rounded-xl border-[3px] border-border bg-primary px-4 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-primary-foreground brutal-shadow-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-primary/90 cursor-pointer"
					>
						<PrimaryIcon class="size-4" />
						{primaryShortcut.label}
						<ArrowRight class="size-3.5" />
					</a>
				{/if}

				{#if visibleShortcuts.length > 0}
					<div class="flex flex-wrap items-center gap-1.5">
						{#each visibleShortcuts as sc}
							{@const ScIcon = sc.icon}
							<a
								href={sc.href}
								class="inline-flex items-center gap-1.5 rounded-lg border-2 border-border bg-card px-2.5 py-1.5 font-mono text-xs font-black uppercase text-foreground brutal-shadow-xs transition-all hover:bg-muted cursor-pointer"
							>
								<ScIcon class="size-3.5 {sc.color}" />
								{sc.label}
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- ========================================================================= -->
	<!-- 2. HIGH-IMPACT KPIS & METRIC CARDS                                        -->
	<!-- ========================================================================= -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
		<!-- 1. Total SPK -->
		<div
			class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-3.5 brutal-shadow transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
		>
			<div class="flex items-center justify-between">
				<span class="font-mono text-[10px] font-black uppercase tracking-widest text-muted-foreground">
					Total SPK
				</span>
				<div class="flex size-7 items-center justify-center rounded-lg border-2 border-border bg-primary text-primary-foreground brutal-shadow-xs">
					<Tag class="size-3.5" />
				</div>
			</div>
			<div class="mt-2">
				<p class="truncate text-xl font-black tracking-tight text-foreground sm:text-2xl" style="font-family: var(--font-display)">
					{fmt(data.spkTotal)}
				</p>
				<p class="font-mono text-[9px] font-bold text-muted-foreground uppercase">
					Seluruh Order
				</p>
			</div>
		</div>

		<!-- 2. SPK Aktif -->
		<div
			class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-3.5 brutal-shadow transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
		>
			<div class="flex items-center justify-between">
				<span class="font-mono text-[10px] font-black uppercase tracking-widest text-warning">
					SPK Aktif
				</span>
				<div class="flex size-7 items-center justify-center rounded-lg border-2 border-border bg-warning text-warning-foreground brutal-shadow-xs">
					<Clock class="size-3.5" />
				</div>
			</div>
			<div class="mt-2">
				<p class="truncate text-xl font-black tracking-tight text-warning sm:text-2xl" style="font-family: var(--font-display)">
					{fmt(data.spkActive)}
				</p>
				<p class="font-mono text-[9px] font-bold text-muted-foreground uppercase">
					Sedang Berjalan
				</p>
			</div>
		</div>

		<!-- 3. SPK Selesai -->
		<div
			class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-3.5 brutal-shadow transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
		>
			<div class="flex items-center justify-between">
				<span class="font-mono text-[10px] font-black uppercase tracking-widest text-success">
					SPK Selesai
				</span>
				<div class="flex size-7 items-center justify-center rounded-lg border-2 border-border bg-success text-success-foreground brutal-shadow-xs">
					<CheckCircle2 class="size-3.5" />
				</div>
			</div>
			<div class="mt-2">
				<p class="truncate text-xl font-black tracking-tight text-foreground sm:text-2xl" style="font-family: var(--font-display)">
					{fmt(data.spkCompleted)}
				</p>
				<div class="mt-0.5 flex items-center justify-between font-mono text-[9px] font-bold">
					<span class="text-muted-foreground">Rate:</span>
					<span class="text-success font-black">{completionRate}%</span>
				</div>
				<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-border bg-muted">
					<div class="h-full bg-success rounded-full transition-all duration-500" style="width: {completionRate}%"></div>
				</div>
			</div>
		</div>

		<!-- 4. PP Aktif -->
		<div
			class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-3.5 brutal-shadow transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
		>
			<div class="flex items-center justify-between">
				<span class="font-mono text-[10px] font-black uppercase tracking-widest text-primary">
					PP Aktif
				</span>
				<div class="flex size-7 items-center justify-center rounded-lg border-2 border-border bg-primary/20 text-primary brutal-shadow-xs">
					<Cpu class="size-3.5" />
				</div>
			</div>
			<div class="mt-2">
				<p class="truncate text-xl font-black tracking-tight text-primary sm:text-2xl" style="font-family: var(--font-display)">
					{fmt(data.ppActiveTotal)}
				</p>
				<p class="font-mono text-[9px] font-bold text-muted-foreground uppercase">
					BOM Siap Dihitung
				</p>
			</div>
		</div>

		<!-- 5. Master Barang -->
		<div
			class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-3.5 brutal-shadow transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
		>
			<div class="flex items-center justify-between">
				<span class="font-mono text-[10px] font-black uppercase tracking-widest text-muted-foreground">
					Master Part
				</span>
				<div class="flex size-7 items-center justify-center rounded-lg border-2 border-border bg-secondary text-secondary-foreground brutal-shadow-xs">
					<Package class="size-3.5" />
				</div>
			</div>
			<div class="mt-2">
				<p class="truncate text-xl font-black tracking-tight text-foreground sm:text-2xl" style="font-family: var(--font-display)">
					{fmt(data.masterTotal)}
				</p>
				<p class="font-mono text-[9px] font-bold text-muted-foreground uppercase">
					Katalog Material
				</p>
			</div>
		</div>

		<!-- 6. Total Produksi -->
		<div
			class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-3.5 brutal-shadow transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
		>
			<div class="flex items-center justify-between">
				<span class="font-mono text-[10px] font-black uppercase tracking-widest text-error">
					Produksi
				</span>
				<div class="flex size-7 items-center justify-center rounded-lg border-2 border-border bg-error text-error-foreground brutal-shadow-xs">
					<Factory class="size-3.5" />
				</div>
			</div>
			<div class="mt-2">
				<p class="truncate text-xl font-black tracking-tight text-foreground sm:text-2xl" style="font-family: var(--font-display)">
					{fmt(data.prodTotal)}
				</p>
				<p class="font-mono text-[9px] font-bold text-muted-foreground uppercase">
					Log Transaksi
				</p>
			</div>
		</div>
	</div>

	<!-- ========================================================================= -->
	<!-- 3. VISUAL CHARTS & DIAGRAMS SECTION (RESPONSIVE 2-COLUMN GRID)            -->
	<!-- ========================================================================= -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
		<!-- CHART 1: BAGAN STATUS & PROGRES SPK (DONUT & RATIO) -->
		<div class="flex flex-col justify-between rounded-2xl border-[3px] border-border bg-card p-5 brutal-shadow lg:col-span-5">
			<div>
				<div class="flex items-center justify-between border-b-2 border-border pb-3">
					<div class="flex items-center gap-2">
						<div class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-primary text-primary-foreground brutal-shadow-xs">
							<PieChart class="size-4" />
						</div>
						<div>
							<h2 class="text-sm font-black uppercase tracking-tight text-foreground sm:text-base" style="font-family: var(--font-display)">
								Status & Progres SPK
							</h2>
							<p class="font-mono text-[10px] font-bold text-muted-foreground uppercase">
								Penyelesaian Order Manufaktur
							</p>
						</div>
					</div>
					<a
						href="/dashboard/spk"
						class="rounded-lg border-2 border-border bg-muted px-2.5 py-1 font-mono text-[10px] font-black uppercase text-foreground hover:bg-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-1"
					>
						Kelola SPK <ArrowRight class="size-3" />
					</a>
				</div>

				<!-- Donut Chart & Key Metrics -->
				<div class="mt-5 flex flex-col items-center justify-center sm:flex-row sm:items-center sm:justify-around gap-6">
					<!-- Interactive SVG Donut Chart -->
					<div class="relative size-40 shrink-0">
						<svg class="size-full -rotate-90" viewBox="0 0 100 100" aria-label="Bagan Status SPK">
							<!-- Track Background -->
							<circle
								cx="50"
								cy="50"
								r="38"
								fill="transparent"
								stroke="var(--muted)"
								stroke-width="12"
							/>
							<!-- Active SPK Segment (Orange/Warning) -->
							<circle
								cx="50"
								cy="50"
								r="38"
								fill="transparent"
								stroke="#FF9100"
								stroke-width="12"
								stroke-dasharray="238.76"
								stroke-dashoffset={238.76 - (238.76 * (activeRateNumber / 100))}
								stroke-linecap="round"
								class="transition-all duration-700"
							/>
							<!-- Completed SPK Segment (Green/Success) -->
							<circle
								cx="50"
								cy="50"
								r="38"
								fill="transparent"
								stroke="#00E676"
								stroke-width="12"
								stroke-dasharray="238.76"
								stroke-dashoffset={238.76 - (238.76 * (completionRateNumber / 100))}
								stroke-linecap="round"
								class="transition-all duration-700"
							/>
						</svg>

						<!-- Center Text Badge -->
						<div class="absolute inset-0 flex flex-col items-center justify-center text-center">
							<span class="text-2xl font-black text-foreground tracking-tight" style="font-family: var(--font-display)">
								{completionRate}%
							</span>
							<span class="font-mono text-[9px] font-black uppercase text-muted-foreground">
								Tuntas
							</span>
						</div>
					</div>

					<!-- Legend Details -->
					<div class="w-full space-y-2.5 sm:w-auto">
						<!-- Selesai Item -->
						<div class="flex items-center justify-between gap-4 rounded-xl border-2 border-border bg-success/10 p-2.5 brutal-shadow-xs">
							<div class="flex items-center gap-2">
								<span class="size-3 rounded-full border-2 border-border bg-success"></span>
								<div>
									<span class="block font-mono text-[10px] font-black uppercase text-foreground">SPK Selesai</span>
									<span class="font-mono text-[9px] text-muted-foreground">{completionRate}% dari total</span>
								</div>
							</div>
							<span class="font-mono text-sm font-black text-foreground">
								{fmt(data.spkCompleted)}
							</span>
						</div>

						<!-- Aktif Item -->
						<div class="flex items-center justify-between gap-4 rounded-xl border-2 border-border bg-warning/10 p-2.5 brutal-shadow-xs">
							<div class="flex items-center gap-2">
								<span class="size-3 rounded-full border-2 border-border bg-warning"></span>
								<div>
									<span class="block font-mono text-[10px] font-black uppercase text-foreground">SPK Aktif</span>
									<span class="font-mono text-[9px] text-muted-foreground">{activeRate}% dalam proses</span>
								</div>
							</div>
							<span class="font-mono text-sm font-black text-warning">
								{fmt(data.spkActive)}
							</span>
						</div>

						<!-- Total Order -->
						<div class="flex items-center justify-between border-t-2 border-border pt-2 px-1">
							<span class="font-mono text-[10px] font-black uppercase text-muted-foreground">Total Keseluruhan</span>
							<span class="font-mono text-xs font-black text-foreground">{fmt(data.spkTotal)} Order</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Bottom Progress Bar Indicator -->
			<div class="mt-4 border-t-2 border-border pt-3">
				<div class="flex items-center justify-between font-mono text-[10px] font-bold text-muted-foreground mb-1">
					<span>Rasio SPK Selesai vs Aktif</span>
					<span>{fmt(data.spkCompleted)} / {fmt(data.spkTotal)}</span>
				</div>
				<div class="flex h-3 w-full overflow-hidden rounded-full border-2 border-border bg-muted">
					<div class="bg-success transition-all duration-700" style="width: {completionRate}%" title="Selesai: {completionRate}%"></div>
					<div class="bg-warning transition-all duration-700" style="width: {activeRate}%" title="Aktif: {activeRate}%"></div>
				</div>
			</div>
		</div>

		<!-- CHART 2: BAGAN DISTRIBUSI PRODUKSI PER DEPARTEMEN (RESPONSIVE BAR CHART) -->
		<div class="flex flex-col justify-between rounded-2xl border-[3px] border-border bg-card p-5 brutal-shadow lg:col-span-7">
			<div>
				<div class="flex items-center justify-between border-b-2 border-border pb-3">
					<div class="flex items-center gap-2">
						<div class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-secondary text-secondary-foreground brutal-shadow-xs">
							<BarChart3 class="size-4" />
						</div>
						<div>
							<h2 class="text-sm font-black uppercase tracking-tight text-foreground sm:text-base" style="font-family: var(--font-display)">
								Distribusi Produksi Departemen
							</h2>
							<p class="font-mono text-[10px] font-bold text-muted-foreground uppercase">
								Volume Log Produksi (IN • SP • MO • PL • AS)
							</p>
						</div>
					</div>
					<a
						href="/dashboard/monitoring-produksi"
						class="rounded-lg border-2 border-border bg-muted px-2.5 py-1 font-mono text-[10px] font-black uppercase text-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors inline-flex items-center gap-1"
					>
						Detail <ArrowRight class="size-3" />
					</a>
				</div>

				<!-- Responsive Bar Chart Container -->
				<div class="mt-5 space-y-3.5">
					{#each deptStats as d}
						{@const colors = deptColorMap[d.dept] || { bg: 'bg-primary', text: 'text-primary', border: 'border-primary' }}
						{@const pct = totalDeptProduction > 0 ? ((d.count / totalDeptProduction) * 100).toFixed(1) : '0'}
						{@const barWidth = maxDeptCount > 0 ? Math.max((d.count / maxDeptCount) * 100, 4) : 4}

						<div class="group">
							<div class="flex items-center justify-between font-mono text-xs font-bold mb-1">
								<div class="flex items-center gap-2">
									<span class="inline-block rounded-md border-2 border-border px-1.5 py-0.5 text-[10px] font-black uppercase {colors.bg} {colors.text} brutal-shadow-xs">
										{d.dept}
									</span>
									<span class="text-foreground font-black tracking-tight">{d.label}</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-muted-foreground font-normal text-[11px]">{pct}%</span>
									<span class="text-foreground font-black font-mono">{fmt(d.count)}</span>
									<span class="text-[10px] text-muted-foreground uppercase">Lot</span>
								</div>
							</div>

							<!-- Horizontal Progress Bar with Neo-Brutalist Border -->
							<div class="relative h-6 w-full overflow-hidden rounded-xl border-2 border-border bg-muted/40 p-0.5">
								<div
									class="h-full rounded-lg border border-border {colors.bg} transition-all duration-700 flex items-center justify-end pr-2"
									style="width: {barWidth}%"
								>
									{#if Number(pct) >= 15}
										<span class="font-mono text-[9px] font-black uppercase text-white drop-shadow-sm">
											{pct}%
										</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Bottom Summary Info -->
			<div class="mt-4 flex flex-wrap items-center justify-between border-t-2 border-border pt-3 font-mono text-[11px] font-bold text-muted-foreground">
				<span class="flex items-center gap-1.5">
					<Activity class="size-3.5 text-primary" />
					Total Agregat: <strong class="text-foreground">{fmt(totalDeptProduction)}</strong> batch produksi
				</span>
				<span class="uppercase text-[10px]">
					Kalkulasi Realtime MSSQL
				</span>
			</div>
		</div>
	</div>

	<!-- ========================================================================= -->
	<!-- 4. COMPACT ACTIVITY CENTER (TABBED DATA FEEDS)                            -->
	<!-- ========================================================================= -->
	<div class="rounded-2xl border-[3px] border-border bg-card brutal-shadow overflow-hidden">
		<!-- Tab Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between border-b-[3px] border-border bg-muted/40 px-4 py-3 gap-3">
			<div class="flex items-center gap-2">
				<Clock class="size-4 text-primary" />
				<h2 class="text-sm font-black uppercase tracking-tight text-foreground sm:text-base" style="font-family: var(--font-display)">
					Pusat Aktivitas Terkini
				</h2>
			</div>

			<!-- Tab buttons -->
			<div class="flex items-center gap-1.5" role="tablist">
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'spk'}
					onclick={() => (activeTab = 'spk')}
					class="rounded-lg border-2 border-border px-3 py-1.5 font-mono text-xs font-black uppercase transition-all cursor-pointer {activeTab === 'spk' ? 'bg-primary text-primary-foreground brutal-shadow-xs' : 'bg-card text-muted-foreground hover:bg-muted'}"
				>
					SPK Aktif ({data.recentSPK.length})
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'prod'}
					onclick={() => (activeTab = 'prod')}
					class="rounded-lg border-2 border-border px-3 py-1.5 font-mono text-xs font-black uppercase transition-all cursor-pointer {activeTab === 'prod' ? 'bg-secondary text-secondary-foreground brutal-shadow-xs' : 'bg-card text-muted-foreground hover:bg-muted'}"
				>
					Log Produksi ({data.recentProd.length})
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'master'}
					onclick={() => (activeTab = 'master')}
					class="rounded-lg border-2 border-border px-3 py-1.5 font-mono text-xs font-black uppercase transition-all cursor-pointer {activeTab === 'master' ? 'bg-success text-success-foreground brutal-shadow-xs' : 'bg-card text-muted-foreground hover:bg-muted'}"
				>
					Master Part ({data.recentMaster.length})
				</button>
			</div>
		</div>

		<!-- Tab Content: SPK -->
		{#if activeTab === 'spk'}
			<div class="overflow-x-auto">
				<Table wrapperClass="border-0 shadow-none rounded-none">
					<TableHeader>
						<TableRow class="bg-muted/20">
							<TableHead class="font-mono text-[10px] font-black uppercase">No. SPK (Order ID)</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase">Keterangan / Remark</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase">Tanggal Order</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase text-right">Status Pengerjaan</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.recentSPK.length === 0}
							<TableRow>
								<TableCell colspan={4} class="h-24 text-center font-mono text-xs font-bold text-muted-foreground">
									Belum ada data SPK aktif yang terdaftar
								</TableCell>
							</TableRow>
						{:else}
							{#each data.recentSPK as r}
								<TableRow class="hover:bg-muted/30">
									<TableCell class="font-mono text-xs font-black text-foreground">
										{r.OrderID}
									</TableCell>
									<TableCell class="text-xs font-bold text-muted-foreground max-w-xs truncate">
										{r.Remark || '-'}
									</TableCell>
									<TableCell class="font-mono text-xs text-muted-foreground">
										{fmtDate(r.OrderDate)}
									</TableCell>
									<TableCell class="text-right">
										<Badge variant={r.Completed ? 'success' : 'warning'} class="border-2 font-mono text-[10px] uppercase">
											{r.Completed ? 'Selesai' : 'Aktif Dalam Proses'}
										</Badge>
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>
			<div class="flex items-center justify-between border-t-2 border-border bg-muted/10 p-3">
				<span class="font-mono text-[10px] font-bold text-muted-foreground uppercase">
					Menampilkan {data.recentSPK.length} baris SPK aktif terbaru
				</span>
				<a
					href="/dashboard/spk"
					class="font-mono text-xs font-black uppercase text-primary hover:underline inline-flex items-center gap-1"
				>
					Buka Seluruh SPK <ArrowRight class="size-3.5" />
				</a>
			</div>
		{/if}

		<!-- Tab Content: Log Produksi -->
		{#if activeTab === 'prod'}
			<div class="overflow-x-auto">
				<Table wrapperClass="border-0 shadow-none rounded-none">
					<TableHeader>
						<TableRow class="bg-muted/20">
							<TableHead class="font-mono text-[10px] font-black uppercase">No. Produksi</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase">Tanggal</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase">Departemen</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase">Kode Barang</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase text-right">SPK Relevan</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.recentProd.length === 0}
							<TableRow>
								<TableCell colspan={5} class="h-24 text-center font-mono text-xs font-bold text-muted-foreground">
									Belum ada catatan log produksi
								</TableCell>
							</TableRow>
						{:else}
							{#each data.recentProd as r}
								<TableRow class="hover:bg-muted/30">
									<TableCell class="font-mono text-xs font-black text-foreground">
										{r.No_Produksi}
									</TableCell>
									<TableCell class="font-mono text-xs text-muted-foreground">
										{fmtDate(r.Tanggal)}
									</TableCell>
									<TableCell>
										<span class="inline-block rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-black uppercase text-foreground">
											{r.Departemen || '-'}
										</span>
									</TableCell>
									<TableCell class="font-mono text-xs font-bold text-foreground">
										{r.ItemID || '-'}
									</TableCell>
									<TableCell class="text-right font-mono text-xs font-black text-primary">
										{r.SPK || '-'}
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>
			<div class="flex items-center justify-between border-t-2 border-border bg-muted/10 p-3">
				<span class="font-mono text-[10px] font-bold text-muted-foreground uppercase">
					Menampilkan {data.recentProd.length} log produksi terakhir
				</span>
				<a
					href="/dashboard/monitoring-produksi"
					class="font-mono text-xs font-black uppercase text-primary hover:underline inline-flex items-center gap-1"
				>
					Buka Monitoring Produksi <ArrowRight class="size-3.5" />
				</a>
			</div>
		{/if}

		<!-- Tab Content: Master Barang -->
		{#if activeTab === 'master'}
			<div class="overflow-x-auto">
				<Table wrapperClass="border-0 shadow-none rounded-none">
					<TableHeader>
						<TableRow class="bg-muted/20">
							<TableHead class="font-mono text-[10px] font-black uppercase">Item ID (Kode Part)</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase">Nama Barang</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase">Departemen</TableHead>
							<TableHead class="font-mono text-[10px] font-black uppercase text-right">Satuan</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#if data.recentMaster.length === 0}
							<TableRow>
								<TableCell colspan={4} class="h-24 text-center font-mono text-xs font-bold text-muted-foreground">
									Belum ada data master barang
								</TableCell>
							</TableRow>
						{:else}
							{#each data.recentMaster as r}
								<TableRow class="hover:bg-muted/30">
									<TableCell class="font-mono text-xs font-black text-foreground">
										{r.ItemID}
									</TableCell>
									<TableCell class="text-xs font-bold text-foreground max-w-sm truncate">
										{r.ItemName}
									</TableCell>
									<TableCell class="font-mono text-xs text-muted-foreground">
										{r.Departemen || '-'}
									</TableCell>
									<TableCell class="text-right font-mono text-xs font-bold text-foreground">
										{r.Satuan || '-'}
									</TableCell>
								</TableRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>
			<div class="flex items-center justify-between border-t-2 border-border bg-muted/10 p-3">
				<span class="font-mono text-[10px] font-bold text-muted-foreground uppercase">
					Menampilkan {data.recentMaster.length} item katalog barang
				</span>
				<a
					href="/dashboard/master-barang"
					class="font-mono text-xs font-black uppercase text-success hover:underline inline-flex items-center gap-1"
				>
					Buka Katalog Master Barang <ArrowRight class="size-3.5" />
				</a>
			</div>
		{/if}
	</div>

	<!-- ========================================================================= -->
	<!-- 5. COMPACT CORE MODULE NAVIGATOR                                          -->
	<!-- ========================================================================= -->
	<div>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="font-black uppercase tracking-tight text-foreground text-sm sm:text-base flex items-center gap-2" style="font-family: var(--font-display)">
				<Layers class="size-4 text-primary" />
				Akses Cepat Modul Utama
			</h2>
			<span class="font-mono text-[10px] font-bold text-muted-foreground uppercase">
				Navigasi Langsung
			</span>
		</div>

		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
			<!-- PPIC -->
			<a
				href="/dashboard/ppic"
				class="group flex flex-col justify-between rounded-xl border-2 border-border bg-card p-3.5 brutal-shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow"
			>
				<div class="flex items-center justify-between">
					<div class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-primary text-primary-foreground">
						<ClipboardList class="size-4" />
					</div>
					<ArrowRight class="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
				</div>
				<div class="mt-3">
					<h3 class="font-mono text-xs font-black uppercase text-foreground group-hover:text-primary">
						PPIC Planning
					</h3>
					<p class="font-mono text-[9px] text-muted-foreground uppercase">BOM & Reservasi</p>
				</div>
			</a>

			<!-- Produksi -->
			<a
				href="/dashboard/monitoring-produksi"
				class="group flex flex-col justify-between rounded-xl border-2 border-border bg-card p-3.5 brutal-shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow"
			>
				<div class="flex items-center justify-between">
					<div class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-secondary text-secondary-foreground">
						<Factory class="size-4" />
					</div>
					<ArrowRight class="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
				</div>
				<div class="mt-3">
					<h3 class="font-mono text-xs font-black uppercase text-foreground group-hover:text-primary">
						Produksi
					</h3>
					<p class="font-mono text-[9px] text-muted-foreground uppercase">Input & Monitoring</p>
				</div>
			</a>

			<!-- Pembelian -->
			<a
				href="/dashboard/monitoring-pembelian"
				class="group flex flex-col justify-between rounded-xl border-2 border-border bg-card p-3.5 brutal-shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow"
			>
				<div class="flex items-center justify-between">
					<div class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-warning text-warning-foreground">
						<ShoppingCart class="size-4" />
					</div>
					<ArrowRight class="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-warning" />
				</div>
				<div class="mt-3">
					<h3 class="font-mono text-xs font-black uppercase text-foreground group-hover:text-warning">
						Pembelian
					</h3>
					<p class="font-mono text-[9px] text-muted-foreground uppercase">PO & Supplier</p>
				</div>
			</a>

			<!-- SPK -->
			<a
				href="/dashboard/spk"
				class="group flex flex-col justify-between rounded-xl border-2 border-border bg-card p-3.5 brutal-shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow"
			>
				<div class="flex items-center justify-between">
					<div class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-info text-info-foreground">
						<Tag class="size-4" />
					</div>
					<ArrowRight class="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
				</div>
				<div class="mt-3">
					<h3 class="font-mono text-xs font-black uppercase text-foreground group-hover:text-primary">
						Order SPK
					</h3>
					<p class="font-mono text-[9px] text-muted-foreground uppercase">Status & Penutupan</p>
				</div>
			</a>

			<!-- Master Barang -->
			<a
				href="/dashboard/master-barang"
				class="group flex flex-col justify-between rounded-xl border-2 border-border bg-card p-3.5 brutal-shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow"
			>
				<div class="flex items-center justify-between">
					<div class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-success text-success-foreground">
						<Package class="size-4" />
					</div>
					<ArrowRight class="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-success" />
				</div>
				<div class="mt-3">
					<h3 class="font-mono text-xs font-black uppercase text-foreground group-hover:text-success">
						Master Part
					</h3>
					<p class="font-mono text-[9px] text-muted-foreground uppercase">Katalog Barang</p>
				</div>
			</a>

			<!-- Gudang & Mutasi -->
			<a
				href="/dashboard/mutasi-gudang"
				class="group flex flex-col justify-between rounded-xl border-2 border-border bg-card p-3.5 brutal-shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow"
			>
				<div class="flex items-center justify-between">
					<div class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-error text-error-foreground">
						<Truck class="size-4" />
					</div>
					<ArrowRight class="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-error" />
				</div>
				<div class="mt-3">
					<h3 class="font-mono text-xs font-black uppercase text-foreground group-hover:text-error">
						Pergudangan
					</h3>
					<p class="font-mono text-[9px] text-muted-foreground uppercase">LBM, LBK & Mutasi</p>
				</div>
			</a>
		</div>
	</div>

	<!-- ========================================================================= -->
	<!-- 6. STREAMLINED INFRASTRUCTURE STATUS FOOTER                               -->
	<!-- ========================================================================= -->
	<div class="rounded-xl border-2 border-border bg-muted/30 p-4 brutal-shadow-xs">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-2">
				<Database class="size-4 text-primary" />
				<span class="font-mono text-xs font-black uppercase text-foreground">
					Infrastruktur MSSQL Terkoneksi
				</span>
				<span class="text-xs text-muted-foreground">• Server 192.168.1.218:1433</span>
			</div>
			<div class="flex items-center gap-2 font-mono text-[10px] font-bold text-muted-foreground uppercase">
				<span class="rounded border border-border bg-card px-2 py-0.5 text-foreground">Tedious Pooled</span>
				<span class="rounded border border-border bg-card px-2 py-0.5 text-success">SvelteKit SPA</span>
			</div>
		</div>
	</div>
</div>
