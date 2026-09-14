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
	import { Search, Download, RotateCcw } from '@lucide/svelte';

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
		data.rows.length > 0 && data.rows.every((r) => selected.includes(String(r.No_Produksi)))
	);

	function toggleSelectAll() {
		if (allSelected) {
			selected = [];
		} else {
			selected = data.rows.map((r) => String(r.No_Produksi));
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
		title="Monitoring Produksi"
		description="Monitoring Inputan Admin — filter departemen & tipe, pilih baris untuk export."
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
		action="/dashboard/monitoring-produksi"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
			<div class="space-y-1.5">
				<Label>Departemen</Label>
				<select
					name="dept"
					value={data.dept}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase tracking-wide brutal-shadow-sm focus:outline-none"
				>
					{#each data.departemenOptions as o}
						<option value={o.value}>{o.label}</option>
					{/each}
				</select>
			</div>

			<div class="space-y-1.5">
				<Label>Tipe</Label>
				<select
					name="tipe"
					value={data.tipe}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase tracking-wide brutal-shadow-sm focus:outline-none"
				>
					{#each data.tipeOptions as o}
						<option value={o.value}>{o.label}</option>
					{/each}
				</select>
			</div>

			<div class="space-y-1.5">
				<Label>Dari Tanggal</Label>
				<Input type="date" name="tgl1" value={data.tgl1} class="h-11 border-[3px]" />
			</div>

			<div class="space-y-1.5">
				<Label>Sampai Tanggal</Label>
				<Input type="date" name="tgl2" value={data.tgl2} class="h-11 border-[3px]" />
			</div>

			<div class="space-y-1.5">
				<Label>Per Halaman</Label>
				<select
					name="pageSize"
					value={String(data.pageSize)}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase tracking-wide brutal-shadow-sm focus:outline-none"
				>
					<option value="100">100 baris</option>
					<option value="1000">1.000 baris</option>
					<option value="10000">10.000 baris</option>
				</select>
			</div>
		</div>

		<div class="flex flex-wrap items-end gap-3 pt-2 border-t-2 border-border/40">
			<div class="min-w-64 flex-1">
				<Label for="q">Cari</Label>
				<div class="relative mt-1">
					<Search class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						id="q"
						name="q"
						value={data.q}
						placeholder="No_Produksi / SPK / ItemID / NamaJenis..."
						class="h-11 border-[3px] pl-9 font-bold"
					/>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<Button type="submit" class="h-11 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm">
					Terapkan Filter
				</Button>
				{#if data.dept || data.tipe || data.tgl1 || data.tgl2 || data.q}
					<a
						href="/dashboard/monitoring-produksi"
						class="border-border bg-card hover:bg-muted inline-flex h-11 items-center gap-1 rounded-lg border-[3px] px-4 text-sm font-black uppercase tracking-wide brutal-shadow-sm"
					>
						<RotateCcw class="size-4" /> Reset
					</a>
				{/if}
			</div>
		</div>
	</form>

	<!-- Actions / Export Bar -->
	<div class="flex flex-wrap items-center justify-between gap-3 bg-card rounded-xl border-[3px] border-border p-3 brutal-shadow">
		<div class="flex items-center gap-3">
			<label class="flex items-center gap-2 font-mono text-xs font-black uppercase cursor-pointer">
				<input
					type="checkbox"
					checked={allSelected}
					onchange={toggleSelectAll}
					class="size-4.5 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
				/>
				<span>Pilih Semua di Halaman Ini</span>
			</label>
			{#if selected.length > 0}
				<Badge variant="primary" class="border-2 font-mono">
					{selected.length} DIPILIH
				</Badge>
			{/if}
		</div>

		<form
			method="post"
			action="/api/monitoring-produksi/export"
			onsubmit={() => {
				loading = true;
				loadingMsg = 'Menyiapkan file Excel...';
				setTimeout(() => (loading = false), 3000);
			}}
			class="flex items-center gap-2"
		>
			<input type="hidden" name="q" value={data.q} />
			<input type="hidden" name="dept" value={data.dept} />
			<input type="hidden" name="tipe" value={data.tipe} />
			<input type="hidden" name="tgl1" value={data.tgl1} />
			<input type="hidden" name="tgl2" value={data.tgl2} />
			{#each selected as id}
				<input type="hidden" name="selected" value={id} />
			{/each}

			<Button
				type="submit"
				variant="secondary"
				class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
			>
				<Download class="size-4 mr-1" />
				Export Excel {selected.length > 0 ? `(${selected.length} terpilih)` : '(semua filter)'}
			</Button>
		</form>
	</div>

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

	<!-- Table -->
	<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
		<div class="overflow-x-auto">
			<Table wrapperClass="border-0 shadow-none rounded-none">
				<TableHeader>
					<TableRow class="bg-muted/50">
						<TableHead class="w-10 text-center">✓</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">No Produksi</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Tanggal</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Dept</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Tipe</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">SPK</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Nama PO</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Item ID</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Bags / Kgs</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Gudang</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">User</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableRow>
							<TableCell colspan={11} class="h-24 text-center">
								<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
									Belum ada data monitoring produksi
								</p>
							</TableCell>
						</TableRow>
					{:else}
						{#each data.rows as r}
							{@const isChecked = selected.includes(String(r.No_Produksi))}
							<TableRow class="hover:bg-primary/5 {isChecked ? 'bg-primary/10' : ''}">
								<TableCell class="text-center">
									<input
										type="checkbox"
										checked={isChecked}
										onchange={() => toggleSelect(String(r.No_Produksi))}
										class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
									/>
								</TableCell>
								<TableCell class="font-mono text-xs font-black">{r.No_Produksi}</TableCell>
								<TableCell class="font-mono text-xs">
									{r.Tanggal ? new Date(r.Tanggal).toLocaleDateString('id-ID') : '-'}
								</TableCell>
								<TableCell>
									<Badge variant="secondary" class="font-mono text-[10px]">{r.Departemen || '-'}</Badge>
								</TableCell>
								<TableCell>
									<Badge
										variant={r.Tipe_Produksi === 'H' ? 'success' : 'secondary'}
										class="font-mono text-[10px]"
									>
										{r.Tipe_Produksi === 'H' ? 'H-HASIL' : r.Tipe_Produksi === 'B' ? 'B-BAHAN' : (r.Tipe_Produksi || '-')}
									</Badge>
								</TableCell>
								<TableCell class="font-mono text-xs font-bold">{r.SPK || '-'}</TableCell>
								<TableCell class="max-w-44 truncate font-bold text-xs">{r.Nama_PO || '-'}</TableCell>
								<TableCell class="font-mono text-xs">{r.ItemID || '-'}</TableCell>
								<TableCell class="font-mono text-xs">
									<span class="font-bold">{r.Bags?.toLocaleString('id-ID') ?? 0}</span> bag /
									<span class="font-black">{r.Kgs?.toLocaleString('id-ID') ?? 0}</span> kg
								</TableCell>
								<TableCell class="font-mono text-xs">{r.Gudang || '-'}</TableCell>
								<TableCell class="font-mono text-xs text-muted-foreground">{r.UserName || '-'}</TableCell>
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
				basePath="/dashboard/monitoring-produksi"
				pageSizeOptions={[100, 1000, 10000]}
				params={{
					q: data.q || undefined,
					dept: data.dept || undefined,
					tipe: data.tipe || undefined,
					tgl1: data.tgl1 || undefined,
					tgl2: data.tgl2 || undefined
				}}
			/>
		</div>
	</div>
</div>
