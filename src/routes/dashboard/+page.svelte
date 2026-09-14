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
		Sparkles,
		ShieldCheck,
		ArrowLeftRight,
		Layers,
		Calendar,
		TrendingUp,
		Cpu
	} from '@lucide/svelte';

	let { data } = $props();

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

	let userName = $derived(
		(data.user?.UserName as string | undefined) ??
		(data.user?.username as string | undefined) ??
		'Pengguna'
	);
	let userDept = $derived(
		(data.user?.Dept as string | undefined) ??
		(data.user?.dept as string | undefined) ??
		'PPIC / Inventory'
	);
	let isBackup = $derived(data.dbSource === 'backup');

	let completionRate = $derived(
		data.spkTotal > 0 ? ((data.spkCompleted / data.spkTotal) * 100).toFixed(1) : '0'
	);
</script>

<div class="space-y-8">
	<!-- ========================================================================= -->
	<!-- 1. HERO BANNER WELCOME                                                    -->
	<!-- ========================================================================= -->
	<div
		class="relative overflow-hidden rounded-2xl border-[3px] border-border bg-card p-6 brutal-shadow lg:p-8"
	>
		<!-- Background decorative brutalist stripe -->
		<div
			class="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full border-[3px] border-border bg-primary/10 -rotate-12"
		></div>
		<div
			class="pointer-events-none absolute right-24 -bottom-16 size-36 rounded-2xl border-[3px] border-border bg-warning/15 rotate-12"
		></div>

		<div class="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
			<!-- Left: Welcome & User Info -->
			<div class="space-y-3">
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
							Sistem Terhubung • MSSQL Live
						</span>
					{/if}

					<span
						class="inline-flex items-center gap-1 rounded-full border-2 border-border bg-muted px-2.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground uppercase"
					>
						<Calendar class="size-3" />
						{todayFormatted}
					</span>
				</div>

				<div>
					<h1
						class="text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl lg:text-4xl"
						style="font-family: var(--font-display)"
					>
						Halo, <span class="text-primary">{userName}</span>! 👋
					</h1>
					<p class="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-muted-foreground sm:text-sm">
						Selamat datang di <span class="text-foreground">KIW Monitoring Inventori</span>. Pantau
						pergerakan stok gudang, perhitungan material PPIC, dan evaluasi hasil produksi secara
						terintegrasi.
					</p>
				</div>

				<div class="flex items-center gap-2 pt-1 font-mono text-xs font-bold text-muted-foreground">
					<span class="rounded-md border-2 border-border bg-muted/60 px-2 py-0.5 text-foreground uppercase">
						Departemen: {userDept}
					</span>
					<span>•</span>
					<span>Versi 2.0 (SvelteKit Edition)</span>
				</div>
			</div>

			<!-- Right: Quick Shortcut Actions -->
			<div class="flex flex-wrap items-center gap-2.5 lg:flex-col lg:items-end">
				<a
					href="/dashboard/ppic"
					class="inline-flex items-center gap-2 rounded-xl border-[3px] border-border bg-primary px-4 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-primary-foreground brutal-shadow-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:bg-primary/90 cursor-pointer"
				>
					<ClipboardList class="size-4" />
					Hitung PPIC
					<ArrowRight class="size-3.5" />
				</a>
				<div class="flex items-center gap-2">
					<a
						href="/dashboard/monitoring-produksi"
						class="inline-flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 py-2 font-mono text-xs font-black uppercase text-foreground brutal-shadow-xs transition-all hover:bg-muted cursor-pointer"
					>
						<Factory class="size-3.5 text-secondary" />
						Produksi
					</a>
					<a
						href="/dashboard/monitoring-pembelian"
						class="inline-flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 py-2 font-mono text-xs font-black uppercase text-foreground brutal-shadow-xs transition-all hover:bg-muted cursor-pointer"
					>
						<ShoppingCart class="size-3.5 text-warning" />
						Pembelian
					</a>
				</div>
			</div>
		</div>
	</div>

	<!-- ========================================================================= -->
	<!-- 2. HIGH-IMPACT KPIS & STATS GRID                                         -->
	<!-- ========================================================================= -->
	<div>
		<div class="mb-3 flex items-center justify-between">
			<h2
				class="font-black uppercase tracking-tight text-foreground text-base sm:text-lg flex items-center gap-2"
				style="font-family: var(--font-display)"
			>
				<TrendingUp class="size-5 text-primary" />
				Ringkasan Indikator Utama
			</h2>
			<span class="font-mono text-[11px] font-bold text-muted-foreground uppercase">
				Realtime Database Metrics
			</span>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
			<!-- 1. Total SPK -->
			<div
				class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow transition-all hover:-translate-x-px hover:-translate-y-px"
			>
				<div class="flex items-center justify-between">
					<span class="font-mono text-[10px] font-black uppercase tracking-widest text-muted-foreground">
						Total SPK
					</span>
					<div
						class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-primary text-primary-foreground brutal-shadow-xs"
					>
						<Tag class="size-4" />
					</div>
				</div>
				<div class="mt-2">
					<p
						class="truncate text-2xl font-black tracking-tight text-foreground"
						style="font-family: var(--font-display)"
					>
						{fmt(data.spkTotal)}
					</p>
					<p class="mt-0.5 font-mono text-[10px] font-bold text-muted-foreground uppercase">
						Seluruh Order SPK
					</p>
				</div>
			</div>

			<!-- 2. SPK Aktif -->
			<div
				class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow transition-all hover:-translate-x-px hover:-translate-y-px"
			>
				<div class="flex items-center justify-between">
					<span class="font-mono text-[10px] font-black uppercase tracking-widest text-warning">
						SPK Aktif
					</span>
					<div
						class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-warning text-warning-foreground brutal-shadow-xs"
					>
						<Clock class="size-4" />
					</div>
				</div>
				<div class="mt-2">
					<p
						class="truncate text-2xl font-black tracking-tight text-warning"
						style="font-family: var(--font-display)"
					>
						{fmt(data.spkActive)}
					</p>
					<p class="mt-0.5 font-mono text-[10px] font-bold text-muted-foreground uppercase">
						Dalam Pengerjaan
					</p>
				</div>
			</div>

			<!-- 3. SPK Selesai -->
			<div
				class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow transition-all hover:-translate-x-px hover:-translate-y-px"
			>
				<div class="flex items-center justify-between">
					<span class="font-mono text-[10px] font-black uppercase tracking-widest text-success">
						SPK Selesai
					</span>
					<div
						class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-success text-success-foreground brutal-shadow-xs"
					>
						<CheckCircle2 class="size-4" />
					</div>
				</div>
				<div class="mt-2">
					<p
						class="truncate text-2xl font-black tracking-tight text-foreground"
						style="font-family: var(--font-display)"
					>
						{fmt(data.spkCompleted)}
					</p>
					<div class="mt-1 flex items-center justify-between font-mono text-[10px] font-bold">
						<span class="text-muted-foreground">Progres:</span>
						<span class="text-success font-black">{completionRate}%</span>
					</div>
					<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-border bg-muted">
						<div class="h-full bg-success rounded-full" style="width: {completionRate}%"></div>
					</div>
				</div>
			</div>

			<!-- 4. PP Aktif Siap Hitung -->
			<div
				class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-primary text-primary-foreground p-4 brutal-shadow transition-all hover:-translate-x-px hover:-translate-y-px"
			>
				<div class="flex items-center justify-between">
					<span class="font-mono text-[10px] font-black uppercase tracking-widest text-primary-foreground/80">
						PP Aktif
					</span>
					<div
						class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-card text-primary brutal-shadow-xs"
					>
						<Cpu class="size-4" />
					</div>
				</div>
				<div class="mt-2">
					<p
						class="truncate text-2xl font-black tracking-tight text-primary-foreground"
						style="font-family: var(--font-display)"
					>
						{fmt(data.ppActiveTotal)}
					</p>
					<p class="mt-0.5 font-mono text-[10px] font-bold text-primary-foreground/80 uppercase">
						AS% Siap Dihitung
					</p>
				</div>
			</div>

			<!-- 5. Master Barang -->
			<div
				class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow transition-all hover:-translate-x-px hover:-translate-y-px"
			>
				<div class="flex items-center justify-between">
					<span class="font-mono text-[10px] font-black uppercase tracking-widest text-muted-foreground">
						Master Part
					</span>
					<div
						class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-secondary text-secondary-foreground brutal-shadow-xs"
					>
						<Package class="size-4" />
					</div>
				</div>
				<div class="mt-2">
					<p
						class="truncate text-2xl font-black tracking-tight text-foreground"
						style="font-family: var(--font-display)"
					>
						{fmt(data.masterTotal)}
					</p>
					<p class="mt-0.5 font-mono text-[10px] font-bold text-muted-foreground uppercase">
						Katalog Material
					</p>
				</div>
			</div>

			<!-- 6. Total Produksi -->
			<div
				class="flex flex-col justify-between rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow transition-all hover:-translate-x-px hover:-translate-y-px"
			>
				<div class="flex items-center justify-between">
					<span class="font-mono text-[10px] font-black uppercase tracking-widest text-error">
						Produksi
					</span>
					<div
						class="flex size-8 items-center justify-center rounded-lg border-2 border-border bg-error text-error-foreground brutal-shadow-xs"
					>
						<Factory class="size-4" />
					</div>
				</div>
				<div class="mt-2">
					<p
						class="truncate text-2xl font-black tracking-tight text-foreground"
						style="font-family: var(--font-display)"
					>
						{fmt(data.prodTotal)}
					</p>
					<p class="mt-0.5 font-mono text-[10px] font-bold text-muted-foreground uppercase">
						Log Input Produksi
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- ========================================================================= -->
	<!-- 3. INTEGRATED CORE MODULES MATRIX                                         -->
	<!-- ========================================================================= -->
	<div>
		<div class="mb-3 flex items-center justify-between">
			<h2
				class="font-black uppercase tracking-tight text-foreground text-base sm:text-lg flex items-center gap-2"
				style="font-family: var(--font-display)"
			>
				<Layers class="size-5 text-primary" />
				Akses Modul Operasional
			</h2>
			<span class="font-mono text-[11px] font-bold text-muted-foreground uppercase">
				Pusat Layanan KIW
			</span>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<!-- Modul 1: PPIC / Production Plan -->
			<a
				href="/dashboard/ppic"
				class="group flex flex-col justify-between rounded-2xl border-[3px] border-border bg-card p-5 brutal-shadow transition-all hover:-translate-x-1 hover:-translate-y-1 hover:brutal-shadow-lg"
			>
				<div>
					<div class="flex items-center justify-between">
						<div
							class="flex size-12 items-center justify-center rounded-xl border-[3px] border-border bg-primary text-primary-foreground brutal-shadow-sm group-hover:bg-primary-accent"
						>
							<ClipboardList class="size-6" />
						</div>
						<span
							class="rounded-md border-2 border-border bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-primary"
						>
							BOM & Reservasi
						</span>
					</div>
					<h3
						class="mt-4 font-black uppercase tracking-tight text-foreground text-lg group-hover:text-primary transition-colors"
						style="font-family: var(--font-display)"
					>
						Production Planning
					</h3>
					<p class="mt-1 text-xs font-bold leading-relaxed text-muted-foreground">
						Hitung kebutuhan BOM komponen material, kalkulasi ketersediaan stok fisik gudang, dan
						reservasi otomatis untuk SPK aktif.
					</p>
				</div>
				<div
					class="mt-5 flex items-center justify-between border-t-2 border-border pt-3 font-mono text-xs font-black uppercase text-primary"
				>
					<span>Buka Perencanaan</span>
					<ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
				</div>
			</a>

			<!-- Modul 2: Monitoring Produksi -->
			<a
				href="/dashboard/monitoring-produksi"
				class="group flex flex-col justify-between rounded-2xl border-[3px] border-border bg-card p-5 brutal-shadow transition-all hover:-translate-x-1 hover:-translate-y-1 hover:brutal-shadow-lg"
			>
				<div>
					<div class="flex items-center justify-between">
						<div
							class="flex size-12 items-center justify-center rounded-xl border-[3px] border-border bg-secondary text-secondary-foreground brutal-shadow-sm"
						>
							<Factory class="size-6" />
						</div>
						<span
							class="rounded-md border-2 border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-black uppercase text-foreground"
						>
							IN • SP • MO • PL • AS
						</span>
					</div>
					<h3
						class="mt-4 font-black uppercase tracking-tight text-foreground text-lg group-hover:text-primary transition-colors"
						style="font-family: var(--font-display)"
					>
						Monitoring Produksi
					</h3>
					<p class="mt-1 text-xs font-bold leading-relaxed text-muted-foreground">
						Pantau hasil inputan admin produksi harian per departemen dan shift kerja dengan opsi
						pencarian fleksibel serta ekspor data.
					</p>
				</div>
				<div
					class="mt-5 flex items-center justify-between border-t-2 border-border pt-3 font-mono text-xs font-black uppercase text-foreground"
				>
					<span>Pantau Produksi</span>
					<ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
				</div>
			</a>

			<!-- Modul 3: Monitoring Pembelian -->
			<a
				href="/dashboard/monitoring-pembelian"
				class="group flex flex-col justify-between rounded-2xl border-[3px] border-border bg-card p-5 brutal-shadow transition-all hover:-translate-x-1 hover:-translate-y-1 hover:brutal-shadow-lg"
			>
				<div>
					<div class="flex items-center justify-between">
						<div
							class="flex size-12 items-center justify-center rounded-xl border-[3px] border-border bg-warning text-warning-foreground brutal-shadow-sm"
						>
							<ShoppingCart class="size-6" />
						</div>
						<span
							class="rounded-md border-2 border-border bg-warning/20 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-warning"
						>
							Purchasing Order
						</span>
					</div>
					<h3
						class="mt-4 font-black uppercase tracking-tight text-foreground text-lg group-hover:text-warning transition-colors"
						style="font-family: var(--font-display)"
					>
						Monitoring Pembelian
					</h3>
					<p class="mt-1 text-xs font-bold leading-relaxed text-muted-foreground">
						Pelacakan Purchase Order (PO Beli), histori penerimaan barang supplier, verifikasi kuantitas
						Bags/Kgs, dan export laporan Excel.
					</p>
				</div>
				<div
					class="mt-5 flex items-center justify-between border-t-2 border-border pt-3 font-mono text-xs font-black uppercase text-warning"
				>
					<span>Lihat Pembelian</span>
					<ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
				</div>
			</a>

			<!-- Modul 4: Surat Perintah Kerja (SPK) -->
			<a
				href="/dashboard/spk"
				class="group flex flex-col justify-between rounded-2xl border-[3px] border-border bg-card p-5 brutal-shadow transition-all hover:-translate-x-1 hover:-translate-y-1 hover:brutal-shadow-lg"
			>
				<div>
					<div class="flex items-center justify-between">
						<div
							class="flex size-12 items-center justify-center rounded-xl border-[3px] border-border bg-info text-info-foreground brutal-shadow-sm"
						>
							<Tag class="size-6" />
						</div>
						<span
							class="rounded-md border-2 border-border bg-info/20 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-info-foreground"
						>
							taPROrder
						</span>
					</div>
					<h3
						class="mt-4 font-black uppercase tracking-tight text-foreground text-lg group-hover:text-primary transition-colors"
						style="font-family: var(--font-display)"
					>
						Surat Perintah Kerja (SPK)
					</h3>
					<p class="mt-1 text-xs font-bold leading-relaxed text-muted-foreground">
						Manajemen status order SPK, filter aktif vs selesai, dan pembaruan massal tanda selesai
						(Completed) dan FinishedDate.
					</p>
				</div>
				<div
					class="mt-5 flex items-center justify-between border-t-2 border-border pt-3 font-mono text-xs font-black uppercase text-foreground"
				>
					<span>Kelola SPK</span>
					<ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
				</div>
			</a>

			<!-- Modul 5: Master Barang -->
			<a
				href="/dashboard/master-barang"
				class="group flex flex-col justify-between rounded-2xl border-[3px] border-border bg-card p-5 brutal-shadow transition-all hover:-translate-x-1 hover:-translate-y-1 hover:brutal-shadow-lg"
			>
				<div>
					<div class="flex items-center justify-between">
						<div
							class="flex size-12 items-center justify-center rounded-xl border-[3px] border-border bg-success text-success-foreground brutal-shadow-sm"
						>
							<Package class="size-6" />
						</div>
						<span
							class="rounded-md border-2 border-border bg-success/20 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-success"
						>
							taGoods
						</span>
					</div>
					<h3
						class="mt-4 font-black uppercase tracking-tight text-foreground text-lg group-hover:text-success transition-colors"
						style="font-family: var(--font-display)"
					>
						Master Data Barang
					</h3>
					<p class="mt-1 text-xs font-bold leading-relaxed text-muted-foreground">
						Katalog seluruh item part, nama teknis, spesifikasi material, kode jenis, satuan kecil,
						dan fitur download database barang.
					</p>
				</div>
				<div
					class="mt-5 flex items-center justify-between border-t-2 border-border pt-3 font-mono text-xs font-black uppercase text-success"
				>
					<span>Katalog Barang</span>
					<ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
				</div>
			</a>

			<!-- Modul 6: Pergudangan & Logistik -->
			<a
				href="/dashboard/mutasi-gudang"
				class="group flex flex-col justify-between rounded-2xl border-[3px] border-border bg-card p-5 brutal-shadow transition-all hover:-translate-x-1 hover:-translate-y-1 hover:brutal-shadow-lg"
			>
				<div>
					<div class="flex items-center justify-between">
						<div
							class="flex size-12 items-center justify-center rounded-xl border-[3px] border-border bg-error text-error-foreground brutal-shadow-sm"
						>
							<Truck class="size-6" />
						</div>
						<span
							class="rounded-md border-2 border-border bg-error/15 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-error"
						>
							LBM • LBK • Mutasi
						</span>
					</div>
					<h3
						class="mt-4 font-black uppercase tracking-tight text-foreground text-lg group-hover:text-error transition-colors"
						style="font-family: var(--font-display)"
					>
						Pergudangan & Mutasi
					</h3>
					<p class="mt-1 text-xs font-bold leading-relaxed text-muted-foreground">
						Pencatatan mutasi antar gudang, Laporan Barang Masuk (LBM), Laporan Barang Keluar (LBK),
						Retur Produksi, dan Transaksi Pemasukan.
					</p>
				</div>
				<div
					class="mt-5 flex items-center justify-between border-t-2 border-border pt-3 font-mono text-xs font-black uppercase text-error"
				>
					<span>Akses Gudang</span>
					<ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
				</div>
			</a>
		</div>
	</div>

	<!-- ========================================================================= -->
	<!-- 4. RECENT ACTIVITY DATA FEEDS (3 TABLES)                                  -->
	<!-- ========================================================================= -->
	<div>
		<div class="mb-3 flex items-center justify-between">
			<h2
				class="font-black uppercase tracking-tight text-foreground text-base sm:text-lg flex items-center gap-2"
				style="font-family: var(--font-display)"
			>
				<Clock class="size-5 text-primary" />
				Aktivitas & Data Terbaru
			</h2>
			<span class="font-mono text-[11px] font-bold text-muted-foreground uppercase">
				Update Terakhir Dari Database
			</span>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Table 1: SPK Terbaru -->
			<div
				class="flex flex-col justify-between overflow-hidden rounded-2xl border-[3px] border-border bg-card brutal-shadow"
			>
				<div>
					<div
						class="flex items-center justify-between border-b-[3px] border-border bg-muted/50 px-4 py-3"
					>
						<h3
							class="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-foreground"
							style="font-family: var(--font-display)"
						>
							<Tag class="size-4 text-primary" /> SPK Aktif Terbaru
						</h3>
						<span
							class="rounded-md border-2 border-border bg-card px-2 py-0.5 font-mono text-[10px] font-black uppercase"
						>
							{data.recentSPK.length} Baris
						</span>
					</div>

					<Table wrapperClass="border-0 shadow-none rounded-none">
						<TableHeader>
							<TableRow class="bg-muted/30">
								<TableHead class="font-mono text-[10px] font-black uppercase">No. SPK</TableHead>
								<TableHead class="font-mono text-[10px] font-black uppercase">Tgl Order</TableHead>
								<TableHead class="font-mono text-[10px] font-black uppercase text-right">Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if data.recentSPK.length === 0}
								<TableRow>
									<TableCell
										colspan={3}
										class="h-24 text-center font-mono text-xs font-bold text-muted-foreground"
									>
										Belum ada data SPK aktif
									</TableCell>
								</TableRow>
							{:else}
								{#each data.recentSPK as r}
									<TableRow class="hover:bg-muted/30">
										<TableCell class="font-mono text-xs font-black text-foreground">
											{r.OrderID}
											{#if r.Remark}
												<span class="block text-[10px] font-normal text-muted-foreground truncate max-w-32">
													{r.Remark}
												</span>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-[11px] text-muted-foreground">
											{fmtDate(r.OrderDate)}
										</TableCell>
										<TableCell class="text-right">
											<Badge
												variant={r.Completed ? 'success' : 'warning'}
												class="border-2 font-mono text-[9px] uppercase"
											>
												{r.Completed ? 'Selesai' : 'Aktif'}
											</Badge>
										</TableCell>
									</TableRow>
								{/each}
							{/if}
						</TableBody>
					</Table>
				</div>

				<div class="border-t-[3px] border-border bg-muted/20 p-2.5 text-center">
					<a
						href="/dashboard/spk"
						class="font-mono text-[11px] font-black uppercase text-primary hover:underline inline-flex items-center gap-1"
					>
						Lihat Semua SPK <ArrowRight class="size-3" />
					</a>
				</div>
			</div>

			<!-- Table 2: Produksi Terbaru -->
			<div
				class="flex flex-col justify-between overflow-hidden rounded-2xl border-[3px] border-border bg-card brutal-shadow"
			>
				<div>
					<div
						class="flex items-center justify-between border-b-[3px] border-border bg-muted/50 px-4 py-3"
					>
						<h3
							class="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-foreground"
							style="font-family: var(--font-display)"
						>
							<Factory class="size-4 text-secondary" /> Produksi Terbaru
						</h3>
						<span
							class="rounded-md border-2 border-border bg-card px-2 py-0.5 font-mono text-[10px] font-black uppercase"
						>
							{data.recentProd.length} Baris
						</span>
					</div>

					<Table wrapperClass="border-0 shadow-none rounded-none">
						<TableHeader>
							<TableRow class="bg-muted/30">
								<TableHead class="font-mono text-[10px] font-black uppercase">No. Produksi</TableHead>
								<TableHead class="font-mono text-[10px] font-black uppercase">Tgl</TableHead>
								<TableHead class="font-mono text-[10px] font-black uppercase text-right">Dept</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if data.recentProd.length === 0}
								<TableRow>
									<TableCell
										colspan={3}
										class="h-24 text-center font-mono text-xs font-bold text-muted-foreground"
									>
										Belum ada data produksi
									</TableCell>
								</TableRow>
							{:else}
								{#each data.recentProd as r}
									<TableRow class="hover:bg-muted/30">
										<TableCell class="font-mono text-xs font-black text-foreground">
											{r.No_Produksi}
										</TableCell>
										<TableCell class="font-mono text-[11px] text-muted-foreground">
											{fmtDate(r.Tanggal)}
										</TableCell>
										<TableCell class="text-right">
											<Badge variant="secondary" class="border-2 font-mono text-[9px] uppercase">
												{r.Departemen || '-'}
											</Badge>
										</TableCell>
									</TableRow>
								{/each}
							{/if}
						</TableBody>
					</Table>
				</div>

				<div class="border-t-[3px] border-border bg-muted/20 p-2.5 text-center">
					<a
						href="/dashboard/monitoring-produksi"
						class="font-mono text-[11px] font-black uppercase text-secondary hover:underline inline-flex items-center gap-1"
					>
						Lihat Monitoring Produksi <ArrowRight class="size-3" />
					</a>
				</div>
			</div>

			<!-- Table 3: Master Barang Baru -->
			<div
				class="flex flex-col justify-between overflow-hidden rounded-2xl border-[3px] border-border bg-card brutal-shadow"
			>
				<div>
					<div
						class="flex items-center justify-between border-b-[3px] border-border bg-muted/50 px-4 py-3"
					>
						<h3
							class="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-foreground"
							style="font-family: var(--font-display)"
						>
							<Package class="size-4 text-success" /> Master Barang Baru
						</h3>
						<span
							class="rounded-md border-2 border-border bg-card px-2 py-0.5 font-mono text-[10px] font-black uppercase"
						>
							{data.recentMaster.length} Baris
						</span>
					</div>

					<Table wrapperClass="border-0 shadow-none rounded-none">
						<TableHeader>
							<TableRow class="bg-muted/30">
								<TableHead class="font-mono text-[10px] font-black uppercase">Item ID</TableHead>
								<TableHead class="font-mono text-[10px] font-black uppercase">Nama Barang</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if data.recentMaster.length === 0}
								<TableRow>
									<TableCell
										colspan={2}
										class="h-24 text-center font-mono text-xs font-bold text-muted-foreground"
									>
										Belum ada data master barang
									</TableCell>
								</TableRow>
							{:else}
								{#each data.recentMaster as r}
									<TableRow class="hover:bg-muted/30">
										<TableCell class="font-mono text-xs font-black text-foreground">
											{r.ItemID}
										</TableCell>
										<TableCell class="max-w-44 truncate text-xs font-bold text-foreground">
											{r.ItemName}
										</TableCell>
									</TableRow>
								{/each}
							{/if}
						</TableBody>
					</Table>
				</div>

				<div class="border-t-[3px] border-border bg-muted/20 p-2.5 text-center">
					<a
						href="/dashboard/master-barang"
						class="font-mono text-[11px] font-black uppercase text-success hover:underline inline-flex items-center gap-1"
					>
						Lihat Katalog Lengkap <ArrowRight class="size-3" />
					</a>
				</div>
			</div>
		</div>
	</div>

	<!-- ========================================================================= -->
	<!-- 5. OPERATIONAL GUIDANCE & SYSTEM STATUS                                   -->
	<!-- ========================================================================= -->
	<div
		class="rounded-2xl border-[3px] border-border bg-secondary text-secondary-foreground p-6 brutal-shadow"
	>
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<Database class="size-5 text-warning" />
					<h3
						class="font-black uppercase tracking-tight text-white text-base sm:text-lg"
						style="font-family: var(--font-display)"
					>
						Status Infrastruktur & Operasional
					</h3>
				</div>
				<p class="text-xs font-bold text-white/70 max-w-2xl leading-relaxed">
					Sistem terhubung ke database MSSQL server lokal (192.168.1.218:1433). Semua query telah
					dioptimasi dengan in-memory caching & index seek untuk performa instan tanpa blocking.
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-3">
				<div class="rounded-xl border-2 border-white/20 bg-white/5 px-3 py-2">
					<span class="block font-mono text-[9px] font-bold text-white/50 uppercase">Koneksi Driver</span>
					<span class="font-mono text-xs font-black text-white">Tedious v20 • Pooled</span>
				</div>
				<div class="rounded-xl border-2 border-white/20 bg-white/5 px-3 py-2">
					<span class="block font-mono text-[9px] font-bold text-white/50 uppercase">Protokol Web</span>
					<span class="font-mono text-xs font-black text-success">SvelteKit SPA Client</span>
				</div>
			</div>
		</div>
	</div>
</div>
