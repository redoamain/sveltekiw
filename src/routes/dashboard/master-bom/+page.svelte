<script lang="ts">
	import { enhance } from '$app/forms';
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
		TableEmpty,
		LoadingOverlay,
		Modal,
		SearchInput
	} from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import {
		Workflow,
		Search,
		Plus,
		Download,
		Printer,
		Edit3,
		Trash2,
		Eye,
		Layers,
		Network,
		Boxes,
		ArrowRight,
		CheckCircle2,
		XCircle,
		FolderTree,
		Calendar,
		User,
		Info,
		RotateCcw,
		CornerDownRight,
		Copy,
		Check,
		Package,
		X,
		ChevronRight,
		Sparkles,
		ExternalLink,
		FileSpreadsheet,
		Filter,
		SlidersHorizontal,
		Hash,
		ArrowRightLeft,
		ChevronDown
	} from '@lucide/svelte';

	let { data, form } = $props();

	let loading = $state(false);
	let exportLoading = $state(false);
	let copiedKey = $state<string | null>(null);

	function copyText(val: string, label = 'Teks') {
		if (!val) return;
		navigator.clipboard.writeText(val);
		copiedKey = val;
		toast.success('Disalin', `${label} "${val}" telah disalin`);
		setTimeout(() => {
			if (copiedKey === val) copiedKey = null;
		}, 2000);
	}

	const fmtNum = (n: number | null | undefined, maxDec = 4) =>
		Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: maxDec });

	$effect(() => {
		if (data) {
			loading = false;
		}
	});

	// Handle response actions form (save / delete)
	$effect(() => {
		if (form?.success) {
			if (form.message) toast.success('Berhasil', form.message);
			isFormModalOpen = false;
			isDeleteModalOpen = false;
		} else if (form?.error) {
			toast.error('Gagal', form.error);
		}
	});

	// ==================== STATE DETAIL / TREE EXPLORER MODAL ====================
	let isDetailModalOpen = $state(false);
	let detailLoading = $state(false);
	let detailTab = $state<'flat' | 'tree'>('flat');
	let activeDetail = $state<{
		header: any;
		details: any[];
		tree: any[];
	} | null>(null);

	// In-modal search query for direct components
	let detailComponentQuery = $state('');

	// In-modal search & filter for Tree
	let treeSearchQuery = $state('');
	let treeLevelFilter = $state<number | 'all'>('all');

	// Filtered components in Tab 1
	let filteredDetailComponents = $derived.by(() => {
		if (!activeDetail?.details) return [];
		const q = detailComponentQuery.trim().toLowerCase();
		if (!q) return activeDetail.details;
		return activeDetail.details.filter(
			(d) =>
				d.ItemID.toLowerCase().includes(q) ||
				(d.ItemName && d.ItemName.toLowerCase().includes(q)) ||
				(d.Departemen && d.Departemen.toLowerCase().includes(q)) ||
				(d.NamaJenis && d.NamaJenis.toLowerCase().includes(q))
		);
	});

	// Derived Tree stats
	let treeStats = $derived.by(() => {
		if (!activeDetail?.tree || activeDetail.tree.length === 0) {
			return { maxLevel: 0, totalNodes: 0, subAssemblies: 0, rawMaterials: 0 };
		}
		let maxLevel = 0;
		let subAssemblies = 0;
		let rawMaterials = 0;

		activeDetail.tree.forEach((node) => {
			if (node.Level > maxLevel) maxLevel = node.Level;
			if (node.Level > 0 && node.TransID) {
				subAssemblies++;
			} else if (node.Level > 0) {
				rawMaterials++;
			}
		});

		return {
			maxLevel,
			totalNodes: activeDetail.tree.length,
			subAssemblies,
			rawMaterials
		};
	});

	// Filtered tree nodes in Tab 2
	let filteredTreeNodes = $derived.by(() => {
		if (!activeDetail?.tree) return [];
		const q = treeSearchQuery.trim().toLowerCase();
		const level = treeLevelFilter;

		return activeDetail.tree.filter((node) => {
			const matchLevel = level === 'all' || node.Level === level;
			const matchQuery =
				!q ||
				node.ItemID.toLowerCase().includes(q) ||
				(node.ItemName && node.ItemName.toLowerCase().includes(q)) ||
				(node.Departemen && node.Departemen.toLowerCase().includes(q)) ||
				(node.NamaJenis && node.NamaJenis.toLowerCase().includes(q));

			return matchLevel && matchQuery;
		});
	});

	async function openDetailModal(transId: string) {
		detailLoading = true;
		detailTab = 'flat';
		detailComponentQuery = '';
		treeSearchQuery = '';
		treeLevelFilter = 'all';
		isDetailModalOpen = true;
		try {
			const res = await fetch(`/api/master-bom/detail?transId=${encodeURIComponent(transId)}`);
			const json = await res.json();
			if (json.success) {
				activeDetail = {
					header: json.header,
					details: json.details || [],
					tree: json.tree || []
				};
			} else {
				toast.error('Gagal', json.error || 'Gagal memuat detail BOM');
				isDetailModalOpen = false;
			}
		} catch (err: any) {
			toast.error('Error', err?.message || 'Koneksi gagal');
			isDetailModalOpen = false;
		} finally {
			detailLoading = false;
		}
	}

	// ==================== STATE UNIVERSAL ITEM PICKER MODAL ====================
	let itemPickerOpen = $state(false);
	let itemPickerTarget = $state<'product' | 'detail'>('product');
	let itemPickerRowIndex = $state<number | null>(null);
	let itemPickerQuery = $state('');
	let itemPickerResults = $state<any[]>([]);
	let itemPickerLoading = $state(false);

	async function searchPickerItems(q: string) {
		const trimmed = q.trim();
		if (!trimmed) {
			itemPickerResults = [];
			return;
		}
		itemPickerLoading = true;
		try {
			const res = await fetch(`/api/production/search-items?q=${encodeURIComponent(trimmed)}`);
			const json = await res.json();
			itemPickerResults = json.items || [];
		} catch {
			itemPickerResults = [];
		} finally {
			itemPickerLoading = false;
		}
	}

	function openItemPicker(target: 'product' | 'detail', rowIndex: number | null = null) {
		itemPickerTarget = target;
		itemPickerRowIndex = rowIndex;
		itemPickerQuery = '';
		itemPickerResults = [];
		itemPickerOpen = true;
	}

	function selectPickerItem(item: any) {
		if (itemPickerTarget === 'product') {
			bomForm.ItemID = item.ItemID;
			bomForm.ItemName = item.ItemName || '';
			bomForm.HasilPackSatuan = item.Satuan || 'PCS';
			toast.success('Produk Terpilih', `${item.ItemID} - ${item.ItemName}`);
		} else if (itemPickerTarget === 'detail' && itemPickerRowIndex !== null) {
			if (bomForm.details[itemPickerRowIndex]) {
				bomForm.details[itemPickerRowIndex].ItemID = item.ItemID;
				bomForm.details[itemPickerRowIndex].ItemName = item.ItemName || '';
				bomForm.details[itemPickerRowIndex].BahanPackSatuan = item.Satuan || 'PCS';
				toast.info('Bahan Dipilih', `#${itemPickerRowIndex + 1}: ${item.ItemID}`);
			}
		}
		itemPickerOpen = false;
	}

	// ==================== STATE MODAL CREATE / EDIT ====================
	let isFormModalOpen = $state(false);
	let isEditMode = $state(false);
	let formSubmitting = $state(false);

	interface BomDetailRow {
		ItemID: string;
		ItemName: string;
		BahanQty: number;
		BahanPackSatuan: string;
	}

	let bomForm = $state({
		TransID: '',
		Transdate: new Date().toISOString().slice(0, 10),
		ItemID: '',
		ItemName: '',
		HasilPackQty: 1,
		HasilPackSatuan: 'PCS',
		LocIDSource: 'GUDAS',
		LocID: 'GUDFG',
		Remark: '',
		details: <BomDetailRow[]>[
			{ ItemID: '', ItemName: '', BahanQty: 1, BahanPackSatuan: 'PCS' }
		]
	});

	function addDetailRow() {
		bomForm.details = [
			...bomForm.details,
			{ ItemID: '', ItemName: '', BahanQty: 1, BahanPackSatuan: 'PCS' }
		];
	}

	function addMultipleDetailRows(count = 5) {
		const newRows: BomDetailRow[] = Array.from({ length: count }, () => ({
			ItemID: '',
			ItemName: '',
			BahanQty: 1,
			BahanPackSatuan: 'PCS'
		}));
		bomForm.details = [...bomForm.details, ...newRows];
	}

	function duplicateDetailRow(index: number) {
		const target = bomForm.details[index];
		if (!target) return;
		const clone: BomDetailRow = {
			ItemID: target.ItemID,
			ItemName: target.ItemName,
			BahanQty: target.BahanQty,
			BahanPackSatuan: target.BahanPackSatuan
		};
		bomForm.details.splice(index + 1, 0, clone);
		bomForm.details = [...bomForm.details];
		toast.info('Baris Diduplikasi', `Komponen #${index + 1} diduplikasi`);
	}

	function removeDetailRow(index: number) {
		if (bomForm.details.length <= 1) {
			toast.warning('Peringatan', 'Minimal harus ada 1 baris bahan.');
			return;
		}
		bomForm.details = bomForm.details.filter((_, idx) => idx !== index);
	}

	function clearDetailRows() {
		bomForm.details = [{ ItemID: '', ItemName: '', BahanQty: 1, BahanPackSatuan: 'PCS' }];
	}

	function openCreateModal() {
		isEditMode = false;
		bomForm = {
			TransID: data.nextTransId,
			Transdate: new Date().toISOString().slice(0, 10),
			ItemID: '',
			ItemName: '',
			HasilPackQty: 1,
			HasilPackSatuan: 'PCS',
			LocIDSource: 'GUDAS',
			LocID: 'GUDFG',
			Remark: '',
			details: [
				{ ItemID: '', ItemName: '', BahanQty: 1, BahanPackSatuan: 'PCS' }
			]
		};
		isFormModalOpen = true;
	}

	async function openEditModal(header: any) {
		isEditMode = true;
		detailLoading = true;
		try {
			const res = await fetch(`/api/master-bom/detail?transId=${encodeURIComponent(header.TransID)}`);
			const json = await res.json();
			if (json.success) {
				const d = json.details || [];
				bomForm = {
					TransID: header.TransID,
					Transdate: header.Transdate ? header.Transdate.slice(0, 10) : new Date().toISOString().slice(0, 10),
					ItemID: header.ItemID,
					ItemName: header.ItemName,
					HasilPackQty: header.HasilPackQty || 1,
					HasilPackSatuan: header.HasilPackSatuan || 'PCS',
					LocIDSource: header.LocIDSource || 'GUDAS',
					LocID: header.LocID || 'GUDFG',
					Remark: header.Remark || '',
					details: d.length > 0 ? d.map((x: any) => ({
						ItemID: x.ItemID,
						ItemName: x.ItemName,
						BahanQty: x.BahanQty,
						BahanPackSatuan: x.BahanPackSatuan
					})) : [{ ItemID: '', ItemName: '', BahanQty: 1, BahanPackSatuan: 'PCS' }]
				};
				isFormModalOpen = true;
			} else {
				toast.error('Gagal', json.error || 'Gagal memuat detail BOM untuk diedit');
			}
		} catch (err: any) {
			toast.error('Error', err?.message || 'Koneksi gagal');
		} finally {
			detailLoading = false;
		}
	}

	// Validation helper for form submission
	let formValidationError = $derived.by(() => {
		if (!bomForm.ItemID.trim()) {
			return 'Produk Hasil (Output) belum dipilih.';
		}
		if (bomForm.details.length === 0) {
			return 'Minimal sertakan 1 komponen bahan.';
		}
		const emptyItems = bomForm.details.filter((d) => !d.ItemID.trim());
		if (emptyItems.length > 0) {
			return `Ada ${emptyItems.length} baris bahan yang belum diisi kode barangnya.`;
		}
		const invalidQty = bomForm.details.filter((d) => Number(d.BahanQty) <= 0);
		if (invalidQty.length > 0) {
			return `Ada ${invalidQty.length} baris bahan dengan kuantitas 0 atau minus.`;
		}
		return null;
	});

	// ==================== STATE MODAL DELETE ====================
	let isDeleteModalOpen = $state(false);
	let bomToDelete = $state<any>(null);

	function openDeleteModal(item: any) {
		bomToDelete = item;
		isDeleteModalOpen = true;
	}
