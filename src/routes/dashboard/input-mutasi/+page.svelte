<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		Modal,
		Alert,
		SearchInput,
		FileUploadZone,
		ConfirmModal,
		toast
	} from '$lib/components';
	import {
		ArrowLeftRight,
		Plus,
		Trash2,
		RefreshCw,
		Search,
		CheckCircle2,
		AlertCircle,
		ExternalLink,
		Boxes,
		PackageCheck,
		ArrowRight,
		Calendar,
		Building2,
		FileText,
		Layers,
		X,
		FileSpreadsheet,
		Download,
		Upload,
		Copy,
		Warehouse
	} from '@lucide/svelte';

	let { data, form } = $props();

	// Inisialisasi awal (mendukung SSR saat membuka langsung /dashboard/input-mutasi?id=...)
	let initTx = untrack(() => data.initialEditData);
	let isEditMode = $state(Boolean(initTx));

	// State Header Mutasi
	let moveId = $state(initTx?.header?.moveId || untrack(() => data.nextMoveId) || '');
	let moveType = $state<'R' | 'M'>(initTx?.header?.moveType || 'R');
	let moveDate = $state(initTx?.header?.moveDate || untrack(() => data.defaultDate) || new Date().toISOString().slice(0, 10));
	let locSrc = $state(initTx?.header?.locSrc || 'GUDUT');
	let locDest = $state(initTx?.header?.locDest || 'GUDIN');
	let prodType = $state(initTx?.header?.prodType || 'IN');
	let noRator = $state<number | null>(initTx?.header?.noRator ?? null);
	let remark = $state(initTx?.header?.remark || 'Mutasi Bahan Baku');
	let notes = $state(initTx?.header?.notes || '');

	// State Detail Items
	interface DetailRow {
		id: string;
		itemId: string;
		itemName: string;
		satuan: string;
		bags: number;
		kgs: number;
		notes?: string;
	}

	let rows = $state<DetailRow[]>(
		initTx?.details && initTx.details.length > 0
			? initTx.details.map((d: any) => ({
					id: crypto.randomUUID(),
					itemId: d.itemId,
					itemName: d.itemName,
					satuan: d.satuan || 'Pcs',
					bags: Math.max(0, parseInt(String(d.bags ?? 0), 10) || 0),
					kgs: Math.max(0, parseInt(String(d.kgs ?? 0), 10) || 0),
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
						notes: ''
					}
				]
	);

	function applyTransactionData(txData: any) {
		if (!txData || !txData.header) return;
		isEditMode = true;
		moveId = String(txData.header.moveId || '').trim();
		moveType = (txData.header.moveType as 'R' | 'M') || 'R';
		moveDate = txData.header.moveDate || new Date().toISOString().slice(0, 10);
		locSrc = String(txData.header.locSrc || 'GUDUT').trim();
		locDest = String(txData.header.locDest || 'GUDIN').trim();
		prodType = String(txData.header.prodType || 'IN').trim();
		noRator = txData.header.noRator != null ? parseInt(String(txData.header.noRator), 10) : null;
		remark = String(txData.header.remark || '').trim();
		notes = String(txData.header.notes || '').trim();

		rows = (txData.details || []).map((d: any) => ({
			id: crypto.randomUUID(),
			itemId: String(d.itemId || '').trim(),
			itemName: String(d.itemName || d.itemId || '').trim(),
			satuan: String(d.satuan || 'Pcs').trim(),
			bags: Math.max(0, parseInt(String(d.bags || 0), 10) || 0),
			kgs: Math.max(0, parseInt(String(d.kgs || 0), 10) || 0),
			notes: String(d.notes || '').trim()
		}));

		if (rows.length === 0) {
			rows = [{ id: crypto.randomUUID(), itemId: '', itemName: '', satuan: 'Pcs', bags: 0, kgs: 0, notes: '' }];
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

	// Otomatisasi Departemen berdasarkan Gudang Tujuan
	function handleDestChange(newDest: string) {
		locDest = newDest;
		const map: Record<string, string> = {
			GUDIN: 'IN',
			GUDSP: 'SP',
			GUDPL: 'PL',
			GUDMO: 'MO',
			GUDAS: 'AS'
		};
		if (map[newDest]) {
			prodType = map[newDest];
		}
	}

	// Update Next MoveID saat MoveType atau Tanggal berubah
	async function updateNextId(type: 'R' | 'M', date: string) {
		if (isEditMode) return;
		try {
			const res = await fetch(`/api/mutasi/next-id?moveType=${type}&date=${date}`);
			const json = await res.json();
			if (json.nextMoveId) {
				moveId = json.nextMoveId;
			}
		} catch (e) {
			console.error('Gagal mengambil next MoveID', e);
		}
	}

	// ==================== BARANG LOOKUP STATE & MODAL ====================
	let isGoodsModalOpen = $state(false);
	let goodsSearchQuery = $state('');
	let goodsSearchResults = $state<any[]>([]);
	let isSearchingGoods = $state(false);
	let activeRowTargetId = $state<string | null>(null);
	let goodsSearchDebounce: any;

	function openGoodsSearchModal(rowId: string) {
		activeRowTargetId = rowId;
		goodsSearchQuery = '';
		goodsSearchResults = [];
		isGoodsModalOpen = true;
	}

	async function performGoodsSearch(val: string) {
		goodsSearchQuery = val;
		if (!val.trim()) {
			goodsSearchResults = [];
			return;
		}
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
	}

	function handleGoodsSearchInput(e: Event) {
		clearTimeout(goodsSearchDebounce);
		const val = (e.target as HTMLInputElement).value;
		goodsSearchDebounce = setTimeout(() => {
			performGoodsSearch(val);
		}, 300);
	}

	function selectGoodsItem(item: any) {
		if (!activeRowTargetId) return;
		const targetRow = rows.find((r) => r.id === activeRowTargetId);
		if (targetRow) {
			targetRow.itemId = item.ItemID;
			targetRow.itemName = item.ItemName;
			targetRow.satuan = item.Satuan || 'Pcs';
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
			} else if (items.length > 0) {
				row.itemId = items[0].ItemID;
				row.itemName = items[0].ItemName;
				row.satuan = items[0].Satuan || 'Pcs';
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
	let searchTxDebounce: any;

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
			const res = await fetch(`/api/mutasi/search-transactions?q=${encodeURIComponent(val)}`);
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

	async function loadTransactionIntoForm(tx: any) {
		try {
			const res = await fetch(`/api/mutasi/get-transaction?id=${encodeURIComponent(tx.moveId)}&type=${encodeURIComponent(tx.moveType)}`);
			const json = await res.json();
			if (!res.ok || !json.data) {
				const errMsg = json.error || 'Gagal memuat transaksi mutasi';
				toast.error(errMsg);
				return;
			}

			const txData = json.data;
			applyTransactionData(txData);

			if (typeof history !== 'undefined') {
				history.pushState({}, '', `/dashboard/input-mutasi?id=${encodeURIComponent(txData.header.moveId)}&type=${encodeURIComponent(txData.header.moveType)}`);
			}

			isLoadModalOpen = false;
			toast.info(`Transaksi mutasi #${txData.header.moveId} berhasil dimuat.`, {
				title: 'Mode Edit Aktif'
			});
		} catch (e: any) {
			toast.error('Terjadi kesalahan saat memuat transaksi: ' + e?.message);
		}
	}

	function resetToNewMode() {
		isEditMode = false;
		moveType = 'R';
		moveDate = data.defaultDate || new Date().toISOString().slice(0, 10);
		locSrc = 'GUDUT';
		locDest = 'GUDIN';
		prodType = 'IN';
		noRator = null;
		remark = 'Mutasi Bahan Baku';
		notes = '';
		rows = [{ id: crypto.randomUUID(), itemId: '', itemName: '', satuan: 'Pcs', bags: 0, kgs: 0, notes: '' }];
		updateNextId('R', moveDate);
		if (typeof history !== 'undefined') {
			history.pushState({}, '', '/dashboard/input-mutasi');
		}
		toast.info('Formulir direset ke mode transaksi baru.');
	}

	// ==================== MODAL IMPORT EXCEL STATE & LOGIC ====================
	let isImportModalOpen = $state(false);
	let isUploadingImport = $state(false);
	let importError = $state('');
	let importSuccessMessage = $state('');
	let parsedImportData = $state<any>(null);
	let importFileInputRef = $state<HTMLInputElement | null>(null);

	// Validasi kelayakan data import sebelum diterapkan
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
		if (importFileInputRef) importFileInputRef.value = '';
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

			const res = await fetch('/api/mutasi/import', {
				method: 'POST',
				body: fd
			});

			const json = await res.json();
			if (!res.ok || json.error) {
				importError = json.error || 'Gagal membaca file Excel mutasi.';
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

	async function handleImportFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		await handleUploadFile(file);
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
				notes: item.notes || ''
			}));
		}

		const h = parsedImportData.header;
		if (h) {
			if (h.moveType) moveType = h.moveType;
			if (h.moveDate) moveDate = h.moveDate;
			if (h.locSrc) locSrc = h.locSrc;
			if (h.locDest) {
				locDest = h.locDest;
				handleDestChange(h.locDest);
			}
			if (h.prodType) prodType = h.prodType;
			if (h.noRator != null) noRator = parseInt(String(h.noRator), 10) || null;
			if (h.remark) remark = h.remark;
		}

		importSuccessMessage = `Berhasil menerapkan ${parsedImportData.summary?.totalRows || 0} baris barang dari file Excel.`;
		toast.success(importSuccessMessage, { title: 'Import Excel Berhasil' });
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
		if (target.value === '' || isNaN(Number(target.value))) {
			target.value = '0';
			onUpdate(0);
		} else {
			const num = parseInt(target.value, 10);
			target.value = String(num);
			onUpdate(num);
		}
	}

	function handleNoRatorInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		let clean = target.value.replace(/\D/g, '');
		if (clean.length > 1 && clean.startsWith('0')) {
			clean = clean.replace(/^0+/, '') || '0';
		}
		target.value = clean;
		noRator = clean === '' ? null : parseInt(clean, 10);
	}

	// ==================== SUBMISSION STATE ====================
	let isSubmitting = $state(false);
	let savePayloadJson = $derived(
		JSON.stringify({
			moveId,
			moveType,
			moveDate,
			locSrc,
			locDest,
			prodType: prodType || null,
			noRator: noRator ? parseInt(String(noRator), 10) : null,
			remark,
			notes,
			details: rows
				.filter((r) => r.itemId.trim())
				.map((r) => ({
					itemId: r.itemId.trim(),
					bags: Math.max(0, parseInt(String(r.bags || 0), 10) || 0),
					kgs: Math.max(0, parseInt(String(r.kgs || 0), 10) || 0),
					notes: r.notes || undefined
				}))
		})
	);
