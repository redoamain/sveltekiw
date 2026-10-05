<script lang="ts">
	import { enhance } from '$app/forms';
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
		LoadingOverlay,
		Alert,
		Modal,
		FileUploadZone
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		Package,
		Search,
		X,
		Download,
		Plus,
		FileSpreadsheet,
		Edit3,
		AlertTriangle,
		CheckCircle2,
		RefreshCw
	} from '@lucide/svelte';
	import * as XLSX from 'xlsx';

	let { data, form } = $props();

	let loading = $state(false);
	let loadingMsg = $state('Memuat...');
	let selected = $state<string[]>([]);

	// Reset loading ketika data halaman selesai diperbarui oleh SvelteKit
	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	// Handle response dari actions form
	$effect(() => {
		if (form?.success) {
			if (form.message) toast.success('Berhasil', form.message);
			isItemModalOpen = false;
		} else if (form?.error) {
			toast.error('Gagal', form.error);
		}
	});

	let allSelected = $derived(
		data.rows.length > 0 && data.rows.every((r) => selected.includes(String(r.ItemID)))
	);

	function toggleSelectAll() {
		if (allSelected) {
			const pageIds = new Set(data.rows.map((r) => String(r.ItemID)));
			selected = selected.filter((id) => !pageIds.has(id));
		} else {
			const pageIds = data.rows.map((r) => String(r.ItemID));
			selected = Array.from(new Set([...selected, ...pageIds]));
		}
	}

	function toggleSelect(id: string) {
		if (selected.includes(id)) {
			selected = selected.filter((s) => s !== id);
		} else {
			selected = [...selected, id];
		}
	}

	function clearSelection() {
		selected = [];
	}

	// ==================== STATE MODAL INPUT / EDIT ====================
	let isItemModalOpen = $state(false);
	let isEditMode = $state(false);
	let itemFormSubmitting = $state(false);
	let itemFormError = $state('');

	let itemForm = $state({
		ItemID: '',
		ItemName: '',
		KodeJenis: 'K01',
		Mark: '',
		SatuanKecil: 'PCS',
		namebc: '',
		ItemName2: '',
		Spec: '',
		bahan: '',
		warna: '',
		warnac: ''
	});

	function openCreateModal() {
		isEditMode = false;
		itemFormError = '';
		itemForm = {
			ItemID: '',
			ItemName: '',
			KodeJenis: data.referenceData?.kinds?.[0]?.KodeJenis || 'K01',
			Mark: data.referenceData?.departments?.[0] || 'WAREHOUSE',
			SatuanKecil: 'PCS',
			namebc: '',
			ItemName2: '',
			Spec: '',
			bahan: '',
			warna: '',
			warnac: ''
		};
		isItemModalOpen = true;
	}

	function openEditModal(item: any) {
		isEditMode = true;
		itemFormError = '';
		itemForm = {
			ItemID: String(item.ItemID || ''),
			ItemName: String(item.ItemName || ''),
			KodeJenis: String(item.KodeJenis || 'K01'),
			Mark: String(item.Departemen || item.Mark || ''),
			SatuanKecil: String(item.Satuan || item.SatuanKecil || 'PCS'),
			namebc: String(item.namebc || ''),
			ItemName2: String(item.namecina || item.ItemName2 || ''),
			Spec: String(item.Spec || ''),
			bahan: String(item.bahan || ''),
			warna: String(item.warna || ''),
			warnac: String(item.warnac || '')
		};
		isItemModalOpen = true;
	}

	// ==================== STATE MODAL IMPORT EXCEL ====================
	let isImportModalOpen = $state(false);
	let isUploadingImport = $state(false);
	let isSavingImport = $state(false);
	let importError = $state('');
	let updateExisting = $state(true);

	interface ParsedImportItem {
		rowNumber: number;
		ItemID: string;
		ItemName: string;
		KodeJenis: string;
		namebc?: string;
		ItemName2?: string;
		Mark?: string;
		SatuanKecil?: string;
		Spec?: string;
		bahan?: string;
		warna?: string;
		warnac?: string;
		status: 'NEW' | 'EXISTS' | 'INVALID';
		errorMessage?: string;
	}

	interface ParsedImportResult {
		items: ParsedImportItem[];
		summary: {
			totalRows: number;
			validCount: number;
			invalidCount: number;
			newCount: number;
			existingCount: number;
		};
		fileName: string;
		fileSize: number;
	}

	let parsedImportData = $state<ParsedImportResult | null>(null);

	async function handleImportFile(file: File) {
		if (!file) return;
		importError = '';
		isUploadingImport = true;
		parsedImportData = null;

		try {
			const formData = new FormData();
			formData.append('file', file);

			const res = await fetch('/api/master-barang/import', {
				method: 'POST',
				body: formData
			});

			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error || 'Gagal membaca file Excel.');
			}

			parsedImportData = json.data;
			toast.info('File Terbaca', `${json.data.summary.totalRows} baris barang ditemukan di file.`);
		} catch (err: any) {
			importError = err?.message || 'Format file Excel tidak sesuai template.';
			toast.error('Gagal Import', importError);
		} finally {
			isUploadingImport = false;
		}
	}

	async function executeBatchImport() {
		if (!parsedImportData || parsedImportData.summary.validCount === 0) {
			toast.error('Peringatan', 'Tidak ada data valid yang dapat disimpan.');
			return;
		}

		isSavingImport = true;
		importError = '';

		try {
			const validItems = parsedImportData.items.filter((it) => it.status !== 'INVALID');
			const res = await fetch('/api/master-barang/batch-save', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					items: validItems,
					updateExisting
				})
			});

			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error || 'Gagal menyimpan data import.');
			}

			const { inserted, updated, skipped, errors } = json.data;
			let msg = `${inserted} barang baru ditambahkan, ${updated} diperbarui.`;
			if (skipped > 0) msg += ` (${skipped} dilewati)`;
			toast.success('Import Berhasil', msg);

			if (errors && errors.length > 0) {
				toast.warning('Sebagian Error', errors.slice(0, 3).join(', '));
			}

			isImportModalOpen = false;
			parsedImportData = null;
			// Reload page to reflect new data
			window.location.reload();
		} catch (err: any) {
			importError = err?.message || 'Gagal menyimpan data import.';
			toast.error('Error Import', importError);
		} finally {
			isSavingImport = false;
		}
	}
