<script lang="ts">
	import {
		Button,
		Label,
		PageHeader,
		Alert,
		SearchInput
	} from '$lib/components';
	import {
		Calculator,
		Printer,
		CheckCircle2,
		AlertTriangle,
		BookOpen,
		ArrowDownRight,
		ArrowUpRight,
		FileSpreadsheet
	} from '@lucide/svelte';

	let { data } = $props();

	let searchQuery = $state('');

	let filteredItems = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return data.items;
		return data.items.filter(
			(item) => item.acc.toLowerCase().includes(q) || item.accName.toLowerCase().includes(q)
		);
	});

	function formatAccounting(val: number | null | undefined, dec = 0): string {
		if (val == null || isNaN(val) || Math.abs(val) < 0.001) return '-';
		const isNeg = val < 0;
		const absStr = Math.abs(val).toLocaleString('id-ID', {
			minimumFractionDigits: dec,
			maximumFractionDigits: dec
		});
		return isNeg ? `(${absStr})` : absStr;
	}

	function formatPeriod(periodStr: string): string {
		if (!periodStr || periodStr.length !== 6) return periodStr || '-';
		const y = periodStr.slice(0, 4);
		const m = periodStr.slice(4, 6);
		const months = [
			'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
			'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
		];
		const mIndex = parseInt(m, 10) - 1;
		return `${months[mIndex] || m} ${y}`;
	}

	function formatDateLong(dateStr: string | null | undefined): string {
		if (!dateStr) return '-';
		const p = dateStr.split('-');
		if (p.length === 3) {
			const months = [
				'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
				'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
			];
			const mIdx = parseInt(p[1], 10) - 1;
			return `${parseInt(p[2], 10)} ${months[mIdx] || p[1]} ${p[0]}`;
		}
		return dateStr;
	}
</script>

