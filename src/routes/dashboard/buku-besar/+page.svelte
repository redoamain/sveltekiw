<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		Badge,
		Button,
		Input,
		Label,
		PageHeader,
		Table,
		TableHeader,
		TableRow,
		TableHead,
		TableBody,
		TableCell,
		LoadingOverlay,
		Alert,
		EmptyState,
		Combobox
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		BookOpen,
		Download,
		Printer,
		Search,
		ChevronDown,
		ChevronRight,
		ArrowUpRight,
		ArrowDownRight,
		Scale,
		Wallet,
		RotateCcw,
		Calendar,
		Coins,
		Building2,
		Sparkles,
		CheckCircle2,
		RefreshCw
	} from '@lucide/svelte';

	let { data } = $props();

	let loading = $state(false);
	let loadingMsg = $state('Memuat...');
	let exportLoading = $state(false);

	// Filter input states di Halaman
	let tgl1Input = $state('');
	let tgl2Input = $state('');
	let acc1Input = $state('');
	let acc2Input = $state('');

	// State Modal Antrian BullMQ
	let showQueueModal = $state(false);
	let queueLoading = $state(false);
	let currentJobId = $state<string | null>(null);
	let jobState = $state<'waiting' | 'active' | 'completed' | 'failed' | null>(null);
	let jobProgress = $state(0);
	let jobResult = $state<any>(null);
	let jobError = $state<string | null>(null);
	let pollInterval = $state<any>(null);

	// Parameter khusus di dalam Modal Export BullMQ
	let exportTgl1 = $state('');
	let exportTgl2 = $state('');
	let exportAcc1 = $state('1101');
	let exportAcc2 = $state('9999');
	let exportCurr = $state('IDR');
	let exportJu = $state(0);
	let exportLawanTransaksi = $state(true);
	let exportHideEmpty = $state(true);

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});

	// Collapsible state per account (default expanded jika ada transaksi)
	let collapsedAccounts = $state<Record<string, boolean>>({});

	$effect(() => {
		if (data) {
			loading = false;
			tgl1Input = data.filters.tgl1;
			tgl2Input = data.filters.tgl2;
			acc1Input = data.filters.acc1;
			acc2Input = data.filters.acc2;
		}
	});

	function toggleCollapse(acc: string) {
		collapsedAccounts[acc] = !collapsedAccounts[acc];
	}

	function expandAll() {
		collapsedAccounts = {};
	}

	function collapseAll() {
		const next: Record<string, boolean> = {};
		for (const ac of data.accounts) {
			next[ac.acc] = true;
		}
		collapsedAccounts = next;
	}

	function formatNum(val: number | null | undefined, dec = 2): string {
		if (val == null || isNaN(val)) return '0,00';
		return Number(val).toLocaleString('id-ID', {
			minimumFractionDigits: dec,
			maximumFractionDigits: dec
		});
	}

	function formatDate(dateStr: string | null | undefined): string {
		if (!dateStr) return '-';
		const p = dateStr.split('-');
		if (p.length === 3) {
			return `${p[2]}/${p[1]}/${p[0]}`;
		}
		return dateStr;
	}

	// Preset pilihan rentang akun
	const ACCOUNT_PRESETS = [
		{ label: 'Kas & Bank', a1: '1101', a2: '1101.99' },
		{ label: 'Piutang Usaha', a1: '1102', a2: '1103.99' },
		{ label: 'Persediaan', a1: '1104', a2: '1104.99' },
		{ label: 'Aktiva Tetap', a1: '1201', a2: '1299' },
		{ label: 'Hutang Usaha', a1: '2101', a2: '2101.99' },
		{ label: 'Biaya Operasional', a1: '6200', a2: '6299' },
		{ label: 'Semua Akun', a1: '1101', a2: '9999' }
	];

	function applyPreset(a1: string, a2: string) {
		acc1Input = a1;
		acc2Input = a2;
	}

	// Format daftar COA untuk Combobox
	let coaOptions = $derived(
		(data.coaList || []).map((c) => ({
			value: c.acc,
			code: c.acc,
			name: c.accName,
			badge: c.accCurr,
			label: `${c.acc} — ${c.accName}`
		}))
	);

	// ==========================================
	// BULLMQ BACKGROUND QUEUE LOGIC
	// ==========================================

	function openExportModal() {
		// Nilai default diambil dari apa yang sedang diinput/dipilih di halaman saat ini
		exportTgl1 = tgl1Input || data.filters.tgl1;
		exportTgl2 = tgl2Input || data.filters.tgl2;
		exportAcc1 = acc1Input || data.filters.acc1;
		exportAcc2 = acc2Input || data.filters.acc2;
		exportCurr = data.filters.curr || 'IDR';
		exportJu = data.filters.ju ?? 0;
		exportLawanTransaksi = data.filters.lawantransaksi !== 0;
		exportHideEmpty = data.filters.hideEmpty ?? true;

		// Reset state progress jika membuka modal baru
		jobState = null;
		currentJobId = null;
		jobProgress = 0;
		jobResult = null;
		jobError = null;
		showQueueModal = true;
	}

	function setExportMonth(offsetMonths = 0) {
		const now = new Date();
		const targetDate = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
		const y = targetDate.getFullYear();
		const m = targetDate.getMonth();
		const lastDay = new Date(y, m + 1, 0).getDate();

		const pad = (n: number) => String(n).padStart(2, '0');
		exportTgl1 = `${y}-${pad(m + 1)}-01`;
		exportTgl2 = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
	}

	function setExportPreset(a1: string, a2: string) {
		exportAcc1 = a1;
		exportAcc2 = a2;
	}

	async function startBullMQExport() {
		if (!exportTgl1 || !exportTgl2) {
			toast.error('Validasi Gagal', 'Tanggal awal dan akhir periode export wajib diisi.');
			return;
		}

		queueLoading = true;
		jobState = 'waiting';
		jobProgress = 5;
		jobResult = null;
		jobError = null;

		try {
			const res = await fetch('/api/queue/buku-besar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tgl1: exportTgl1,
					tgl2: exportTgl2,
					acc1: exportAcc1,
					acc2: exportAcc2,
					curr: exportCurr,
					ju: exportJu,
					lawantransaksi: exportLawanTransaksi ? 1 : 0,
					hideEmpty: exportHideEmpty
				})
			});

			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.message || 'Gagal membuat pekerjaan di antrian BullMQ');
			}

			currentJobId = json.jobId;
			toast.info('Antrian BullMQ', `Pekerjaan #${currentJobId} berhasil didaftarkan ke antrian worker.`);
			pollJobStatus(json.jobId);
		} catch (err: any) {
			queueLoading = false;
			jobState = 'failed';
			jobError = err?.message || 'Terjadi kesalahan sistem';
			toast.error('Gagal Antrian', jobError || '');
		}
	}

	function pollJobStatus(jobId: string) {
		if (pollInterval) clearInterval(pollInterval);

		pollInterval = setInterval(async () => {
			try {
				const res = await fetch(`/api/queue/buku-besar?jobId=${jobId}`);
				const json = await res.json();

				if (json.success && json.data) {
					jobState = json.data.state;
					jobProgress = typeof json.data.progress === 'number' ? json.data.progress : jobProgress;

					if (jobState === 'completed') {
						clearInterval(pollInterval);
						queueLoading = false;
						jobProgress = 100;
						jobResult = json.data.result;
						toast.success('Pekerjaan Selesai', `Buku Besar berhasil digenerate oleh BullMQ worker.`);
					} else if (jobState === 'failed') {
						clearInterval(pollInterval);
						queueLoading = false;
						jobError = json.data.failedReason || 'Pekerjaan gagal diproses di background worker';
						toast.error('Pekerjaan Gagal', jobError || '');
					}
				}
			} catch {
				// Abaikan error jaringan sesaat saat polling
			}
		}, 1500);
	}

	function closeQueueModal() {
		if (pollInterval) clearInterval(pollInterval);
		showQueueModal = false;
	}
