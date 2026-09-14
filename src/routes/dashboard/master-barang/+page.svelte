<script lang="ts">
	import {
		Badge,
		Button,
		Input,
		Label,
		Card,
		CardContent,
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
	import { Package, Search, X } from '@lucide/svelte';

	let { data } = $props();

	let loading = $state(false);
	let loadingMsg = $state('Memuat...');

	// Reset loading ketika data halaman selesai diperbarui oleh SvelteKit
	$effect(() => {
		if (data) {
			loading = false;
		}
	});
</script>

<LoadingOverlay show={loading} message={loadingMsg} submessage="Mohon tunggu" />

<div class="space-y-5">
	<PageHeader
		title="Master Barang"
		description="Data taGoods + taKindofGoods — cari ItemID, nama, atau jenis. Query join sesuai permintaan."
	>
		{#snippet actions()}
			<Badge variant="secondary" class="border-[3px] font-mono font-black">
				{data.total.toLocaleString('id-ID')} ITEM
			</Badge>
			<form
				method="post"
				action="/api/master/export"
				onsubmit={() => {
					loading = true;
					loadingMsg = 'Menyiapkan Excel...';
					setTimeout(() => (loading = false), 3000);
				}}
				class="inline-flex"
			>
				<input type="hidden" name="q" value={data.q} />
				<Button
					type="submit"
					variant="secondary"
					class="h-9 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					Export Excel
				</Button>
			</form>
			<a
				href={`/api/master/export${data.q ? `?q=${encodeURIComponent(data.q)}` : ''}`}
				class="hidden md:inline-flex h-9 items-center border-[3px] border-border bg-card rounded-lg px-3 text-xs font-black uppercase tracking-wide brutal-shadow-sm hover:bg-muted"
				title="Download via API (GET)"
			>
				API
			</a>
		{/snippet}
	</PageHeader>

	<!-- Search bar brutal -->
	<form
		method="get"
		action="/dashboard/master-barang"
		class="bg-card flex flex-wrap items-end gap-3 rounded-xl border-[3px] border-border p-4 brutal-shadow"
	>
		<div class="min-w-64 flex-1 space-y-1">
			<Label for="q">Cari</Label>
			<div class="flex gap-2">
				<div class="relative flex-1">
					<Search class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						id="q"
						name="q"
						value={data.q}
						placeholder="ItemID / ItemName / namebc / NamaJenis..."
						class="h-11 border-[3px] pl-9 font-bold"
					/>
				</div>
				<Button type="submit" class="h-11 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm">
					Cari
				</Button>
				{#if data.q}
					<a
						href="/dashboard/master-barang"
						class="border-border bg-card hover:bg-muted inline-flex h-11 items-center gap-1 rounded-lg border-[3px] px-4 text-sm font-black uppercase tracking-wide brutal-shadow-sm"
					>
						<X class="size-4" /> Reset
					</a>
				{/if}
			</div>
			<p class="font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-1">
				Contoh: <code class="bg-muted rounded border-2 border-border px-1 py-0.5">A001</code> •
				<code class="bg-muted rounded border-2 border-border px-1 py-0.5">KAIN</code> • Klik ItemID untuk detail
			</p>
		</div>
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

	<!-- Detail card when ?id= -->
	{#if data.detail}
		<Card class="overflow-hidden border-4 border-border brutal-shadow-lg">
			<div class="bg-primary border-b-4 border-border px-6 py-3">
				<p class="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground">
					Detail Item • WHERE ItemID = @ItemID
				</p>
				<p class="font-black uppercase tracking-tight text-primary-foreground text-lg" style="font-family: var(--font-display)">
					{data.detail.ItemID} — {data.detail.ItemName}
				</p>
			</div>
			<CardContent class="p-0">
				<div class="grid grid-cols-1 md:grid-cols-2">
					{#each [
						['ItemID', data.detail.ItemID, 'font-mono'],
						['ItemName', data.detail.ItemName, ''],
						['namebc', data.detail.namebc || '-', 'font-mono text-xs'],
						['Nama Cina (ItemName2)', data.detail.namecina || '-', ''],
						['Warna (warnac)', data.detail.warna || '-', ''],
						['Departemen (Mark)', data.detail.Departemen || '-', ''],
						['KodeJenis', data.detail.KodeJenis || '-', 'font-mono'],
						['NamaJenis', data.detail.NamaJenis || '-', 'font-black uppercase'],
						['Satuan (SatuanKecil)', data.detail.Satuan || '-', ''],
						['Spec', data.detail.Spec || '-', ''],
						['Bahan', data.detail.bahan || '-', '']
					] as [label, val, cls]}
						<div class="border-border flex flex-col gap-1 border-b p-4 md:odd:border-r-[3px]">
							<span class="font-mono text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
								{label}
							</span>
							<span class="font-bold {cls}">{val}</span>
						</div>
					{/each}
				</div>
				<div class="bg-muted border-t-[3px] border-border p-3 text-center">
					<a
						href={`/dashboard/master-barang${data.q ? `?q=${encodeURIComponent(data.q)}` : ''}`}
						class="font-mono text-xs font-black uppercase tracking-widest underline hover:text-primary"
					>
						← Kembali ke daftar
					</a>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Brutal table wrapper -->
	<div class="bg-card overflow-hidden rounded-xl border-[3px] border-border brutal-shadow">
		<div class="bg-muted/40 border-b-[3px] border-border flex items-center justify-between px-4 py-3">
			<h3 class="font-black uppercase tracking-tight" style="font-family: var(--font-display)">
				Daftar Barang
			</h3>
			<span class="bg-card border-border rounded-full border-2 px-3 py-1 font-mono text-[10px] font-black uppercase">
				{data.total.toLocaleString('id-ID')} total • hal {data.page}
			</span>
		</div>

		<div class="overflow-x-auto">
			<Table wrapperClass="border-0 shadow-none rounded-none">
				<TableHeader>
					<TableRow class="bg-muted/50">
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Kode</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Nama</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">NamaBC</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Warna</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Dept</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Jenis</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Satuan</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Spec / Bahan</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableRow>
							<TableCell colspan={8} class="h-24 text-center">
								<div class="flex flex-col items-center gap-2 py-4">
									<div class="bg-muted border-border flex size-12 items-center justify-center rounded-xl border-[3px] brutal-shadow-sm">
										<Package class="size-6" />
									</div>
									<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
										{data.q ? `Tidak ada hasil untuk "${data.q}"` : 'Belum ada data'}
									</p>
								</div>
							</TableCell>
						</TableRow>
					{:else}
						{#each data.rows as r}
							<TableRow class="hover:bg-primary/5">
								<TableCell>
									<a
										href={`/dashboard/master-barang?id=${encodeURIComponent(r.ItemID)}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`}
										class="bg-card hover:bg-primary hover:text-primary-foreground inline-flex rounded-lg border-2 border-border px-2 py-1 font-mono text-xs font-black brutal-shadow-sm transition-colors"
									>
										{r.ItemID}
									</a>
								</TableCell>
								<TableCell class="max-w-56 truncate font-bold">{r.ItemName || '-'}</TableCell>
								<TableCell class="font-mono text-xs">{r.namebc || '-'}</TableCell>
								<TableCell>
									<Badge variant="secondary" class="font-mono text-[10px]">{r.warna || '-'}</Badge>
								</TableCell>
								<TableCell>
									<Badge variant="secondary" class="font-mono text-[10px]">{r.Departemen || '-'}</Badge>
								</TableCell>
								<TableCell>
									<div class="flex flex-col">
										<span class="font-mono text-xs font-black">{r.KodeJenis}</span>
										<span class="text-[11px] font-bold uppercase tracking-wide">{r.NamaJenis || '-'}</span>
									</div>
								</TableCell>
								<TableCell class="font-mono text-xs font-bold">{r.Satuan || '-'}</TableCell>
								<TableCell class="max-w-52">
									<div class="truncate font-mono text-xs">{r.Spec || '-'}</div>
									<div class="truncate text-[11px] font-bold uppercase text-muted-foreground">{r.bahan || '-'}</div>
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
				basePath="/dashboard/master-barang"
				params={{ q: data.q || undefined, id: data.id || undefined }}
			/>
		</div>
	</div>
</div>