</script>

<LoadingOverlay show={loading} message={loadingMsg} submessage="Mohon tunggu" />

<div class="space-y-5">
	<PageHeader
		title="Master Data Barang"
		description="Katalog master barang (taGoods + taKindofGoods) — input manual, import Excel masal, dan pencarian."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<Badge variant="secondary" class="border-[3px] font-mono font-black">
					{data.total.toLocaleString('id-ID')} ITEM
				</Badge>
				<Button
					type="button"
					variant="primary"
					onclick={openCreateModal}
					class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<Plus class="size-4 mr-1.5" /> Tambah Barang
				</Button>
				<Button
					type="button"
					variant="secondary"
					onclick={() => {
						importError = '';
						parsedImportData = null;
						isImportModalOpen = true;
					}}
					class="h-10 border-[3px] font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
				>
					<FileSpreadsheet class="size-4 mr-1.5" /> Import Excel
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Search bar brutal -->
	<form
		method="get"
		action="/dashboard/master-barang"
		class="bg-card flex flex-wrap items-end gap-3 rounded-xl border-[3px] border-border p-4 brutal-shadow"
	>
		<div class="min-w-64 flex-1 space-y-1">
			<Label for="q">Cari Master Barang</Label>
			<div class="flex gap-2">
				<div class="relative flex-1">
					<Search class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						id="q"
						name="q"
						value={data.q}
						placeholder="Ketik ItemID / ItemName / namebc / NamaJenis..."
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
				Contoh: <code class="bg-muted rounded border-2 border-border px-1 py-0.5">LC-</code> •
				<code class="bg-muted rounded border-2 border-border px-1 py-0.5">KRAN</code> •
				<code class="bg-muted rounded border-2 border-border px-1 py-0.5">BAHAN BAKU</code>
			</p>
		</div>
	</form>

	{#if data.error}
		<Alert variant="error" title="Terjadi Kesalahan" dismissible>
			{data.error}
		</Alert>
	{/if}

	<!-- Detail card when ?id= -->
	{#if data.detail}
		<Card class="overflow-hidden border-4 border-border brutal-shadow-lg">
			<div class="bg-primary border-b-4 border-border px-6 py-3 flex items-center justify-between">
				<div>
					<p class="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground">
						Detail Item • {data.detail.ItemID}
					</p>
					<p class="font-black uppercase tracking-tight text-primary-foreground text-lg" style="font-family: var(--font-display)">
						{data.detail.ItemName}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<Button
						type="button"
						variant="secondary"
						onclick={() => openEditModal(data.detail)}
						class="h-8 border-2 font-black uppercase text-xs brutal-shadow-sm cursor-pointer"
					>
						<Edit3 class="size-3.5 mr-1" /> Edit
					</Button>
				</div>
			</div>
			<CardContent class="p-0">
				<div class="grid grid-cols-1 md:grid-cols-2">
					{#each [
						['ItemID', data.detail.ItemID, 'font-mono'],
						['ItemName', data.detail.ItemName, ''],
						['namebc', data.detail.namebc || '-', 'font-mono text-xs'],
						['Nama Cina (ItemName2)', data.detail.namecina || '-', ''],
						['Warna Indo (warna)', data.detail.warna || '-', 'font-mono font-bold'],
						['Warna Mandarin (warnac)', data.detail.warnac || '-', ''],
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
		<div class="bg-muted/40 border-b-[3px] border-border flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<div class="flex items-center gap-3">
				<h3 class="font-black uppercase tracking-tight" style="font-family: var(--font-display)">
					Daftar Barang
				</h3>
				{#if selected.length > 0}
					<Badge variant="primary" class="border-2 font-mono">
						{selected.length} DIPILIH
					</Badge>
					<button
						type="button"
						onclick={clearSelection}
						class="text-[11px] font-mono font-bold underline text-muted-foreground hover:text-foreground cursor-pointer"
					>
						Batal Pilih
					</button>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<span class="bg-card border-border rounded-full border-2 px-3 py-1 font-mono text-[10px] font-black uppercase">
					{data.total.toLocaleString('id-ID')} total • hal {data.page}
				</span>
				<form
					method="post"
					action="/api/master/export"
					onsubmit={() => {
						loading = true;
						loadingMsg = 'Menyiapkan Excel...';
						toast.info('Export Excel', selected.length > 0 ? `Mengekspor ${selected.length} barang terpilih...` : 'Mengekspor data master barang...');
						setTimeout(() => (loading = false), 3000);
					}}
					class="inline-flex"
				>
					<input type="hidden" name="q" value={data.q} />
					{#each selected as id}
						<input type="hidden" name="selected" value={id} />
					{/each}
					<Button
						type="submit"
						variant="secondary"
						class="h-8 border-2 font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
					>
						<Download class="size-3.5 mr-1" />
						Export {selected.length > 0 ? `(${selected.length})` : 'Excel'}
					</Button>
				</form>
			</div>
		</div>

		<div class="overflow-x-auto">
			<Table wrapperClass="border-0 shadow-none rounded-none">
				<TableHeader>
					<TableRow class="bg-muted/50">
						<TableHead class="w-10 text-center">
							<input
								type="checkbox"
								checked={allSelected}
								onchange={toggleSelectAll}
								class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
								title="Pilih semua di halaman ini"
							/>
						</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Kode</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Nama</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">NamaBC</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Warna</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Dept</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Jenis</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Satuan</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest">Spec / Bahan</TableHead>
						<TableHead class="font-mono text-[11px] font-black uppercase tracking-widest text-center">Aksi</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableRow>
							<TableCell colspan={10} class="h-24 text-center">
								<div class="flex flex-col items-center gap-2 py-4">
									<div class="bg-muted border-border flex size-12 items-center justify-center rounded-xl border-[3px] brutal-shadow-sm">
										<Package class="size-6" />
									</div>
									<p class="font-mono text-xs font-black uppercase tracking-wide text-muted-foreground">
										{data.q ? `Tidak ada hasil untuk "${data.q}"` : 'Belum ada data barang'}
									</p>
								</div>
							</TableCell>
						</TableRow>
					{:else}
						{#each data.rows as r}
							{@const isChecked = selected.includes(String(r.ItemID))}
							<TableRow class="hover:bg-primary/5 {isChecked ? 'bg-primary/10' : ''}">
								<TableCell class="text-center">
									<input
										type="checkbox"
										checked={isChecked}
										onchange={() => toggleSelect(String(r.ItemID))}
										class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
									/>
								</TableCell>
								<TableCell>
									<a
										href={`/dashboard/master-barang?id=${encodeURIComponent(r.ItemID)}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`}
										class="bg-card hover:bg-primary hover:text-primary-foreground inline-flex rounded-lg border-2 border-border px-2 py-1 font-mono text-xs font-black brutal-shadow-sm transition-colors"
										title="Klik untuk melihat detail item"
									>
										{r.ItemID}
									</a>
								</TableCell>
								<TableCell class="max-w-56 truncate font-bold">{r.ItemName || '-'}</TableCell>
								<TableCell class="font-mono text-xs">{r.namebc || '-'}</TableCell>
								<TableCell>
									<Badge variant="secondary" class="font-mono text-[10px]">{r.warna || '-'}</Badge>
									{#if r.warnac && r.warnac !== r.warna}
										<div class="text-[10px] text-muted-foreground truncate max-w-24 mt-0.5" title={r.warnac}>
											{r.warnac}
										</div>
									{/if}
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
								<TableCell class="text-center">
									<div class="flex items-center justify-center">
										<button
											type="button"
											onclick={() => openEditModal(r)}
											class="rounded-lg border-2 border-border bg-card p-1.5 hover:bg-muted brutal-shadow-sm cursor-pointer"
											title="Edit Barang"
										>
											<Edit3 class="size-3.5 text-foreground" />
										</button>
									</div>
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

<!-- ==================== MODAL 1: TAMBAH / EDIT BARANG ==================== -->
<Modal
	bind:open={isItemModalOpen}
	title={isEditMode ? `Edit Master Barang: ${itemForm.ItemID}` : 'Tambah Master Barang Baru'}
	subtitle={isEditMode ? 'Perbarui informasi spesifikasi dan atribut barang di master katalog.' : 'Daftarkan kode dan nama barang baru ke tabel taGoods.'}
	icon={isEditMode ? Edit3 : Plus}
	size="3xl"
>
	{#if itemFormError}
		<Alert variant="error" dismissible class="mb-4">
			{itemFormError}
		</Alert>
	{/if}

	<form
		method="post"
		action="?/save"
		use:enhance={() => {
			itemFormSubmitting = true;
			itemFormError = '';
			return async ({ result, update }) => {
				itemFormSubmitting = false;
				if (result.type === 'failure') {
					itemFormError = String(result.data?.error || 'Gagal menyimpan data.');
				} else if (result.type === 'success') {
					isItemModalOpen = false;
					await update();
				}
			};
		}}
		class="space-y-4"
	>
		<input type="hidden" name="isEdit" value={String(isEditMode)} />

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- Kode Barang (ItemID) -->
			<div class="space-y-1">
				<Label for="ItemID" class="font-black text-xs uppercase">
					Kode Barang (ItemID) <span class="text-error">*</span>
				</Label>
				<Input
					id="ItemID"
					name="ItemID"
					bind:value={itemForm.ItemID}
					placeholder="Contoh: LC-01S076BN-ST"
					required
					readonly={isEditMode}
					class="h-10 border-2 font-mono font-bold uppercase {isEditMode ? 'bg-muted cursor-not-allowed opacity-80' : ''}"
				/>
				{#if !isEditMode}
					<p class="font-mono text-[10px] text-muted-foreground">Maksimal 40 karakter, huruf besar & angka.</p>
				{/if}
			</div>

			<!-- Nama Barang (ItemName) -->
			<div class="space-y-1">
				<Label for="ItemName" class="font-black text-xs uppercase">
					Nama Barang (ItemName) <span class="text-error">*</span>
				</Label>
				<Input
					id="ItemName"
					name="ItemName"
					bind:value={itemForm.ItemName}
					placeholder="Contoh: Faucet Body 01S076"
					required
					class="h-10 border-2 font-bold"
				/>
			</div>

			<!-- Jenis Barang (KodeJenis) -->
			<div class="space-y-1">
				<Label for="KodeJenis" class="font-black text-xs uppercase">
					Jenis Barang <span class="text-error">*</span>
				</Label>
				<select
					id="KodeJenis"
					name="KodeJenis"
					bind:value={itemForm.KodeJenis}
					required
					class="w-full h-10 rounded-lg border-2 border-border bg-card px-3 text-xs font-black uppercase brutal-shadow-sm focus:outline-none"
				>
					{#each data.referenceData?.kinds || [] as k}
						<option value={k.KodeJenis}>
							{k.KodeJenis} — {k.NamaJenis}
						</option>
					{/each}
				</select>
			</div>

			<!-- Departemen (Mark) -->
			<div class="space-y-1">
				<Label for="Mark" class="font-black text-xs uppercase">
					Departemen (Mark)
				</Label>
				<input
					id="Mark"
					name="Mark"
					list="departmentsList"
					bind:value={itemForm.Mark}
					placeholder="Pilih atau ketik departemen..."
					class="w-full h-10 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase brutal-shadow-sm focus:outline-none"
				/>
				<datalist id="departmentsList">
					{#each data.referenceData?.departments || [] as dept}
						<option value={dept}></option>
					{/each}
				</datalist>
			</div>

			<!-- Satuan (SatuanKecil) -->
			<div class="space-y-1">
				<Label for="SatuanKecil" class="font-black text-xs uppercase">
					Satuan
				</Label>
				<input
					id="SatuanKecil"
					name="SatuanKecil"
					list="unitsList"
					bind:value={itemForm.SatuanKecil}
					placeholder="Contoh: PCS, KG, METER..."
					class="w-full h-10 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase brutal-shadow-sm focus:outline-none"
				/>
				<datalist id="unitsList">
					{#each data.referenceData?.units || [] as unit}
						<option value={unit}></option>
					{/each}
				</datalist>
			</div>

			<!-- Warna Indo (warna) -->
			<div class="space-y-1">
				<Label for="warna" class="font-black text-xs uppercase">
					Warna Indo (warna)
				</Label>
				<input
					id="warna"
					name="warna"
					list="warnaList"
					bind:value={itemForm.warna}
					maxlength="20"
					placeholder="Contoh: HITAM, CHROME, NATURAL..."
					class="w-full h-10 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase brutal-shadow-sm focus:outline-none"
				/>
				<datalist id="warnaList">
					{#each data.referenceData?.colors || [] as color}
						<option value={color}></option>
					{/each}
				</datalist>
				<p class="font-mono text-[10px] text-muted-foreground">Maksimal 20 karakter.</p>
			</div>

			<!-- Warna Mandarin (warnac) -->
			<div class="space-y-1">
				<Label for="warnac" class="font-black text-xs uppercase">
					Warna Mandarin (warnac)
				</Label>
				<Input
					id="warnac"
					name="warnac"
					bind:value={itemForm.warnac}
					placeholder="Contoh: 黑色, 铬色, 哑黑色..."
					class="h-10 border-2 text-xs"
				/>
			</div>

			<!-- Nama Bea Cukai (namebc) -->
			<div class="space-y-1">
				<Label for="namebc" class="font-black text-xs uppercase">
					Nama Bea Cukai (BC)
				</Label>
				<Input
					id="namebc"
					name="namebc"
					bind:value={itemForm.namebc}
					placeholder="Nama deskripsi resmi Bea Cukai..."
					class="h-10 border-2 text-xs"
				/>
			</div>

			<!-- Nama Mandarin (ItemName2) -->
			<div class="space-y-1">
				<Label for="ItemName2" class="font-black text-xs uppercase">
					Nama Mandarin / Cina (ItemName2)
				</Label>
				<Input
					id="ItemName2"
					name="ItemName2"
					bind:value={itemForm.ItemName2}
					placeholder="Nama barang dalam bahasa mandarin..."
					class="h-10 border-2 text-xs"
				/>
			</div>

			<!-- Spesifikasi (Spec) -->
			<div class="space-y-1">
				<Label for="Spec" class="font-black text-xs uppercase">
					Spesifikasi (Spec)
				</Label>
				<Input
					id="Spec"
					name="Spec"
					bind:value={itemForm.Spec}
					placeholder="Dimensi, toleransi, ukuran..."
					class="h-10 border-2 text-xs"
				/>
			</div>

			<!-- Bahan -->
			<div class="space-y-1">
				<Label for="bahan" class="font-black text-xs uppercase">
					Bahan Baku (bahan)
				</Label>
				<Input
					id="bahan"
					name="bahan"
					bind:value={itemForm.bahan}
					placeholder="ZINC, BRASS, ABS, PP..."
					class="h-10 border-2 font-bold uppercase"
				/>
			</div>
		</div>

		<div class="flex items-center justify-end gap-2 border-t-2 border-border pt-4 mt-6">
			<Button
				type="button"
				variant="secondary"
				onclick={() => (isItemModalOpen = false)}
				class="h-10 border-2 font-black uppercase text-xs brutal-shadow-sm cursor-pointer"
			>
				Batal
			</Button>
			<Button
				type="submit"
				variant="primary"
				disabled={itemFormSubmitting}
				class="h-10 border-2 font-black uppercase text-xs brutal-shadow-sm cursor-pointer"
			>
				{#if itemFormSubmitting}
					<RefreshCw class="size-4 mr-1.5 animate-spin" /> Menyimpan...
				{:else}
					<CheckCircle2 class="size-4 mr-1.5" /> {isEditMode ? 'Simpan Perubahan' : 'Tambahkan Barang'}
				{/if}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL 2: IMPORT EXCEL MASTER BARANG ==================== -->
<Modal
	bind:open={isImportModalOpen}
	title="Import Master Barang dari Excel"
	subtitle="Unggah berkas spreadsheet Excel untuk menambah atau memperbarui katalog master barang secara massal."
	icon={FileSpreadsheet}
	size="4xl"
>
	<div class="space-y-4">
		<FileUploadZone
			accept=".xlsx,.xls"
			title="Pilih file template Excel Master Barang (.xlsx atau .xls)"
			subtitle="Tarik & lepas file ke kotak ini atau klik untuk memilih file"
			templateUrl="/api/master-barang/template"
			templateLabel="Unduh Template Excel Master Barang"
			loading={isUploadingImport}
			loadingMessage="Membaca dan memvalidasi file Excel..."
			onfile={handleImportFile}
		/>

		{#if importError}
			<Alert variant="error" dismissible>
				{importError}
			</Alert>
		{/if}

		{#if parsedImportData}
			<div class="border-2 border-border p-4 rounded-xl space-y-3 bg-muted/20 brutal-shadow-sm">
				<div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border pb-3">
					<div class="space-y-0.5">
						<span class="font-black text-xs uppercase tracking-wide">Ringkasan Validasi Berkas</span>
						<p class="font-mono text-[11px] text-muted-foreground">{parsedImportData.fileName} ({(parsedImportData.fileSize / 1024).toFixed(1)} KB)</p>
					</div>
					<div class="flex flex-wrap items-center gap-2 font-mono text-xs">
						<Badge variant="secondary" class="border-2 font-mono font-bold">
							{parsedImportData.summary.totalRows} Total
						</Badge>
						<Badge variant="primary" class="border-2 font-mono font-bold">
							{parsedImportData.summary.newCount} Baru
						</Badge>
						<Badge variant="outline" class="border-2 font-mono font-bold">
							{parsedImportData.summary.existingCount} Update
						</Badge>
						{#if parsedImportData.summary.invalidCount > 0}
							<Badge variant="error" class="border-2 font-mono font-bold">
								{parsedImportData.summary.invalidCount} Tidak Valid
							</Badge>
						{/if}
					</div>
				</div>

				<div class="flex items-center gap-2 py-1">
					<label class="flex items-center gap-2 font-bold text-xs cursor-pointer select-none">
						<input
							type="checkbox"
							bind:checked={updateExisting}
							class="size-4 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
						/>
						<span>Perbarui data jika Kode Barang (ItemID) sudah ada di master (Update existing)</span>
					</label>
				</div>

				<!-- Preview table -->
				<div class="max-h-64 overflow-y-auto border-2 border-border rounded-lg bg-card">
					<Table wrapperClass="border-0 shadow-none rounded-none text-xs">
						<TableHeader>
							<TableRow class="bg-muted/50 text-[10px]">
								<TableHead class="w-16">Baris</TableHead>
								<TableHead class="w-20">Status</TableHead>
								<TableHead>Kode</TableHead>
								<TableHead>Nama Barang</TableHead>
								<TableHead>Warna</TableHead>
								<TableHead>Jenis</TableHead>
								<TableHead>Departemen</TableHead>
								<TableHead>Satuan</TableHead>
								<TableHead>Keterangan</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each parsedImportData.items.slice(0, 50) as it}
								<TableRow class="hover:bg-primary/5">
									<TableCell class="font-mono text-muted-foreground">{it.rowNumber}</TableCell>
									<TableCell>
										{#if it.status === 'NEW'}
											<Badge variant="primary" class="font-mono text-[9px]">BARU</Badge>
										{:else if it.status === 'EXISTS'}
											<Badge variant="secondary" class="font-mono text-[9px]">UPDATE</Badge>
										{:else}
											<Badge variant="error" class="font-mono text-[9px]">INVALID</Badge>
										{/if}
									</TableCell>
									<TableCell class="font-mono font-black">{it.ItemID}</TableCell>
									<TableCell class="font-bold max-w-44 truncate">{it.ItemName}</TableCell>
									<TableCell>
										<span class="font-mono text-[10px] font-bold">{it.warna || '-'}</span>
										{#if it.warnac && it.warnac !== it.warna}
											<span class="text-[10px] text-muted-foreground ml-1">({it.warnac})</span>
										{/if}
									</TableCell>
									<TableCell class="font-mono">{it.KodeJenis}</TableCell>
									<TableCell>{it.Mark || '-'}</TableCell>
									<TableCell class="font-mono">{it.SatuanKecil || 'PCS'}</TableCell>
									<TableCell class="text-[11px] {it.status === 'INVALID' ? 'text-error font-bold' : 'text-muted-foreground'}">
										{it.errorMessage || '-'}
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				</div>
				{#if parsedImportData.items.length > 50}
					<p class="font-mono text-[10px] text-muted-foreground text-center">
						Menampilkan 50 baris pertama dari total {parsedImportData.items.length} baris.
					</p>
				{/if}

				<div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
					<Button
						type="button"
						variant="secondary"
						onclick={() => (parsedImportData = null)}
						class="h-9 border-2 font-black uppercase text-xs brutal-shadow-sm cursor-pointer"
					>
						Reset Berkas
					</Button>
					<Button
						type="button"
						variant="primary"
						disabled={isSavingImport || parsedImportData.summary.validCount === 0}
						onclick={executeBatchImport}
						class="h-9 border-2 font-black uppercase text-xs brutal-shadow-sm cursor-pointer"
					>
						{#if isSavingImport}
							<RefreshCw class="size-4 mr-1.5 animate-spin" /> Memproses Import...
						{:else}
							<CheckCircle2 class="size-4 mr-1.5" /> Simpan & Import ({parsedImportData.summary.validCount} Valid)
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	</div>
</Modal>
