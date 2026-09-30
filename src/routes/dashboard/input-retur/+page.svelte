<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		RotateCcw,
		Plus,
		Trash2,
		RefreshCw,
		Search,
		CheckCircle2,
		AlertCircle,
		Boxes,
		PackageCheck,
		FileText,
		Layers,
		FileSpreadsheet,
		Download,
		Upload,
		Copy
	} from '@lucide/svelte';
	import { Modal, Alert, SearchInput, FileUploadZone, toast } from '$lib/components';

	let { data, form } = $props();

	// Inisialisasi awal (mendukung SSR saat membuka langsung /dashboard/input-retur?id=...)
	let initTx = untrack(() => data.initialEditData);
	let isEditMode = $state(Boolean(initTx));

	// State Header Retur
	let moveId = $state(initTx?.header?.moveId || untrack(() => data.nextMoveId) || '');
	let moveDate = $state(
		initTx?.header?.moveDate || untrack(() => data.defaultDate) || new Date().toISOString().slice(0, 10)
	);
	let locId = $state(initTx?.header?.locId || untrack(() => data.warehouses?.[0]?.LocID) || 'GUDIN');
	let noRator = $state<number | null>(initTx?.header?.noRator ?? null);
	let remark = $state(initTx?.header?.remark || 'RETUR DARI AREA PRODUKSI');
	let docId = $state(initTx?.header?.docId || '');

	// State Detail Items
	interface DetailRow {
		id: string;
		itemId: string;
		itemName: string;
		satuan: string;
		bags: number;
		kgs: number;
		hppPrice: number;
		notes: string;
	}

	let rows = $state<DetailRow[]>(
		initTx?.items && initTx.items.length > 0
			? initTx.items.map((d: any) => ({
					id: crypto.randomUUID(),
					itemId: d.itemId,
					itemName: d.itemName,
					satuan: d.satuan || 'Pcs',
					bags: Math.max(0, parseInt(String(d.bags ?? 0), 10) || 0),
					kgs: Math.max(0, parseInt(String(d.kgs ?? 0), 10) || 0),
					hppPrice: Number(d.hppPrice) || 0,
					notes: d.notes || ''
				}))
			: [
					{
						id: crypto.randomUUID(),
						itemId: '',
						itemName: '',
						satuan: 'Pcs',
						bags: 0,
						kgs: 0,
						hppPrice: 0,
						notes: ''
					}
				]
	);

	function applyTransactionData(txData: any) {
		if (!txData || !txData.header) return;
		isEditMode = true;
		moveId = String(txData.header.moveId || '').trim();
		moveDate = txData.header.moveDate || new Date().toISOString().slice(0, 10);
		locId = String(txData.header.locId || '').trim() || (data.warehouses?.[0]?.LocID ?? 'GUDIN');
		noRator = txData.header.noRator != null ? Number(txData.header.noRator) : null;
		remark = txData.header.remark || '';
		docId = txData.header.docId || '';

		if (txData.items && txData.items.length > 0) {
			rows = txData.items.map((it: any) => ({
				id: crypto.randomUUID(),
				itemId: String(it.itemId || '').trim(),
				itemName: String(it.itemName || it.itemId || '').trim(),
				satuan: String(it.satuan || 'Pcs').trim(),
				bags: Math.max(0, parseInt(String(it.bags || 0), 10) || 0),
				kgs: Math.max(0, parseInt(String(it.kgs || 0), 10) || 0),
				hppPrice: Number(it.hppPrice) || 0,
				notes: it.notes ? String(it.notes) : ''
			}));
		} else {
			rows = [
				{
					id: crypto.randomUUID(),
					itemId: '',
					itemName: '',
					satuan: 'Pcs',
					bags: 0,
					kgs: 0,
					hppPrice: 0,
					notes: ''
				}
			];
		}
	}

	$effect(() => {
		if (data.initialEditData) {
			untrack(() => {
				applyTransactionData(data.initialEditData);
			});
		}
	});

	// Hitung Ringkasan
	let totalItems = $derived(rows.filter((r) => r.itemId.trim()).length);
	let totalBags = $derived(rows.reduce((acc, r) => acc + (Number(r.bags) || 0), 0));
	let totalKgs = $derived(rows.reduce((acc, r) => acc + (Number(r.kgs) || 0), 0));

	// Update Next MoveID saat tanggal berubah
	async function updateNextId(date: string) {
		if (isEditMode) return;
		try {
			const res = await fetch(`/api/retur/next-id?date=${encodeURIComponent(date)}`);
			const json = await res.json();
			if (json.nextMoveId) {
				moveId = json.nextMoveId;
			}
		} catch (e) {
			console.error('Gagal mengambil next MoveID Retur', e);
		}
	}

	// ==================== BARANG LOOKUP STATE & MODAL ====================
	let isGoodsModalOpen = $state(false);
	let goodsSearchQuery = $state('');
	let goodsSearchResults = $state<any[]>([]);
	let isSearchingGoods = $state(false);
	let activeRowTargetId = $state<string | null>(null);
	let goodsSearchDebounce: ReturnType<typeof setTimeout> | undefined;

	function openGoodsSearchModal(rowId: string) {
		activeRowTargetId = rowId;
		goodsSearchQuery = '';
		goodsSearchResults = [];
		isGoodsModalOpen = true;
	}

	function handleGoodsSearchInput(e: Event) {
		clearTimeout(goodsSearchDebounce);
		const val = (e.target as HTMLInputElement).value;
		goodsSearchQuery = val;
		if (!val.trim()) {
			goodsSearchResults = [];
			return;
		}
		goodsSearchDebounce = setTimeout(async () => {
			isSearchingGoods = true;
			try {
				const res = await fetch(`/api/production/search-items?q=${encodeURIComponent(val)}`);
				const json = await res.json();
				goodsSearchResults = json.items || [];
			} catch (err) {
				console.error(err);
			} finally {
				isSearchingGoods = false;
			}
		}, 300);
	}

	function selectGoodsItem(item: any) {
		if (!activeRowTargetId) return;
		const targetRow = rows.find((r) => r.id === activeRowTargetId);
		if (targetRow) {
			targetRow.itemId = item.ItemID;
			targetRow.itemName = item.ItemName;
			targetRow.satuan = item.Satuan || 'Pcs';
			if (item.HPPPrice) {
				targetRow.hppPrice = Number(item.HPPPrice) || 0;
			}
		}
		isGoodsModalOpen = false;
	}

	// Direct ItemID validation via Tab/Blur
	async function handleItemIdBlur(row: DetailRow) {
		const val = row.itemId.trim();
		if (!val) {
			row.itemName = '';
			return;
		}
		try {
			const res = await fetch(`/api/production/search-items?q=${encodeURIComponent(val)}`);
			const json = await res.json();
			const items: any[] = json.items || [];
			const exact = items.find((i) => i.ItemID.toUpperCase() === val.toUpperCase());
			if (exact) {
				row.itemId = exact.ItemID;
				row.itemName = exact.ItemName;
				row.satuan = exact.Satuan || 'Pcs';
				if (exact.HPPPrice) {
					row.hppPrice = Number(exact.HPPPrice) || 0;
				}
			} else if (items.length > 0) {
				row.itemId = items[0].ItemID;
				row.itemName = items[0].ItemName;
				row.satuan = items[0].Satuan || 'Pcs';
				if (items[0].HPPPrice) {
					row.hppPrice = Number(items[0].HPPPrice) || 0;
				}
			}
		} catch (e) {
			console.error(e);
		}
	}

	// Manipulasi Baris
	function addRow() {
		rows.push({
			id: crypto.randomUUID(),
			itemId: '',
			itemName: '',
			satuan: 'Pcs',
			bags: 0,
			kgs: 0,
			hppPrice: 0,
			notes: ''
		});
	}

	function duplicateRow(idx: number) {
		const src = rows[idx];
		if (!src) return;
		rows.splice(idx + 1, 0, {
			id: crypto.randomUUID(),
			itemId: src.itemId,
			itemName: src.itemName,
			satuan: src.satuan,
			bags: src.bags,
			kgs: src.kgs,
			hppPrice: src.hppPrice,
			notes: src.notes
		});
	}

	function removeRow(idx: number) {
		if (rows.length === 1) {
			rows[0] = {
				id: crypto.randomUUID(),
				itemId: '',
				itemName: '',
				satuan: 'Pcs',
				bags: 0,
				kgs: 0,
				hppPrice: 0,
				notes: ''
			};
		} else {
			rows.splice(idx, 1);
		}
	}

	// ==================== BUKA / CARI TRANSAKSI MODAL ====================
	let isLoadModalOpen = $state(false);
	let loadSearchQuery = $state('');
	let isSearchingTransactions = $state(false);
	let searchTransactionsResult = $state<any[]>(untrack(() => data.recentTransactions) || []);
	let searchTxDebounce: ReturnType<typeof setTimeout> | undefined;

	function openLoadModal() {
		loadSearchQuery = '';
		searchTransactionsResult = data.recentTransactions || [];
		isLoadModalOpen = true;
	}

	async function performTxSearch(val: string) {
		loadSearchQuery = val;
		if (!val.trim()) {
			searchTransactionsResult = data.recentTransactions || [];
			return;
		}
		isSearchingTransactions = true;
		try {
			const res = await fetch(`/api/retur/search-transactions?q=${encodeURIComponent(val)}`);
			const json = await res.json();
			searchTransactionsResult = json.transactions || [];
		} catch (err) {
			console.error(err);
		} finally {
			isSearchingTransactions = false;
		}
	}

	function handleSearchTxInput(e: Event) {
		clearTimeout(searchTxDebounce);
		const val = (e.target as HTMLInputElement).value;
		loadSearchQuery = val;
		searchTxDebounce = setTimeout(() => {
			performTxSearch(val);
		}, 300);
	}

	async function loadExistingTransaction(tx: any) {
		try {
			const res = await fetch(`/api/retur/get-transaction?id=${encodeURIComponent(tx.moveId)}`);
			const json = await res.json();
			if (!res.ok || !json.data) {
				const errMsg = json.error || 'Gagal memuat transaksi Retur';
				toast.error(errMsg);
				return;
			}

			const txData = json.data;
			applyTransactionData(txData);

			if (typeof history !== 'undefined') {
				history.pushState({}, '', `/dashboard/input-retur?id=${encodeURIComponent(txData.header.moveId)}`);
			}

			isLoadModalOpen = false;
			toast.info(`Transaksi Retur #${txData.header.moveId} berhasil dimuat.`, {
				title: 'Mode Edit Aktif'
			});
		} catch (e: any) {
			toast.error('Terjadi kesalahan saat memuat transaksi: ' + e?.message);
		}
	}

	function resetFormToNew() {
		isEditMode = false;
		moveDate = data.defaultDate || new Date().toISOString().slice(0, 10);
		locId = data.warehouses?.[0]?.LocID || 'GUDIN';
		noRator = null;
		remark = 'RETUR DARI AREA PRODUKSI';
		docId = '';
		rows = [
			{
				id: crypto.randomUUID(),
				itemId: '',
				itemName: '',
				satuan: 'Pcs',
				bags: 0,
				kgs: 0,
				hppPrice: 0,
				notes: ''
			}
		];
		updateNextId(moveDate);
		if (typeof history !== 'undefined') {
			history.pushState({}, '', '/dashboard/input-retur');
		}
		toast.info('Formulir direset ke mode transaksi baru.');
	}

	// ==================== MODAL IMPORT EXCEL STATE & LOGIC ====================
	let isImportModalOpen = $state(false);
	let isUploadingImport = $state(false);
	let importError = $state('');
	let importSuccessMessage = $state('');
	let parsedImportData = $state<any>(null);

	let hasInvalidItems = $derived(Boolean(parsedImportData && parsedImportData.summary?.invalidCount > 0));
	let isLocInvalid = $derived(Boolean(parsedImportData && parsedImportData.header?.isLocValid === false));
	let canApplyImport = $derived(
		Boolean(
			parsedImportData &&
			parsedImportData.items &&
			parsedImportData.items.length > 0 &&
			!hasInvalidItems &&
			!isLocInvalid
		)
	);

	function openImportModal() {
		importError = '';
		parsedImportData = null;
		isImportModalOpen = true;
	}

	function closeImportModal() {
		isImportModalOpen = false;
	}

	async function handleUploadFile(file: File) {
		importError = '';
		parsedImportData = null;
		isUploadingImport = true;

		try {
			const fd = new FormData();
			fd.append('file', file);

			const res = await fetch('/api/retur/import', {
				method: 'POST',
				body: fd
			});

			const json = await res.json();
			if (!res.ok || json.error) {
				importError = json.error || 'Gagal membaca file Excel Retur.';
				toast.error(importError);
			} else {
				parsedImportData = json.data;
				toast.info(`Berhasil membaca file ${json.data?.fileName || 'Excel'}. Periksa preview.`);
			}
		} catch (err: any) {
			importError = err?.message || 'Terjadi kesalahan saat mengunggah file Excel.';
			toast.error(importError);
		} finally {
			isUploadingImport = false;
		}
	}

	function applyImportToForm() {
		if (!parsedImportData || !canApplyImport) return;

		if (parsedImportData.items && parsedImportData.items.length > 0) {
			rows = parsedImportData.items.map((item: any) => ({
				id: crypto.randomUUID(),
				itemId: item.itemId || '',
				itemName: item.itemName || '',
				satuan: item.satuan || 'Pcs',
				bags: Math.max(0, parseInt(String(item.bags || 0), 10) || 0),
				kgs: Math.max(0, parseInt(String(item.kgs || 0), 10) || 0),
				hppPrice: Number(item.hppPrice) || 0,
				notes: item.notes || ''
			}));
		}

		const h = parsedImportData.header;
		if (h) {
			if (h.moveDate) {
				moveDate = h.moveDate;
				updateNextId(h.moveDate);
			}
			if (h.locId) locId = h.locId;
			if (h.noRator != null) noRator = parseInt(String(h.noRator), 10) || null;
			if (h.remark) remark = h.remark;
		}

		importSuccessMessage = `Berhasil menerapkan ${parsedImportData.summary?.totalRows || 0} baris barang dari file Excel.`;
		toast.success(importSuccessMessage, { title: 'Import Excel Selesai' });
		closeImportModal();
	}

	// ==================== INTEGER INPUT HELPERS ====================
	function preventNonDigits(e: KeyboardEvent) {
		const allowedKeys = [
			'Backspace',
			'Delete',
			'Tab',
			'Escape',
			'Enter',
			'ArrowLeft',
			'ArrowRight',
			'ArrowUp',
			'ArrowDown',
			'Home',
			'End'
		];
		if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
			return;
		}
		if (!/^[0-9]$/.test(e.key)) {
			e.preventDefault();
		}
	}

	function handlePasteDigitsOnly(e: ClipboardEvent) {
		e.preventDefault();
		const text = e.clipboardData?.getData('text') || '';
		const clean = text.replace(/\D/g, '');
		if (clean) {
			const target = e.currentTarget as HTMLInputElement;
			const start = target.selectionStart ?? target.value.length;
			const end = target.selectionEnd ?? target.value.length;
			const val = target.value;
			target.value = val.substring(0, start) + clean + val.substring(end);
			target.setSelectionRange(start + clean.length, start + clean.length);
			target.dispatchEvent(new Event('input', { bubbles: true }));
		}
	}

	function handleIntegerInput(e: Event, onUpdate: (val: number) => void) {
		const target = e.currentTarget as HTMLInputElement;
		let clean = target.value.replace(/\D/g, '');
		if (clean.length > 1 && clean.startsWith('0')) {
			clean = clean.replace(/^0+/, '') || '0';
		}
		target.value = clean;
		const num = clean === '' ? 0 : parseInt(clean, 10);
		onUpdate(num);
	}

	function handleIntegerBlur(e: Event, onUpdate: (val: number) => void) {
		const target = e.currentTarget as HTMLInputElement;
		const clean = target.value.replace(/\D/g, '');
		const num = clean === '' ? 0 : parseInt(clean, 10);
		target.value = String(num);
		onUpdate(num);
	}

	// Modal Hapus State
	let isDeleteModalOpen = $state(false);
	let isDeleting = $state(false);

	// Payload JSON untuk dikirim ke actions.save
	let payloadJson = $derived(
		JSON.stringify({
			moveId: moveId.trim(),
			moveDate,
			locId: locId.trim(),
			noRator: noRator !== null && noRator !== undefined ? Number(noRator) : null,
			remark: remark.trim(),
			docId: docId.trim() || null,
			details: rows
				.filter((r) => r.itemId.trim())
				.map((r) => ({
					itemId: r.itemId.trim(),
					itemName: r.itemName,
					satuan: r.satuan,
					bags: Math.max(0, parseInt(String(r.bags || 0), 10) || 0),
					kgs: Math.max(0, parseInt(String(r.kgs || 0), 10) || 0),
					price: Number(r.hppPrice) > 0 ? Number(r.hppPrice) : 1,
					hppPrice: Number(r.hppPrice) || 0,
					notes: r.notes ? r.notes.trim() : ''
				}))
		})
	);

	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Input Retur (Pengembalian Bahan) - KIW ERP</title>
