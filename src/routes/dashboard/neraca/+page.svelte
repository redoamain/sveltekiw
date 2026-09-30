<script lang="ts">
	import {
		Button,
		Label,
		PageHeader,
		Alert
	} from '$lib/components';
	import {
		Scale,
		Printer,
		CheckCircle2,
		AlertTriangle,
		Building2,
		Wallet,
		ShieldCheck,
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

	function formatPct(val: number | null | undefined): string {
		if (val == null || isNaN(val) || Math.abs(val) < 0.001) return '-';
		return `${val.toFixed(2)}%`;
	}
</script>

<div class="space-y-6">
	<!-- Page Header (Screen Only) -->
	<div class="print:hidden">
		<PageHeader
			title="Laporan Posisi Keuangan (Neraca)"
			description="Format Laporan Posisi Keuangan Standar Akuntansi Keuangan (SAK) Indonesia komparatif."
		>
			{#snippet actions()}
				<div class="flex items-center gap-2">
					<form method="post" action="/api/neraca/export" class="inline">
						<input type="hidden" name="periode1" value={data.filters.periode1} />
						<input type="hidden" name="periode2" value={data.filters.periode2} />
						<input type="hidden" name="tglPeriode" value={data.filters.tglPeriode} />
						<input type="hidden" name="pjgLevel" value={data.filters.pjgLevel} />
						<input type="hidden" name="company" value={data.filters.company} />
						<Button
							type="submit"
							variant="secondary"
							class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
							title="Export format Excel template rpneracal.xls"
						>
							<FileSpreadsheet class="size-4 mr-1.5" />
							Export Excel (rpneracal.xls)
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
		<!-- Total Aktiva -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Aset (Aktiva)</span>
				<Building2 class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl sm:text-2xl font-black text-foreground">
					Rp {formatAccounting(data.aktiva.totalRp1)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Per {formatDateLong(data.filters.tglPeriode)}
				</p>
			</div>
		</div>

		<!-- Total Kewajiban & Ekuitas -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Liabilitas & Ekuitas</span>
				<Wallet class="size-4 text-slate-500" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl sm:text-2xl font-black text-foreground">
					Rp {formatAccounting(data.pasiva.totalRp1)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Per {formatDateLong(data.filters.tglPeriode)}
				</p>
			</div>
		</div>

		<!-- Status Keseimbangan -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between {data.isBalanced1 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black uppercase tracking-wider {data.isBalanced1 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
					Status Keseimbangan
				</span>
				{#if data.isBalanced1}
					<CheckCircle2 class="size-4 text-emerald-600" />
				{:else}
					<AlertTriangle class="size-4 text-rose-600" />
				{/if}
			</div>
			<div class="mt-2">
				<div class="text-lg font-black {data.isBalanced1 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
					{data.isBalanced1 ? 'SEIMBANG (BALANCED)' : 'SELISIH NERACA'}
				</div>
				<p class="text-[11px] font-mono font-bold {data.isBalanced1 ? 'text-emerald-600/80' : 'text-rose-600'} mt-0.5">
					{data.isBalanced1 ? 'Aset = Liabilitas + Ekuitas' : `Selisih: Rp ${formatAccounting(Math.abs(data.diffRp1))}`}
				</p>
			</div>
		</div>

		<!-- Total Aset Periode Lalu -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Aset Pembanding</span>
				<Scale class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl sm:text-2xl font-black text-foreground">
					Rp {formatAccounting(data.aktiva.totalRp2)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Periode {formatPeriod(data.filters.periode2)}
				</p>
			</div>
		</div>
	</div>

	<!-- Filter Form (Screen Only) Sesuai Stored Procedure [rpNeracaL] -->
	<form
		method="get"
		action="/dashboard/neraca"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4 print:hidden"
	>
		<div class="flex items-center justify-between pb-2 border-b-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-foreground">Parameter Stored Procedure:</span>
				<code class="text-[11px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
					rpNeracaL (@PjgLevel, @Periode1, @Periode2, @TglPeriode, @company)
				</code>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
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
		<Alert variant="error" title="Gagal Memuat Neraca">
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
				LAPORAN POSISI KEUANGAN (NERACA)
			</h1>
			<p class="text-xs sm:text-sm font-bold text-muted-foreground">
				Per {formatDateLong(data.filters.tglPeriode)} dan {formatPeriod(data.filters.periode2)}
			</p>
			<p class="text-[11px] italic text-muted-foreground font-medium pt-0.5">
				(Dinyatakan dalam Rupiah, kecuali dinyatakan lain)
			</p>
		</div>

		<!-- Tabel Laporan Neraca SAK -->
		<div class="mt-6 overflow-x-auto">
			<table class="w-full text-left border-collapse text-xs">
				<thead>
					<tr class="border-b-2 border-border font-black uppercase text-[11px] tracking-wider text-foreground">
						<th class="py-2.5 px-3">Keterangan / Uraian Akun</th>
						<th class="py-2.5 px-3 text-center w-24">Kode</th>
						<th class="py-2.5 px-3 text-right w-36">{formatPeriod(data.filters.periode1)}</th>
						<th class="py-2.5 px-3 text-right w-16">%</th>
						<th class="py-2.5 px-3 text-right w-36">{formatPeriod(data.filters.periode2)}</th>
						<th class="py-2.5 px-3 text-right w-16">%</th>
						<th class="py-2.5 px-3 text-right w-24">% Growth</th>
					</tr>
				</thead>

				<tbody class="font-medium text-foreground">
					<!-- ============================================== -->
					<!-- BAGIAN 1: ASET (AKTIVA)                         -->
					<!-- ============================================== -->
					<tr class="bg-muted/40 font-black text-xs text-foreground">
						<td colspan="7" class="py-2 px-3 tracking-wide">
							ASET (AKTIVA)
						</td>
					</tr>

					{#each data.aktiva.groups as grp}
						<!-- Sub-Header Kategori (e.g. ASET LANCAR, ASET TETAP) -->
						<tr class="font-bold text-xs text-foreground">
							<td colspan="7" class="pt-3 pb-1 px-3 pl-6 uppercase tracking-wider text-primary">
								{grp.groupName}
							</td>
						</tr>

						<!-- Rincian Akun -->
						{#each grp.items as item}
							<tr class="hover:bg-muted/20 transition-colors">
								<td class="py-1 px-3 pl-10 text-foreground/90 font-medium">
									{item.accName}
								</td>
								<td class="py-1 px-3 text-center font-mono text-[11px] text-muted-foreground">
									{item.acc}
								</td>
								<td class="py-1 px-3 text-right font-mono font-medium text-foreground">
									{formatAccounting(item.saldoRp1)}
								</td>
								<td class="py-1 px-3 text-right font-mono text-xs text-muted-foreground">
									{formatPct(item.pct1)}
								</td>
								<td class="py-1 px-3 text-right font-mono font-medium text-muted-foreground">
									{formatAccounting(item.saldoRp2)}
								</td>
								<td class="py-1 px-3 text-right font-mono text-xs text-muted-foreground">
									{formatPct(item.pct2)}
								</td>
								<td class="py-1 px-3 text-right font-mono font-bold {item.growth > 0 ? 'text-emerald-600' : item.growth < 0 ? 'text-rose-600' : 'text-muted-foreground'}">
									{item.growth !== 0 ? `${item.growth > 0 ? '+' : ''}${item.growth.toFixed(1)}%` : '-'}
								</td>
							</tr>
						{/each}

						<!-- Subtotal Kelompok Aset -->
						<tr class="font-bold text-xs border-t border-border/50">
							<td class="py-1.5 px-3 pl-6 italic font-bold text-foreground">
								Jumlah {grp.groupName}
							</td>
							<td class="py-1.5 px-3"></td>
							<td class="py-1.5 px-3 text-right font-mono font-bold text-foreground">
								{formatAccounting(grp.subtotalRp1)}
							</td>
							<td class="py-1.5 px-3 text-right font-mono text-xs font-bold text-foreground">
								{formatPct(grp.subtotalPct1)}
							</td>
							<td class="py-1.5 px-3 text-right font-mono font-bold text-muted-foreground">
								{formatAccounting(grp.subtotalRp2)}
							</td>
							<td class="py-1.5 px-3 text-right font-mono text-xs font-bold text-muted-foreground">
								{formatPct(grp.subtotalPct2)}
							</td>
							<td class="py-1.5 px-3 text-right font-mono font-bold {grp.subtotalGrowth > 0 ? 'text-emerald-600' : grp.subtotalGrowth < 0 ? 'text-rose-600' : 'text-muted-foreground'}">
								{grp.subtotalGrowth !== 0 ? `${grp.subtotalGrowth > 0 ? '+' : ''}${grp.subtotalGrowth.toFixed(1)}%` : '-'}
							</td>
						</tr>
					{/each}

					<!-- GRAND TOTAL ASET (Double Underline SAK) -->
					<tr class="border-t-2 border-border border-b-4 border-double border-border bg-primary/5 font-black text-xs sm:text-sm text-foreground">
						<td class="py-3 px-3 uppercase tracking-wider">
							JUMLAH ASET
						</td>
						<td class="py-3 px-3"></td>
						<td class="py-3 px-3 text-right font-mono font-black text-primary">
							Rp {formatAccounting(data.aktiva.totalRp1)}
						</td>
						<td class="py-3 px-3 text-right font-mono font-black text-primary">
							100.00%
						</td>
						<td class="py-3 px-3 text-right font-mono font-black text-muted-foreground">
							Rp {formatAccounting(data.aktiva.totalRp2)}
						</td>
						<td class="py-3 px-3 text-right font-mono font-black text-muted-foreground">
							100.00%
						</td>
						<td class="py-3 px-3 text-right font-mono font-black {data.aktiva.totalGrowth > 0 ? 'text-emerald-600' : data.aktiva.totalGrowth < 0 ? 'text-rose-600' : 'text-muted-foreground'}">
							{data.aktiva.totalGrowth !== 0 ? `${data.aktiva.totalGrowth > 0 ? '+' : ''}${data.aktiva.totalGrowth.toFixed(1)}%` : '-'}
						</td>
					</tr>

					<!-- Separator Spacing -->
					<tr>
						<td colspan="7" class="py-4"></td>
					</tr>

					<!-- ============================================== -->
					<!-- BAGIAN 2: LIABILITAS DAN EKUITAS                -->
					<!-- ============================================== -->
					<tr class="bg-muted/40 font-black text-xs text-foreground">
						<td colspan="7" class="py-2 px-3 tracking-wide">
							LIABILITAS DAN EKUITAS
						</td>
					</tr>

					{#each data.pasiva.groups as grp}
						<!-- Sub-Header Kategori (e.g. KEWAJIBAN LANCAR, MODAL) -->
						<tr class="font-bold text-xs text-foreground">
							<td colspan="7" class="pt-3 pb-1 px-3 pl-6 uppercase tracking-wider text-primary">
								{grp.groupName}
							</td>
						</tr>

						<!-- Rincian Akun -->
						{#each grp.items as item}
							<tr class="hover:bg-muted/20 transition-colors">
								<td class="py-1 px-3 pl-10 text-foreground/90 font-medium">
									{item.accName}
								</td>
								<td class="py-1 px-3 text-center font-mono text-[11px] text-muted-foreground">
									{item.acc}
								</td>
								<td class="py-1 px-3 text-right font-mono font-medium text-foreground">
									{formatAccounting(item.saldoRp1)}
								</td>
								<td class="py-1 px-3 text-right font-mono text-xs text-muted-foreground">
									{formatPct(item.pct1)}
								</td>
								<td class="py-1 px-3 text-right font-mono font-medium text-muted-foreground">
									{formatAccounting(item.saldoRp2)}
								</td>
								<td class="py-1 px-3 text-right font-mono text-xs text-muted-foreground">
									{formatPct(item.pct2)}
								</td>
								<td class="py-1 px-3 text-right font-mono font-bold {item.growth > 0 ? 'text-emerald-600' : item.growth < 0 ? 'text-rose-600' : 'text-muted-foreground'}">
									{item.growth !== 0 ? `${item.growth > 0 ? '+' : ''}${item.growth.toFixed(1)}%` : '-'}
								</td>
							</tr>
						{/each}

						<!-- Subtotal Kelompok Liabilitas / Ekuitas -->
						<tr class="font-bold text-xs border-t border-border/50">
							<td class="py-1.5 px-3 pl-6 italic font-bold text-foreground">
								Jumlah {grp.groupName}
							</td>
							<td class="py-1.5 px-3"></td>
							<td class="py-1.5 px-3 text-right font-mono font-bold text-foreground">
								{formatAccounting(grp.subtotalRp1)}
							</td>
							<td class="py-1.5 px-3 text-right font-mono text-xs font-bold text-foreground">
								{formatPct(grp.subtotalPct1)}
							</td>
							<td class="py-1.5 px-3 text-right font-mono font-bold text-muted-foreground">
								{formatAccounting(grp.subtotalRp2)}
							</td>
							<td class="py-1.5 px-3 text-right font-mono text-xs font-bold text-muted-foreground">
								{formatPct(grp.subtotalPct2)}
							</td>
							<td class="py-1.5 px-3 text-right font-mono font-bold {grp.subtotalGrowth > 0 ? 'text-emerald-600' : grp.subtotalGrowth < 0 ? 'text-rose-600' : 'text-muted-foreground'}">
								{grp.subtotalGrowth !== 0 ? `${grp.subtotalGrowth > 0 ? '+' : ''}${grp.subtotalGrowth.toFixed(1)}%` : '-'}
							</td>
						</tr>
					{/each}

					<!-- GRAND TOTAL LIABILITAS DAN EKUITAS (Double Underline SAK) -->
					<tr class="border-t-2 border-border border-b-4 border-double border-border bg-primary/5 font-black text-xs sm:text-sm text-foreground">
						<td class="py-3 px-3 uppercase tracking-wider">
							JUMLAH LIABILITAS DAN EKUITAS
						</td>
						<td class="py-3 px-3"></td>
						<td class="py-3 px-3 text-right font-mono font-black text-primary">
							Rp {formatAccounting(data.pasiva.totalRp1)}
						</td>
						<td class="py-3 px-3 text-right font-mono font-black text-primary">
							100.00%
						</td>
						<td class="py-3 px-3 text-right font-mono font-black text-muted-foreground">
							Rp {formatAccounting(data.pasiva.totalRp2)}
						</td>
						<td class="py-3 px-3 text-right font-mono font-black text-muted-foreground">
							100.00%
						</td>
						<td class="py-3 px-3 text-right font-mono font-black {data.pasiva.totalGrowth > 0 ? 'text-emerald-600' : data.pasiva.totalGrowth < 0 ? 'text-rose-600' : 'text-muted-foreground'}">
							{data.pasiva.totalGrowth !== 0 ? `${data.pasiva.totalGrowth > 0 ? '+' : ''}${data.pasiva.totalGrowth.toFixed(1)}%` : '-'}
						</td>
					</tr>
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

	<!-- Keseimbangan Akhir Neraca Banner (Screen Only) -->
	<div class="rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-wrap items-center justify-between gap-4 print:hidden {data.isBalanced1 ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-800 dark:text-rose-300'}">
		<div class="flex items-center gap-3">
			{#if data.isBalanced1}
				<CheckCircle2 class="size-6 text-emerald-600 shrink-0" />
			{:else}
				<AlertTriangle class="size-6 text-rose-600 shrink-0" />
			{/if}
			<div>
				<div class="font-black text-sm uppercase">
					{data.isBalanced1 ? 'Persamaan Akuntansi Terverifikasi Seimbang (SAK)' : 'Perhatian: Terjadi Selisih Pada Neraca'}
				</div>
				<p class="text-xs font-semibold opacity-90 mt-0.5">
					Aset: Rp {formatAccounting(data.aktiva.totalRp1)} | Liabilitas & Ekuitas: Rp {formatAccounting(data.pasiva.totalRp1)}
					{#if !data.isBalanced1}
						(Selisih: Rp {formatAccounting(Math.abs(data.diffRp1))})
					{/if}
				</p>
			</div>
		</div>
		<div class="font-mono text-xs font-black px-3 py-1.5 rounded-lg border-2 border-border bg-card text-foreground">
			Periode: {formatPeriod(data.filters.periode1)}
		</div>
	</div>
</div>
