<script lang="ts">
	import {
		Badge,
		Button,
		Input,
		Label,
		PageHeader,
		Pagination,
		Table,
		TableHeader,
		TableRow,
		TableHead,
		TableBody,
		TableCell,
		LoadingOverlay
	} from '$lib/components';
	import { Search, Download } from '@lucide/svelte';

	let { data } = $props();

	let loading = $state(false);
	let loadingMsg = $state('Memuat...');
	let selected = $state<string[]>([]);

	// Reset loading ketika data halaman selesai diperbarui oleh SvelteKit
	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	let allSelected = $derived(
		data.rows.length > 0 && data.rows.every((r) => selected.includes(String(r.No_Transaksi)))
	);

	function toggleSelectAll() {
		if (allSelected) {
			selected = [];
		} else {
			selected = data.rows.map((r) => String(r.No_Transaksi));
		}
	}

	function toggleSelect(id: string) {
		if (selected.includes(id)) {
			selected = selected.filter((s) => s !== id);
		} else {
			selected = [...selected, id];
		}
	}
</script>

<LoadingOverlay show={loading} message={loadingMsg} submessage="Mohon tunggu" />

<div class="space-y-5">
	<PageHeader
		title="Retur Produksi"
		description="Monitoring Memo In Retur Produksi (MoveType K) — filter tanggal & pencarian."
	>
		{#snippet actions()}
			<Badge variant="secondary" class="border-[3px] font-mono font-black">
				{data.total.toLocaleString('id-ID')} BARIS
			</Badge>
			<span class="hidden md:inline-flex bg-muted border-border rounded-full border-2 px-3 py-1 font-mono text-[10px] font-black uppercase">
				TOP 10000
			</span>
		{/snippet}
	</PageHeader>

	<!-- Filter form brutal -->
	<form
		method="get"
		action="/dashboard/retur-produksi"
		class="bg-card flex flex-wrap items-end gap-3 rounded-xl border-[3px] border-border p-4 brutal-shadow"
	>
		<div class="space-y-1">
			<Label for="tgl1">Tgl Awal</Label>
			<input
				type="date"
				id="tgl1"
				name="tgl1"
				value={data.tgl1}
				class="bg-card border-border h-11 rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
			/>
		</div>
		<div class="space-y-1">
			<Label for="tgl2">Tgl Akhir</Label>
			<input
				type="date"
				id="tgl2"
				name="tgl2"
				value={data.tgl2}
				class="bg-card border-border h-11 rounded-lg border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
			/>
		</div>
		<div class="min-w-56 flex-1 space-y-1">
			<Label for="q">Cari</Label>
			<div class="relative">
				<Search class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
				<Input
					id="q"
					name="q"
					value={data.q}
					placeholder="No Transaksi / Gudang / ItemID / Remark..."
					class="h-11 border-[3px] pl-9 font-bold"
				/>
			</div>
		</div>
		<div class="space-y-1">
			<Label>Tampil</Label>
			<select
				name="pageSize"
				value={String(data.pageSize)}
				class="bg-card border-border h-11 rounded-lg border-[3px] px-3 pr-8 text-sm font-black brutal-shadow-sm focus:outline-none"
			>
				<option value="100">100</option>
				<option value="1000">1.000</option>
				<option value="10000">10.000</option>
			</select>
		</div>
		<Button type="submit" class="h-11 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm">
			Tampilkan
		</Button>
		{#if data.q || data.tgl1 || data.tgl2}
			<a
				href="/dashboard/retur-produksi"
				class="border-border bg-card hover:bg-muted inline-flex h-11 items-center rounded-lg border-[3px] px-4 text-sm font-black uppercase tracking-wide brutal-shadow-sm"
			>
				Reset
			</a>
		{/if}
	</form>

	{#if data.error}
		<div
			class="bg-error text-error-foreground flex items-center gap-2 rounded-xl border-[3px] border-border px-4 py-3 text-sm font-black uppercase tracking-wide brutal-shadow"
			role="alert"
		>
			<span class="bg-card text-error flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border text-xs font-black">
				!
			</span>
			<span>{data.error}</span>
		</div>
	{/if}

	<!-- Table container -->
	<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
		<div class="bg-card border-b-[3px] border-border flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<h3 class="font-black uppercase tracking-tight" style="font-family: var(--font-display)">
				Daftar Retur Produksi
			</h3>
			<div class="flex items-center gap-2">
				<span class="bg-muted border-border hidden rounded-full border-2 px-3 py-1 font-mono text-[10px] font-black uppercase md:inline-flex">
					{data.total.toLocaleString('id-ID')} total • hal {data.page}
				</span>
				<form
					method="post"
					action="/api/retur/export"
					onsubmit={() => {
						loading = true;
						loadingMsg = 'Menyiapkan Excel...';
						setTimeout(() => (loading = false), 3000);
					}}
					class="inline-flex"
				>
					<input type="hidden" name="q" value={data.q} />
					<input type="hidden" name="tgl1" value={data.tgl1} />
					<input type="hidden" name="tgl2" value={data.tgl2} />
					{#each selected as id}
						<input type="hidden" name="selected" value={id} />
					{/each}
					<Button
						type="submit"
						variant="secondary"
						class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
					>
						<Download class="size-4 mr-1" /> Export Excel
					</Button>
				</form>
				<a
					href={`/api/retur/export?${new URLSearchParams({ ...(data.q && { q: data.q }), ...(data.tgl1 && { tgl1: data.tgl1 }), ...(data.tgl2 && { tgl2: data.tgl2 }) }).toString()}`}
					class="hidden md:inline-flex h-9 items-center gap-1 rounded-lg border-[3px] border-border bg-card px-3 text-xs font-black uppercase tracking-wide brutal-shadow-sm hover:bg-muted"
				>
					API
				</a>
			</div>
		</div>

		<div class="overflow-x-auto">
			<Table wrapperClass="border-0 shadow-none rounded-none">
				<TableHeader>
					<TableRow class="bg-muted/50">
						<TableHead class="w-10 text-center">✓</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">No Transaksi</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Tanggal</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Gudang</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">ItemID</TableHead>
						<TableHead class="text-right font-mono text-[11px] font-black uppercase tracking-widest">Bags</TableHead>
						<TableHead class="text-right font-mono text-[11px] font-black uppercase tracking-widest">Kgs</TableHead>
						<TableHead class="text-right font-mono text-[11px] font-black uppercase tracking-widest">HPP</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Kategori</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableRow>
							<TableCell colspan={9} class="h-24 text-center">
								<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
									{data.q || data.tgl1 || data.tgl2 ? 'Tidak ada data untuk filter ini' : 'Belum ada data'}
								</p>
							</TableCell>
						</TableRow>
					{:else}
						{#each data.rows as r}
							{@const isChecked = selected.includes(String(r.No_Transaksi))}
							<TableRow class="hover:bg-primary/5 {isChecked ? 'bg-primary/10' : ''}">
								<TableCell class="text-center">
									<input
										type="checkbox"
										checked={isChecked}
										onchange={() => toggleSelect(String(r.No_Transaksi))}
										class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
									/>
								</TableCell>
								<TableCell class="font-mono text-xs font-black">{r.No_Transaksi}</TableCell>
								<TableCell class="font-mono text-xs">
									{r.Tanggal ?? '-'}
								</TableCell>
								<TableCell>
									<Badge variant="secondary" class="font-mono text-[10px]">{r.Gudang ?? '-'}</Badge>
								</TableCell>
								<TableCell class="font-mono text-xs font-black">{r.ItemID}</TableCell>
								<TableCell class="text-right font-mono text-xs font-bold">
									{r.Bags != null ? Number(r.Bags).toLocaleString('id-ID') : '-'}
								</TableCell>
								<TableCell class="text-right font-mono text-xs font-black">
									{r.Kgs != null ? Number(r.Kgs).toLocaleString('id-ID') : '-'}
								</TableCell>
								<TableCell class="text-right font-mono text-xs">
									{r.HPPPrice != null ? Number(r.HPPPrice).toLocaleString('id-ID') : '-'}
								</TableCell>
								<TableCell class="text-xs font-bold uppercase tracking-wide">
									{r.Kategori ?? '-'}
								</TableCell>
							</TableRow>
						{/each}
					{/if}
				</TableBody>
			</Table>
		</div>

		<div class="border-t-[3px] border-border bg-muted/30 px-3">
			<Pagination
				page={data.page}
				pageSize={data.pageSize}
				total={data.total}
				basePath="/dashboard/retur-produksi"
				pageSizeOptions={[100, 1000, 10000]}
				params={{
					q: data.q || undefined,
					tgl1: data.tgl1 || undefined,
					tgl2: data.tgl2 || undefined
				}}
			/>
		</div>
	</div>
</div>