</script>

<LoadingOverlay show={loading} message={loadingMsg} submessage="Mohon tunggu sejenak" />

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Laporan Buku Besar Pembantu (GL)"
		description="Rekapitulasi buku besar pembantu per akun COA (SP rpBBPembantuL) — saldo awal, mutasi debet/kredit, lawan transaksi, terintegrasi ekspor Excel dan antrian background BullMQ."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<Badge variant="secondary" class="border-[3px] font-mono font-black text-xs">
					{data.grandTotal.totalAccounts.toLocaleString('id-ID')} AKUN • {data.grandTotal.totalTransactions.toLocaleString('id-ID')} MUTASI
				</Badge>

				<!-- Tombol Export Background BullMQ (Anti-Timeout) -->
				<Button
					type="button"
					variant="default"
					onclick={openExportModal}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
					title="Buka form parameter export BullMQ untuk memilih tanggal dan akun secara bebas"
				>
					<Sparkles class="size-4 mr-1.5" />
					Export via BullMQ (Anti-Timeout)
				</Button>

				<!-- Tombol Export Excel Langsung -->
				<form
					method="post"
					action="/api/buku-besar/export"
					onsubmit={() => {
						exportLoading = true;
						toast.info('Export Excel', 'Menyiapkan berkas Excel template rpbbpembantul.xls...');
						setTimeout(() => (exportLoading = false), 4000);
					}}
					class="inline-flex"
				>
					<input type="hidden" name="tgl1" value={data.filters.tgl1} />
					<input type="hidden" name="tgl2" value={data.filters.tgl2} />
					<input type="hidden" name="acc1" value={data.filters.acc1} />
					<input type="hidden" name="acc2" value={data.filters.acc2} />
					<input type="hidden" name="curr" value={data.filters.curr} />
					<input type="hidden" name="ju" value={String(data.filters.ju)} />
					<input type="hidden" name="lawantransaksi" value={String(data.filters.lawantransaksi)} />
					<input type="hidden" name="hideEmpty" value={String(data.filters.hideEmpty)} />

					<Button
						type="submit"
						variant="secondary"
						disabled={exportLoading}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export format Excel yang persis seperti template rpbbpembantul.xls"
					>
						<Download class="size-4 mr-1.5" />
						Export Excel Langsung
					</Button>
				</form>

				<Button
					type="button"
					variant="secondary"
					onclick={() => window.print()}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer hidden sm:inline-flex"
					title="Cetak tampilan buku besar"
				>
					<Printer class="size-4 mr-1" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Summary Metrics Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
		<!-- Total Akun -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Akun</span>
				<BookOpen class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.grandTotal.totalAccounts}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.grandTotal.totalTransactions} Transaksi Mutasi
				</p>
			</div>
		</div>

		<!-- Saldo Awal Total -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Saldo Awal Total</span>
				<Wallet class="size-4 text-slate-500" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-foreground">
					Rp {formatNum(data.grandTotal.totalSaldoAwalRp, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Per {formatDate(data.filters.tgl1)}</p>
			</div>
		</div>

		<!-- Total Debet -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Debet</span>
				<ArrowDownRight class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-emerald-700 dark:text-emerald-400">
					Rp {formatNum(data.grandTotal.totalDebetRp, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Mutasi Masuk / Penambahan</p>
			</div>
		</div>

		<!-- Total Kredit -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-amber-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Kredit</span>
				<ArrowUpRight class="size-4 text-amber-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-amber-700 dark:text-amber-400">
					Rp {formatNum(data.grandTotal.totalCreditRp, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Mutasi Keluar / Pengurangan</p>
			</div>
		</div>

		<!-- Saldo Akhir Total -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-primary/5 col-span-2 lg:col-span-1">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-primary">Saldo Akhir Total</span>
				<Scale class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl font-black text-primary">
					Rp {formatNum(data.grandTotal.totalSaldoAkhirRp, 0)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">Per {formatDate(data.filters.tgl2)}</p>
			</div>
		</div>
	</div>

	<!-- Filter Form Neo-Brutalist -->
	<form
		method="get"
		action="/dashboard/buku-besar"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4"
	>
		<div class="flex items-center justify-between pb-2 border-b-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-foreground">Parameter Stored Procedure:</span>
				<code class="text-[11px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
					rpBBPembantuL (@Tgl1, @Tgl2, @Acc1, @Acc2, @Curr, @ju, @lawantransksi)
				</code>
			</div>
		</div>

		<!-- Presets Toolbar -->
		<div class="flex flex-wrap items-center gap-1.5 pb-2 border-b-2 border-border/40">
			<span class="text-xs font-black uppercase text-muted-foreground mr-1">Preset Akun:</span>
			{#each ACCOUNT_PRESETS as p}
				<button
					type="button"
					onclick={() => applyPreset(p.a1, p.a2)}
					class="px-2.5 py-1 rounded-md border-2 border-border font-mono text-[11px] font-black uppercase tracking-wider hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer brutal-shadow-sm {acc1Input === p.a1 && acc2Input === p.a2 ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}"
				>
					{p.label}
				</button>
			{/each}
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
			<!-- Tgl Awal -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="tgl1">Periode Awal</Label>
				<input
					type="date"
					id="tgl1"
					name="tgl1"
					bind:value={tgl1Input}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
				/>
			</div>

			<!-- Tgl Akhir -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="tgl2">Periode Akhir</Label>
				<input
					type="date"
					id="tgl2"
					name="tgl2"
					bind:value={tgl2Input}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
				/>
			</div>

			<!-- Dari Akun -->
			<div class="space-y-1.5 lg:col-span-3">
				<Label for="acc1">Dari Akun (Acc1)</Label>
				<Combobox
					id="acc1"
					name="acc1"
					bind:value={acc1Input}
					options={coaOptions}
					placeholder="Ketik no COA / nama akun..."
					allowCustom={true}
				/>
			</div>

			<!-- Sampai Akun -->
			<div class="space-y-1.5 lg:col-span-3">
				<div class="flex items-center justify-between">
					<Label for="acc2">Sampai Akun (Acc2)</Label>
					{#if acc1Input}
						<button
							type="button"
							onclick={() => (acc2Input = acc1Input)}
							class="text-[10px] font-mono font-black uppercase text-primary hover:underline cursor-pointer"
							title="Samakan dengan Dari Akun untuk melihat 1 akun tunggal"
						>
							= Samakan
						</button>
					{/if}
				</div>
				<Combobox
					id="acc2"
					name="acc2"
					bind:value={acc2Input}
					options={coaOptions}
					placeholder="Ketik no COA / nama akun..."
					allowCustom={true}
					dropdownClass="lg:right-0 lg:left-auto"
				/>
			</div>

			<!-- Mata Uang -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label>Valas</Label>
				<select
					name="curr"
					value={data.filters.curr}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-black uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="IDR">IDR</option>
					<option value="USD">USD</option>
					<option value="">Semua</option>
				</select>
			</div>

			<!-- Tipe Jurnal -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label>Jurnal</Label>
				<select
					name="ju"
					value={String(data.filters.ju)}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-black uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="0">Semua</option>
					<option value="1">Hanya JU</option>
				</select>
			</div>
		</div>

		<!-- Checkbox options & Action Buttons -->
		<div class="flex flex-wrap items-center justify-between gap-4 pt-1 border-t-2 border-border/40">
			<div class="flex flex-wrap items-center gap-5">
				<label class="inline-flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
					<input
						type="checkbox"
						name="lawantransaksi"
						value="1"
						checked={data.filters.lawantransaksi === 1}
						class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
					/>
					<span>Tampilkan Lawan Transaksi COA</span>
					<span class="text-[10px] text-muted-foreground font-normal">(Hilangkan centang untuk rentang panjang &gt; 3 bulan agar cepat)</span>
				</label>

				<label class="inline-flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
					<input
						type="checkbox"
						name="hideEmpty"
						value="1"
						checked={data.filters.hideEmpty}
						class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
					/>
					<span>Sembunyikan Akun Bersaldo 0 & Tanpa Mutasi</span>
				</label>
			</div>

			<div class="flex items-center gap-2">
				{#if data.filters.acc1 !== '1101' || data.filters.acc2 !== '1101.99' || data.filters.curr !== 'IDR' || data.filters.ju !== 0}
					<a
						href="/dashboard/buku-besar"
						class="border-border bg-card hover:bg-muted inline-flex h-10 items-center rounded-lg border-[3px] px-4 text-xs font-black uppercase tracking-wide brutal-shadow-sm"
					>
						Reset Filter
					</a>
				{/if}
				<Button type="submit" class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm px-6">
					Tampilkan Buku Besar
				</Button>
			</div>
		</div>
	</form>

	{#if data.error}
		<Alert variant="error" title="Terjadi Kesalahan" dismissible>
			{data.error}
		</Alert>
	{/if}

	<!-- Controls Expand / Collapse All -->
	{#if data.accounts.length > 0}
		<div class="flex items-center justify-between px-1">
			<span class="text-xs font-black uppercase tracking-wide text-muted-foreground">
				Menampilkan {data.accounts.length} Akun Buku Besar:
			</span>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={expandAll}
					class="text-[11px] font-black uppercase text-primary hover:underline cursor-pointer"
				>
					Buka Semua
				</button>
				<span class="text-muted-foreground">•</span>
				<button
					type="button"
					onclick={collapseAll}
					class="text-[11px] font-black uppercase text-primary hover:underline cursor-pointer"
				>
					Tutup Semua
				</button>
			</div>
		</div>
	{/if}

	<!-- DAFTAR AKUN BUKU BESAR -->
	{#if data.accounts.length === 0}
		<div class="bg-card rounded-xl border-[3px] border-border p-12 text-center brutal-shadow">
			<EmptyState
				icon={BookOpen}
				title="Tidak Ada Data Buku Besar"
				description="Tidak ditemukan transaksi atau saldo akun yang sesuai dengan filter yang dipilih."
			/>
		</div>
	{:else}
		<div class="space-y-5">
			{#each data.accounts as ac}
				{@const isCollapsed = Boolean(collapsedAccounts[ac.acc])}

				<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
					<!-- Account Card Header -->
					<button
						type="button"
						class="w-full bg-muted/40 border-b-[3px] border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-muted/60 transition-colors cursor-pointer select-none"
						onclick={() => toggleCollapse(ac.acc)}
					>
						<div class="flex items-center gap-3">
							<span
								class="inline-flex size-7 items-center justify-center rounded-md border-2 border-border bg-card font-bold brutal-shadow-sm shrink-0"
							>
								{#if isCollapsed}
									<ChevronRight class="size-4" />
								{:else}
									<ChevronDown class="size-4" />
								{/if}
							</span>

							<div>
								<div class="flex items-center gap-2">
									<span class="font-mono text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/30">
										{ac.acc}
									</span>
									<h3 class="font-black text-sm uppercase tracking-tight text-foreground">
										{ac.accName}
									</h3>
									<span class="font-mono text-[10px] font-black px-1.5 py-0.2 rounded border border-border bg-card">
										{ac.curr}
									</span>
								</div>
								<div class="text-[11px] font-bold text-muted-foreground mt-0.5 flex items-center gap-3">
									<span>Saldo Awal: <strong class="font-mono font-black text-foreground">Rp {formatNum(ac.saldoAwalRp)}</strong></span>
									<span>•</span>
									<span>Mutasi: <strong class="font-mono">{ac.transactions.length} baris</strong></span>
								</div>
							</div>
						</div>

						<!-- Quick Totals Header Badge -->
						<div class="flex flex-wrap items-center gap-3 text-right">
							<div class="hidden sm:block">
								<span class="block text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Total Debet</span>
								<span class="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
									Rp {formatNum(ac.totalDebetRp)}
								</span>
							</div>

							<div class="hidden sm:block">
								<span class="block text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Total Kredit</span>
								<span class="font-mono text-xs font-black text-amber-700 dark:text-amber-400">
									Rp {formatNum(ac.totalCreditRp)}
								</span>
							</div>

							<div class="border-l-2 border-border/50 pl-3">
								<span class="block text-[10px] font-black uppercase text-muted-foreground">Saldo Akhir</span>
								<span class="font-mono text-sm font-black text-foreground">
									Rp {formatNum(ac.saldoAkhirRp)}
								</span>
							</div>
						</div>
					</button>

					<!-- Table Transaksi Akun -->
					{#if !isCollapsed}
						<div class="overflow-x-auto">
							<Table wrapperClass="border-0 shadow-none rounded-none">
								<TableHeader>
									<TableRow class="bg-muted/70">
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-24">Tanggal</TableHead>
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-32">No. Bukti</TableHead>
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest min-w-44">Keterangan / Remark</TableHead>
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-36">COA Transaksi</TableHead>
										<TableHead class="font-mono text-[10px] font-black uppercase tracking-widest w-14 text-center">Curr</TableHead>
										<TableHead class="text-right font-mono text-[10px] font-black uppercase tracking-widest w-28 bg-emerald-500/5">Debet (Rp)</TableHead>
										<TableHead class="text-right font-mono text-[10px] font-black uppercase tracking-widest w-28 bg-amber-500/5">Credit (Rp)</TableHead>
										<TableHead class="text-right font-mono text-[10px] font-black uppercase tracking-widest w-36 bg-primary/5">Saldo (Rp)</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									<!-- Baris Saldo Awal -->
									<TableRow class="bg-muted/30 font-bold">
										<TableCell class="font-mono text-xs">{formatDate(data.filters.tgl1)}</TableCell>
										<TableCell class="font-mono text-xs text-muted-foreground">-</TableCell>
										<TableCell class="font-mono text-xs font-black text-primary">SALDO AWAL</TableCell>
										<TableCell class="font-mono text-xs text-muted-foreground">-</TableCell>
										<TableCell class="font-mono text-xs text-center">{ac.curr}</TableCell>
										<TableCell class="text-right font-mono text-xs">-</TableCell>
										<TableCell class="text-right font-mono text-xs">-</TableCell>
										<TableCell class="text-right font-mono text-xs font-black bg-primary/5">
											{formatNum(ac.saldoAwalRp)}
										</TableCell>
									</TableRow>

									<!-- Baris Transaksi -->
									{#if ac.transactions.length === 0}
										<TableRow>
											<TableCell colspan={8} class="py-6 text-center text-xs font-bold text-muted-foreground">
												Tidak ada mutasi transaksi pada periode ini.
											</TableCell>
										</TableRow>
									{:else}
										{#each ac.transactions as t}
											<TableRow class="hover:bg-primary/5">
												<TableCell class="font-mono text-xs text-muted-foreground">{formatDate(t.tgl)}</TableCell>
												<TableCell class="font-mono text-xs font-bold text-primary">{t.noBukti}</TableCell>
												<TableCell class="text-xs font-semibold">{t.remark}</TableCell>
												<TableCell class="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
													{t.lawanTransaksi || '-'}
												</TableCell>
												<TableCell class="font-mono text-xs text-center text-muted-foreground">{t.curr}</TableCell>
												<TableCell class="text-right font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
													{t.debetRp > 0 ? formatNum(t.debetRp) : '-'}
												</TableCell>
												<TableCell class="text-right font-mono text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/5">
													{t.creditRp > 0 ? formatNum(t.creditRp) : '-'}
												</TableCell>
												<TableCell class="text-right font-mono text-xs font-black bg-primary/5">
													{formatNum(t.saldoRp)}
												</TableCell>
											</TableRow>
										{/each}
									{/if}

									<!-- Baris Subtotal Akun -->
									<TableRow class="bg-muted/80 font-black border-t-2 border-border">
										<TableCell colspan={5} class="text-right font-black uppercase text-xs">
											TOTAL MUTASI [{ac.acc}]:
										</TableCell>
										<TableCell class="text-right font-mono text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
											{formatNum(ac.totalDebetRp)}
										</TableCell>
										<TableCell class="text-right font-mono text-xs font-black text-amber-700 dark:text-amber-400 bg-amber-500/10">
											{formatNum(ac.totalCreditRp)}
										</TableCell>
										<TableCell class="text-right font-mono text-xs font-black text-foreground bg-primary/10">
											{formatNum(ac.saldoAkhirRp)}
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</div>
					{/if}
				</div>
			{/each}

			<!-- GRAND TOTAL FOOTER BANNER -->
			<div class="bg-card rounded-xl border-[3px] border-border p-5 brutal-shadow flex flex-wrap items-center justify-between gap-4 bg-muted/20">
				<div>
					<h3 class="font-black uppercase text-base tracking-tight" style="font-family: var(--font-display)">
						GRAND TOTAL LAPORAN BUKU BESAR
					</h3>
					<p class="text-xs font-bold text-muted-foreground mt-0.5">
						Periode {formatDate(data.filters.tgl1)} s/d {formatDate(data.filters.tgl2)} • Akun {data.filters.acc1} s/d {data.filters.acc2}
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-6">
					<div>
						<span class="block text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Total Debet</span>
						<span class="font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
							Rp {formatNum(data.grandTotal.totalDebetRp)}
						</span>
					</div>

					<div>
						<span class="block text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Total Kredit</span>
						<span class="font-mono text-base font-black text-amber-700 dark:text-amber-400">
							Rp {formatNum(data.grandTotal.totalCreditRp)}
						</span>
					</div>

					<div class="border-l-2 border-border pl-4">
						<span class="block text-[10px] font-black uppercase text-primary">Saldo Akhir Kumulatif</span>
						<span class="font-mono text-base font-black text-primary">
							Rp {formatNum(data.grandTotal.totalSaldoAkhirRp)}
						</span>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- MODAL PROGRES PEKERJAAN BULLMQ ANTRIAN -->
{#if showQueueModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
	>
		<div
			class="bg-card w-full max-w-lg rounded-2xl border-[3px] border-border p-6 brutal-shadow-lg space-y-5 max-h-[90vh] overflow-y-auto"
		>
			<!-- Header Modal -->
			<div class="flex items-center justify-between pb-3 border-b-2 border-border/40">
				<div class="flex items-center gap-2">
					<div class="size-8 rounded-lg border-2 border-border bg-primary/10 text-primary flex items-center justify-center font-bold">
						<Sparkles class="size-4" />
					</div>
					<div>
						<h3 class="font-black text-base uppercase text-foreground">Export Background BullMQ</h3>
						<p class="text-[11px] font-bold text-muted-foreground">Proses export file Excel di antrian worker (Bebas Timeout)</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeQueueModal}
					class="size-8 rounded-lg border-2 border-border bg-muted/60 hover:bg-muted font-black text-sm flex items-center justify-center cursor-pointer transition-colors"
				>
					✕
				</button>
			</div>

			{#if jobState === null}
				<!-- TAHAP 1: FORM PEMILIHAN TANGGAL & PARAMETER EXPORT -->
				<div class="space-y-4 text-xs">
					<!-- Pilihan Periode Tanggal -->
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<Label class="font-black uppercase text-xs">Periode Tanggal Export</Label>
							<div class="flex items-center gap-1">
								<button
									type="button"
									onclick={() => setExportMonth(0)}
									class="px-2 py-0.5 rounded border-2 border-border bg-muted/60 hover:bg-primary hover:text-primary-foreground font-mono text-[10px] font-bold cursor-pointer transition-colors"
								>
									Bulan Ini
								</button>
								<button
									type="button"
									onclick={() => setExportMonth(-1)}
									class="px-2 py-0.5 rounded border-2 border-border bg-muted/60 hover:bg-primary hover:text-primary-foreground font-mono text-[10px] font-bold cursor-pointer transition-colors"
								>
									Bulan Lalu
								</button>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-2.5">
							<div class="space-y-1">
								<span class="text-[10px] font-bold text-muted-foreground">Dari Tanggal:</span>
								<input
									type="date"
									bind:value={exportTgl1}
									class="bg-card border-border h-10 w-full rounded-lg border-2 px-3 text-xs font-bold brutal-shadow-sm"
								/>
							</div>
							<div class="space-y-1">
								<span class="text-[10px] font-bold text-muted-foreground">Sampai Tanggal:</span>
								<input
									type="date"
									bind:value={exportTgl2}
									class="bg-card border-border h-10 w-full rounded-lg border-2 px-3 text-xs font-bold brutal-shadow-sm"
								/>
							</div>
						</div>
					</div>

					<!-- Pilihan Rentang Akun -->
					<div class="space-y-2 pt-2 border-t border-border/40">
						<div class="flex items-center justify-between">
							<Label class="font-black uppercase text-xs">Rentang Akun (COA)</Label>
							<span class="text-[10px] text-muted-foreground font-bold">Pilih atau gunakan preset</span>
						</div>

						<!-- Quick Presets -->
						<div class="flex flex-wrap gap-1">
							{#each ACCOUNT_PRESETS as p}
								<button
									type="button"
									onclick={() => setExportPreset(p.a1, p.a2)}
									class="px-2 py-0.5 rounded border-2 border-border text-[10px] font-bold transition-colors cursor-pointer {exportAcc1 === p.a1 && exportAcc2 === p.a2 ? 'bg-primary text-primary-foreground font-black' : 'bg-muted/50 hover:bg-muted'}"
								>
									{p.label}
								</button>
							{/each}
						</div>

						<div class="grid grid-cols-2 gap-2.5 pt-1">
							<div class="space-y-1">
								<span class="text-[10px] font-bold text-muted-foreground">Dari Akun (Acc1):</span>
								<Combobox
									id="exportAcc1"
									name="exportAcc1"
									bind:value={exportAcc1}
									options={coaOptions}
									placeholder="1101"
									allowCustom={true}
								/>
							</div>
							<div class="space-y-1">
								<span class="text-[10px] font-bold text-muted-foreground">Sampai Akun (Acc2):</span>
								<Combobox
									id="exportAcc2"
									name="exportAcc2"
									bind:value={exportAcc2}
									options={coaOptions}
									placeholder="9999"
									allowCustom={true}
									dropdownClass="right-0 left-auto"
								/>
							</div>
						</div>
					</div>

					<!-- Opsi Tambahan -->
					<div class="space-y-2.5 pt-2 border-t border-border/40 bg-muted/30 p-3 rounded-xl border-2">
						<span class="font-black uppercase text-[11px] text-foreground">Opsi Tambahan</span>

						<div class="grid grid-cols-2 gap-2">
							<div class="space-y-1">
								<span class="text-[10px] font-bold text-muted-foreground">Mata Uang:</span>
								<select
									bind:value={exportCurr}
									class="bg-card border-border h-9 w-full rounded-lg border-2 px-2 text-xs font-bold uppercase cursor-pointer"
								>
									<option value="IDR">IDR</option>
									<option value="USD">USD</option>
									<option value="">Semua</option>
								</select>
							</div>
							<div class="space-y-1">
								<span class="text-[10px] font-bold text-muted-foreground">Tipe Jurnal:</span>
								<select
									bind:value={exportJu}
									class="bg-card border-border h-9 w-full rounded-lg border-2 px-2 text-xs font-bold uppercase cursor-pointer"
								>
									<option value={0}>Semua</option>
									<option value={1}>Hanya JU</option>
								</select>
							</div>
						</div>

						<div class="space-y-2 pt-1">
							<label class="flex items-center gap-2 cursor-pointer select-none">
								<input
									type="checkbox"
									bind:checked={exportLawanTransaksi}
									class="size-4 rounded border-2 border-border text-primary cursor-pointer"
								/>
								<span class="font-bold text-xs">Tampilkan Lawan Transaksi COA</span>
							</label>

							<label class="flex items-center gap-2 cursor-pointer select-none">
								<input
									type="checkbox"
									bind:checked={exportHideEmpty}
									class="size-4 rounded border-2 border-border text-primary cursor-pointer"
								/>
								<span class="font-bold text-xs">Sembunyikan Akun Bersaldo 0 & Tanpa Mutasi</span>
							</label>
						</div>
					</div>

					<!-- Action Buttons Modal -->
					<div class="flex items-center justify-end gap-2 pt-3 border-t-2 border-border/40">
						<Button
							type="button"
							variant="secondary"
							onclick={closeQueueModal}
							class="h-10 border-[2px] font-bold text-xs uppercase"
						>
							Batal
						</Button>
						<Button
							type="button"
							variant="default"
							onclick={startBullMQExport}
							class="h-10 px-5 border-[3px] bg-primary text-primary-foreground font-black text-xs uppercase tracking-wide brutal-shadow-sm cursor-pointer hover:bg-primary/90"
						>
							<Sparkles class="size-4 mr-1.5" />
							Mulai Export Background
						</Button>
					</div>
				</div>
			{:else}
				<!-- TAHAP 2: PROGRES PEMROSESAN / HASIL -->
				<div class="space-y-4">
					<!-- Informasi Job -->
					<div class="bg-muted/50 rounded-xl border-2 border-border/60 p-3.5 space-y-2 text-xs">
						<div class="flex justify-between">
							<span class="text-muted-foreground font-bold">Laporan:</span>
							<span class="font-black uppercase">Buku Besar Pembantu</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground font-bold">Periode:</span>
							<span class="font-black font-mono">{formatDate(exportTgl1)} s/d {formatDate(exportTgl2)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground font-bold">Rentang Akun:</span>
							<span class="font-black font-mono">{exportAcc1} s/d {exportAcc2}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground font-bold">Lawan Transaksi:</span>
							<span class="font-bold">{exportLawanTransaksi ? 'Ya' : 'Tidak'}</span>
						</div>
						{#if currentJobId}
							<div class="flex justify-between">
								<span class="text-muted-foreground font-bold">ID Pekerjaan BullMQ:</span>
								<span class="font-black font-mono text-primary">#{currentJobId}</span>
							</div>
						{/if}
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground font-bold">Status:</span>
							<Badge
								variant={jobState === 'completed' ? 'default' : jobState === 'failed' ? 'error' : 'secondary'}
								class="font-mono uppercase text-[10px]"
							>
								{jobState || 'MENUNGGU...'}
							</Badge>
						</div>
					</div>

					<!-- Progress Bar -->
					<div class="space-y-2">
						<div class="flex justify-between text-xs font-black">
							<span>Progres Pemrosesan</span>
							<span class="font-mono">{jobProgress}%</span>
						</div>
						<div class="h-3 w-full rounded-full border-2 border-border bg-muted overflow-hidden">
							<div
								class="h-full bg-primary transition-all duration-300"
								style="width: {jobProgress}%"
							></div>
						</div>
					</div>

					<!-- Pesan Status / Error -->
					{#if jobState === 'failed'}
						<Alert variant="error" title="Gagal Memproses">
							{jobError || 'Worker mengalami kendala saat memproses laporan.'}
						</Alert>
					{:else if jobState === 'completed' && jobResult}
						<div class="bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs space-y-2">
							<div class="flex items-center gap-2 font-black">
								<CheckCircle2 class="size-4" />
								<span>Berkas Excel Berhasil Dibuat!</span>
							</div>
							<p class="font-medium text-[11px] leading-relaxed">
								{jobResult.message}
							</p>
						</div>
					{:else}
						<div class="flex items-center gap-2 text-xs text-muted-foreground justify-center py-2">
							<RefreshCw class="size-4 animate-spin text-primary" />
							<span class="font-bold">Sedang mengeksekusi Stored Procedure & menyusun file Excel...</span>
						</div>
					{/if}

					<!-- Action Buttons -->
					<div class="flex items-center justify-end gap-2 pt-2 border-t-2 border-border/40">
						{#if jobState === 'failed'}
							<Button
								type="button"
								variant="default"
								onclick={() => (jobState = null)}
								class="h-10 border-[2px] font-bold text-xs uppercase"
							>
								Ubah Parameter & Coba Lagi
							</Button>
						{/if}
						{#if jobState === 'completed' && currentJobId}
							<a
								href="/api/queue/buku-besar?jobId={currentJobId}&download=true"
								class="h-10 px-5 inline-flex items-center justify-center rounded-lg border-[3px] bg-primary text-primary-foreground font-black text-xs uppercase tracking-wide brutal-shadow-sm hover:opacity-95"
							>
								<Download class="size-4 mr-2" />
								Unduh Berkas Excel ({jobResult?.fileName || 'rpbbpembantul.xlsx'})
							</a>
						{/if}
						<Button
							type="button"
							variant="secondary"
							onclick={closeQueueModal}
							class="h-10 border-[3px] font-bold text-xs uppercase"
						>
							Tutup
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

