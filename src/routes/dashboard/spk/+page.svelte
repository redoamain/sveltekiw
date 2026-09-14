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
	import { Search, CheckCircle, RotateCcw, Download } from '@lucide/svelte';

	let { data, form } = $props();

	let loading = $state(false);
	let loadingMsg = $state('Memproses...');
	let selected = $state<string[]>([]);

	// Reset loading ketika data halaman selesai diperbarui oleh SvelteKit
	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	let allSelected = $derived(
		data.rows.length > 0 && data.rows.every((r) => selected.includes(String(r.OrderID)))
	);

	function toggleSelectAll() {
		if (allSelected) {
			selected = [];
		} else {
			selected = data.rows.map((r) => String(r.OrderID));
		}
	}

	function toggleSelect(id: string) {
		if (selected.includes(id)) {
			selected = selected.filter((s) => s !== id);
		} else {
			selected = [...selected, id];
		}
	}

	let flashMsg = $derived(data.flash || '');
	let flashErr = $derived(form?.error || data.flashErr || data.error || '');
</script>

<LoadingOverlay show={loading} message={loadingMsg} submessage="Mohon tunggu" />

<div class="space-y-5">
	<PageHeader
		title="Manajemen SPK"
		description="Update Completed & FinishedDate — transaksi bulk. Centang untuk bulk & export."
	>
		{#snippet actions()}
			<Badge variant="secondary" class="border-[3px] font-mono font-black">
				{data.total.toLocaleString('id-ID')} SPK
			</Badge>
		{/snippet}
	</PageHeader>

	<!-- Filter form brutal -->
	<form
		method="get"
		action="/dashboard/spk"
		class="bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-4"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<div class="space-y-1.5">
				<Label>Status</Label>
				<select
					name="status"
					value={data.status}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase tracking-wide brutal-shadow-sm focus:outline-none"
				>
					<option value="">Semua</option>
					<option value="active">Aktif</option>
					<option value="completed">Selesai</option>
				</select>
			</div>

			<div class="space-y-1.5">
				<Label>Per Halaman</Label>
				<select
					name="pageSize"
					value={String(data.pageSize)}
					class="bg-card border-border h-11 w-full rounded-lg border-[3px] px-3 text-sm font-black uppercase tracking-wide brutal-shadow-sm focus:outline-none"
				>
					<option value="100">100 SPK</option>
					<option value="1000">1.000 SPK</option>
					<option value="10000">10.000 SPK</option>
				</select>
			</div>

			<div class="space-y-1.5">
				<Label for="q">Cari</Label>
				<div class="relative">
					<Search class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						id="q"
						name="q"
						value={data.q}
						placeholder="OrderID / Remark / Customer..."
						class="h-11 border-[3px] pl-9 font-bold"
					/>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-2 pt-2 border-t-2 border-border/40">
			<Button type="submit" class="h-11 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm">
				Cari & Filter
			</Button>
			{#if data.status || data.q}
				<a
					href="/dashboard/spk"
					class="border-border bg-card hover:bg-muted inline-flex h-11 items-center gap-1 rounded-lg border-[3px] px-4 text-sm font-black uppercase tracking-wide brutal-shadow-sm"
				>
					<RotateCcw class="size-4" /> Reset
				</a>
			{/if}
		</div>
	</form>

	{#if flashMsg}
		<div
			class="bg-success text-success-foreground flex items-center gap-2 rounded-xl border-[3px] border-border px-4 py-3 text-sm font-black uppercase tracking-wide brutal-shadow"
			role="alert"
		>
			<span class="bg-card text-success flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border text-xs font-black">
				✓
			</span>
			<span>{flashMsg}</span>
		</div>
	{/if}

	{#if flashErr}
		<div
			class="bg-error text-error-foreground flex items-center gap-2 rounded-xl border-[3px] border-border px-4 py-3 text-sm font-black uppercase tracking-wide brutal-shadow"
			role="alert"
		>
			<span class="bg-card text-error flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border text-xs font-black">
				!
			</span>
			<span>{flashErr}</span>
		</div>
	{/if}

	<!-- Bulk actions bar brutal -->
	<div class="flex flex-wrap items-center justify-between gap-3 bg-card rounded-xl border-[3px] border-border p-4 brutal-shadow">
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
					{selected.length} SPK DIPILIH
				</Badge>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<!-- Tandai Selesai -->
			<form
				method="post"
				action="?/complete"
				onsubmit={() => {
					loading = true;
					loadingMsg = 'Memperbarui SPK...';
				}}
				class="inline-flex"
			>
				<input type="hidden" name="q" value={data.q} />
				<input type="hidden" name="status" value={data.status} />
				<input type="hidden" name="page" value={String(data.page)} />
				<input type="hidden" name="pageSize" value={String(data.pageSize)} />
				{#each selected as id}
					<input type="hidden" name="selected" value={id} />
				{/each}
				<Button
					type="submit"
					variant="success"
					disabled={selected.length === 0}
					class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<CheckCircle class="size-4 mr-1" />
					Tandai Selesai ({selected.length})
				</Button>
			</form>

			<!-- Tandai Aktif -->
			<form
				method="post"
				action="?/activate"
				onsubmit={() => {
					loading = true;
					loadingMsg = 'Mengaktifkan SPK...';
				}}
				class="inline-flex"
			>
				<input type="hidden" name="q" value={data.q} />
				<input type="hidden" name="status" value={data.status} />
				<input type="hidden" name="page" value={String(data.page)} />
				<input type="hidden" name="pageSize" value={String(data.pageSize)} />
				{#each selected as id}
					<input type="hidden" name="selected" value={id} />
				{/each}
				<Button
					type="submit"
					variant="warning"
					disabled={selected.length === 0}
					class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<RotateCcw class="size-4 mr-1" />
					Tandai Aktif ({selected.length})
				</Button>
			</form>

			<!-- Export Excel -->
			<form
				method="post"
				action="/api/spk/export"
				onsubmit={() => {
					loading = true;
					loadingMsg = 'Menyiapkan Excel...';
					setTimeout(() => (loading = false), 3000);
				}}
				class="inline-flex"
			>
				<input type="hidden" name="q" value={data.q} />
				<input type="hidden" name="status" value={data.status} />
				{#each selected as id}
					<input type="hidden" name="selected" value={id} />
				{/each}
				<Button
					type="submit"
					variant="secondary"
					class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<Download class="size-4 mr-1" />
					Export Excel {selected.length > 0 ? `(${selected.length})` : '(semua)'}
				</Button>
			</form>
		</div>
	</div>

	<!-- Table -->
	<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
		<div class="overflow-x-auto">
			<Table wrapperClass="border-0 shadow-none rounded-none">
				<TableHeader>
					<TableRow class="bg-muted/50">
						<TableHead class="w-10 text-center">✓</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">OrderID (SPK)</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Tgl Order</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Tipe</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Remark (PO)</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Status</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">FinishedDate</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableRow>
							<TableCell colspan={7} class="h-24 text-center">
								<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
									Belum ada SPK yang cocok
								</p>
							</TableCell>
						</TableRow>
					{:else}
						{#each data.rows as r}
							{@const isChecked = selected.includes(String(r.OrderID))}
							<TableRow class="hover:bg-primary/5 {isChecked ? 'bg-primary/10' : ''}">
								<TableCell class="text-center">
									<input
										type="checkbox"
										checked={isChecked}
										onchange={() => toggleSelect(String(r.OrderID))}
										class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
									/>
								</TableCell>
								<TableCell class="font-mono text-xs font-black">{r.OrderID}</TableCell>
								<TableCell class="font-mono text-xs">{r.OrderDate ?? '-'}</TableCell>
								<TableCell>
									<Badge variant="secondary" class="font-mono text-[10px]">{r.OrderType || '-'}</Badge>
								</TableCell>
								<TableCell class="max-w-72 truncate font-bold text-xs">{r.Remark || '-'}</TableCell>
								<TableCell>
									<Badge
										variant={r.Completed ? 'success' : 'secondary'}
										class="border-[3px] font-mono text-[10px]"
									>
										{r.Completed ? 'SELESAI' : 'AKTIF'}
									</Badge>
								</TableCell>
								<TableCell class="font-mono text-xs">{r.FinishedDate ?? '-'}</TableCell>
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
				basePath="/dashboard/spk"
				pageSizeOptions={[100, 1000, 10000]}
				params={{
					q: data.q || undefined,
					status: data.status || undefined
				}}
			/>
		</div>
	</div>
</div>
