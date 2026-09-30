<script lang="ts">
	import {
		Button,
		Label,
		PageHeader,
		Alert,
		SearchInput
	} from '$lib/components';
	import {
		FileText,
		Printer,
		CheckCircle2,
		AlertTriangle,
		ArrowDownRight,
		ArrowUpRight,
		ChevronLeft,
		ChevronRight,
		Tag,
		Layers,
		FileSpreadsheet
	} from '@lucide/svelte';

	let { data } = $props();

	let searchQuery = $state('');
	let currentPage = $state(1);
	let pageSize = 25;

	let filteredGroups = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return data.groups;
		return data.groups.filter(
			(g) =>
				g.transNo.toLowerCase().includes(q) ||
				g.transType.toLowerCase().includes(q) ||
				g.alias.toLowerCase().includes(q) ||
				g.items.some(
					(i) =>
						i.acc.toLowerCase().includes(q) ||
						i.accName.toLowerCase().includes(q) ||
						i.remark.toLowerCase().includes(q)
				)
		);
	});

	let totalPages = $derived(Math.max(1, Math.ceil(filteredGroups.length / pageSize)));

	let pagedGroups = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredGroups.slice(start, start + pageSize);
	});

	function formatNum(val: number | null | undefined, dec = 0): string {
		if (val == null || isNaN(val)) return '0';
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
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<PageHeader
		title="Jurnal Transaksi (General Journal)"
		description="Rekapitulasi pencatatan jurnal transaksi akuntansi harian per nomor bukti transaksi."
	>
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<form method="post" action="/api/jurnal/export" class="inline">
					<input type="hidden" name="tgl1" value={data.filters.tgl1} />
					<input type="hidden" name="tgl2" value={data.filters.tgl2} />
					<input type="hidden" name="curr" value={data.filters.curr} />
					<Button
						type="submit"
						variant="secondary"
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export format Excel template rpjurnallistl.xls"
					>
						<FileSpreadsheet class="size-4 mr-1.5" />
						Export Excel (rpjurnallistl.xls)
					</Button>
				</form>

				<Button
					type="button"
					variant="secondary"
					onclick={() => window.print()}
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<Printer class="size-4 mr-1.5" />
					Cetak Jurnal
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- KPI Summary Metrics -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Bukti Transaksi -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider">Total Bukti Transaksi</span>
				<FileText class="size-4 text-primary" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.totals.totalTransactions}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					{data.totals.totalEntries} Baris Jurnal
				</p>
			</div>
		</div>

		<!-- Total Debet -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-emerald-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Debet</span>
				<ArrowDownRight class="size-4 text-emerald-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
					Rp {formatNum(data.totals.totalDebetRp)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Total Mutasi Debet
				</p>
			</div>
		</div>

		<!-- Total Kredit -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between bg-amber-500/5">
			<div class="flex items-center justify-between text-muted-foreground">
				<span class="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Kredit</span>
				<ArrowUpRight class="size-4 text-amber-600" />
			</div>
			<div class="mt-2">
				<div class="font-mono text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">
					Rp {formatNum(data.totals.totalCreditRp)}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Total Mutasi Kredit
				</p>
			</div>
		</div>

		<!-- Status Keseimbangan -->
		<div class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow flex flex-col justify-between {data.totals.isBalanced ? 'bg-emerald-500/10' : 'bg-rose-500/10'}">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black uppercase tracking-wider {data.totals.isBalanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
					Keseimbangan Jurnal
				</span>
				{#if data.totals.isBalanced}
					<CheckCircle2 class="size-4 text-emerald-600" />
				{:else}
					<AlertTriangle class="size-4 text-rose-600" />
				{/if}
			</div>
			<div class="mt-2">
				<div class="text-lg font-black {data.totals.isBalanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
					{data.totals.isBalanced ? 'SEIMBANG (BALANCED)' : 'SELISIH JURNAL'}
				</div>
				<p class="text-[11px] font-mono font-bold {data.totals.isBalanced ? 'text-emerald-600/80' : 'text-rose-600'} mt-0.5">
					{data.totals.isBalanced ? 'Debet = Kredit' : `Selisih: Rp ${formatNum(Math.abs(data.totals.totalDebetRp - data.totals.totalCreditRp))}`}
				</p>
			</div>
		</div>
	</div>

	<!-- Filter Form Sesuai Stored Procedure [rpJurnalListL] -->
	<form
		method="get"
		action="/dashboard/jurnal"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4"
	>
		<div class="flex items-center justify-between pb-2 border-b-2 border-border/40">
			<div class="flex items-center gap-2">
				<span class="text-xs font-black uppercase text-foreground">Parameter Stored Procedure:</span>
				<code class="text-[11px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
					rpJurnalListL (@Tgl1, @Tgl2, @Curr)
				</code>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
			<!-- Tanggal Awal (@Tgl1) -->
			<div class="space-y-1.5">
				<Label for="tgl1" class="text-xs font-bold">Tanggal Awal (@Tgl1)</Label>
				<input
					type="date"
					id="tgl1"
					name="tgl1"
					value={data.filters.tgl1}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-none"
				/>
			</div>

			<!-- Tanggal Akhir (@Tgl2) -->
			<div class="space-y-1.5">
				<Label for="tgl2" class="text-xs font-bold">Tanggal Akhir (@Tgl2)</Label>
				<input
					type="date"
					id="tgl2"
					name="tgl2"
					value={data.filters.tgl2}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm focus:outline-none"
				/>
			</div>

			<!-- Mata Uang (@Curr) -->
			<div class="space-y-1.5">
				<Label for="curr" class="text-xs font-bold">Mata Uang (@Curr)</Label>
				<select
					id="curr"
					name="curr"
					value={data.filters.curr}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase brutal-shadow-sm focus:outline-none cursor-pointer"
				>
					<option value="IDR">IDR (Rupiah)</option>
					<option value="USD">USD (Dollar)</option>
					<option value="">Semua Mata Uang</option>
				</select>
			</div>

			<!-- Submit Button -->
			<div>
				<Button type="submit" class="h-11 w-full border-[3px] font-black uppercase tracking-wide brutal-shadow-sm cursor-pointer">
					Tampilkan Jurnal
				</Button>
			</div>
		</div>
	</form>

	{#if data.error}
		<Alert variant="error" title="Gagal Memuat Jurnal">
			{data.error}
		</Alert>
	{/if}

	<!-- Search & Pagination Summary -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="max-w-md w-full">
			<SearchInput
				placeholder="Cari no bukti, akun, atau keterangan..."
				bind:value={searchQuery}
			/>
		</div>
		<span class="font-mono text-xs font-bold text-muted-foreground">
			Menampilkan {pagedGroups.length} dari {filteredGroups.length} bukti transaksi
		</span>
	</div>

	<!-- Journal Entries Cards -->
	<div class="space-y-4">
		{#if pagedGroups.length === 0}
			<div class="bg-card rounded-xl border-[3px] border-border p-12 text-center text-muted-foreground font-bold brutal-shadow">
				Tidak ada jurnal transaksi yang sesuai dengan filter.
			</div>
		{:else}
			{#each pagedGroups as group}
				<div class="bg-card rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
					<!-- Voucher Header -->
					<div class="px-4 py-3 bg-muted/60 border-b-2 border-border flex flex-wrap items-center justify-between gap-2">
						<div class="flex items-center gap-2.5">
							<span class="font-mono font-black text-sm px-2.5 py-0.5 rounded-md border-2 border-border bg-primary/10 text-primary">
								{group.alias ? `${group.alias}-${group.transNo}` : group.transNo}
							</span>
							<span class="text-xs font-bold text-muted-foreground">
								{formatDate(group.transDate)}
							</span>
							{#if group.transType}
								<span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-border bg-card text-foreground">
									{group.transType}
								</span>
							{/if}
						</div>

						<div class="flex items-center gap-3 text-xs font-mono font-bold">
							<span>D: <strong class="text-emerald-700 dark:text-emerald-400">Rp {formatNum(group.totalDebetRp)}</strong></span>
							<span>K: <strong class="text-amber-700 dark:text-amber-400">Rp {formatNum(group.totalCreditRp)}</strong></span>
						</div>
					</div>

					<!-- Voucher Line Items -->
					<div class="overflow-x-auto">
						<table class="w-full text-left border-collapse text-xs">
							<thead>
								<tr class="border-b border-border/40 text-muted-foreground font-bold text-[10px] uppercase">
									<th class="py-2 px-4 w-32">Akun</th>
									<th class="py-2 px-4 w-56">Nama Akun</th>
									<th class="py-2 px-4">Keterangan</th>
									<th class="py-2 px-4 text-right w-36">Debet</th>
									<th class="py-2 px-4 text-right w-36">Kredit</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/20">
								{#each group.items as item}
									<tr class="hover:bg-muted/20 transition-colors">
										<td class="py-2 px-4 font-mono font-bold text-foreground">
											{item.acc}
										</td>
										<td class="py-2 px-4 font-semibold text-foreground">
											{item.accName}
										</td>
										<td class="py-2 px-4 text-muted-foreground">
											{item.remark || '-'}
										</td>
										<td class="py-2 px-4 text-right font-mono font-bold {item.debetRp > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}">
											{item.debetRp > 0 ? `Rp ${formatNum(item.debetRp)}` : '-'}
										</td>
										<td class="py-2 px-4 text-right font-mono font-bold {item.creditRp > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}">
											{item.creditRp > 0 ? `Rp ${formatNum(item.creditRp)}` : '-'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Client-side Pagination -->
	{#if totalPages > 1}
		<div class="flex items-center justify-between gap-3 pt-3 border-t-2 border-border/40">
			<span class="text-xs font-mono font-bold text-muted-foreground">
				Halaman <strong class="text-foreground">{currentPage}</strong> dari <strong class="text-foreground">{totalPages}</strong>
			</span>

			<div class="flex items-center gap-1.5">
				<Button
					type="button"
					variant="secondary"
					disabled={currentPage <= 1}
					onclick={() => (currentPage = Math.max(1, currentPage - 1))}
					class="h-9 px-3 border-2 font-black uppercase text-xs brutal-shadow-sm cursor-pointer disabled:opacity-40"
				>
					<ChevronLeft class="size-4 mr-1" />
					Sebelumnya
				</Button>

				<Button
					type="button"
					variant="secondary"
					disabled={currentPage >= totalPages}
					onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
					class="h-9 px-3 border-2 font-black uppercase text-xs brutal-shadow-sm cursor-pointer disabled:opacity-40"
				>
					Selanjutnya
					<ChevronRight class="size-4 ml-1" />
				</Button>
			</div>
		</div>
	{/if}
</div>