</svelte:head>

<div class="space-y-6 pb-16">
	<!-- HEADER UTAMA NEO-BRUTALIST -->
	<div class="bg-card border-border flex flex-col justify-between gap-4 rounded-xl border-[3px] p-6 brutal-shadow md:flex-row md:items-center">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<span class="bg-primary text-primary-foreground border-border inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-0.5 font-mono text-xs font-black uppercase tracking-wider">
					<RotateCcw class="h-3.5 w-3.5" />
					Retur Produksi
				</span>
				{#if isEditMode}
					<span class="bg-amber-400 text-black border-border inline-flex items-center gap-1 rounded-lg border-2 px-2.5 py-0.5 font-mono text-xs font-black uppercase tracking-wider">
						Mode Edit
					</span>
				{:else}
					<span class="bg-emerald-400 text-black border-border inline-flex items-center gap-1 rounded-lg border-2 px-2.5 py-0.5 font-mono text-xs font-black uppercase tracking-wider">
						Mode Baru
					</span>
				{/if}
			</div>
			<h1 class="text-2xl font-black tracking-tight uppercase md:text-3xl">Input Retur (Pengembalian Bahan)</h1>
			<p class="text-muted-foreground text-sm font-medium">
				Pencatatan pengembalian bahan dari lini produksi ke gudang (MoveType K) secara real-time.
			</p>
		</div>

		<!-- Tombol Aksi Cepat Header -->
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={openLoadModal}
				class="bg-card hover:bg-muted border-border inline-flex items-center gap-2 rounded-xl border-[3px] px-3.5 py-2 text-xs font-black uppercase transition-transform active:translate-x-0.5 active:translate-y-0.5 brutal-shadow-sm cursor-pointer"
			>
				<Search class="h-4 w-4" />
				Cari Retur
			</button>

			<a
				href="/api/retur/template"
				download
				class="bg-card hover:bg-muted border-border inline-flex items-center gap-2 rounded-xl border-[3px] px-3.5 py-2 text-xs font-black uppercase transition-transform active:translate-x-0.5 active:translate-y-0.5 brutal-shadow-sm cursor-pointer"
			>
				<Download class="h-4 w-4" />
				Unduh Template
			</a>

			<button
				type="button"
				onclick={openImportModal}
				class="bg-blue-400 hover:bg-blue-500 text-black border-border inline-flex items-center gap-2 rounded-xl border-[3px] px-3.5 py-2 text-xs font-black uppercase transition-transform active:translate-x-0.5 active:translate-y-0.5 brutal-shadow-sm cursor-pointer"
			>
				<Upload class="h-4 w-4" />
				Import Excel
			</button>

			{#if isEditMode}
				<button
					type="button"
					onclick={resetFormToNew}
					class="bg-card hover:bg-muted border-border inline-flex items-center gap-2 rounded-xl border-[3px] px-3.5 py-2 text-xs font-black uppercase transition-transform active:translate-x-0.5 active:translate-y-0.5 brutal-shadow-sm cursor-pointer"
				>
					<Plus class="h-4 w-4" />
					Transaksi Baru
				</button>
			{/if}
		</div>
	</div>

	<!-- ALERT FEEDBACK (Success / Error / Import / Load) -->
	{#if data.loadError}
		<Alert variant="error" title="Gagal Memuat Bukti Retur" message={data.loadError} />
	{/if}

	{#if form && !form.success && form.message}
		<Alert variant="error" title="Gagal Menyimpan Transaksi" message={form.message} />
	{/if}

	{#if form?.message && form?.success}
		<Alert variant="success" title="Transaksi Berhasil" message={form.message} />
	{/if}

	{#if importSuccessMessage}
		<Alert
			variant="info"
			title="Excel Berhasil Diterapkan"
			message={importSuccessMessage}
			dismissible
			ondismiss={() => (importSuccessMessage = '')}
		/>
	{/if}

	<!-- SUMMARY STATS CARDS (Persis seperti LBK: 3 kolom) -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="bg-card border-border flex items-center justify-between rounded-xl border-[3px] p-4 brutal-shadow-sm">
			<div class="space-y-0.5">
				<span class="text-muted-foreground text-xs font-bold uppercase tracking-wider">Total Item Barang</span>
				<p class="text-2xl font-black">{totalItems} <span class="text-xs font-semibold text-muted-foreground">Barang</span></p>
			</div>
			<div class="bg-primary/20 border-border rounded-xl border-2 p-2.5">
				<Boxes class="h-6 w-6" />
			</div>
		</div>

		<div class="bg-card border-border flex items-center justify-between rounded-xl border-[3px] p-4 brutal-shadow-sm">
			<div class="space-y-0.5">
				<span class="text-muted-foreground text-xs font-bold uppercase tracking-wider">Total Bags / Zak</span>
				<p class="text-2xl font-black">{totalBags.toLocaleString('id-ID')} <span class="text-xs font-semibold text-muted-foreground">Bags</span></p>
			</div>
			<div class="bg-amber-400/20 border-border rounded-xl border-2 p-2.5">
				<PackageCheck class="h-6 w-6 text-amber-700" />
			</div>
		</div>

		<div class="bg-card border-border flex items-center justify-between rounded-xl border-[3px] p-4 brutal-shadow-sm">
			<div class="space-y-0.5">
				<span class="text-muted-foreground text-xs font-bold uppercase tracking-wider">Total Berat (Kgs)</span>
				<p class="text-2xl font-black text-emerald-600">{totalKgs.toLocaleString('id-ID')} <span class="text-xs font-semibold text-muted-foreground">Kg</span></p>
			</div>
			<div class="bg-emerald-400/20 border-border rounded-xl border-2 p-2.5">
				<Layers class="h-6 w-6 text-emerald-700" />
			</div>
		</div>
	</div>

	<!-- FORM FORMULIR RETUR UTAMA -->
	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ result, update }) => {
				await update();
				isSubmitting = false;
				if (result.type === 'success') {
					const resData = result.data as any;
					if (resData?.message) {
						toast.success(resData.message, {
							title: isEditMode ? 'Retur Diperbarui' : 'Retur Tersimpan',
							action: resData.moveId
								? { label: 'Buka Retur', href: `/dashboard/input-retur?id=${encodeURIComponent(resData.moveId)}` }
								: undefined
						});
					}
					if (!isEditMode && resData?.moveId) {
						if (typeof history !== 'undefined') {
							history.pushState({}, '', `/dashboard/input-retur?id=${encodeURIComponent(resData.moveId)}`);
						}
						isEditMode = true;
					}
				} else if (result.type === 'failure') {
					const resData = result.data as any;
					toast.error(resData?.message || resData?.error || 'Gagal menyimpan transaksi Retur', { title: 'Gagal Menyimpan' });
				} else if (result.type === 'error') {
					toast.error('Terjadi kesalahan pada server saat memproses Retur.', { title: 'Kesalahan Sistem' });
				}
			};
		}}
		class="space-y-6"
	>
		<!-- Input Payload Tersembunyi -->
		<input type="hidden" name="payload" value={payloadJson} />
		<input type="hidden" name="isEdit" value={isEditMode ? 'true' : 'false'} />

		<!-- SECTION 1: HEADER TRANSAKSI -->
		<div class="bg-card border-border rounded-xl border-[3px] p-6 brutal-shadow">
			<h2 class="mb-4 flex items-center gap-2 text-base font-black uppercase tracking-wider">
				<FileText class="h-4 w-4" />
				Informasi Header Bukti Retur
			</h2>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Nomor Transaksi Retur (MoveID) -->
				<div class="space-y-1.5">
					<div class="flex items-center justify-between">
						<label for="moveId" class="text-xs font-black uppercase tracking-wider">
							No. Bukti (MoveID) <span class="text-red-500">*</span>
						</label>
						<span class="bg-primary/20 border-border inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-black uppercase">
							Otomatis
						</span>
					</div>
					<div class="relative">
						<input
							type="text"
							id="moveId"
							value={moveId}
							readonly
							tabindex="-1"
							placeholder="2600001"
							class="bg-muted text-foreground border-border h-11 w-full rounded-xl border-[3px] px-3 font-mono text-sm font-black uppercase cursor-not-allowed select-none brutal-shadow-sm opacity-90 focus:outline-none"
						/>
					</div>
				</div>

				<!-- Tanggal Transaksi -->
				<div class="space-y-1.5">
					<label for="moveDate" class="text-xs font-black uppercase tracking-wider">
						Tanggal <span class="text-red-500">*</span>
					</label>
					<div class="relative">
						<input
							type="date"
							id="moveDate"
							bind:value={moveDate}
							onchange={() => updateNextId(moveDate)}
							required
							class="bg-background border-border focus:ring-primary h-11 w-full rounded-xl border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
						/>
					</div>
				</div>

				<!-- Gudang Penerima Retur -->
				<div class="space-y-1.5">
					<label for="locId" class="text-xs font-black uppercase tracking-wider">
						Gudang <span class="text-red-500">*</span>
					</label>
					<select
						id="locId"
						bind:value={locId}
						required
						class="bg-background border-border focus:ring-primary h-11 w-full rounded-xl border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					>
						{#each data.warehouses as w}
							<option value={w.LocID}>{w.LocID} - {w.LocName}</option>
						{/each}
					</select>
				</div>

				<!-- No. Rator (Integer Only) -->
				<div class="space-y-1.5">
					<label for="noRator" class="text-xs font-black uppercase tracking-wider">
						No. Rator (Angka Bulat)
					</label>
					<input
						type="text"
						inputmode="numeric"
						id="noRator"
						value={noRator ?? ''}
						onkeydown={preventNonDigits}
						onpaste={handlePasteDigitsOnly}
						oninput={(e) => {
							const target = e.currentTarget as HTMLInputElement;
							const clean = target.value.replace(/\D/g, '');
							target.value = clean;
							noRator = clean ? parseInt(clean, 10) : null;
						}}
						placeholder="Contoh: 1026192"
						class="bg-background border-border focus:ring-primary h-11 w-full rounded-xl border-[3px] px-3 font-mono text-sm font-bold brutal-shadow-sm"
					/>
				</div>

				<!-- DocID (Referensi Dokumen) -->
				<div class="space-y-1.5">
					<label for="docId" class="text-xs font-black uppercase tracking-wider">
						No. Ref / DocID
					</label>
					<input
						type="text"
						id="docId"
						bind:value={docId}
						maxlength="7"
						placeholder="Contoh: DO-101"
						class="bg-background border-border focus:ring-primary h-11 w-full rounded-xl border-[3px] px-3 font-mono text-sm font-bold uppercase brutal-shadow-sm"
					/>
				</div>

				<!-- Catatan / Remark -->
				<div class="space-y-1.5 sm:col-span-2">
					<label for="remark" class="text-xs font-black uppercase tracking-wider">
						Keperluan / Catatan Retur
					</label>
					<input
						type="text"
						id="remark"
						bind:value={remark}
						maxlength="50"
						placeholder="Contoh: RETUR DARI AREA PRODUKSI"
						class="bg-background border-border focus:ring-primary h-11 w-full rounded-xl border-[3px] px-3 text-sm font-bold brutal-shadow-sm"
					/>
				</div>
			</div>
		</div>

		<!-- SECTION 2: TABEL RINCIAN BARANG (Persis seperti LBK) -->
		<div class="bg-card border-border rounded-xl border-[3px] p-6 brutal-shadow">
			<div class="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
				<h2 class="flex items-center gap-2 text-base font-black uppercase tracking-wider">
					<Boxes class="h-4 w-4" />
					Daftar Barang Retur ({rows.length} Baris)
				</h2>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={addRow}
						class="bg-primary text-primary-foreground hover:opacity-90 border-border inline-flex items-center gap-1.5 rounded-xl border-[3px] px-3.5 py-1.5 text-xs font-black uppercase transition-transform active:translate-x-0.5 active:translate-y-0.5 brutal-shadow-sm cursor-pointer"
					>
						<Plus class="h-3.5 w-3.5" />
						Tambah Baris
					</button>
				</div>
			</div>

			<div class="border-border overflow-x-auto rounded-xl border-[3px]">
				<table class="w-full text-left text-xs">
					<thead class="bg-muted border-border border-b-[3px] font-black uppercase tracking-wider">
						<tr>
							<th class="w-10 px-3 py-3 text-center">#</th>
							<th class="min-w-44 px-3 py-3">Kode Barang *</th>
							<th class="min-w-56 px-3 py-3">Nama Barang</th>
							<th class="w-20 px-3 py-3 text-center">Satuan</th>
							<th class="w-28 px-3 py-3 text-right">Bags (Zak)</th>
							<th class="w-32 px-3 py-3 text-right">Qty (Kgs) *</th>
							<th class="w-28 px-3 py-3 text-right">HPP</th>
							<th class="w-24 px-3 py-3 text-center">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-border divide-y-[2px] font-medium">
						{#each rows as row, idx (row.id)}
							<tr class="hover:bg-muted/40 transition-colors">
								<!-- Index -->
								<td class="px-3 py-2 text-center font-bold text-muted-foreground">
									{idx + 1}
								</td>

								<!-- Kode Barang -->
								<td class="px-3 py-2">
									<div class="flex items-center gap-1.5">
										<input
											type="text"
											bind:value={row.itemId}
											onblur={() => handleItemIdBlur(row)}
											placeholder="PILIH BARANG"
											class="bg-background border-border h-9 w-full rounded-lg border-2 px-2.5 font-mono text-xs font-black uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-primary"
										/>
										<button
											type="button"
											onclick={() => openGoodsSearchModal(row.id)}
											title="Cari dari Master Barang"
											class="bg-card hover:bg-muted border-border rounded-lg border-2 p-1.5 transition-transform active:translate-y-0.5 cursor-pointer"
										>
											<Search class="h-3.5 w-3.5" />
										</button>
									</div>
								</td>

								<!-- Nama Barang -->
								<td class="px-3 py-2">
									<input
										type="text"
										value={row.itemName}
										readonly
										placeholder="Otomatis dari master"
										class="bg-muted/50 border-border h-9 w-full rounded-lg border-2 px-2.5 text-xs font-bold text-foreground cursor-default"
									/>
								</td>

								<!-- Satuan -->
								<td class="px-3 py-2 text-center">
									<span class="bg-muted border-border inline-block rounded border px-2 py-1 font-mono text-[11px] font-black uppercase">
										{row.satuan || 'Pcs'}
									</span>
								</td>

								<!-- Bags (Integer Only) -->
								<td class="px-3 py-2">
									<input
										type="text"
										inputmode="numeric"
										value={row.bags}
										onkeydown={preventNonDigits}
										onpaste={handlePasteDigitsOnly}
										oninput={(e) => handleIntegerInput(e, (v) => (row.bags = v))}
										onblur={(e) => handleIntegerBlur(e, (v) => (row.bags = v))}
										class="bg-background border-border h-9 w-full rounded-lg border-2 px-2.5 text-right font-mono text-xs font-black focus:outline-none focus:ring-1 focus:ring-primary"
									/>
								</td>

								<!-- Kgs (Integer Only) -->
								<td class="px-3 py-2">
									<input
										type="text"
										inputmode="numeric"
										value={row.kgs}
										onkeydown={preventNonDigits}
										onpaste={handlePasteDigitsOnly}
										oninput={(e) => handleIntegerInput(e, (v) => (row.kgs = v))}
										onblur={(e) => handleIntegerBlur(e, (v) => (row.kgs = v))}
										class="bg-background border-border h-9 w-full rounded-lg border-2 px-2.5 text-right font-mono text-xs font-black text-emerald-600 focus:outline-none focus:ring-1 focus:ring-primary"
									/>
								</td>

								<!-- HPP -->
								<td class="px-3 py-2">
									<input
										type="number"
										step="any"
										bind:value={row.hppPrice}
										class="bg-background border-border h-9 w-full rounded-lg border-2 px-2.5 text-right font-mono text-xs font-bold text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
									/>
								</td>

								<!-- Aksi Baris -->
								<td class="px-3 py-2 text-center">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											onclick={() => duplicateRow(idx)}
											title="Duplikasi Baris"
											class="hover:bg-muted border-border rounded-lg border p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
										>
											<Copy class="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											onclick={() => removeRow(idx)}
											title="Hapus Baris"
											class="hover:bg-red-100 border-border rounded-lg border p-1 text-red-600 transition-colors cursor-pointer"
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>

					<!-- Footer Tabel Kalkulasi -->
					<tfoot class="bg-muted border-border border-t-[3px] font-black uppercase">
						<tr>
							<td colspan="4" class="px-3 py-3 text-right">
								TOTAL KESELURUHAN:
							</td>
							<td class="px-3 py-3 text-right font-mono text-xs">
								{totalBags.toLocaleString('id-ID')}
							</td>
							<td class="px-3 py-3 text-right font-mono text-xs text-emerald-600">
								{totalKgs.toLocaleString('id-ID')}
							</td>
							<td colspan="2"></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>

		<!-- SECTION 3: TOMBOL SUBMIT & ACTIONS -->
		<div class="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
			<div>
				{#if isEditMode}
					<button
						type="button"
						onclick={() => (isDeleteModalOpen = true)}
						class="bg-red-500 hover:bg-red-600 text-white border-border inline-flex items-center gap-2 rounded-xl border-[3px] px-5 py-3 text-xs font-black uppercase transition-transform active:translate-x-0.5 active:translate-y-0.5 brutal-shadow-sm cursor-pointer"
					>
						<Trash2 class="h-4 w-4" />
						Hapus Transaksi Retur
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={resetFormToNew}
					class="bg-card hover:bg-muted border-border inline-flex items-center gap-2 rounded-xl border-[3px] px-5 py-3 text-xs font-black uppercase transition-transform active:translate-x-0.5 active:translate-y-0.5 brutal-shadow-sm cursor-pointer"
				>
					Reset Form
				</button>

				<button
					type="submit"
					disabled={isSubmitting || totalItems === 0 || totalKgs <= 0}
					class="bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 border-border inline-flex items-center gap-2 rounded-xl border-[3px] px-6 py-3 text-xs font-black uppercase transition-transform active:translate-x-0.5 active:translate-y-0.5 brutal-shadow cursor-pointer"
				>
					{#if isSubmitting}
						<RefreshCw class="h-4 w-4 animate-spin" />
						Menyimpan...
					{:else if isEditMode}
						<CheckCircle2 class="h-4 w-4" />
						Perbarui Transaksi Retur
					{:else}
						<CheckCircle2 class="h-4 w-4" />
						Simpan Transaksi Retur
					{/if}
				</button>
			</div>
		</div>
	</form>
</div>

<!-- ==================== MODAL 1: CARI / LOOKUP MASTER BARANG ==================== -->
<Modal bind:open={isGoodsModalOpen} title="Cari Master Barang" size="2xl">
	<SearchInput
		value={goodsSearchQuery}
		oninput={handleGoodsSearchInput}
		loading={isSearchingGoods}
		placeholder="Ketik kode atau nama barang (misal: BOSODIUM, BOPOLY, DOTA)..."
	/>

	<div class="mt-4 flex-1 overflow-y-auto max-h-72">
		{#if goodsSearchResults.length > 0}
			<div class="divide-border rounded-xl border-2 divide-y">
				{#each goodsSearchResults as item}
					<button
						type="button"
						onclick={() => selectGoodsItem(item)}
						class="hover:bg-muted/70 flex w-full items-center justify-between p-3 text-left transition-colors cursor-pointer"
					>
						<div>
							<div class="font-mono text-xs font-black uppercase">{item.ItemID}</div>
							<div class="text-muted-foreground text-xs font-bold">{item.ItemName}</div>
						</div>
						<div class="text-right">
							<span class="bg-muted border-border rounded border px-2 py-0.5 font-mono text-[10px] font-black uppercase">
								{item.Satuan || 'Pcs'}
							</span>
						</div>
					</button>
				{/each}
			</div>
		{:else if goodsSearchQuery.trim() && !isSearchingGoods}
			<div class="py-8 text-center text-xs font-bold text-muted-foreground">
				Tidak ada barang yang cocok dengan kata kunci "{goodsSearchQuery}".
			</div>
		{:else if !isSearchingGoods}
			<div class="py-8 text-center text-xs font-bold text-muted-foreground">
				Ketik kata kunci untuk memulai pencarian master barang.
			</div>
		{/if}
	</div>
</Modal>

<!-- ==================== MODAL 2: CARI TRANSAKSI RETUR EXISTING ==================== -->
<Modal bind:open={isLoadModalOpen} title="Cari Transaksi Retur Tersimpan" size="3xl">
	<SearchInput
		value={loadSearchQuery}
		oninput={handleSearchTxInput}
		loading={isSearchingTransactions}
		placeholder="Cari berdasarkan No. Bukti, Remark, No. Rator, Gudang, atau Kode Barang..."
	/>

	<div class="mt-4 max-h-80 overflow-y-auto">
		{#if searchTransactionsResult.length > 0}
			<div class="divide-border rounded-xl border-2 divide-y">
				{#each searchTransactionsResult as tx}
					<button
						type="button"
						onclick={() => loadExistingTransaction(tx)}
						class="hover:bg-muted/70 flex w-full flex-col justify-between gap-2 p-3 text-left transition-colors sm:flex-row sm:items-center cursor-pointer"
					>
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<span class="font-mono text-xs font-black uppercase">{tx.moveId}</span>
								<span class="bg-primary/20 border-border rounded border px-1.5 py-0.2 font-mono text-[10px] font-black uppercase">
									Retur (K)
								</span>
								<span class="text-muted-foreground text-xs font-bold">
									{tx.moveDate}
								</span>
							</div>
							<div class="text-xs font-bold text-foreground">
								{tx.locName || tx.locId} - <span class="text-muted-foreground">{tx.remark || 'Tanpa catatan'}</span>
							</div>
						</div>

						<div class="flex items-center gap-3 font-mono text-xs">
							<span class="bg-muted border-border rounded border px-2 py-0.5 text-[11px] font-bold">
								{tx.totalItems} Barang
							</span>
							<span class="text-emerald-600 font-bold">
								{tx.totalKgs.toLocaleString('id-ID')} Kg
							</span>
						</div>
					</button>
				{/each}
			</div>
		{:else if loadSearchQuery.trim() && !isSearchingTransactions}
			<div class="py-8 text-center text-xs font-bold text-muted-foreground">
				Tidak ada transaksi Retur yang cocok dengan "{loadSearchQuery}".
			</div>
		{:else if !isSearchingTransactions}
			<div class="py-8 text-center text-xs font-bold text-muted-foreground">
				Ketik No. Bukti atau kata kunci untuk mencari transaksi Retur.
			</div>
		{/if}
	</div>
</Modal>

<!-- ==================== MODAL 3: IMPORT EXCEL RETUR ==================== -->
<Modal bind:open={isImportModalOpen} title="Import Transaksi Retur dari Excel" size="3xl" icon={FileSpreadsheet}>
	<FileUploadZone
		accept=".xlsx,.xls"
		title="Pilih file template Excel Retur (.xlsx atau .xls)"
		subtitle="Pastikan struktur file sesuai template resmi sistem."
		templateUrl="/api/retur/template"
		templateLabel="Unduh Template Excel Retur"
		loading={isUploadingImport}
		loadingMessage="Membaca dan memvalidasi file Excel..."
		onfile={(file) => {
			handleUploadFile(file);
		}}
	/>

	{#if importError}
		<Alert variant="error" message={importError} />
	{/if}

	{#if parsedImportData}
		<div class="border-2 border-black p-4 space-y-3 bg-slate-50">
			<div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
				<span class="font-black text-xs uppercase">Ringkasan Validasi File</span>
				<div class="flex items-center gap-2 font-mono text-xs">
					<span class="bg-emerald-200 text-emerald-950 border border-black px-2 py-0.5 font-bold">
						{parsedImportData.summary?.totalRows || 0} Total Baris
					</span>
					{#if parsedImportData.summary?.invalidCount > 0}
						<span class="bg-red-200 text-red-950 border border-black px-2 py-0.5 font-bold">
							{parsedImportData.summary?.invalidCount} Baris Tidak Valid
						</span>
					{:else}
						<span class="bg-emerald-200 text-emerald-950 border border-black px-2 py-0.5 font-bold">
							Semua Valid
						</span>
					{/if}
				</div>
			</div>

			<!-- Header Preview -->
			<div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 font-bold">
				<div>
					<span class="text-slate-500 block text-[10px] uppercase font-bold">Gudang</span>
					{parsedImportData.header?.locId || '-'}
				</div>
				<div>
					<span class="text-slate-500 block text-[10px] uppercase font-bold">No. Rator</span>
					{parsedImportData.header?.noRator ?? '-'}
				</div>
				<div>
					<span class="text-slate-500 block text-[10px] uppercase font-bold">Tanggal</span>
					{parsedImportData.header?.moveDate || '-'}
				</div>
				<div>
					<span class="text-slate-500 block text-[10px] uppercase font-bold">Remark</span>
					{parsedImportData.header?.remark || '-'}
				</div>
			</div>

			<!-- Tabel Barang Preview -->
			<div class="max-h-48 overflow-y-auto border-2 border-black bg-white">
				<table class="w-full text-left text-[11px]">
					<thead class="bg-black text-white font-black uppercase sticky top-0">
						<tr>
							<th class="p-2">Kode</th>
							<th class="p-2">Nama Barang</th>
							<th class="p-2 text-right">Bags</th>
							<th class="p-2 text-right">Kgs</th>
							<th class="p-2">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-black/20 font-medium">
						{#each parsedImportData.items as item}
							<tr class={item.isValid ? '' : 'bg-red-50 text-red-900'}>
								<td class="p-2 font-mono font-bold">{item.itemId}</td>
								<td class="p-2">{item.itemName}</td>
								<td class="p-2 text-right font-mono">{item.bags}</td>
								<td class="p-2 text-right font-mono font-bold">{item.kgs}</td>
								<td class="p-2">
									{#if item.isValid}
										<span class="text-emerald-700 font-bold">OK</span>
									{:else}
										<span class="text-red-700 font-bold">{item.errorMessage || 'Tidak valid'}</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<button
			type="button"
			onclick={closeImportModal}
			class="border-2 border-black bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200 cursor-pointer"
		>
			Batal
		</button>
		<button
			type="button"
			disabled={!canApplyImport}
			onclick={applyImportToForm}
			class="border-2 border-black bg-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-emerald-300 disabled:opacity-50 cursor-pointer"
		>
			Terapkan ke Formulir
		</button>
	{/snippet}
</Modal>

<!-- ==================== MODAL 4: KONFIRMASI HAPUS ==================== -->
<Modal bind:open={isDeleteModalOpen} title="Konfirmasi Hapus Retur" icon={AlertCircle} size="md">
	<p class="text-xs font-bold text-slate-700 leading-relaxed">
		Apakah Anda yakin ingin menghapus bukti Retur <strong class="text-black font-black">{moveId}</strong> beserta seluruh {rows.length} baris barang di dalamnya? Tindakan ini tidak dapat dibatalkan.
	</p>

	{#snippet footer()}
		<form
			method="POST"
			action="?/delete"
			use:enhance={() => {
				isDeleting = true;
				return async ({ result, update }) => {
					await update();
					isDeleting = false;
					isDeleteModalOpen = false;
					if (result.type === 'success') {
						toast.info(`Bukti Retur ${moveId} berhasil dihapus.`, { title: 'Retur Dihapus' });
						resetFormToNew();
					} else if (result.type === 'failure') {
						const resData = result.data as any;
						toast.error(resData?.message || resData?.error || 'Gagal menghapus transaksi Retur.', { title: 'Gagal Hapus' });
					}
				};
			}}
			class="flex items-center justify-end gap-2"
		>
			<input type="hidden" name="moveId" value={moveId} />

			<button
				type="button"
				onclick={() => (isDeleteModalOpen = false)}
				class="border-2 border-black bg-slate-100 px-4 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200 cursor-pointer"
			>
				Batal
			</button>

			<button
				type="submit"
				disabled={isDeleting}
				class="border-2 border-black bg-red-400 hover:bg-red-500 px-4 py-2 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
			>
				{#if isDeleting}
					<RefreshCw class="h-3.5 w-3.5 animate-spin" />
					Menghapus...
				{:else}
					<Trash2 class="h-3.5 w-3.5" />
					Hapus Sekarang
				{/if}
			</button>
		</form>
	{/snippet}
</Modal>