</script>

<svelte:head>
	<title>{isEditMode ? `Edit Mutasi #${moveId}` : 'Input Mutasi Gudang'} | KIW Inventory</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Bar / Page Header -->
	<div class="flex flex-col gap-4 border-b-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] md:flex-row md:items-center md:justify-between">
		<div>
			<div class="flex items-center gap-2">
				<span class="border-2 border-black bg-[#FFD43B] p-1.5 shadow-[2px_2px_0px_0px_#000]">
					<ArrowLeftRight class="h-5 w-5 text-black" />
				</span>
				<h1 class="text-xl font-black uppercase tracking-tight text-black sm:text-2xl">
					{isEditMode ? `Edit Mutasi Gudang #${moveId}` : 'Input Mutasi Gudang'}
				</h1>
				<span
					class="border-2 border-black px-2.5 py-0.5 text-xs font-black uppercase {isEditMode
						? 'bg-[#FFD43B] text-black shadow-[2px_2px_0px_0px_#000]'
						: 'bg-[#51CF66] text-black shadow-[2px_2px_0px_0px_#000]'}"
				>
					{isEditMode ? 'Mode Edit' : 'Transaksi Baru'}
				</span>
			</div>
			<p class="mt-1 text-xs font-medium text-black/70">
				Formulir pencatatan perpindahan stok antar gudang (taMoveHD & taMoveDT)
			</p>
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={openLoadModal}
				class="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition hover:bg-slate-100 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
			>
				<Search class="h-3.5 w-3.5" />
				Cari Transaksi
			</button>

			<button
				type="button"
				onclick={openImportModal}
				class="inline-flex items-center gap-1.5 border-2 border-black bg-[#E7F5FF] px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition hover:bg-[#D0EBFF] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
			>
				<Upload class="h-3.5 w-3.5" />
				Import Excel
			</button>

			<a
				href="/dashboard/mutasi-gudang"
				class="inline-flex items-center gap-1.5 border-2 border-black bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition hover:bg-slate-200 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
			>
				<ExternalLink class="h-3.5 w-3.5" />
				Laporan Mutasi
			</a>

			{#if isEditMode}
				<button
					type="button"
					onclick={resetToNewMode}
					class="inline-flex items-center gap-1.5 border-2 border-black bg-[#FFA94D] px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition hover:bg-[#FF922B] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
				>
					<RefreshCw class="h-3.5 w-3.5" />
					Reset / Baru
				</button>
			{/if}
		</div>
	</div>

	<!-- Alert Messages -->
	{#if form?.error}
		<Alert variant="error" title="Terjadi Kesalahan:">
			<span class="font-mono">{form.error}</span>
		</Alert>
	{/if}

	{#if form?.success || importSuccessMessage}
		<Alert variant="success" title="Berhasil:">
			{form?.message || importSuccessMessage}
		</Alert>
	{/if}

	<!-- Form Utama -->
	<form
		method="POST"
		action={isEditMode ? '?/update' : '?/create'}
		use:enhance={() => {
			isSubmitting = true;
			return async ({ result, update }) => {
				await update();
				isSubmitting = false;
				if (result.type === 'success') {
					const data = result.data as any;
					toast.success(data?.message || 'Transaksi mutasi berhasil disimpan!', {
						description: data?.moveId ? `MoveID: ${data.moveId}` : undefined
					});
				} else if (result.type === 'failure') {
					const data = result.data as any;
					toast.error(data?.error || 'Gagal menyimpan transaksi mutasi', { title: 'Gagal Menyimpan Mutasi' });
				} else if (result.type === 'error') {
					toast.error('Terjadi kesalahan pada server saat memproses transaksi mutasi.', { title: 'Kesalahan Sistem' });
				}
			};
		}}
		class="space-y-6"
	>
		<input type="hidden" name="payload" value={savePayloadJson} />

		<!-- Section 1: Header Transaksi -->
		<div class="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
			<div class="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
				<div class="flex items-center gap-2">
					<span class="size-6 rounded-full border-2 border-black bg-[#FFD43B] flex items-center justify-center text-xs font-black">1</span>
					<h2 class="text-sm font-black uppercase tracking-wider text-black">Header Transaksi Mutasi</h2>
				</div>
				<div class="text-[11px] font-mono text-black/60">
					User: <strong>{data.currentUser}</strong>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
				<!-- Nomor Mutasi (MoveID) -->
				<div>
					<div class="flex items-center justify-between">
						<label for="move-id" class="block text-xs font-black uppercase tracking-wider text-black">
							No. Mutasi (MoveID)
						</label>
						<span class="border border-black bg-emerald-100 px-1.5 py-0.2 font-mono text-[10px] font-black uppercase">
							Otomatis
						</span>
					</div>
					<div class="mt-1">
						<input
							id="move-id"
							type="text"
							value={moveId}
							readonly
							tabindex="-1"
							placeholder="2600001"
							class="w-full border-2 border-black bg-slate-200 px-3 py-2 font-mono text-sm font-black shadow-[2px_2px_0px_0px_#000] cursor-not-allowed select-none opacity-90 focus:outline-none"
						/>
					</div>
				</div>

				<!-- Tipe Mutasi -->
				<div>
					<label for="move-type" class="block text-xs font-black uppercase tracking-wider text-black">
						Tipe Mutasi
					</label>
					<select
						id="move-type"
						bind:value={moveType}
						onchange={() => updateNextId(moveType, moveDate)}
						disabled={isEditMode}
						class="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					>
						<option value="R">R - Mutasi Produksi / Departemen</option>
						<option value="M">M - Mutasi Antar Gudang</option>
					</select>
				</div>

				<!-- Tanggal Mutasi -->
				<div>
					<label for="move-date" class="block text-xs font-black uppercase tracking-wider text-black">
						Tanggal Mutasi
					</label>
					<input
						id="move-date"
						type="date"
						bind:value={moveDate}
						onchange={() => updateNextId(moveType, moveDate)}
						class="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					/>
				</div>

				<!-- Gudang Asal -->
				<div>
					<label for="loc-src" class="block text-xs font-black uppercase tracking-wider text-black">
						Gudang Asal *
					</label>
					<select
						id="loc-src"
						bind:value={locSrc}
						class="mt-1 w-full border-2 border-black bg-amber-50 px-3 py-2 text-sm font-black shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					>
						{#each data.warehouses as wh}
							<option value={wh.LocID}>{wh.LocID} - {wh.LocName}</option>
						{/each}
					</select>
				</div>

				<!-- Gudang Tujuan -->
				<div>
					<label for="loc-dest" class="block text-xs font-black uppercase tracking-wider text-black">
						Gudang Tujuan *
					</label>
					<select
						id="loc-dest"
						value={locDest}
						onchange={(e) => handleDestChange((e.target as HTMLSelectElement).value)}
						class="mt-1 w-full border-2 border-black bg-emerald-50 px-3 py-2 text-sm font-black shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					>
						{#each data.warehouses as wh}
							<option value={wh.LocID}>{wh.LocID} - {wh.LocName}</option>
						{/each}
					</select>
				</div>

				<!-- Nomor Rator -->
				<div>
					<label for="no-rator" class="block text-xs font-black uppercase tracking-wider text-black">
						Nomor Rator
					</label>
					<input
						id="no-rator"
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						value={noRator ?? ''}
						onkeydown={preventNonDigits}
						onpaste={handlePasteDigitsOnly}
						oninput={handleNoRatorInput}
						placeholder="Misal: 1026901"
						class="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					/>
				</div>

				<!-- Keterangan / Remark -->
				<div class="sm:col-span-2 md:col-span-4">
					<label for="remark" class="block text-xs font-black uppercase tracking-wider text-black">
						Keterangan Mutasi / Remark
					</label>
					<div class="mt-1 flex flex-col gap-1 sm:flex-row">
						<input
							id="remark"
							type="text"
							bind:value={remark}
							placeholder="Contoh: Mutasi Bahan Baku, Pengambilan Obat Plating, dll."
							class="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
						/>
						<!-- Preset Buttons -->
						<div class="flex items-center gap-1 shrink-0 overflow-x-auto pb-1 sm:pb-0">
							<button
								type="button"
								onclick={() => (remark = 'Mutasi Bahan Baku')}
								class="border border-black bg-slate-100 px-2 py-1 text-[10px] font-bold hover:bg-slate-200"
							>
								Bahan Baku
							</button>
							<button
								type="button"
								onclick={() => (remark = 'BAHAN KIMIA SPRAY')}
								class="border border-black bg-slate-100 px-2 py-1 text-[10px] font-bold hover:bg-slate-200"
							>
								Kimia Spray
							</button>
							<button
								type="button"
								onclick={() => (remark = 'PENGAMBILAN OBAT PLATING')}
								class="border border-black bg-slate-100 px-2 py-1 text-[10px] font-bold hover:bg-slate-200"
							>
								Obat Plating
							</button>
						</div>
					</div>
				</div>

				<!-- Departemen -->
				<div class="sm:col-span-2 md:col-span-2">
					<label for="prod-type" class="block text-xs font-black uppercase tracking-wider text-black">
						Departemen Terkait
					</label>
					<select
						id="prod-type"
						bind:value={prodType}
						class="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					>
						<option value="">- Tanpa Departemen -</option>
						{#each data.departments as dept}
							<option value={dept.PRDeptID}>{dept.PRDeptID} - {dept.PRDeptName}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<!-- Section 2: Tabel Barang Mutasi -->
		<div class="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] space-y-4">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b-2 border-black pb-3">
				<div class="flex items-center gap-2">
					<span class="size-6 rounded-full border-2 border-black bg-[#51CF66] flex items-center justify-center text-xs font-black">2</span>
					<h2 class="text-sm font-black uppercase tracking-wider text-black">Rincian Barang Mutasi</h2>
					<span class="border border-black bg-slate-100 px-2 py-0.5 text-xs font-bold font-mono">
						{totalItems} Item
					</span>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={addRow}
						class="inline-flex items-center gap-1 border-2 border-black bg-[#FFD43B] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition hover:bg-[#FCC419] active:translate-x-0.5 active:translate-y-0.5"
					>
						<Plus class="h-4 w-4" />
						Tambah Baris
					</button>
				</div>
			</div>

			<!-- Tabel Input -->
			<div class="overflow-x-auto border-2 border-black">
				<table class="w-full border-collapse text-left text-xs font-mono">
					<thead>
						<tr class="bg-black text-white uppercase text-[11px]">
							<th class="border border-black px-2 py-2 w-10 text-center">No</th>
							<th class="border border-black px-3 py-2 w-56">Kode Barang *</th>
							<th class="border border-black px-3 py-2">Nama Barang (taGoods)</th>
							<th class="border border-black px-2 py-2 w-16 text-center">Satuan</th>
							<th class="border border-black px-2 py-2 w-28 text-right">Bags</th>
							<th class="border border-black px-2 py-2 w-32 text-right">Qty (Kgs) *</th>
							<th class="border border-black px-3 py-2 w-48">Keterangan</th>
							<th class="border border-black px-2 py-2 w-20 text-center">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row, idx (row.id)}
							<tr class="border-b border-black/20 hover:bg-slate-50 transition">
								<td class="border-r border-black/20 px-2 py-2 text-center font-bold">{idx + 1}</td>
								
								<!-- Kode Barang dengan tombol Cari -->
								<td class="border-r border-black/20 px-2 py-1">
									<div class="flex items-center gap-1">
										<input
											type="text"
											bind:value={row.itemId}
											onblur={() => handleItemIdBlur(row)}
											placeholder="KODE BARANG"
											class="w-full border border-black px-2 py-1 font-mono text-xs font-black uppercase shadow-[1px_1px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none"
										/>
										<button
											type="button"
											onclick={() => openGoodsSearchModal(row.id)}
											title="Cari master taGoods"
											class="border border-black bg-slate-100 p-1 hover:bg-slate-200"
										>
											<Search class="h-3.5 w-3.5 text-black" />
										</button>
									</div>
								</td>

								<!-- Nama Barang -->
								<td class="border-r border-black/20 px-2 py-1">
									<div class="truncate font-sans font-medium text-xs {row.itemName ? 'text-black font-bold' : 'text-slate-400 italic'}">
										{row.itemName || 'Otomatis dari master'}
									</div>
								</td>

								<!-- Satuan -->
								<td class="border-r border-black/20 px-2 py-1 text-center font-bold">
									{row.satuan}
								</td>

								<!-- Bags -->
								<td class="border-r border-black/20 px-2 py-1 text-right">
									<input
										type="text"
										inputmode="numeric"
										pattern="[0-9]*"
										value={row.bags}
										onkeydown={preventNonDigits}
										onpaste={handlePasteDigitsOnly}
										oninput={(e) => handleIntegerInput(e, (val) => (row.bags = val))}
										onblur={(e) => handleIntegerBlur(e, (val) => (row.bags = val))}
										class="w-full border border-black px-2 py-1 font-mono text-xs font-bold text-right shadow-[1px_1px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none"
									/>
								</td>

								<!-- Kgs (Qty) -->
								<td class="border-r border-black/20 px-2 py-1 text-right">
									<input
										type="text"
										inputmode="numeric"
										pattern="[0-9]*"
										value={row.kgs}
										onkeydown={preventNonDigits}
										onpaste={handlePasteDigitsOnly}
										oninput={(e) => handleIntegerInput(e, (val) => (row.kgs = val))}
										onblur={(e) => handleIntegerBlur(e, (val) => (row.kgs = val))}
										class="w-full border-2 border-black bg-white px-2 py-1 font-mono text-xs font-black text-right shadow-[1px_1px_0px_0px_#000] focus:bg-emerald-50 focus:outline-none {row.kgs <= 0 && row.itemId ? 'border-red-600 bg-red-50' : ''}"
									/>
								</td>

								<!-- Notes -->
								<td class="border-r border-black/20 px-2 py-1">
									<input
										type="text"
										bind:value={row.notes}
										placeholder="Catatan item (opsional)"
										class="w-full border border-black px-2 py-1 font-sans text-xs shadow-[1px_1px_0px_0px_#000] focus:outline-none"
									/>
								</td>

								<!-- Aksi Baris -->
								<td class="px-2 py-1 text-center">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											onclick={() => duplicateRow(idx)}
											title="Duplikat baris ini"
											class="border border-black bg-white p-1 hover:bg-slate-100"
										>
											<Copy class="h-3.5 w-3.5 text-black" />
										</button>
										<button
											type="button"
											onclick={() => removeRow(idx)}
											title="Hapus baris ini"
											class="border border-black bg-white p-1 hover:bg-red-100 text-red-600"
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Summary Bar -->
			<div class="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-slate-50 p-3 font-mono text-xs">
				<div class="flex items-center gap-4">
					<span>Total Baris: <strong>{totalItems}</strong></span>
					<span>Total Bags: <strong>{totalBags}</strong></span>
				</div>
				<div class="flex items-center gap-2 text-sm font-black">
					<span>TOTAL KUANTITI (KGS):</span>
					<span class="border-2 border-black bg-[#51CF66] px-3 py-1 text-black shadow-[2px_2px_0px_0px_#000]">
						{totalKgs.toLocaleString('id-ID')}
					</span>
				</div>
			</div>
		</div>

		<!-- Section 3: Bottom Action Buttons -->
		<div class="flex flex-wrap items-center justify-between gap-4 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
			<div>
				{#if isEditMode}
					<button
						type="submit"
						formaction="?/delete"
						onclick={(e) => {
							if (!confirm(`Apakah Anda yakin ingin MENGHAPUS mutasi #${moveId}? Tindakan ini tidak dapat dibatalkan!`)) {
								e.preventDefault();
							}
						}}
						class="inline-flex items-center gap-2 border-2 border-black bg-[#FF6B6B] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] transition hover:bg-red-500 active:translate-x-0.5 active:translate-y-0.5"
					>
						<Trash2 class="h-4 w-4" />
						Hapus Mutasi #{moveId}
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={resetToNewMode}
					class="border-2 border-black bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5"
				>
					Batal / Reset
				</button>

				<button
					type="submit"
					disabled={isSubmitting || totalItems === 0 || totalKgs <= 0}
					class="inline-flex items-center gap-2 border-[3px] border-black bg-[#51CF66] px-8 py-3 text-sm font-black uppercase tracking-wider text-black shadow-[4px_4px_0px_0px_#000] transition hover:bg-[#40C057] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
				>
					<CheckCircle2 class="h-5 w-5" />
					{isSubmitting
						? 'Menyimpan...'
						: isEditMode
							? `SIMPAN PERUBAHAN #${moveId}`
							: 'SIMPAN TRANSAKSI MUTASI'}
				</button>
			</div>
		</div>
	</form>
</div>

<!-- ==================== MODAL CARI BARANG (taGoods) ==================== -->
<Modal bind:open={isGoodsModalOpen} title="Pencarian Barang Master taGoods" size="2xl">
	<div class="space-y-4">
		<SearchInput
			value={goodsSearchQuery}
			onsearch={performGoodsSearch}
			placeholder="Ketik Kode atau Nama Barang..."
			loading={isSearchingGoods}
		/>

		<div class="max-h-96 overflow-y-auto">
			{#if isSearchingGoods}
				<div class="p-6 text-center text-xs font-bold text-muted-foreground">Mencari barang di database...</div>
			{:else if goodsSearchResults.length === 0}
				<div class="p-6 text-center text-xs font-bold text-muted-foreground">
					{goodsSearchQuery ? 'Barang tidak ditemukan.' : 'Silakan ketik kode atau nama barang di kotak pencarian.'}
				</div>
			{:else}
				<table class="w-full border-collapse text-left text-xs font-mono">
					<thead>
						<tr class="bg-black text-white uppercase text-[10px]">
							<th class="border border-black px-2 py-1.5 w-36">Kode Barang</th>
							<th class="border border-black px-2 py-1.5">Nama Barang</th>
							<th class="border border-black px-2 py-1.5 w-16 text-center">Satuan</th>
							<th class="border border-black px-2 py-1.5 w-16 text-center">Pilih</th>
						</tr>
					</thead>
					<tbody>
						{#each goodsSearchResults as item}
							<tr class="border-b border-black/10 hover:bg-yellow-50 transition cursor-pointer" onclick={() => selectGoodsItem(item)}>
								<td class="border-r border-black/10 px-2 py-1.5 font-black">{item.ItemID}</td>
								<td class="border-r border-black/10 px-2 py-1.5 font-sans font-medium">{item.ItemName}</td>
								<td class="border-r border-black/10 px-2 py-1.5 text-center font-bold">{item.Satuan}</td>
								<td class="px-2 py-1.5 text-center">
									<button
										type="button"
										onclick={() => selectGoodsItem(item)}
										class="border border-black bg-[#51CF66] px-2 py-0.5 text-[10px] font-black uppercase text-black"
									>
										PILIH
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<button
			type="button"
			onclick={() => (isGoodsModalOpen = false)}
			class="border-2 border-black bg-white px-4 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200"
		>
			Tutup
		</button>
	{/snippet}
</Modal>

<!-- ==================== MODAL BUKA / CARI TRANSAKSI ==================== -->
<Modal bind:open={isLoadModalOpen} title="Cari Transaksi Mutasi Gudang" size="3xl">
	<div class="space-y-4">
		<SearchInput
			value={loadSearchQuery}
			onsearch={performTxSearch}
			placeholder="Cari berdasarkan Nomor Mutasi (MoveID), Gudang, Rator, atau Remark..."
			loading={isSearchingTransactions}
		/>

		<div class="max-h-96 overflow-y-auto">
			{#if isSearchingTransactions}
				<div class="p-6 text-center text-xs font-bold text-muted-foreground">Mencari transaksi...</div>
			{:else if searchTransactionsResult.length === 0}
				<div class="p-6 text-center text-xs font-bold text-muted-foreground">Tidak ada transaksi ditemukan.</div>
			{:else}
				<table class="w-full border-collapse text-left text-xs font-mono">
					<thead>
						<tr class="bg-black text-white uppercase text-[10px]">
							<th class="border border-black px-2 py-1.5 w-24">No. Mutasi</th>
							<th class="border border-black px-2 py-1.5 w-14 text-center">Tipe</th>
							<th class="border border-black px-2 py-1.5 w-24">Tanggal</th>
							<th class="border border-black px-2 py-1.5 w-20">Asal</th>
							<th class="border border-black px-2 py-1.5 w-20">Tujuan</th>
							<th class="border border-black px-2 py-1.5 w-20 text-center">Rator</th>
							<th class="border border-black px-2 py-1.5 w-24 text-right">Total Qty</th>
							<th class="border border-black px-2 py-1.5">Remark</th>
							<th class="border border-black px-2 py-1.5 w-16 text-center">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each searchTransactionsResult as tx}
							<tr class="border-b border-black/10 hover:bg-yellow-50 transition">
								<td class="border-r border-black/10 px-2 py-1.5 font-black">{tx.moveId}</td>
								<td class="border-r border-black/10 px-2 py-1.5 text-center font-bold">{tx.moveType}</td>
								<td class="border-r border-black/10 px-2 py-1.5">{tx.moveDate}</td>
								<td class="border-r border-black/10 px-2 py-1.5 font-bold">{tx.locSrc}</td>
								<td class="border-r border-black/10 px-2 py-1.5 font-bold">{tx.locDest}</td>
								<td class="border-r border-black/10 px-2 py-1.5 text-center">{tx.noRator ?? '-'}</td>
								<td class="border-r border-black/10 px-2 py-1.5 text-right font-black">{tx.totalKgs}</td>
								<td class="border-r border-black/10 px-2 py-1.5 truncate max-w-xs font-sans">{tx.remark}</td>
								<td class="px-2 py-1.5 text-center">
									<button
										type="button"
										onclick={() => loadTransactionIntoForm(tx)}
										class="border border-black bg-[#51CF66] px-2 py-0.5 text-[10px] font-black uppercase text-black hover:bg-[#40C057]"
									>
										BUKA
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<button
			type="button"
			onclick={() => (isLoadModalOpen = false)}
			class="border-2 border-black bg-white px-4 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200"
		>
			Tutup
		</button>
	{/snippet}
</Modal>

<!-- ==================== MODAL IMPORT EXCEL MUTASI ==================== -->
<Modal bind:open={isImportModalOpen} title="Import File Excel Mutasi Gudang" size="3xl">
	<div class="space-y-4">
		<FileUploadZone
			templateUrl="/api/mutasi/template"
			templateLabel="Download Template Mutasi (.xlsx)"
			accept=".xlsx, .xls"
			loading={isUploadingImport}
			onfile={handleUploadFile}
		/>

		{#if importError}
			<Alert variant="error" title="Gagal Membaca File:">
				{importError}
			</Alert>
		{/if}

		{#if parsedImportData}
			<div class="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] space-y-4">
				<div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
					<div>
						<div class="text-xs font-black uppercase text-black/70">File Terpilih:</div>
						<div class="font-mono text-sm font-black text-black truncate max-w-sm">
							📄 {parsedImportData.fileName || 'Excel Import'}
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<span class="border border-black bg-[#51CF66] px-2.5 py-1 text-xs font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
							Barang: {parsedImportData.summary?.totalRows || 0} Baris ({parsedImportData.summary?.totalKgs || 0} Kgs)
						</span>
						{#if hasInvalidItems}
							<span class="border border-black bg-[#FF6B6B] px-2.5 py-1 text-xs font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
								⚠️ {parsedImportData.summary?.invalidCount} Kode Tidak Sesuai
							</span>
						{:else}
							<span class="border border-black bg-emerald-100 px-2.5 py-1 text-xs font-black uppercase text-emerald-800">
								✓ Semua Kode Valid
							</span>
						{/if}
					</div>
				</div>

				<div class="border-2 border-black bg-slate-50 p-3 text-xs">
					<div class="font-black text-black uppercase text-[11px] mb-2 flex items-center gap-1.5">
						<span>🎯</span>
						<span>Status Header Transaksi:</span>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
						<div class="border border-black bg-white p-2">
							<div class="text-[10px] font-black uppercase text-black/60">Gudang Asal:</div>
							<div class="font-black text-sm">{parsedImportData.header?.locSrc || locSrc}</div>
						</div>
						<div class="border border-black bg-white p-2">
							<div class="text-[10px] font-black uppercase text-black/60">Gudang Tujuan:</div>
							<div class="font-black text-sm">{parsedImportData.header?.locDest || locDest}</div>
						</div>
						<div class="border border-black bg-white p-2">
							<div class="text-[10px] font-black uppercase text-black/60">No. Rator & Tipe:</div>
							<div class="font-black text-sm">
								Rator: {parsedImportData.header?.noRator != null ? parsedImportData.header.noRator : (noRator ?? '-')} | Tipe: {parsedImportData.header?.moveType || moveType}
							</div>
						</div>
					</div>
				</div>

				<div class="overflow-x-auto max-h-56 border-2 border-black">
					<table class="w-full border-collapse text-left text-xs font-mono">
						<thead>
							<tr class="bg-black text-white uppercase text-[10px]">
								<th class="border border-black px-2 py-1.5 w-10 text-center">No</th>
								<th class="border border-black px-2 py-1.5 w-32">Kode Barang</th>
								<th class="border border-black px-2 py-1.5">Nama Barang (taGoods)</th>
								<th class="border border-black px-2 py-1.5 w-16 text-center">Satuan</th>
								<th class="border border-black px-2 py-1.5 w-20 text-right">Bags</th>
								<th class="border border-black px-2 py-1.5 w-24 text-right">Qty (Kgs)</th>
								<th class="border border-black px-2 py-1.5 w-28 text-center">Status</th>
							</tr>
						</thead>
						<tbody>
							{#each parsedImportData.items as it, idx}
								<tr class="border-b border-black/10 hover:bg-slate-50 {it.isValid ? '' : 'bg-red-50 text-red-900'}">
									<td class="border-r border-black/10 px-2 py-1 text-center font-bold">{idx + 1}</td>
									<td class="border-r border-black/10 px-2 py-1 font-black">{it.itemId}</td>
									<td class="border-r border-black/10 px-2 py-1 truncate max-w-xs">{it.itemName}</td>
									<td class="border-r border-black/10 px-2 py-1 text-center">{it.satuan}</td>
									<td class="border-r border-black/10 px-2 py-1 text-right">{it.bags}</td>
									<td class="border-r border-black/10 px-2 py-1 text-right font-black">{it.kgs}</td>
									<td class="px-2 py-1 text-center">
										{#if it.isValid}
											<span class="border border-black bg-[#51CF66] px-1.5 py-0.2 text-[9px] font-black uppercase text-black">
												✓ VALID
											</span>
										{:else}
											<span class="border border-black bg-[#FF6B6B] px-1.5 py-0.2 text-[9px] font-black uppercase text-black" title={it.error}>
												✕ TIDAK ADA
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if hasInvalidItems || isLocInvalid}
					<Alert variant="error" title="Tidak Dapat Menerapkan ke Formulir:">
						<ul class="list-disc list-inside space-y-1 text-xs">
							{#if hasInvalidItems}
								<li>
									Terdapat <strong>{parsedImportData.summary?.invalidCount} barang</strong> dengan kode barang yang tidak terdaftar di master taGoods atau kuantiti tidak valid (&le; 0).
								</li>
							{/if}
							{#if isLocInvalid}
								<li>
									{parsedImportData.header?.locError || 'Gudang Asal dan Gudang Tujuan tidak boleh sama atau tidak terdaftar.'}
								</li>
							{/if}
						</ul>
					</Alert>
				{/if}
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<div class="flex w-full items-center justify-between">
			<button
				type="button"
				onclick={closeImportModal}
				class="border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200"
			>
				Batal
			</button>

			<button
				type="button"
				onclick={applyImportToForm}
				disabled={!canApplyImport}
				class="inline-flex items-center gap-2 border-[3px] border-black bg-[#51CF66] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] transition hover:bg-[#40C057] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
			>
				<CheckCircle2 class="h-4 w-4" />
				TERAPKAN KE FORM MUTASI
			</button>
		</div>
	{/snippet}
</Modal>