<div class="space-y-6">
	<!-- Page Header (Screen Only) -->
	<div class="print:hidden">
		<PageHeader
			title="Neraca Saldo (Trial Balance)"
			description="Rekapitulasi saldo awal, mutasi debet, kredit, dan saldo akhir akun COA Standar Akuntansi Indonesia."
		>
			{#snippet actions()}
				<div class="flex items-center gap-2">
					<form method="post" action="/api/trial-balance/export" class="inline">
						<input type="hidden" name="periode" value={data.filters.periode} />
						<input type="hidden" name="tglPeriode" value={data.filters.tglPeriode} />
						<input type="hidden" name="pjgLevel" value={data.filters.pjgLevel} />
						<input type="hidden" name="company" value={data.filters.company} />
						<Button
							type="submit"
							variant="secondary"
							class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
							title="Export format Excel template rptrialbalancel-l.xls"
						>
							<FileSpreadsheet class="size-4 mr-1.5" />
							Export Excel (rptrialbalancel-l.xls)
						</Button>
					</form>

					<Button
						type="button"
						variant="secondary"
						onclick={() => window.print()}
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Cetak lembar laporan resmi A4"
					>
						<Printer class="size-4 mr-1.5" />
						Cetak Lembar Resmi SAK
					</Button>
				</div>
			{/snippet}
		</PageHeader>
	</div>

	<!-- KPI Summary Metrics (Screen Only) -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
		<!-- Total Akun -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Akun Terdaftar</span>
				<BookOpen class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.totals.totalAccounts}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Periode {formatPeriod(data.filters.periode)}
				</p>
			</div>
		</div>

		<!-- Total Mutasi Debet -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Mutasi Debet</span>
				<ArrowDownRight class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
					Rp {formatAccounting(data.totals.totalMutasiDebet)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Mutasi Debet Periode Ini
				</p>
			</div>
		</div>

		<!-- Total Mutasi Kredit -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-amber-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Mutasi Kredit</span>
				<ArrowUpRight class="size-4 text-amber-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">
					Rp {formatAccounting(data.totals.totalMutasiKredit)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Mutasi Kredit Periode Ini
				</p>
			</div>
		</div>

		<!-- Status Keseimbangan -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between {data.totals.isBalanced ? 'bg-emerald-500/10' : 'bg-rose-500/10'}">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black uppercase tracking-wider {data.totals.isBalanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
					Status Keseimbangan
				</span>
				{#if data.totals.isBalanced}
					<CheckCircle2 class="size-4 text-emerald-600" />
				{:else}
					<AlertTriangle class="size-4 text-rose-600" />
				{/if}
			</div>
			<div class="mt-2">
				<div class="text-lg font-black {data.totals.isBalanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
					{data.totals.isBalanced ? 'SEIMBANG (BALANCED)' : 'TERJADI SELISIH'}
				</div>
				<p class="text-[11px] font-mono font-bold {data.totals.isBalanced ? 'text-emerald-600/80' : 'text-rose-600'} mt-0.5">
					{data.totals.isBalanced ? 'Debet = Kredit' : `Selisih Mutasi: Rp ${formatAccounting(Math.abs(data.totals.totalMutasiDebet - data.totals.totalMutasiKredit))}`}
				</p>
			</div>
		</div>
	</div>

	<!-- Filter Form (Screen Only) Sesuai Stored Procedure [rpTrialBalanceL] -->
	<form
		method="get"
		action="/dashboard/trial-balance"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4 print:hidden"
	>
		<div class="flex items-center justify-between pb-2 border-b-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-foreground">Parameter Stored Procedure:</span>
				<code class="text-[11px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
					rpTrialBalanceL (@PjgLevel, @Periode, @TglPeriode, @company)
				</code>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
			<!-- Periode (YYYYMM) -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="periode" class="text-xs font-bold">Periode (@Periode)</Label>
				<input
					type="text"
					id="periode"
					name="periode"
					value={data.filters.periode}
					placeholder="YYYYMM"
					maxlength="6"
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm uppercase focus:outline-none"
					title="Format YYYYMM (contoh: 202609)"
				/>
			</div>

			<!-- Per Tanggal -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="tglPeriode" class="text-xs font-bold">Per Tanggal (@TglPeriode)</Label>
				<input
					type="date"
					id="tglPeriode"
					name="tglPeriode"
					value={data.filters.tglPeriode}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-none"
				/>
			</div>

			<!-- Level Akun (@PjgLevel) -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="pjgLevel" class="text-xs font-bold">Level Akun (@PjgLevel)</Label>
				<select
					id="pjgLevel"
					name="pjgLevel"
					value={String(data.filters.pjgLevel)}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-bold uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="10">Level 10 (Standar / 10 Digit)</option>
					<option value="4">Level 4 (Group / 4 Digit)</option>
					<option value="6">Level 6 (Sub-Akun / 6 Digit)</option>
					<option value="8">Level 8 (Sub-Sub / 8 Digit)</option>
					<option value="20">Level 20 (Maksimal / 20 Digit)</option>
				</select>
			</div>

			<!-- Perusahaan (@company) -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="company" class="text-xs font-bold">Perusahaan (@company)</Label>
				<select
					id="company"
					name="company"
					value={String(data.filters.company)}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-bold uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="0">0 — Semua (Konsolidasi)</option>
					<option value="1">1 — PT DBTR / CP</option>
					<option value="2">2 — PT MDU</option>
					<option value="3">3 — PT PMS</option>
				</select>
			</div>

			<!-- Submit Button -->
			<div class="lg:col-span-1">
				<Button type="submit" class="h-11 w-full border-[3px] font-black uppercase tracking-wide brutal-shadow-sm cursor-pointer">
					Tampilkan
				</Button>
			</div>
		</div>
	</form>

	{#if data.error}
		<Alert variant="error" title="Gagal Memuat Neraca Saldo">
			{data.error}
		</Alert>
	{/if}

	<!-- Quick Search Bar (Screen Only) -->
	<div class="flex items-center justify-between gap-4 print:hidden">
		<div class="max-w-md w-full">
			<SearchInput
				placeholder="Cari nomor atau nama akun..."
				bind:value={searchQuery}
			/>
		</div>
		<span class="font-mono text-xs font-bold text-muted-foreground">
			Menampilkan {filteredItems.length} dari {data.totals.totalAccounts} akun
		</span>
	</div>

	<!-- ======================================================== -->
	<!-- LEMBAR LAPORAN KEUANGAN RESMI STANDAR SAK INDONESIA       -->
	<!-- ======================================================== -->
	<div class="bg-card border-[3px] border-border rounded-2xl p-6 sm:p-10 brutal-shadow max-w-5xl mx-auto print:border-none print:shadow-none print:p-0 print:max-w-none print:rounded-none">
		<!-- Kop Surat / Header Formal SAK -->
		<div class="text-center space-y-1 pb-6 border-b-2 border-border/80">
			<h2 class="text-lg sm:text-xl font-black tracking-widest uppercase text-foreground">
				PT CITI PLUMB
			</h2>
			<h1 class="text-base sm:text-lg font-black tracking-wider uppercase text-foreground">
				NERACA SALDO (TRIAL BALANCE)
			</h1>
			<p class="text-xs sm:text-sm font-bold text-muted-foreground">
				Per {formatDateLong(data.filters.tglPeriode)} ({formatPeriod(data.filters.periode)})
			</p>
			<p class="text-[11px] italic text-muted-foreground font-medium pt-0.5">
				(Dinyatakan dalam Rupiah, kecuali dinyatakan lain)
			</p>
		</div>

		<!-- Tabel Neraca Saldo SAK -->
		<div class="mt-6 overflow-x-auto">
			<table class="w-full text-left border-collapse text-xs">
				<thead>
					<tr class="border-b border-border font-black uppercase text-[11px] tracking-wider text-foreground">
						<th rowspan="2" class="py-2.5 px-3 w-28 text-center border-r border-border">Perkiraan</th>
						<th rowspan="2" class="py-2.5 px-3 border-r border-border">Nama Perkiraan</th>
						<th colspan="2" class="py-2 px-3 text-center border-r border-border bg-muted/30">Saldo Awal</th>
						<th colspan="2" class="py-2 px-3 text-center border-r border-border bg-muted/10">Mutasi</th>
						<th colspan="2" class="py-2 px-3 text-center bg-muted/30">Saldo Akhir</th>
					</tr>
					<tr class="border-b-2 border-border font-black uppercase text-[10px] tracking-wider text-foreground">
						<th class="py-1.5 px-2 text-right w-28 border-r border-border/60">Debet</th>
						<th class="py-1.5 px-2 text-right w-28 border-r border-border">Kredit</th>
						<th class="py-1.5 px-2 text-right w-28 border-r border-border/60 text-emerald-700 dark:text-emerald-400">Debet</th>
						<th class="py-1.5 px-2 text-right w-28 border-r border-border text-amber-700 dark:text-amber-400">Kredit</th>
						<th class="py-1.5 px-2 text-right w-28 border-r border-border/60">Debet</th>
						<th class="py-1.5 px-2 text-right w-28">Kredit</th>
					</tr>
				</thead>

				<tbody class="font-medium text-foreground divide-y divide-border/20">
					{#if filteredItems.length === 0}
						<tr>
							<td colspan="8" class="py-12 text-center text-muted-foreground font-bold text-sm">
								Tidak ada data akun yang sesuai dengan filter.
							</td>
						</tr>
					{:else}
						{#each filteredItems as item}
							<tr class="hover:bg-muted/20 transition-colors">
								<td class="py-1.5 px-3 text-center font-mono font-bold text-muted-foreground border-r border-border/40">
									{item.acc}
								</td>
								<td class="py-1.5 px-3 font-semibold text-foreground border-r border-border/40">
									{item.accName}
								</td>
								<td class="py-1.5 px-2 text-right font-mono font-medium border-r border-border/20">
									{formatAccounting(item.saldoAwalDebet)}
								</td>
								<td class="py-1.5 px-2 text-right font-mono font-medium border-r border-border/40">
									{formatAccounting(item.saldoAwalKredit)}
								</td>
								<td class="py-1.5 px-2 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400 border-r border-border/20">
									{formatAccounting(item.mutasiDebet)}
								</td>
								<td class="py-1.5 px-2 text-right font-mono font-medium text-amber-700 dark:text-amber-400 border-r border-border/40">
									{formatAccounting(item.mutasiKredit)}
								</td>
								<td class="py-1.5 px-2 text-right font-mono font-bold text-foreground border-r border-border/20">
									{formatAccounting(item.saldoAkhirDebet)}
								</td>
								<td class="py-1.5 px-2 text-right font-mono font-bold text-foreground">
									{formatAccounting(item.saldoAkhirKredit)}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>

				<tfoot>
					<!-- GRAND TOTAL (Double Underline SAK) -->
					<tr class="border-t-2 border-border border-b-4 border-double border-border bg-primary/5 font-black text-xs text-foreground">
						<td colspan="2" class="py-3 px-3 uppercase tracking-wider border-r border-border">
							JUMLAH KESELURUHAN (GRAND TOTAL)
						</td>
						<td class="py-3 px-2 text-right font-mono font-black border-r border-border/40">
							{formatAccounting(data.totals.totalAwalDebet)}
						</td>
						<td class="py-3 px-2 text-right font-mono font-black border-r border-border">
							{formatAccounting(data.totals.totalAwalKredit)}
						</td>
						<td class="py-3 px-2 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 border-r border-border/40">
							{formatAccounting(data.totals.totalMutasiDebet)}
						</td>
						<td class="py-3 px-2 text-right font-mono font-black text-amber-700 dark:text-amber-400 border-r border-border">
							{formatAccounting(data.totals.totalMutasiKredit)}
						</td>
						<td class="py-3 px-2 text-right font-mono font-black text-primary border-r border-border/40">
							{formatAccounting(data.totals.totalAkhirDebet)}
						</td>
						<td class="py-3 px-2 text-right font-mono font-black text-primary">
							{formatAccounting(data.totals.totalAkhirKredit)}
						</td>
					</tr>
				</tfoot>
			</table>
		</div>

		<!-- Kolom Tanda Tangan Pengesahan Resmi (Sign-off Section) -->
		<div class="mt-14 pt-6 border-t border-border/60 text-xs">
			<div class="text-right text-muted-foreground font-semibold mb-8">
				Lamongan, {formatDateLong(data.filters.tglPeriode)}
			</div>

			<div class="grid grid-cols-2 gap-10 text-center">
				<div>
					<p class="font-bold text-muted-foreground">Mengetahui,</p>
					<p class="font-black text-foreground uppercase tracking-wide">Direktur / Finance Manager</p>
					<div class="h-20 sm:h-24"></div>
					<p class="font-bold text-foreground underline underline-offset-4">( ___________________________ )</p>
				</div>
				<div>
					<p class="font-bold text-muted-foreground">Dibuat Oleh,</p>
					<p class="font-black text-foreground uppercase tracking-wide">Staff Akuntansi / GL</p>
					<div class="h-20 sm:h-24"></div>
					<p class="font-bold text-foreground underline underline-offset-4">( ___________________________ )</p>
				</div>
			</div>
		</div>
	</div>
</div>