</script>

<LoadingOverlay show={loading || detailLoading} message="Memproses Data Master BOM..." submessage="Mohon tunggu sejenak" />

<div class="space-y-6 text-foreground">
	<!-- Page Header -->
	<PageHeader
		title="Master Data Bill of Materials (BOM)"
		description="Kelola struktur resep produksi, hierarki multi-level komponen material, serta alur perpindahan gudang perakitan dan cetak."
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					variant="primary"
					onclick={openCreateModal}
					class="h-10 border-[3px] border-border font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
					title="Tambah Master BOM baru"
				>
					<Plus class="size-4 mr-1.5" />
					Tambah BOM
				</Button>

				<!-- Form Export Excel -->
				<form
					method="post"
					action="/api/master-bom/export"
					onsubmit={() => {
						exportLoading = true;
						toast.info('Export Excel', 'Menyiapkan berkas Excel Master BOM...');
						setTimeout(() => (exportLoading = false), 3500);
					}}
					class="inline-flex"
				>
					<input type="hidden" name="q" value={data.q} />
					<input type="hidden" name="locIdSource" value={data.locIdSource} />
					<input type="hidden" name="locId" value={data.locId} />

					<Button
						type="submit"
						variant="outline"
						disabled={exportLoading}
						class="h-10 border-[3px] border-border bg-card text-foreground hover:bg-muted font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer"
						title="Export Excel seluruh daftar Master BOM sesuai filter aktif"
					>
						<Download class="size-4 mr-1.5" />
						Export Excel
					</Button>
				</form>

				<Button
					type="button"
					variant="outline"
					onclick={() => window.print()}
					class="h-10 border-[3px] border-border bg-card text-foreground hover:bg-muted font-black uppercase tracking-wide brutal-shadow-sm text-xs cursor-pointer hidden sm:inline-flex"
					title="Cetak daftar Master BOM"
				>
					<Printer class="size-4 mr-1.5" />
					Cetak
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	<!-- Summary Metrics Cards (5-Cards High Visibility Bar) -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
		<!-- Total Resep BOM -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Total Resep BOM</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-primary/20 text-primary">
					<Workflow class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalBom.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Formula Resep Terdaftar
				</p>
			</div>
		</div>

		<!-- Total Komponen Detail -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Total Komponen</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-blue-100 text-blue-700">
					<Layers class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalDetails.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Relasi Bahan Terpasang
				</p>
			</div>
		</div>

		<!-- Produk Jadi (FG) -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Produk Jadi (FG)</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-emerald-100 text-emerald-700">
					<Package class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalFinishedGoods.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Finished Goods Output
				</p>
			</div>
		</div>

		<!-- BOM Assembly -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">BOM Assembly</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-purple-100 text-purple-700">
					<Boxes class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalAssembly.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Perakitan (GUDAS)
				</p>
			</div>
		</div>

		<!-- BOM Injeksi / Cetak -->
		<div class="rounded-xl border-[3px] border-border bg-card p-4 brutal-shadow flex flex-col justify-between col-span-2 sm:col-span-1">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black uppercase tracking-wider text-muted-foreground">BOM Injeksi</span>
				<div class="p-1.5 rounded-lg border-2 border-border bg-amber-100 text-amber-700">
					<Network class="size-4" />
				</div>
			</div>
			<div class="mt-3">
				<div class="font-mono text-2xl font-black text-foreground">
					{data.stats.totalInjeksi.toLocaleString('id-ID')}
				</div>
				<p class="text-[11px] font-bold text-muted-foreground mt-0.5">
					Molding & Sub-WIP (GUDIN)
				</p>
			</div>
		</div>
	</div>

	<!-- Filter & Search Bar Form -->
	<form
		method="get"
		action="/dashboard/master-bom"
		class="bg-card text-foreground rounded-xl border-[3px] border-border p-4 brutal-shadow space-y-3"
	>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
			<!-- Input Pencarian -->
			<div class="space-y-1.5 lg:col-span-4">
				<Label for="q" class="text-xs font-black uppercase tracking-wider text-foreground">Pencarian BOM</Label>
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						id="q"
						name="q"
						value={data.q}
						placeholder="TransID, Kode Produk, Nama Produk, Departemen..."
						class="bg-card text-foreground placeholder:text-muted-foreground border-border h-10 w-full rounded-lg border-[3px] pl-9 pr-8 text-xs sm:text-sm font-bold brutal-shadow-sm focus:outline-none"
					/>
					{#if data.q}
						<a
							href="/dashboard/master-bom?{new URLSearchParams({ locIdSource: data.locIdSource, locId: data.locId, pageSize: String(data.pageSize) }).toString()}"
							class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							title="Bersihkan pencarian"
						>
							<X class="size-4" />
						</a>
					{/if}
				</div>
			</div>

			<!-- Filter Gudang Asal (LocIDSource) -->
			<div class="space-y-1.5 lg:col-span-3">
				<Label for="locIdSource" class="text-xs font-black uppercase tracking-wider text-foreground">Gudang Asal (Source)</Label>
				<select
					id="locIdSource"
					name="locIdSource"
					class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 text-xs sm:text-sm font-bold brutal-shadow-sm focus:outline-none font-mono"
				>
					<option value="">Semua Gudang Asal</option>
					{#each data.locations as loc}
						<option value={loc.LocID} selected={data.locIdSource === loc.LocID}>
							[{loc.LocID}] {loc.LocName}
						</option>
					{/each}
				</select>
			</div>

			<!-- Filter Gudang Tujuan (LocID) -->
			<div class="space-y-1.5 lg:col-span-2">
				<Label for="locId" class="text-xs font-black uppercase tracking-wider text-foreground">Gudang Tujuan (Dest)</Label>
				<select
					id="locId"
					name="locId"
					class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 text-xs sm:text-sm font-bold brutal-shadow-sm focus:outline-none font-mono"
				>
					<option value="">Semua Tujuan</option>
					{#each data.locations as loc}
						<option value={loc.LocID} selected={data.locId === loc.LocID}>
							[{loc.LocID}] {loc.LocName}
						</option>
					{/each}
				</select>
			</div>

			<!-- Filter Page Size -->
			<div class="space-y-1.5 lg:col-span-1">
				<Label for="pageSize" class="text-xs font-black uppercase tracking-wider text-foreground">Baris</Label>
				<select
					id="pageSize"
					name="pageSize"
					class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-2 text-xs sm:text-sm font-bold brutal-shadow-sm focus:outline-none font-mono"
				>
					{#each [10, 25, 50, 100, 200] as ps}
						<option value={ps} selected={data.pageSize === ps}>{ps}</option>
					{/each}
				</select>
			</div>

			<!-- Action Buttons Filter -->
			<div class="flex items-center gap-2 lg:col-span-2">
				<Button
					type="submit"
					variant="primary"
					class="h-10 flex-1 border-[3px] border-border font-black uppercase text-xs tracking-wide brutal-shadow-sm cursor-pointer"
				>
					<Filter class="size-3.5 mr-1" />
					Filter
				</Button>
				{#if data.q || data.locIdSource || data.locId}
					<a
						href="/dashboard/master-bom?pageSize={data.pageSize}"
						class="h-10 px-3 inline-flex items-center justify-center rounded-lg border-[3px] border-border bg-card text-foreground hover:bg-muted font-black text-xs brutal-shadow-sm"
						title="Reset Filter"
					>
						<RotateCcw class="size-4 text-foreground" />
					</a>
				{/if}
			</div>
		</div>

		<!-- Active Filter Badges & Counter -->
		<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t-2 border-border/40">
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="text-xs font-bold text-muted-foreground mr-1">Filter Aktif:</span>
				{#if !data.q && !data.locIdSource && !data.locId}
					<span class="text-xs text-muted-foreground font-mono italic">Tidak ada filter aktif (menampilkan seluruh resep)</span>
				{/if}

				{#if data.q}
					<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border-2 border-border bg-primary/10 text-primary text-xs font-black font-mono">
						<span>Cari: "{data.q}"</span>
						<a
							href="/dashboard/master-bom?{new URLSearchParams({ locIdSource: data.locIdSource, locId: data.locId, pageSize: String(data.pageSize) }).toString()}"
							class="hover:text-destructive text-primary"
						>
							<X class="size-3" />
						</a>
					</span>
				{/if}

				{#if data.locIdSource}
					<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border-2 border-border bg-blue-100 text-blue-900 text-xs font-black font-mono">
						<span>Asal: {data.locIdSource}</span>
						<a
							href="/dashboard/master-bom?{new URLSearchParams({ q: data.q, locId: data.locId, pageSize: String(data.pageSize) }).toString()}"
							class="hover:text-destructive text-blue-900"
						>
							<X class="size-3" />
						</a>
					</span>
				{/if}

				{#if data.locId}
					<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border-2 border-border bg-emerald-100 text-emerald-900 text-xs font-black font-mono">
						<span>Tujuan: {data.locId}</span>
						<a
							href="/dashboard/master-bom?{new URLSearchParams({ q: data.q, locIdSource: data.locIdSource, pageSize: String(data.pageSize) }).toString()}"
							class="hover:text-destructive text-emerald-900"
						>
							<X class="size-3" />
						</a>
					</span>
				{/if}
			</div>

			<div class="text-xs font-bold text-foreground">
				Ditemukan <span class="font-black font-mono text-primary text-sm">{data.total.toLocaleString('id-ID')}</span> Master BOM produk
			</div>
		</div>
	</form>

	<!-- Tabel Master BOM Neo-Brutalist -->
	<div class="bg-card text-foreground rounded-xl border-[3px] border-border brutal-shadow overflow-hidden">
		<div class="overflow-x-auto">
			<Table wrapperClass="border-0 shadow-none rounded-none">
				<TableHeader>
					<TableRow class="bg-muted/70 border-b-[3px] border-border">
						<TableHead class="w-12 text-center font-black text-foreground">No</TableHead>
						<TableHead class="w-28 font-black text-foreground">Trans ID</TableHead>
						<TableHead class="font-black text-foreground min-w-[280px]">Produk Hasil (Output)</TableHead>
						<TableHead class="w-32 font-black text-foreground">Qty Hasil</TableHead>
						<TableHead class="w-48 font-black text-foreground">Alur Gudang</TableHead>
						<TableHead class="w-32 text-center font-black text-foreground">Komponen</TableHead>
						<TableHead class="w-36 font-black text-foreground">Tanggal & User</TableHead>
						<TableHead class="w-36 text-right font-black text-foreground pr-4">Aksi</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if data.rows.length === 0}
						<TableEmpty colspan={8} message="Tidak ada data Master BOM yang sesuai filter pencarian." />
					{:else}
						{#each data.rows as bom, idx}
							<TableRow class="hover:bg-muted/30 transition-colors border-b-2 border-border/30 text-foreground">
								<!-- No -->
								<TableCell class="text-center font-mono text-xs text-foreground font-black">
									{(data.page - 1) * data.pageSize + idx + 1}
								</TableCell>

								<!-- Trans ID -->
								<TableCell>
									<div class="flex items-center gap-1.5">
										<button
											type="button"
											onclick={() => openDetailModal(bom.TransID)}
											class="font-mono font-black text-sm text-primary hover:underline cursor-pointer tracking-wide"
											title="Buka detail resep BOM #{bom.TransID}"
										>
											{bom.TransID}
										</button>
										<button
											type="button"
											onclick={() => copyText(bom.TransID, 'TransID')}
											class="text-foreground/70 hover:text-foreground p-0.5 rounded cursor-pointer"
											title="Salin TransID"
										>
											{#if copiedKey === bom.TransID}
												<Check class="size-3 text-emerald-600" />
											{:else}
												<Copy class="size-3" />
											{/if}
										</button>
									</div>
								</TableCell>

								<!-- Produk Hasil -->
								<TableCell>
									<div class="space-y-1">
										<div class="flex items-center gap-1.5 flex-wrap">
											<span class="font-mono font-black text-sm text-foreground">
												{bom.ItemID}
											</span>
											{#if bom.Departemen}
												<Badge variant="outline" class="font-mono font-bold text-[10px] px-1.5 py-0 bg-muted text-foreground border-border">
													{bom.Departemen}
												</Badge>
											{/if}
											<button
												type="button"
												onclick={() => copyText(bom.ItemID, 'Kode Produk')}
												class="text-foreground/70 hover:text-foreground p-0.5 rounded cursor-pointer"
												title="Salin Kode Produk"
											>
												{#if copiedKey === bom.ItemID}
													<Check class="size-3 text-emerald-600" />
												{:else}
													<Copy class="size-3" />
												{/if}
											</button>
										</div>
										<div class="text-xs text-foreground font-black line-clamp-1">
											{bom.ItemName || '-'}
										</div>
										{#if bom.ItemName2}
											<div class="text-[11px] text-muted-foreground font-mono font-semibold line-clamp-1">
												{bom.ItemName2}
											</div>
										{/if}
										{#if bom.Remark}
											<div class="text-[10px] text-muted-foreground font-medium italic line-clamp-1">
												Ket: {bom.Remark}
											</div>
										{/if}
									</div>
								</TableCell>

								<!-- Qty Hasil -->
								<TableCell>
									<span class="font-mono font-black text-xs bg-muted text-foreground px-2.5 py-1 rounded-md border border-border inline-block shadow-xs">
										{fmtNum(bom.HasilPackQty)} {bom.HasilPackSatuan}
									</span>
								</TableCell>

								<!-- Alur Gudang Asal & Tujuan -->
								<TableCell>
									<div>
										<div class="flex items-center gap-1.5 font-mono text-xs">
											<span
												class="px-1.5 py-0.5 rounded font-black border border-border bg-card text-foreground"
												title={bom.LocIDSourceName || bom.LocIDSource || 'Gudang Asal'}
											>
												{bom.LocIDSource || '-'}
											</span>
											<ArrowRight class="size-3 text-muted-foreground shrink-0" />
											<span
												class="px-1.5 py-0.5 rounded font-black border border-primary/40 bg-primary/10 text-primary"
												title={bom.LocIDName || bom.LocID || 'Gudang Tujuan'}
											>
												{bom.LocID || '-'}
											</span>
										</div>
										{#if bom.LocIDSourceName || bom.LocIDName}
											<div class="text-[10px] text-muted-foreground font-semibold mt-1 truncate max-w-[190px]" title="{bom.LocIDSourceName || bom.LocIDSource} &rarr; {bom.LocIDName || bom.LocID}">
												{bom.LocIDSourceName || bom.LocIDSource} &rarr; {bom.LocIDName || bom.LocID}
											</div>
										{/if}
									</div>
								</TableCell>

								<!-- Jml Komponen Bahan -->
								<TableCell class="text-center">
									<button
										type="button"
										onclick={() => openDetailModal(bom.TransID)}
										class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-black border-2 transition-all cursor-pointer bg-blue-100 border-blue-400 text-blue-900 hover:bg-blue-200 brutal-shadow-xs"
										title="Klik untuk eksplorasi resep dan pohon hierarki multi-level"
									>
										<Layers class="size-3.5 text-blue-800 shrink-0" />
										<span>{bom.componentCount} Bahan</span>
									</button>
								</TableCell>

								<!-- Tanggal & User -->
								<TableCell>
									<div class="text-xs space-y-0.5">
										<div class="font-mono font-black text-foreground flex items-center gap-1">
											<Calendar class="size-3 text-muted-foreground" />
											<span>{bom.Transdate ? bom.Transdate.slice(0, 10) : '-'}</span>
										</div>
										{#if bom.Username}
											<div class="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
												<User class="size-3 text-muted-foreground" />
												<span class="truncate max-w-[110px]">{bom.Username}</span>
											</div>
										{/if}
									</div>
								</TableCell>

								<!-- Aksi (Detail/Tree, Export, Edit, Hapus) -->
								<TableCell class="text-right pr-4">
									<div class="flex items-center justify-end gap-1">
										<!-- Detail & Tree Explorer -->
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => openDetailModal(bom.TransID)}
											class="h-8 w-8 p-0 cursor-pointer text-blue-700 bg-card border-2 border-border hover:bg-blue-50 brutal-shadow-xs"
											title="Buka Hierarki Multi-Level BOM Tree"
										>
											<FolderTree class="size-4" />
										</Button>

										<!-- Export Single BOM Excel -->
										<a
											href="/api/master-bom/export?transId={bom.TransID}"
											download
											class="h-8 w-8 inline-flex items-center justify-center rounded-md border-2 border-border bg-card text-foreground hover:text-primary hover:bg-muted/50 cursor-pointer brutal-shadow-xs"
											title="Export Resep BOM ke Excel"
										>
											<Download class="size-4 text-foreground" />
										</a>

										<!-- Edit BOM -->
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => openEditModal(bom)}
											class="h-8 w-8 p-0 cursor-pointer text-primary bg-card border-2 border-border hover:bg-primary/10 brutal-shadow-xs"
											title="Ubah Resep BOM"
										>
											<Edit3 class="size-4" />
										</Button>

										<!-- Hapus BOM -->
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => openDeleteModal(bom)}
											class="h-8 w-8 p-0 cursor-pointer text-error bg-card border-2 border-border hover:bg-error/10 brutal-shadow-xs"
											title="Hapus Master BOM"
										>
											<Trash2 class="size-4" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						{/each}
					{/if}
				</TableBody>
			</Table>
		</div>

		<!-- Pagination Footer -->
		<div class="border-t-[3px] border-border p-3 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
			<div class="text-xs text-foreground font-bold">
				Menampilkan <span class="text-foreground font-black font-mono">{data.rows.length}</span> dari <span class="text-foreground font-black font-mono">{data.total.toLocaleString('id-ID')}</span> BOM (Halaman {data.page} dari {data.totalPages || 1})
			</div>

			<Pagination
				page={data.page}
				pageSize={data.pageSize}
				total={data.total}
				basePath="/dashboard/master-bom"
				params={{
					q: data.q,
					locIdSource: data.locIdSource,
					locId: data.locId
				}}
				pageSizeOptions={[10, 25, 50, 100, 200]}
			/>
		</div>
	</div>
</div>

<!-- ==================== MODAL DETAIL & BOM TREE EXPLORER ==================== -->
<Modal
	bind:open={isDetailModalOpen}
	size="2xl"
	title="Struktur Resep & Hierarki Multi-Level BOM"
	subtitle={activeDetail ? `${activeDetail.header.ItemID} — ${activeDetail.header.ItemName}` : 'Memuat data BOM...'}
	icon={Network}
>
	{#if activeDetail}
		<div class="space-y-4 py-1 text-foreground">
			<!-- Header Ringkasan Produk Master -->
			<div class="p-4 rounded-xl border-[3px] border-border bg-card brutal-shadow space-y-3">
				<div class="flex flex-wrap items-start justify-between gap-3 border-b-2 border-border/40 pb-3">
					<div>
						<div class="flex items-center gap-2 flex-wrap">
							<span class="font-mono text-lg font-black text-foreground">{activeDetail.header.ItemID}</span>
							{#if activeDetail.header.Departemen}
								<Badge variant="outline" class="font-mono text-xs font-black bg-muted text-foreground border-border">
									{activeDetail.header.Departemen}
								</Badge>
							{/if}
							<span class="text-xs font-mono font-black bg-muted text-foreground px-2 py-0.5 rounded border border-border/60">
								TransID: {activeDetail.header.TransID}
							</span>
						</div>
						<div class="text-sm font-black text-foreground mt-0.5">
							{activeDetail.header.ItemName}
						</div>
						{#if activeDetail.header.ItemName2}
							<div class="text-xs text-muted-foreground font-mono font-semibold">
								{activeDetail.header.ItemName2}
							</div>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						<a
							href="/api/master-bom/export?transId={activeDetail.header.TransID}"
							download
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-border bg-card text-foreground font-black text-xs hover:bg-muted cursor-pointer brutal-shadow-xs"
							title="Export Excel Struktur BOM Ini"
						>
							<Download class="size-3.5 text-foreground" />
							<span>Export Excel</span>
						</a>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => openEditModal(activeDetail?.header)}
							class="border-2 border-border font-black text-xs text-primary bg-card hover:bg-primary/10 brutal-shadow-xs"
						>
							<Edit3 class="size-3.5 mr-1" />
							Edit Resep
						</Button>
					</div>
				</div>

				<!-- Info Grid Kuantitas, Gudang, Tanggal -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
					<div class="p-2.5 rounded-lg border-2 border-border/60 bg-muted/30">
						<span class="text-[10px] text-muted-foreground font-black uppercase block">Output Produk Hasil</span>
						<span class="font-mono text-sm font-black text-foreground">
							{fmtNum(activeDetail.header.HasilPackQty)} {activeDetail.header.HasilPackSatuan}
						</span>
					</div>

					<div class="p-2.5 rounded-lg border-2 border-border/60 bg-muted/30">
						<span class="text-[10px] text-muted-foreground font-black uppercase block">Alur Gudang</span>
						<span class="font-mono text-sm font-bold text-foreground">
							{activeDetail.header.LocIDSource || '-'} &rarr; {activeDetail.header.LocID || '-'}
						</span>
						{#if activeDetail.header.LocIDSourceName || activeDetail.header.LocIDName}
							<span class="block text-[9px] text-muted-foreground font-semibold truncate">
								{activeDetail.header.LocIDSourceName} &rarr; {activeDetail.header.LocIDName}
							</span>
						{/if}
					</div>

					<div class="p-2.5 rounded-lg border-2 border-border/60 bg-muted/30">
						<span class="text-[10px] text-muted-foreground font-black uppercase block">Tanggal Pembuatan</span>
						<span class="font-mono text-sm font-black text-foreground">
							{activeDetail.header.Transdate ? activeDetail.header.Transdate.slice(0, 10) : '-'}
						</span>
					</div>

					<div class="p-2.5 rounded-lg border-2 border-border/60 bg-muted/30">
						<span class="text-[10px] text-muted-foreground font-black uppercase block">Operator ERP</span>
						<span class="font-mono text-sm font-black text-foreground">
							{activeDetail.header.Username || 'system'}
						</span>
					</div>
				</div>

				{#if activeDetail.header.Remark}
					<div class="p-2.5 rounded-lg border border-border/60 bg-muted/10 text-xs flex items-center gap-2">
						<Info class="size-4 text-primary shrink-0" />
						<span class="font-semibold text-foreground"><strong>Catatan:</strong> {activeDetail.header.Remark}</span>
					</div>
				{/if}
			</div>

			<!-- Toggle Tab: Komponen Langsung vs Multi-Level Tree -->
			<div class="flex items-center justify-between border-b-2 border-border pb-2 pt-1">
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (detailTab = 'flat')}
						class="px-4 py-2 rounded-lg border-2 font-black text-xs uppercase tracking-wide cursor-pointer transition-all {detailTab === 'flat' ? 'bg-primary text-primary-foreground border-border brutal-shadow-sm' : 'bg-card text-foreground border-border hover:bg-muted'}"
					>
						1. Komponen Langsung ({activeDetail.details.length} Bahan)
					</button>
					<button
						type="button"
						onclick={() => (detailTab = 'tree')}
						class="px-4 py-2 rounded-lg border-2 font-black text-xs uppercase tracking-wide cursor-pointer transition-all {detailTab === 'tree' ? 'bg-primary text-primary-foreground border-border brutal-shadow-sm' : 'bg-card text-foreground border-border hover:bg-muted'}"
					>
						2. Hierarki Multi-Level BOM Tree ({activeDetail.tree.length} Node)
					</button>
				</div>
			</div>

			<!-- TAB 1: KOMPONEN LANGSUNG (FLAT LIST) -->
			{#if detailTab === 'flat'}
				<div class="space-y-3">
					<!-- Search input within direct components -->
					<div class="flex items-center justify-between gap-3">
						<div class="relative flex-1 max-w-sm">
							<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
							<input
								type="text"
								bind:value={detailComponentQuery}
								placeholder="Cari kode atau nama bahan komponen..."
								class="bg-card text-foreground placeholder:text-muted-foreground border-border h-9 w-full rounded-lg border-2 pl-8 pr-3 text-xs font-bold focus:outline-none"
							/>
							{#if detailComponentQuery}
								<button
									type="button"
									onclick={() => (detailComponentQuery = '')}
									class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								>
									<X class="size-3.5" />
								</button>
							{/if}
						</div>
						<div class="text-xs font-black text-foreground font-mono">
							Menampilkan {filteredDetailComponents.length} dari {activeDetail.details.length} Bahan
						</div>
					</div>

					<div class="border-2 border-border rounded-xl overflow-hidden max-h-96 overflow-y-auto brutal-shadow-xs">
						<Table wrapperClass="border-0 shadow-none rounded-none">
							<TableHeader>
								<TableRow class="bg-muted/70 border-b-2 border-border">
									<TableHead class="w-12 text-center font-black text-foreground">No</TableHead>
									<TableHead class="w-36 font-black text-foreground">Kode Komponen</TableHead>
									<TableHead class="font-black text-foreground">Nama Komponen / Bahan</TableHead>
									<TableHead class="w-32 text-right font-black text-foreground">Kebutuhan Qty</TableHead>
									<TableHead class="w-24 font-black text-foreground">Satuan</TableHead>
									<TableHead class="w-28 font-black text-foreground">Departemen</TableHead>
									<TableHead class="w-28 font-black text-foreground">Jenis</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#if filteredDetailComponents.length === 0}
									<TableEmpty colspan={7} message="Tidak ada komponen yang cocok dengan pencarian." />
								{:else}
									{#each filteredDetailComponents as item, idx}
										<TableRow class="hover:bg-muted/20 border-b border-border/30 text-xs text-foreground">
											<TableCell class="text-center font-mono text-foreground font-black">{idx + 1}</TableCell>
											<TableCell>
												<div class="flex items-center gap-1 font-mono font-black text-foreground">
													<span>{item.ItemID}</span>
													<button
														type="button"
														onclick={() => copyText(item.ItemID, 'Kode Bahan')}
														class="text-foreground/70 hover:text-foreground"
														title="Salin Kode Bahan"
													>
														<Copy class="size-3" />
													</button>
												</div>
											</TableCell>
											<TableCell>
												<div class="font-black text-foreground">{item.ItemName}</div>
												{#if item.Spec}
													<div class="text-[10px] text-muted-foreground font-mono font-semibold">{item.Spec}</div>
												{/if}
											</TableCell>
											<TableCell class="text-right font-mono font-black text-primary text-sm">
												{fmtNum(item.BahanQty)}
											</TableCell>
											<TableCell class="font-mono font-black text-foreground">{item.BahanPackSatuan}</TableCell>
											<TableCell>
												{#if item.Departemen}
													<Badge variant="outline" class="font-mono text-[10px] bg-muted text-foreground border-border">{item.Departemen}</Badge>
												{:else}
													<span class="text-muted-foreground">-</span>
												{/if}
											</TableCell>
											<TableCell class="text-[11px] text-foreground font-bold">
												{item.NamaJenis || '-'}
											</TableCell>
										</TableRow>
									{/each}
								{/if}
							</TableBody>
						</Table>
					</div>
				</div>
			{/if}

			<!-- TAB 2: HIERARKI MULTI-LEVEL (BOM TREE) -->
			{#if detailTab === 'tree'}
				<div class="space-y-3">
					<!-- Tree Summary & Search Filter Bar -->
					<div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border-2 border-border bg-card">
						<!-- Search Tree Input -->
						<div class="relative flex-1 min-w-[200px] max-w-sm">
							<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
							<input
								type="text"
								bind:value={treeSearchQuery}
								placeholder="Cari item pada pohon hierarki..."
								class="bg-card text-foreground placeholder:text-muted-foreground border-border h-9 w-full rounded-lg border-2 pl-8 pr-3 text-xs font-bold focus:outline-none"
							/>
							{#if treeSearchQuery}
								<button
									type="button"
									onclick={() => (treeSearchQuery = '')}
									class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								>
									<X class="size-3.5" />
								</button>
							{/if}
						</div>

						<!-- Tree Level Filter -->
						<div class="flex items-center gap-2">
							<span class="text-xs font-black text-foreground">Filter Level:</span>
							<select
								bind:value={treeLevelFilter}
								class="bg-card text-foreground border-border h-9 rounded-lg border-2 px-2 text-xs font-bold font-mono focus:outline-none"
							>
								<option value="all">Semua Level ({treeStats.totalNodes} Node)</option>
								{#each Array.from({ length: treeStats.maxLevel + 1 }, (_, i) => i) as lv}
									<option value={lv}>Level {lv}</option>
								{/each}
							</select>
						</div>

						<!-- Fast stats pills -->
						<div class="flex items-center gap-2 text-xs font-mono font-bold">
							<span class="px-2 py-1 rounded bg-card text-foreground border border-border">
								Kedalaman: <strong>{treeStats.maxLevel} Level</strong>
							</span>
							<span class="px-2 py-1 rounded bg-blue-100 text-blue-900 border border-blue-400">
								Sub-Assembly: <strong>{treeStats.subAssemblies}</strong>
							</span>
						</div>
					</div>

					<!-- Visual Hierarchical Tree Container -->
					<div class="border-2 border-border rounded-xl p-3 bg-muted/20 max-h-[420px] overflow-y-auto space-y-1.5 font-mono text-xs">
						{#if filteredTreeNodes.length === 0}
							<div class="py-12 text-center text-foreground font-bold border-2 border-dashed border-border/50 rounded-lg">
								Tidak ada simpul hierarki yang cocok dengan filter.
							</div>
						{:else}
							{#each filteredTreeNodes as node}
								<div
									class="relative flex items-center justify-between p-2.5 rounded-lg border-2 transition-colors {node.Level === 0 ? 'bg-primary/20 border-primary font-black shadow-xs' : node.Level === 1 ? 'bg-card border-border font-bold' : 'bg-card border-border/60 font-medium'}"
									style="margin-left: {node.Level * 24}px;"
								>
									<!-- Tree connector indicator -->
									<div class="flex items-center gap-2 overflow-hidden flex-1">
										{#if node.Level > 0}
											<CornerDownRight class="size-3.5 text-foreground shrink-0" />
										{:else}
											<Package class="size-4 text-primary shrink-0" />
										{/if}

										<!-- Badge Level -->
										<span
											class="px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 {node.Level === 0 ? 'bg-primary text-primary-foreground' : node.Level === 1 ? 'bg-blue-100 text-blue-900 border border-blue-400' : 'bg-muted text-foreground border border-border'}"
										>
											Lv {node.Level}
										</span>

										<!-- Kode Barang & Nama -->
										<div class="truncate flex items-center gap-1.5">
											<span class="font-mono text-foreground font-black">{node.ItemID}</span>
											<span class="text-foreground font-sans font-bold text-xs truncate">
												{node.ItemName.trim()}
											</span>
										</div>
									</div>

									<!-- Attributes: Departemen, Sub-Assembly BOM link, Qty -->
									<div class="flex items-center gap-3 shrink-0 ml-3">
										{#if node.Departemen}
											<Badge variant="outline" class="font-mono text-[10px] bg-muted text-foreground border border-border hidden sm:inline-flex">
												{node.Departemen}
											</Badge>
										{/if}

										{#if node.TransID && node.Level > 0}
											<button
												type="button"
												onclick={() => openDetailModal(node.TransID)}
												class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-amber-100 text-amber-900 border border-amber-400 hover:bg-amber-200 cursor-pointer"
												title="Klik untuk membuka BOM Sub-Assembly ini"
											>
												Sub-BOM: {node.TransID}
											</button>
										{/if}

										<div class="text-right min-w-[90px]">
											<div class="font-mono font-black text-primary">
												Qty: {fmtNum(node.Qty)}
											</div>
											{#if node.Level > 1}
												<div class="text-[10px] text-muted-foreground font-mono font-bold">
													Tot: {fmtNum(node.CumulativeQty)}
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}

			<!-- Action Footer Modal -->
			<div class="flex items-center justify-end gap-2 pt-3 border-t-2 border-border/40">
				<Button
					type="button"
					variant="outline"
					onclick={() => (isDetailModalOpen = false)}
					class="border-2 border-border bg-card text-foreground font-black uppercase text-xs px-5 cursor-pointer brutal-shadow-xs"
				>
					Tutup
				</Button>
			</div>
		</div>
	{/if}
</Modal>

<!-- ==================== MODAL TAMBAH / UBAH BOM ==================== -->
<Modal
	bind:open={isFormModalOpen}
	size="2xl"
	title={isEditMode ? `Ubah Master BOM: ${bomForm.TransID}` : 'Tambah Master BOM Baru'}
	subtitle={isEditMode ? 'Perbarui informasi header dan baris komponen bahan' : 'Daftarkan struktur BOM resep material baru ke sistem ERP'}
	icon={Workflow}
>
	<form
		method="post"
		action="?/save"
		use:enhance={() => {
			formSubmitting = true;
			return async ({ update }) => {
				formSubmitting = false;
				await update();
			};
		}}
		class="space-y-4 py-1 text-foreground"
	>
		<input type="hidden" name="isEdit" value={String(isEditMode)} />
		<input type="hidden" name="detailsJson" value={JSON.stringify(bomForm.details)} />

		<!-- Header BOM Inputs Card -->
		<div class="p-4 rounded-xl border-[3px] border-border bg-card brutal-shadow space-y-3">
			<div class="flex items-center justify-between border-b-2 border-border/40 pb-2">
				<h4 class="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
					<Workflow class="size-4 text-primary" />
					<span>Informasi Header Resep BOM</span>
				</h4>
				{#if isEditMode}
					<Badge variant="primary" class="font-mono font-black text-xs">
						MODE EDIT
					</Badge>
				{:else}
					<Badge variant="outline" class="bg-emerald-100 text-emerald-900 font-mono font-black text-xs border border-emerald-400">
						RESEP BARU
					</Badge>
				{/if}
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
				<!-- TransID -->
				<div class="space-y-1.5">
					<Label for="TransID" class="text-xs font-black uppercase text-foreground">Trans ID *</Label>
					<input
						type="text"
						id="TransID"
						name="TransID"
						bind:value={bomForm.TransID}
						readonly={isEditMode}
						required
						maxlength="7"
						class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-black brutal-shadow-sm {isEditMode ? 'bg-muted/50 cursor-not-allowed opacity-80' : ''}"
					/>
				</div>

				<!-- Tanggal Transaksi -->
				<div class="space-y-1.5">
					<Label for="Transdate" class="text-xs font-black uppercase text-foreground">Tanggal Pembuatan *</Label>
					<input
						type="date"
						id="Transdate"
						name="Transdate"
						bind:value={bomForm.Transdate}
						required
						class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- Qty Hasil -->
				<div class="space-y-1.5">
					<Label for="HasilPackQty" class="text-xs font-black uppercase text-foreground">Qty Hasil *</Label>
					<input
						type="number"
						id="HasilPackQty"
						name="HasilPackQty"
						bind:value={bomForm.HasilPackQty}
						min="1"
						required
						class="bg-card text-primary border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-black brutal-shadow-sm"
					/>
				</div>

				<!-- Satuan Hasil -->
				<div class="space-y-1.5">
					<Label for="HasilPackSatuan" class="text-xs font-black uppercase text-foreground">Satuan Hasil *</Label>
					<input
						type="text"
						id="HasilPackSatuan"
						name="HasilPackSatuan"
						bind:value={bomForm.HasilPackSatuan}
						required
						maxlength="10"
						placeholder="PCS / SET"
						class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 font-mono text-sm font-black brutal-shadow-sm uppercase"
					/>
				</div>
			</div>

			<!-- Pemilihan Produk Hasil (Output) -->
			<div class="space-y-1.5 pt-1">
				<Label class="text-xs font-black uppercase text-foreground">Produk Hasil (Output Barang Jadi / WIP) *</Label>
				<input type="hidden" name="ItemID" value={bomForm.ItemID} />

				{#if bomForm.ItemID}
					<!-- Card Produk Terpilih -->
					<div class="p-3 rounded-lg border-2 border-primary/40 bg-primary/10 flex flex-wrap items-center justify-between gap-3">
						<div class="flex items-center gap-2.5">
							<Package class="size-5 text-primary shrink-0" />
							<div>
								<div class="font-mono text-sm font-black text-foreground">{bomForm.ItemID}</div>
								<div class="text-xs text-foreground font-black">{bomForm.ItemName || 'Produk Terdaftar'}</div>
							</div>
						</div>

						<div class="flex items-center gap-2">
							<span class="font-mono text-xs font-black px-2 py-0.5 rounded bg-card text-foreground border border-border">
								Satuan: {bomForm.HasilPackSatuan}
							</span>
							{#if !isEditMode}
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => openItemPicker('product')}
									class="border-2 border-border bg-card text-foreground hover:bg-muted font-black text-xs cursor-pointer"
								>
									Ganti Produk
								</Button>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Tombol Pilih Produk Jika Belum Dipilih -->
					<button
						type="button"
						onclick={() => openItemPicker('product')}
						class="w-full p-4 rounded-lg border-2 border-dashed border-primary/60 bg-primary/5 hover:bg-primary/10 text-primary transition-all flex items-center justify-center gap-2 cursor-pointer font-black text-xs"
					>
						<Search class="size-4 text-primary" />
						<span>Klik untuk Cari & Pilih Produk Hasil (Output)...</span>
					</button>
				{/if}
			</div>

			<!-- Gudang Asal, Gudang Tujuan & Remark -->
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
				<!-- Gudang Asal -->
				<div class="space-y-1.5">
					<Label for="LocIDSource" class="text-xs font-black uppercase text-foreground">Gudang Asal (Source)</Label>
					<select
						id="LocIDSource"
						name="LocIDSource"
						bind:value={bomForm.LocIDSource}
						class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 text-xs sm:text-sm font-bold brutal-shadow-sm font-mono"
					>
						{#each data.locations as loc}
							<option value={loc.LocID}>[{loc.LocID}] {loc.LocName}</option>
						{/each}
					</select>
				</div>

				<!-- Gudang Tujuan -->
				<div class="space-y-1.5">
					<Label for="LocID" class="text-xs font-black uppercase text-foreground">Gudang Tujuan (Dest)</Label>
					<select
						id="LocID"
						name="LocID"
						bind:value={bomForm.LocID}
						class="bg-card text-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 text-xs sm:text-sm font-bold brutal-shadow-sm font-mono"
					>
						{#each data.locations as loc}
							<option value={loc.LocID}>[{loc.LocID}] {loc.LocName}</option>
						{/each}
					</select>
				</div>

				<!-- Catatan / Remark -->
				<div class="space-y-1.5">
					<Label for="Remark" class="text-xs font-black uppercase text-foreground">Catatan / Keterangan</Label>
					<input
						type="text"
						id="Remark"
						name="Remark"
						bind:value={bomForm.Remark}
						maxlength="50"
						placeholder="Contoh: Revisi formula 2026"
						class="bg-card text-foreground placeholder:text-muted-foreground border-border h-10 w-full rounded-lg border-[3px] px-3 text-xs sm:text-sm font-bold brutal-shadow-sm"
					/>
				</div>
			</div>
		</div>

		<!-- Tabel Dynamic Baris Komponen Bahan -->
		<div class="space-y-3 pt-2">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h4 class="text-sm font-black uppercase text-foreground flex items-center gap-1.5">
					<Layers class="size-4 text-primary" />
					<span>Daftar Komponen / Resep Material ({bomForm.details.length} Baris)</span>
				</h4>
				<div class="flex items-center gap-1.5">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={addDetailRow}
						class="border-2 border-border bg-card text-foreground hover:bg-muted font-black uppercase text-xs cursor-pointer brutal-shadow-xs"
					>
						<Plus class="size-3.5 mr-1" />
						Tambah Baris
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => addMultipleDetailRows(5)}
						class="border-2 border-border bg-card text-foreground hover:bg-muted font-black uppercase text-xs cursor-pointer brutal-shadow-xs hidden sm:inline-flex"
					>
						+5 Baris
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={clearDetailRows}
						class="border-2 border-border bg-card text-foreground hover:bg-destructive/10 font-black uppercase text-xs cursor-pointer text-destructive brutal-shadow-xs"
						title="Reset kembali ke 1 baris"
					>
						Reset Baris
					</Button>
				</div>
			</div>

			<div class="border-2 border-border rounded-xl overflow-hidden max-h-80 overflow-y-auto brutal-shadow-xs">
				<Table wrapperClass="border-0 shadow-none rounded-none">
					<TableHeader>
						<TableRow class="bg-muted/70 border-b-2 border-border text-xs">
							<TableHead class="w-12 text-center font-black text-foreground">No</TableHead>
							<TableHead class="w-64 font-black text-foreground">Kode Bahan (ItemID) *</TableHead>
							<TableHead class="font-black text-foreground">Nama Bahan</TableHead>
							<TableHead class="w-32 font-black text-foreground">Kebutuhan Qty *</TableHead>
							<TableHead class="w-24 font-black text-foreground">Satuan *</TableHead>
							<TableHead class="w-20 text-center font-black text-foreground">Aksi</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each bomForm.details as dt, idx}
							<TableRow class="hover:bg-muted/10 border-b border-border/30 text-xs text-foreground">
								<TableCell class="text-center font-mono font-black text-foreground">{idx + 1}</TableCell>

								<!-- Input ItemID Bahan dengan Tombol Picker Modal -->
								<TableCell>
									<div class="flex items-center gap-1">
										<input
											type="text"
											bind:value={dt.ItemID}
											placeholder="Kode bahan..."
											required
											class="bg-card text-foreground border-border h-9 w-full rounded border-2 px-2.5 font-mono text-xs font-black uppercase"
										/>
										<button
											type="button"
											onclick={() => openItemPicker('detail', idx)}
											class="h-9 px-2.5 rounded border-2 border-border bg-card text-foreground hover:bg-muted font-black text-xs cursor-pointer shrink-0"
											title="Cari barang dari katalog taGoods"
										>
											<Search class="size-3.5 text-foreground" />
										</button>
									</div>
								</TableCell>

								<!-- Nama Bahan (Display) -->
								<TableCell>
									<span class="font-black text-foreground line-clamp-1">{dt.ItemName || '-'}</span>
								</TableCell>

								<!-- Kebutuhan Qty -->
								<TableCell>
									<input
										type="number"
										step="0.0001"
										bind:value={dt.BahanQty}
										required
										min="0.0001"
										class="bg-card text-primary border-border h-9 w-full rounded border-2 px-2.5 font-mono text-xs font-black text-right"
									/>
								</TableCell>

								<!-- Satuan -->
								<TableCell>
									<input
										type="text"
										bind:value={dt.BahanPackSatuan}
										required
										maxlength="10"
										placeholder="PCS / KG"
										class="bg-card text-foreground border-border h-9 w-full rounded border-2 px-2 font-mono text-xs font-black uppercase"
									/>
								</TableCell>

								<!-- Aksi Baris (Duplicate & Hapus) -->
								<TableCell class="text-center">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											onclick={() => duplicateDetailRow(idx)}
											class="p-1.5 rounded text-foreground hover:bg-muted cursor-pointer"
											title="Duplikasi baris ini"
										>
											<Copy class="size-3.5 text-foreground" />
										</button>
										<button
											type="button"
											onclick={() => removeDetailRow(idx)}
											class="p-1.5 rounded text-destructive hover:bg-destructive/10 cursor-pointer"
											title="Hapus baris ini"
										>
											<Trash2 class="size-3.5 text-destructive" />
										</button>
									</div>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>

			{#if formValidationError}
				<div class="p-2.5 rounded-lg border-2 border-destructive/40 bg-destructive/10 text-xs font-black text-destructive flex items-center gap-2">
					<Info class="size-4 shrink-0" />
					<span>{formValidationError}</span>
				</div>
			{/if}
		</div>

		<!-- Action Footer: Batal & Simpan -->
		<div class="flex items-center justify-end gap-2 pt-4 border-t-2 border-border/40 mt-4 sticky bottom-0 bg-card py-2 z-10">
			<Button
				type="button"
				variant="outline"
				onclick={() => (isFormModalOpen = false)}
				class="h-10 border-[3px] border-border bg-card text-foreground font-black uppercase brutal-shadow-sm text-xs px-4 cursor-pointer"
			>
				Batal
			</Button>
			<Button
				type="submit"
				variant="primary"
				disabled={formSubmitting || !!formValidationError}
				class="h-10 border-[3px] border-border font-black uppercase brutal-shadow-sm text-xs px-6 cursor-pointer disabled:opacity-50"
			>
				{formSubmitting ? 'Menyimpan...' : isEditMode ? 'Perbarui BOM' : 'Simpan Master BOM'}
			</Button>
		</div>
	</form>
</Modal>

<!-- ==================== MODAL UNIVERSAL ITEM PICKER ==================== -->
<Modal
	bind:open={itemPickerOpen}
	title={itemPickerTarget === 'product' ? 'PILIH PRODUK HASIL (OUTPUT)' : `PILIH BAHAN BAKU / KOMPONEN BARIS #${(itemPickerRowIndex ?? 0) + 1}`}
	subtitle="Cari kode atau nama barang dari master data taGoods"
	icon={Package}
	size="xl"
>
	<div class="space-y-4 py-1 text-foreground">
		<SearchInput
			bind:value={itemPickerQuery}
			placeholder="Ketik kode barang atau nama barang..."
			loading={itemPickerLoading}
			debounceMs={300}
			onsearch={searchPickerItems}
			autofocus
		/>

		<div class="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
			{#if itemPickerResults.length === 0}
				<div class="py-10 text-center font-mono text-xs text-foreground font-bold border-2 border-dashed border-border/50 rounded-lg p-6">
					{#if itemPickerQuery.trim().length < 2}
						Ketik minimal 2 karakter untuk mencari barang...
					{:else}
						Tidak ada barang yang cocok dengan kata kunci "{itemPickerQuery}".
					{/if}
				</div>
			{:else}
				{#each itemPickerResults as item}
					<button
						type="button"
						onclick={() => selectPickerItem(item)}
						class="flex w-full items-center justify-between border-2 border-border bg-card text-foreground p-3 text-left rounded-lg brutal-shadow-xs hover:bg-primary/10 transition-colors cursor-pointer"
					>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="font-mono text-xs sm:text-sm font-black text-foreground">#{item.ItemID}</span>
								<Badge variant="outline" class="font-mono text-[10px] border border-border bg-card text-foreground">
									{item.Satuan || 'PCS'}
								</Badge>
								{#if item.Departemen}
									<Badge variant="outline" class="font-mono text-[10px] bg-muted text-foreground border border-border">
										{item.Departemen}
									</Badge>
								{/if}
							</div>
							<div class="mt-1 font-black text-xs text-foreground truncate">
								{item.ItemName}
							</div>
						</div>
						<div class="shrink-0 ml-3">
							<span class="text-xs font-black uppercase text-primary border-2 border-primary/40 px-2.5 py-1 rounded bg-primary/10">
								Pilih
							</span>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</div>
</Modal>

<!-- ==================== MODAL KONFIRMASI HAPUS BOM ==================== -->
<Modal
	bind:open={isDeleteModalOpen}
	size="sm"
	title="Konfirmasi Hapus BOM"
	subtitle="Tindakan ini akan menghapus formula resep produksi"
	icon={Trash2}
>
	{#if bomToDelete}
		<form
			method="post"
			action="?/delete"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4 py-1 text-foreground"
		>
			<input type="hidden" name="transId" value={bomToDelete.TransID} />

			<div class="p-4 rounded-xl border-2 border-destructive/40 bg-destructive/10 space-y-2">
				<p class="text-sm font-black text-destructive">
					Hapus Master BOM <span class="font-mono underline">{bomToDelete.TransID}</span>?
				</p>
				<p class="text-xs text-foreground font-semibold">
					Produk: <span class="font-mono font-black text-foreground">{bomToDelete.ItemID}</span> ({bomToDelete.ItemName}).
					Seluruh susunan bahan baku pada resep ini akan dihapus permanen.
				</p>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2 border-t-2 border-border/30">
				<Button
					type="button"
					variant="outline"
					onclick={() => (isDeleteModalOpen = false)}
					class="border-2 border-border bg-card text-foreground font-black uppercase text-xs px-4 cursor-pointer"
				>
					Batal
				</Button>
				<Button
					type="submit"
					variant="error"
					class="border-[3px] border-border font-black uppercase text-xs px-5 cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
				>
					Ya, Hapus BOM
				</Button>
			</div>
		</form>
	{/if}
</Modal>
