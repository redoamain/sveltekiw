<script lang="ts">
	import {
		Button,
		Label,
		PageHeader,
		Alert
	} from '$lib/components';
	import {
		TrendingUp,
		TrendingDown,
		Printer,
		BadgeDollarSign,
		ArrowDownRight,
		ArrowUpRight,
		Wallet,
		FileSpreadsheet
	} from '@lucide/svelte';

	let { data } = $props();

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
			title="Laporan Laba Rugi (Income Statement)"
			description="Format Laporan Laba Rugi Multi-Step Standar Akuntansi Keuangan (SAK) Indonesia."
		>
			{#snippet actions()}
				<div class="flex items-center gap-2">
					<form method="post" action="/api/laba-rugi/export" class="inline">
						<input type="hidden" name="periode1" value={data.filters.periode1} />
						<input type="hidden" name="periode2" value={data.filters.periode2} />
						<input type="hidden" name="tglPeriode" value={data.filters.tglPeriode} />
						<input type="hidden" name="pjgLevel" value={data.filters.pjgLevel} />
						<input type="hidden" name="jenisopr" value={data.filters.jenisopr} />
						<input type="hidden" name="company" value={data.filters.company} />
						<Button
							type="submit"
							variant="secondary"
							class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
							title="Export format Excel template rprugilabanew.xls"
						>
							<FileSpreadsheet class="size-4 mr-1.5" />
							Export Excel (rprugilabanew.xls)
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
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
		<!-- Penjualan Bersih -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Penjualan Bersih</span>
				<BadgeDollarSign class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-lg sm:text-xl font-black text-foreground">
					Rp {formatAccounting(data.summary.penjualanBersih)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Periode {formatPeriod(data.filters.periode1)}
				</p>
			</div>
		</div>

		<!-- HPP -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Beban Pokok (HPP)</span>
				<ArrowDownRight class="size-4 text-amber-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-lg sm:text-xl font-black text-foreground">
					Rp {formatAccounting(-Math.abs(data.summary.hpp))}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Biaya Pokok Penjualan
				</p>
			</div>
		</div>

		<!-- Laba Kotor -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Laba Kotor</span>
				<ArrowUpRight class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-lg sm:text-xl font-black {data.summary.labaKotor >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
					Rp {formatAccounting(data.summary.labaKotor)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Penjualan - HPP
				</p>
			</div>
		</div>

		<!-- Beban Usaha -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Beban Usaha</span>
				<Wallet class="size-4 text-slate-500" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-lg sm:text-xl font-black text-foreground">
					Rp {formatAccounting(-Math.abs(data.summary.bebanUsaha))}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Beban Ops & Admin
				</p>
			</div>
		</div>

		<!-- Laba Bersih -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between col-span-2 lg:col-span-1 {data.summary.labaBersih >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black uppercase tracking-wider {data.summary.labaBersih >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
					Laba Bersih
				</span>
				{#if data.summary.labaBersih >= 0}
					<TrendingUp class="size-4 text-emerald-600" />
				{:else}
					<TrendingDown class="size-4 text-rose-600" />
				{/if}
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl sm:text-2xl font-black {data.summary.labaBersih >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
					Rp {formatAccounting(data.summary.labaBersih)}
				</div>
				<p class="text-[11px] font-bold {data.summary.labaBersih >= 0 ? 'text-emerald-600/80' : 'text-rose-600'} mt-0.5">
					{data.summary.labaBersih >= 0 ? 'Surplus Laba Bersih' : 'Defisit Rugi Bersih'}
				</p>
			</div>
		</div>
	</div>

	<!-- Filter Form (Screen Only) Sesuai Stored Procedure [rpRugiLabaNew] -->
	<form
		method="get"
		action="/dashboard/laba-rugi"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4 print:hidden"
	>
		<div class="flex items-center justify-between pb-2 border-b-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-foreground">Parameter Stored Procedure:</span>
				<code class="text-[11px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
					rpRugiLabaNew (@PjgLevel, @Periode1, @Periode2, @TglPeriode, @jenisopr, @company)
				</code>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 items-end">
			<!-- Periode Berjalan (YYYYMM) -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="periode1" class="text-xs font-bold">Periode 1 (@Periode1)</Label>
				<input
					type="text"
					id="periode1"
					name="periode1"
					value={data.filters.periode1}
					placeholder="YYYYMM"
					maxlength="6"
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm uppercase focus:outline-none"
					title="Format YYYYMM (contoh: 202609)"
				/>
			</div>

			<!-- Periode Pembanding (YYYYMM) -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="periode2" class="text-xs font-bold">Periode 2 (@Periode2)</Label>
				<input
					type="text"
					id="periode2"
					name="periode2"
					value={data.filters.periode2}
					placeholder="YYYYMM"
					maxlength="6"
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm uppercase focus:outline-none"
					title="Format YYYYMM (contoh: 202608)"
				/>
			</div>

			<!-- Per Tanggal (@TglPeriode) -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="tglPeriode" class="text-xs font-bold">Cut-off (@TglPeriode)</Label>
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
				<Label for="pjgLevel" class="text-xs font-bold">Level (@PjgLevel)</Label>
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
					<option value="15">Level 15 (Detail / 15 Digit)</option>
					<option value="20">Level 20 (Maksimal / 20 Digit)</option>
				</select>
			</div>

			<!-- Divisi Operasi (@jenisopr) -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="jenisopr" class="text-xs font-bold">Divisi (@jenisopr)</Label>
				<select
					id="jenisopr"
					name="jenisopr"
					value={String(data.filters.jenisopr)}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-2 text-xs font-bold uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="0">0 — SEMUA DIVISI</option>
					<option value="1">1 — DIVISI TRADING</option>
					<option value="2">2 — DIVISI PRODUKSI</option>
					<option value="3">3 — DIVISI JASA</option>
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
		<Alert variant="error" title="Gagal Memuat Laba Rugi">
			{data.error}
		</Alert>
	{/if}

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
				LAPORAN LABA RUGI DAN PENGHASILAN KOMPREHENSIF LAIN
			</h1>
			<p class="text-xs sm:text-sm font-bold text-muted-foreground">
				Untuk Periode yang Berakhir pada {formatDateLong(data.filters.tglPeriode)} dan {formatPeriod(data.filters.periode2)}
			</p>
			<p class="text-[11px] italic text-muted-foreground font-medium pt-0.5">
				(Dinyatakan dalam Rupiah, kecuali dinyatakan lain)
			</p>
		</div>

		<!-- Tabel Laporan Laba Rugi SAK (Multiple-Step) -->
		<div class="mt-6 overflow-x-auto">
			<table class="w-full text-left border-collapse text-xs">
				<thead>
					<tr class="border-b-2 border-border font-black uppercase text-[11px] tracking-wider text-foreground">
						<th class="py-2.5 px-3">Uraian / Pos Laba Rugi</th>
						<th class="py-2.5 px-3 text-center w-24">Kode</th>
						<th class="py-2.5 px-3 text-right w-40">{formatPeriod(data.filters.periode1)}</th>
						<th class="py-2.5 px-3 text-right w-40">{formatPeriod(data.filters.periode2)}</th>
						<th class="py-2.5 px-3 text-right w-40">Y T D</th>
					</tr>
				</thead>

				<tbody class="font-medium text-foreground">
					{#if data.rows.length === 0}
						<tr>
							<td colspan="5" class="py-12 text-center text-muted-foreground font-bold text-sm">
								Tidak ada data transaksi laba rugi untuk periode ini.
							</td>
						</tr>
					{:else}
						{#each data.rows as row}
							{#if !row.detail}
								<!-- Subtotal / Major Summary Row (SAK Multi-Step Heading/Total) -->
								{@const isFinal = (row.titleNR || '').includes('SEBELUM KOREKSI') || (row.titleNR || '').includes('BERSIH SETELAH') || (row.accName || '').includes('BERSIH')}
								<tr class="{isFinal ? 'border-t-2 border-border border-b-4 border-double border-border bg-primary/10 font-black text-xs sm:text-sm py-3' : 'border-t border-border/80 font-bold bg-muted/30'}">
									<td class="py-2.5 px-3 uppercase tracking-wide text-foreground">
										{row.titleNR || row.accName || row.groupTitle}
									</td>
									<td class="py-2.5 px-3 text-center font-mono text-[11px] text-muted-foreground">
										{row.acc || '-'}
									</td>
									<td class="py-2.5 px-3 text-right font-mono font-black {row.saldoRp1 >= 0 ? 'text-foreground' : 'text-rose-700 dark:text-rose-400'}">
										{isFinal ? `Rp ${formatAccounting(row.saldoRp1)}` : formatAccounting(row.saldoRp1)}
									</td>
									<td class="py-2.5 px-3 text-right font-mono font-black {row.saldoRp2 >= 0 ? 'text-muted-foreground' : 'text-rose-700 dark:text-rose-400'}">
										{isFinal ? `Rp ${formatAccounting(row.saldoRp2)}` : formatAccounting(row.saldoRp2)}
									</td>
									<td class="py-2.5 px-3 text-right font-mono font-black {row.saldoYTD >= 0 ? 'text-primary' : 'text-rose-700 dark:text-rose-400'}">
										{isFinal ? `Rp ${formatAccounting(row.saldoYTD)}` : formatAccounting(row.saldoYTD)}
									</td>
								</tr>
							{:else}
								<!-- Detail Line Item Row -->
								<tr class="hover:bg-muted/20 transition-colors">
									<td class="py-1 px-3 pl-8 text-foreground/90 font-medium">
										{row.accName}
									</td>
									<td class="py-1 px-3 text-center font-mono text-[11px] text-muted-foreground">
										{row.acc}
									</td>
									<td class="py-1 px-3 text-right font-mono font-medium text-foreground">
										{formatAccounting(row.saldoRp1)}
									</td>
									<td class="py-1 px-3 text-right font-mono font-medium text-muted-foreground">
										{formatAccounting(row.saldoRp2)}
									</td>
									<td class="py-1 px-3 text-right font-mono font-medium text-primary">
										{formatAccounting(row.saldoYTD)}
									</td>
								</tr>
							{/if}
						{/each}
					{/if}
				</tbody>
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
