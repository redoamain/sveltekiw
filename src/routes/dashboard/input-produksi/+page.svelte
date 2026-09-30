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
		Factory,
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
		Clock,
		Calendar,
		Building2,
		FileText,
		Layers,
		Columns3,
		ChevronRight,
		X,
		FileSpreadsheet,
		Download,
		Upload
	} from '@lucide/svelte';

	let { data, form } = $props();

	// Inisialisasi awal (mendukung SSR saat membuka langsung /dashboard/input-produksi?id=...)
	let initTx = untrack(() => data.initialEditData);
	let isEditMode = $state(Boolean(initTx));
	let selectedDept = $state(initTx?.header?.prodType || untrack(() => data.selectedDept) || 'AS');
	let prodDate = $state(initTx?.header?.prodDate || untrack(() => data.defaultDate) || new Date().toISOString().slice(0, 10));
	let prodId = $state(initTx?.header?.prodId || untrack(() => data.nextProdId) || '');
	let locId = $state(initTx?.header?.locId || '');
	let orderId = $state(initTx?.header?.orderId || '');
	let selectedSpkRemark = $state(initTx?.header?.spkRemark || initTx?.header?.remark || '');
	let shift = $state(initTx?.header?.shift || 1);
	let remark = $state(initTx?.header?.remark || '');
	let noRator = $state<number | null>(initTx?.header?.noRator ?? null);
	let notes = $state(initTx?.header?.notes || '');

	// SPK List State
	let spkList = $state(untrack(() => data.spkList) || []);
	let isSpkModalOpen = $state(false);
	let spkSearchQuery = $state('');
	let isSearchingSpk = $state(false);

	// Tab Mode: 'bahan' | 'hasil' | 'split'
	let activeTab = $state<'bahan' | 'hasil' | 'split'>('bahan');

	// State Rows (Hanya 2 Input: Bags dan Qty)
	interface DetailRow {
		id: string;
		itemType: 'B' | 'H';
		itemId: string;
		itemName: string;
		satuan: string;
		bags: number;
		qty: number;
	}

	let initBahan = initTx?.details?.filter((d: any) => d.itemType === 'B') || [];
	let initHasil = initTx?.details?.filter((d: any) => d.itemType === 'H') || [];

	let bahanList = $state<DetailRow[]>(
		initBahan.length > 0
			? initBahan.map((d: any) => ({
					id: crypto.randomUUID(),
					itemType: 'B',
					itemId: d.itemId || '',
					itemName: d.itemName || '',
					satuan: d.satuan || 'Pcs',
					bags: Number(d.bags) || 0,
					qty: Number(d.qty) || 0
				}))
			: [
					{
						id: crypto.randomUUID(),
						itemType: 'B',
						itemId: '',
						itemName: '',
						satuan: 'Pcs',
						bags: 0,
						qty: 0
					}
				]
	);

	let hasilList = $state<DetailRow[]>(
		initHasil.length > 0
			? initHasil.map((d: any) => ({
					id: crypto.randomUUID(),
					itemType: 'H',
					itemId: d.itemId || '',
					itemName: d.itemName || '',
					satuan: d.satuan || 'Pcs',
					bags: Number(d.bags) || 0,
					qty: Number(d.qty) || 0
				}))
			: [
					{
						id: crypto.randomUUID(),
						itemType: 'H',
						itemId: '',
						itemName: '',
						satuan: 'Pcs',
						bags: 0,
						qty: 0
					}
				]
	);

	// Auto-suggest Gudang berdasarkan Departemen
	function suggestWarehouse(dept: string): string {
		switch (dept) {
			case 'IN':
				return 'GUDIN';
			case 'AS':
				return 'GUDLOC';
			case 'PL':
				return 'GUDPL';
			case 'SP':
				return 'GUDSP';
			case 'MO':
				return 'GUDMO';
			default:
				return 'GUDLOC';
		}
	}

	$effect(() => {
		if (!locId) {
			locId = suggestWarehouse(selectedDept);
		}
	});

	let currentDeptName = $derived(
		data.departments.find((d: any) => d.PRDeptID === selectedDept)?.PRDeptName || selectedDept
	);

	let currentWarehouseName = $derived(
		data.warehouses.find((w: any) => w.LocID === locId)?.LocName || locId
	);

	// Ambil nomor ProdID berikutnya via API
	let isLoadingId = $state(false);
	async function refreshProdId() {
		if (isEditMode) return;
		isLoadingId = true;
		try {
			const res = await fetch(`/api/production/next-id?dept=${selectedDept}&date=${prodDate}`);
			const json = await res.json();
			if (json.prodId && !isEditMode) {
				prodId = json.prodId;
			}
		} catch (e) {
			console.error('Gagal mengambil next prod id:', e);
		} finally {
			isLoadingId = false;
		}
	}

	// Fetch SPK saat ganti departemen atau cari
	async function fetchSpkList(dept: string, query = '') {
		isSearchingSpk = true;
		try {
			const res = await fetch(
				`/api/production/spk-list?dept=${encodeURIComponent(dept)}&q=${encodeURIComponent(query)}`
			);
			const json = await res.json();
			if (json.spkList) {
				spkList = json.spkList;
			}
		} catch (e) {
			console.error('Gagal fetch SPK:', e);
		} finally {
			isSearchingSpk = false;
		}
	}

	// Tangani perubahan Departemen
	function onDeptChange(newDept: string) {
		selectedDept = newDept;
		locId = suggestWarehouse(newDept);
		orderId = '';
		selectedSpkRemark = '';
		if (!isEditMode) {
			refreshProdId();
		}
		fetchSpkList(newDept, spkSearchQuery);
	}

	// Handle SPK Search debounce
	let spkDebounce: any;
	function performSearchSpk(q: string) {
		spkSearchQuery = q;
		fetchSpkList(selectedDept, q);
	}

	function handleSpkSearchInput() {
		clearTimeout(spkDebounce);
		spkDebounce = setTimeout(() => {
			fetchSpkList(selectedDept, spkSearchQuery);
		}, 300);
	}

	// Pilih SPK (Hanya set SPK, hasil produksi tetap diinput manual)
	function selectSpk(spk: any) {
		orderId = spk.OrderID;
		selectedSpkRemark = spk.Remark || '';
		isSpkModalOpen = false;
		toast.info(`SPK #${spk.OrderID} dipilih.`, { title: 'SPK Terpasang' });
	}

	// ==================== IMPORT EXCEL STATE & LOGIC ====================
	let isImportModalOpen = $state(false);
	let isUploadingImport = $state(false);
	let importError = $state('');
	let importSuccessMessage = $state('');
	let parsedImportData = $state<any>(null);
	let importActiveTab = $state<'bahan' | 'hasil'>('bahan');
	let currentImportItems = $derived(
		parsedImportData
			? (importActiveTab === 'bahan' ? parsedImportData.bahanList : parsedImportData.hasilList) || []
			: []
	);
	let importFileInputRef = $state<HTMLInputElement | null>(null);

	// Validasi kelayakan data import sebelum diterapkan ke formulir
	let hasInvalidItems = $derived(Boolean(parsedImportData && (parsedImportData.summary?.invalidCount > 0)));
	let isSpkInvalid = $derived.by(() => {
		if (!parsedImportData) return false;
		const h = parsedImportData.header;
		if (h?.orderId) {
			return !h.isSpkValid;
		}
		// Jika Excel tidak mencantumkan No SPK, wajib sudah ada SPK yang dipilih di formulir web
		return !orderId;
	});
	let canApplyImport = $derived(
		Boolean(
			parsedImportData &&
			((parsedImportData.bahanList && parsedImportData.bahanList.length > 0) ||
			 (parsedImportData.hasilList && parsedImportData.hasilList.length > 0)) &&
			!hasInvalidItems &&
			!isSpkInvalid
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

			const res = await fetch('/api/production/import', {
				method: 'POST',
				body: fd,
				credentials: 'same-origin'
			});

			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error || 'Gagal memproses file Excel.');
			}

			parsedImportData = json;
			if (json.bahanList && json.bahanList.length > 0) {
				importActiveTab = 'bahan';
			} else if (json.hasilList && json.hasilList.length > 0) {
				importActiveTab = 'hasil';
			}
			toast.info(`Berhasil membaca file ${file.name}. Periksa rincian sebelum menerapkan.`);
		} catch (err: any) {
			importError = err?.message || 'Terjadi kesalahan saat membaca file Excel.';
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

		// 1. Terapkan rincian Bahan Baku jika ada
		if (parsedImportData.bahanList && parsedImportData.bahanList.length > 0) {
			bahanList = parsedImportData.bahanList.map((item: any) => ({
				id: crypto.randomUUID(),
				itemType: 'B',
				itemId: item.itemId || '',
				itemName: item.itemName || '',
				satuan: item.satuan || 'Pcs',
				bags: Number(item.bags) || 0,
				qty: Number(item.qty) || 0
			}));
		}

		// 2. Terapkan rincian Hasil Produksi jika ada
		if (parsedImportData.hasilList && parsedImportData.hasilList.length > 0) {
			hasilList = parsedImportData.hasilList.map((item: any) => ({
				id: crypto.randomUUID(),
				itemType: 'H',
				itemId: item.itemId || '',
				itemName: item.itemName || '',
				satuan: item.satuan || 'Pcs',
				bags: Number(item.bags) || 0,
				qty: Number(item.qty) || 0
			}));
		}

		// 3. Terapkan Header Transaksi jika diisi dalam Excel
		const h = parsedImportData.header;
		if (h) {
			if (h.orderId && h.isSpkValid) {
				orderId = h.orderId;
				selectedSpkRemark = h.spkRemark || '';
			}
			if (h.locId) locId = h.locId;
			if (h.prodDate) prodDate = h.prodDate;
			if (h.shift) shift = Number(h.shift) || shift;
			if (h.remark) remark = h.remark;
			if (h.noRator != null) noRator = Number(h.noRator);
		}

		const totalBahan = parsedImportData.summary?.totalBahanRows || 0;
		const totalHasil = parsedImportData.summary?.totalHasilRows || 0;
		let spkMsg = '';
		if (h?.orderId && h?.isSpkValid) {
			spkMsg = ` dengan SPK ${h.orderId}`;
		} else if (orderId) {
			spkMsg = ` dengan SPK aktif ${orderId}`;
		} else {
			spkMsg = ` (PENTING: Jangan lupa pilih SPK di form sebelum menyimpan)`;
		}

		importSuccessMessage = `Berhasil menerapkan ${totalBahan} baris bahan baku & ${totalHasil} baris hasil produksi dari file Excel${spkMsg}.`;
		toast.success(importSuccessMessage, { title: 'Import Excel Berhasil' });

		closeImportModal();
	}

	// Edit Mode State & Functions
	let isLoadModalOpen = $state(false);
	let loadSearchProdId = $state('');
	let isLoadingTransaction = $state(false);
	let loadError = $state('');
	let searchTransactionsResult = $state<any[]>([]);
	let isSearchingTransactions = $state(false);
	let searchTxDebounce: any;

	function performSearchTransaction(q: string) {
		loadSearchProdId = q;
		const trimmed = q.trim();
		if (!trimmed) {
			searchTransactionsResult = [];
			return;
		}
		isSearchingTransactions = true;
		fetch(`/api/production/search-transactions?q=${encodeURIComponent(trimmed)}`)
			.then((res) => res.json())
			.then((json) => {
				if (json.transactions) {
					searchTransactionsResult = json.transactions;
				}
			})
			.catch((e) => {
				console.error('Gagal mencari transaksi:', e);
			})
			.finally(() => {
				isSearchingTransactions = false;
			});
	}

	function handleSearchTransactionInput() {
		clearTimeout(searchTxDebounce);
		const q = loadSearchProdId.trim();
		if (!q) {
			searchTransactionsResult = [];
			return;
		}
		searchTxDebounce = setTimeout(() => {
			performSearchTransaction(q);
		}, 300);
	}

	function applyTransactionData(txData: any) {
		if (!txData || !txData.header) return;
		isEditMode = true;
		prodId = String(txData.header.prodId || '').trim();
		selectedDept = txData.header.prodType || 'AS';
		prodDate = txData.header.prodDate || new Date().toISOString().slice(0, 10);
		locId = txData.header.locId || suggestWarehouse(selectedDept);
		orderId = txData.header.orderId || '';
		selectedSpkRemark = txData.header.spkRemark || txData.header.remark || '';
		shift = Number(txData.header.shift) || 1;
		remark = txData.header.remark || '';
		noRator = txData.header.noRator != null ? Number(txData.header.noRator) : null;
		notes = txData.header.notes || '';

		const bRows = (txData.details || []).filter((d: any) => d.itemType === 'B');
		const hRows = (txData.details || []).filter((d: any) => d.itemType === 'H');

		bahanList = bRows.length > 0
			? bRows.map((d: any) => ({
					id: crypto.randomUUID(),
					itemType: 'B',
					itemId: d.itemId || '',
					itemName: d.itemName || '',
					satuan: d.satuan || 'Pcs',
					bags: Number(d.bags) || 0,
					qty: Number(d.qty) || 0
				}))
			: [{ id: crypto.randomUUID(), itemType: 'B', itemId: '', itemName: '', satuan: 'Pcs', bags: 0, qty: 0 }];

		hasilList = hRows.length > 0
			? hRows.map((d: any) => ({
					id: crypto.randomUUID(),
					itemType: 'H',
					itemId: d.itemId || '',
					itemName: d.itemName || '',
					satuan: d.satuan || 'Pcs',
					bags: Number(d.bags) || 0,
					qty: Number(d.qty) || 0
				}))
			: [{ id: crypto.randomUUID(), itemType: 'H', itemId: '', itemName: '', satuan: 'Pcs', bags: 0, qty: 0 }];

		fetchSpkList(selectedDept, spkSearchQuery);
	}

	function resetToNewMode() {
		isEditMode = false;
		orderId = '';
		selectedSpkRemark = '';
		remark = '';
		noRator = null;
		notes = '';
		bahanList = [{ id: crypto.randomUUID(), itemType: 'B', itemId: '', itemName: '', satuan: 'Pcs', bags: 0, qty: 0 }];
		hasilList = [{ id: crypto.randomUUID(), itemType: 'H', itemId: '', itemName: '', satuan: 'Pcs', bags: 0, qty: 0 }];
		if (typeof history !== 'undefined') {
			history.pushState({}, '', '/dashboard/input-produksi');
		}
		refreshProdId();
	}

	// Delete Transaction States
	let isDeleteModalOpen = $state(false);
	let targetDeleteProdId = $state('');
	let isDeleting = $state(false);
	let deleteError = $state('');
	let deleteSuccessMessage = $state('');

	function openDeleteConfirm(id: string) {
		targetDeleteProdId = id;
		deleteError = '';
		isDeleteModalOpen = true;
	}

	function closeDeleteModal() {
		if (isDeleting) return;
		isDeleteModalOpen = false;
		targetDeleteProdId = '';
		deleteError = '';
	}

	async function executeDelete() {
		if (!targetDeleteProdId.trim()) return;
		isDeleting = true;
		deleteError = '';
		try {
			const res = await fetch('/api/production/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prodId: targetDeleteProdId.trim() })
			});
			const json = await res.json();
			if (json.success) {
				deleteSuccessMessage = json.message || `Bukti produksi ${targetDeleteProdId} berhasil dihapus.`;
				isDeleteModalOpen = false;

				// Hapus dari data.recentTransactions jika ada
				if (data.recentTransactions) {
					data.recentTransactions = data.recentTransactions.filter(
						(rx: any) => rx.prodId !== targetDeleteProdId
					);
				}

				// Jika transaksi yang dihapus sedang dibuka di form, reset ke Input Baru
				if (isEditMode && prodId === targetDeleteProdId) {
					resetToNewMode();
				} else {
					refreshProdId();
				}

				// Hilangkan notifikasi sukses setelah 6 detik
				setTimeout(() => {
					deleteSuccessMessage = '';
				}, 6000);
			} else {
				deleteError = json.error || 'Gagal menghapus transaksi.';
			}
		} catch (e: any) {
			deleteError = e?.message || 'Gagal menghubungi server untuk menghapus.';
		} finally {
			isDeleting = false;
		}
	}

	async function loadTransactionById(idToLoad: string) {
		const trimmedId = idToLoad.trim();
		if (!trimmedId) return;
		isLoadingTransaction = true;
		loadError = '';
		try {
			const res = await fetch(`/api/production/get-transaction?prodId=${encodeURIComponent(trimmedId)}`);
			const json = await res.json();
			if (json.success) {
				applyTransactionData(json);
				isLoadModalOpen = false;
				loadSearchProdId = '';
				searchTransactionsResult = [];
				if (typeof history !== 'undefined') {
					history.pushState({}, '', `/dashboard/input-produksi?id=${encodeURIComponent(trimmedId)}`);
				}
				toast.info(`Transaksi produksi #${trimmedId} dimuat ke formulir.`, {
					title: 'Mode Edit Aktif'
				});
			} else {
				loadError = json.error || 'Transaksi tidak ditemukan.';
				toast.error(loadError);
			}
		} catch (e: any) {
			loadError = e?.message || 'Gagal memuat transaksi.';
			toast.error(loadError);
		} finally {
			isLoadingTransaction = false;
		}
	}

	// Inisialisasi awal jika ada initialEditData dari URL ?id=...
	$effect(() => {
		if (data.initialEditData) {
			untrack(() => {
				applyTransactionData(data.initialEditData);
			});
		}
	});

	// Modal Cari Barang
	let itemSearchOpen = $state(false);
	let itemSearchQuery = $state('');
	let itemSearchResults = $state<any[]>([]);
	let isSearchingItems = $state(false);
	let targetRowId = $state<string | null>(null);
	let targetRowType = $state<'B' | 'H'>('B');

	function openItemSearch(rowId: string, type: 'B' | 'H') {
		targetRowId = rowId;
		targetRowType = type;
		itemSearchQuery = '';
		itemSearchResults = [];
		itemSearchOpen = true;
	}

	let itemDebounce: any;
	function performSearchItem(q: string) {
		itemSearchQuery = q;
		const trimmed = q.trim();
		if (!trimmed) {
			itemSearchResults = [];
			return;
		}
		isSearchingItems = true;
		fetch(`/api/production/search-items?q=${encodeURIComponent(trimmed)}`)
			.then((res) => res.json())
			.then((json) => {
				itemSearchResults = json.items || [];
			})
			.catch((e) => {
				console.error('Gagal cari barang:', e);
			})
			.finally(() => {
				isSearchingItems = false;
			});
	}

	function handleItemSearchInput() {
		clearTimeout(itemDebounce);
		const q = itemSearchQuery.trim();
		if (!q) {
			itemSearchResults = [];
			return;
		}
		itemDebounce = setTimeout(() => {
			performSearchItem(q);
		}, 300);
	}

	function selectItem(item: any) {
		if (!targetRowId) return;
		const updateRow = (row: DetailRow) => {
			if (row.id === targetRowId) {
				return {
					...row,
					itemId: item.ItemID,
					itemName: item.ItemName,
					satuan: item.Satuan
				};
			}
			return row;
		};

		if (targetRowType === 'B') {
			bahanList = bahanList.map(updateRow);
		} else {
			hasilList = hasilList.map(updateRow);
		}
		itemSearchOpen = false;
		toast.info(`Barang #${item.ItemID} dipilih.`);
		targetRowId = null;
	}

	// Tambah / Hapus Baris
	function addBahanRow() {
		bahanList = [
			...bahanList,
			{
				id: crypto.randomUUID(),
				itemType: 'B',
				itemId: '',
				itemName: '',
				satuan: 'Pcs',
				bags: 0,
				qty: 0
			}
		];
	}

	// Modal Konfirmasi Hapus Item
	let isDeleteItemModalOpen = $state(false);
	let targetDeleteItem = $state<{
		id: string;
		type: 'B' | 'H';
		itemId: string;
		itemName: string;
		bags: number;
		qty: number;
		satuan: string;
	} | null>(null);

	function requestRemoveItem(row: DetailRow, type: 'B' | 'H') {
		// Jika baris kosong (belum dipilih barang dan angka 0), hapus langsung tanpa modal
		if (!row.itemId.trim() && row.bags === 0 && row.qty === 0) {
			executeRemoveRowDirect(row.id, type);
			return;
		}

		// Jika baris ada isinya, buka modal konfirmasi
		targetDeleteItem = {
			id: row.id,
			type,
			itemId: row.itemId,
			itemName: row.itemName,
			bags: row.bags,
			qty: row.qty,
			satuan: row.satuan
		};
		isDeleteItemModalOpen = true;
	}

	function closeDeleteItemModal() {
		isDeleteItemModalOpen = false;
		targetDeleteItem = null;
	}

	function executeRemoveRowDirect(id: string, type: 'B' | 'H') {
		if (type === 'B') {
			if (bahanList.length > 1) {
				bahanList = bahanList.filter((b) => b.id !== id);
			} else {
				bahanList = [{ id: crypto.randomUUID(), itemType: 'B', itemId: '', itemName: '', satuan: 'Pcs', bags: 0, qty: 0 }];
			}
		} else {
			if (hasilList.length > 1) {
				hasilList = hasilList.filter((h) => h.id !== id);
			} else {
				hasilList = [{ id: crypto.randomUUID(), itemType: 'H', itemId: '', itemName: '', satuan: 'Pcs', bags: 0, qty: 0 }];
			}
		}
	}

	function confirmExecuteRemoveItem() {
		if (!targetDeleteItem) return;
		executeRemoveRowDirect(targetDeleteItem.id, targetDeleteItem.type);
		closeDeleteItemModal();
	}

	function addHasilRow() {
		hasilList = [
			...hasilList,
			{
				id: crypto.randomUUID(),
				itemType: 'H',
				itemId: '',
				itemName: '',
				satuan: 'Pcs',
				bags: 0,
				qty: 0
			}
		];
	}

	// Helper Input Khusus Angka (Integer Only)
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
		}
	}

	// Kalkulasi Statistik
	let totalBahanBags = $derived(bahanList.reduce((sum, b) => sum + (Number(b.bags) || 0), 0));
	let totalBahanQty = $derived(bahanList.reduce((sum, b) => sum + (Number(b.qty) || 0), 0));
	let totalHasilBags = $derived(hasilList.reduce((sum, h) => sum + (Number(h.bags) || 0), 0));
	let totalHasilQty = $derived(hasilList.reduce((sum, h) => sum + (Number(h.qty) || 0), 0));
	let rasioPersen = $derived(
		totalBahanQty > 0 ? ((totalHasilQty / totalBahanQty) * 100).toFixed(1) : '0'
	);

	// Status form submission
	let isSubmitting = $state(false);

	// Status validasi kelayakan simpan
	let hasValidBahan = $derived(bahanList.some((b) => b.itemId.trim()));
	let hasValidHasil = $derived(hasilList.some((h) => h.itemId.trim()));
	let hasValidItems = $derived(hasValidBahan || hasValidHasil);
	let canSubmit = $derived(
		Boolean(data.canInputProduction) && !isSubmitting && Boolean(orderId) && Boolean(locId) && hasValidItems
	);

	let payloadJson = $derived(
		JSON.stringify({
			prodId,
			prodType: selectedDept,
			prodDate,
			locId,
			orderId,
			shift,
			remark,
			noRator,
			notes,
			details: [
				...bahanList
					.filter((b) => b.itemId.trim())
					.map((b) => ({
						itemType: 'B',
						itemId: b.itemId.trim(),
						bags: Math.round(Number(b.bags)) || 0,
						kgs: Math.round(Number(b.qty)) || 0,
						bagsLeft: 0,
						kgsLeft: 0,
						keterangan: null
					})),
				...hasilList
					.filter((h) => h.itemId.trim())
					.map((h) => ({
						itemType: 'H',
						itemId: h.itemId.trim(),
						bags: Math.round(Number(h.bags)) || 0,
						kgs: Math.round(Number(h.qty)) || 0,
						batch: null,
						jamMulai: null,
						jamSelesai: null,
						keterangan: null
					}))
			]
		})
	);
</script>

<svelte:head>
	<title>Input Transaksi Produksi | KIW Brutal</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 pb-24 font-sans text-black">
	<!-- HEADER TITLE (NEO-BRUTAL BANNER) -->
	<div class="border-[3px] border-black bg-[#FFDF00] p-5 shadow-[5px_5px_0px_0px_#000]">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-1">
				<div class="inline-block border-2 border-black bg-black px-2 py-0.5 text-xs font-black uppercase tracking-widest text-[#FFDF00]">
					MODUL INPUT PRODUKSI
				</div>
				<h1 class="text-3xl font-black uppercase tracking-tight text-black sm:text-4xl">
					{#if isEditMode}
						EDIT BUKTI PRODUKSI #{prodId}
					{:else}
						INPUT BUKTI PRODUKSI
					{/if}
				</h1>
				<p class="text-xs font-bold text-black/80">
					Menambahkan data transaksi ke <span class="bg-black px-1.5 py-0.5 font-mono text-white">taPRProdHd</span> & <span class="bg-black px-1.5 py-0.5 font-mono text-white">taPRProdDt</span>
				</p>
				<div class="mt-2 flex flex-wrap items-center gap-2 pt-1">
					<span class="text-xs font-black uppercase text-black/70">Role Login:</span>
					{#if data.isSuperAdmin}
						<span class="inline-flex items-center gap-1 border-2 border-black bg-[#51CF66] px-2.5 py-0.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000]">
							⭐ Bagian IT (Superadmin — Akses Semua Departemen)
						</span>
					{:else if data.canInputProduction}
						<span class="inline-flex items-center gap-1 border-2 border-black bg-white px-2.5 py-0.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000]">
							🔒 Bagian {data.userRole} (Khusus Departemen {data.userRole})
						</span>
					{:else}
						<span class="inline-flex items-center gap-1 border-2 border-black bg-[#FF6B6B] px-2.5 py-0.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000]">
							🚫 Bagian {data.userRole} (Tidak Berwenang Menginput)
						</span>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#if data.canInputProduction}
					<button
						type="button"
						onclick={openImportModal}
						class="inline-flex items-center gap-2 border-2 border-black bg-[#51CF66] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] transition hover:-translate-y-0.5 hover:bg-[#40C057] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
					>
						<FileSpreadsheet class="h-4 w-4" />
						Import Excel
					</button>
				{/if}
				<button
					type="button"
					onclick={() => (isLoadModalOpen = true)}
					class="inline-flex items-center gap-2 border-2 border-black bg-[#4DABF7] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] transition hover:-translate-y-0.5 hover:bg-[#339AF0] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
				>
					<Search class="h-4 w-4" />
					Cari / Edit Transaksi
				</button>
				<a
					href="/dashboard/monitoring-produksi"
					class="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] transition hover:-translate-y-0.5 hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
				>
					<ExternalLink class="h-4 w-4" />
					Monitoring Produksi
				</a>
			</div>
		</div>
	</div>

	<!-- PERMISSION ALERT JIKA ROLE TIDAK SESUAI -->
	{#if !data.canInputProduction}
		<Alert variant="error" title={`AKSES INPUT DIBATASI UNTUK ROLE '${data.userRole}'`}>
			Sesuai hak akses sistem (tabel <span class="bg-black text-white px-1 py-0.5 font-mono text-[11px]">MenuCP.dbo.taUser</span>), kolom <span class="bg-black text-white px-1 py-0.5 font-mono text-[11px]">Bagian</span> digunakan untuk membatasi departemen penginputan. Hanya departemen produksi terkait (AS, IN, PL, SP, MO) atau <strong>IT (Superadmin)</strong> yang berhak menginput data produksi.
		</Alert>
	{/if}

	{#if data.editPermissionError}
		<Alert variant="error" title="Peringatan Hak Akses:">
			{data.editPermissionError}
		</Alert>
	{/if}

	<!-- IMPORT SUCCESS ALERT -->
	{#if importSuccessMessage}
		<Alert variant="success" title="Import Berhasil:">
			{importSuccessMessage}
		</Alert>
	{/if}

	<!-- EDIT MODE BANNER -->
	{#if isEditMode}
		<div class="border-[3px] border-black bg-[#CC5DE8] p-4 font-black text-white shadow-[5px_5px_0px_0px_#000]">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-2">
					<span class="text-xl">✏️</span>
					<div>
						<div class="text-sm font-black uppercase tracking-wider">
							MODE EDIT TRANSAKSI: #{prodId}
						</div>
						<div class="text-xs font-semibold text-white/90">
							Anda sedang mengedit transaksi ini. Lengkapi hasil produksi atau sesuaikan bahan, lalu simpan perubahan.
						</div>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => openDeleteConfirm(prodId)}
						class="inline-flex items-center gap-1.5 border-2 border-black bg-[#FF6B6B] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition hover:bg-red-500 hover:text-white active:translate-x-0.5 active:translate-y-0.5"
					>
						<Trash2 class="h-4 w-4" />
						Hapus Transaksi
					</button>
					<button
						type="button"
						onclick={resetToNewMode}
						class="border-2 border-black bg-white px-3.5 py-1.5 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000] hover:bg-slate-100"
					>
						✕ Batal Edit / Input Baru
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- DELETE SUCCESS ALERT -->
	{#if deleteSuccessMessage}
		<Alert variant="success" title="Bukti Produksi Dihapus!">
			{deleteSuccessMessage}
		</Alert>
	{/if}

	<!-- ALERTS -->
	{#if form?.success}
		<Alert variant="success" title={`SUKSES ${isEditMode ? 'MEMPERBARUI' : 'MENYIMPAN'}!`}>
			<div>{form.message}</div>
			<div class="mt-2 flex gap-4 text-xs underline">
				<a href="/dashboard/monitoring-produksi?q={form.prodId}">
					Cek di Monitoring Produksi →
				</a>
				<button type="button" onclick={resetToNewMode} class="font-bold uppercase">
					Input Transaksi Baru +
				</button>
			</div>
		</Alert>
	{/if}

	{#if form?.error}
		<Alert variant="error" title="GAGAL MENYIMPAN TRANSAKSI!">
			{form.error}
		</Alert>
	{/if}

	<!-- FORM UTAMA -->
	<form
		method="POST"
		action={isEditMode ? '?/update' : '?/create'}
		use:enhance={({ formData }) => {
			formData.set('payload', payloadJson);
			isSubmitting = true;
			return async ({ result, update }) => {
				await update();
				isSubmitting = false;
				if (result.type === 'success') {
					const data = result.data as any;
					toast.success(data?.message || 'Transaksi produksi berhasil disimpan!', {
						description: data?.prodId ? `ProdID: ${data.prodId}` : undefined
					});
				} else if (result.type === 'failure') {
					const data = result.data as any;
					toast.error(data?.error || 'Gagal menyimpan transaksi produksi.', { title: 'Gagal Menyimpan Produksi' });
				} else if (result.type === 'error') {
					toast.error('Terjadi kesalahan pada server saat memproses transaksi produksi.', { title: 'Kesalahan Sistem' });
				}
			};
		}}
		class="space-y-6"
	>
		<input type="hidden" name="payload" value={payloadJson} />

		<!-- 1. HEADER TRANSAKSI (NEO-BRUTAL PANEL) -->
		<div class="border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
			<div class="mb-4 flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
				<div class="flex items-center gap-2">
					<div class="border-2 border-black bg-black p-1 text-white">
						<FileText class="h-4 w-4" />
					</div>
					<h2 class="text-lg font-black uppercase tracking-wider">
						1. INFORMASI HEADER PRODUKSI
					</h2>
				</div>
				<div class="border-2 border-black bg-[#CC5DE8] px-2.5 py-0.5 font-mono text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_#000]">
					{currentDeptName}
				</div>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Departemen -->
				<div class="space-y-1">
					<div class="flex items-center justify-between">
						<label for="dept-select" class="block text-xs font-black uppercase tracking-wider text-black">
							Departemen *
						</label>
						{#if !data.isSuperAdmin}
							<span class="border border-black bg-yellow-200 px-1.5 py-0.2 text-[10px] font-black uppercase text-black">
								🔒 Terkunci ({data.userRole})
							</span>
						{/if}
					</div>
					<select
						id="dept-select"
						value={selectedDept}
						onchange={(e) => onDeptChange((e.target as HTMLSelectElement).value)}
						disabled={!data.isSuperAdmin}
						class="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-700"
					>
						{#each data.departments as d}
							{#if data.isSuperAdmin || d.PRDeptID === selectedDept}
								<option value={d.PRDeptID}>{d.PRDeptName} ({d.PRDeptID})</option>
							{/if}
						{/each}
					</select>
					{#if !data.isSuperAdmin}
						<p class="text-[10px] font-bold text-black/70">
							Role Anda: <strong>{data.userRole}</strong>. Hanya berwenang menginput data departemen {data.userRole}.
						</p>
					{/if}
				</div>

				<!-- Tanggal Produksi -->
				<div class="space-y-1">
					<label for="date-input" class="block text-xs font-black uppercase tracking-wider text-black">
						Tanggal Produksi *
					</label>
					<input
						id="date-input"
						type="date"
						bind:value={prodDate}
						onchange={refreshProdId}
						class="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none"
					/>
				</div>

				<!-- No Produksi (ProdID) - OTOMATIS & TIDAK BISA DIEDIT -->
				<div class="space-y-1">
					<div class="flex items-center justify-between">
						<label for="prodid-input" class="text-xs font-black uppercase tracking-wider text-black">
							No. Produksi *
						</label>
						{#if isEditMode}
							<span class="border border-black bg-yellow-300 px-1.5 py-0.5 text-[10px] font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
								✏️ SEDANG DIEDIT
							</span>
						{:else}
							<span class="border border-black bg-amber-200 px-1.5 py-0.2 text-[10px] font-black uppercase text-black">
								🔒 OTOMATIS
							</span>
						{/if}
					</div>
					<div class="relative">
						<input
							id="prodid-input"
							type="text"
							value={isLoadingId ? 'Mengambil nomor...' : prodId}
							readonly
							tabindex="-1"
							class="w-full cursor-not-allowed border-2 border-black {isEditMode ? 'bg-amber-100 font-black text-black ring-1 ring-black' : 'bg-slate-100 font-bold text-black'} px-3 py-2 font-mono text-base tracking-wide shadow-[3px_3px_0px_0px_#000] select-all focus:outline-none"
						/>
						{#if isLoadingId}
							<RefreshCw class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-black" />
						{/if}
					</div>
				</div>

				<!-- Shift -->
				<div class="space-y-1">
					<label for="shift-select" class="block text-xs font-black uppercase tracking-wider text-black">
						Shift Kerja
					</label>
					<select
						id="shift-select"
						bind:value={shift}
						class="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none"
					>
						<option value={1}>Shift 1 (Pagi)</option>
						<option value={2}>Shift 2 (Siang/Sore)</option>
						<option value={3}>Shift 3 (Malam)</option>
					</select>
				</div>

				<!-- SPK / ORDER ID SELECTOR -->
				<div class="space-y-1 sm:col-span-2">
					<label for="spk-picker-btn" class="block text-xs font-black uppercase tracking-wider text-black">
						Surat Perintah Kerja (SPK) *
					</label>
					<div class="flex items-stretch gap-2">
						<button
							id="spk-picker-btn"
							type="button"
							onclick={() => {
								isSpkModalOpen = true;
								fetchSpkList(selectedDept, spkSearchQuery);
							}}
							class="flex-1 border-2 border-black bg-white p-2.5 text-left shadow-[3px_3px_0px_0px_#000] transition hover:bg-slate-50 focus:bg-yellow-50 focus:outline-none"
						>
							{#if orderId}
								<div class="flex items-center justify-between">
									<span class="font-mono text-base font-black text-black">{orderId}</span>
									<span class="border border-black bg-[#51CF66] px-1.5 py-0.5 text-[10px] font-black uppercase text-black">
										TERPILIH
									</span>
								</div>
								{#if selectedSpkRemark}
									<div class="text-xs font-bold text-black/70">PO: {selectedSpkRemark}</div>
								{/if}
							{:else}
								<div class="flex items-center justify-between text-slate-500">
									<span class="text-xs font-black uppercase">🔍 KLIK UNTUK PILIH SPK...</span>
									<span class="border border-black bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-black">
										{spkList.length} SPK TERSEDIA
									</span>
								</div>
							{/if}
						</button>

						<button
							type="button"
							onclick={() => {
								isSpkModalOpen = true;
								fetchSpkList(selectedDept, spkSearchQuery);
							}}
							class="border-2 border-black bg-[#4DABF7] px-4 font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] transition hover:bg-[#339AF0] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
						>
							CARI SPK
						</button>
					</div>
				</div>

				<!-- Gudang Lokasi -->
				<div class="space-y-1">
					<label for="loc-select" class="block text-xs font-black uppercase tracking-wider text-black">
						Gudang Lokasi *
					</label>
					<select
						id="loc-select"
						bind:value={locId}
						class="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none"
					>
						{#each data.warehouses as w}
							<option value={w.LocID}>
								{w.LocName}
							</option>
						{/each}
					</select>
				</div>

				<!-- No. Rator -->
				<div class="space-y-1">
					<label for="rator-input" class="block text-xs font-black uppercase tracking-wider text-black">
						No. Rator
					</label>
					<input
						id="rator-input"
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						value={noRator ?? ''}
						placeholder="Misal: 1026467"
						onkeydown={preventNonDigits}
						onpaste={handlePasteDigitsOnly}
						oninput={(e) => handleIntegerInput(e, (val) => (noRator = val === 0 ? null : val))}
						class="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none"
					/>
				</div>

				<!-- Remark -->
				<div class="space-y-1 sm:col-span-4">
					<label for="remark-input" class="block text-xs font-black uppercase tracking-wider text-black">
						Catatan / Remark Header
					</label>
					<input
						id="remark-input"
						type="text"
						bind:value={remark}
						placeholder="Keterangan tambahan transaksi..."
						class="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none"
					/>
				</div>
			</div>
		</div>

		<!-- 2. PEMISAH TAMPILAN BAHAN VS HASIL (TAB SELECTOR NEO-BRUTAL) -->
		<div class="flex flex-wrap items-center gap-3 border-[3px] border-black bg-[#FFF9DB] p-3 shadow-[5px_5px_0px_0px_#000]">
			<span class="mr-2 text-xs font-black uppercase tracking-wider text-black">
				MODE TAMPILAN:
			</span>

			<!-- TAB 1: BAHAN BAKU -->
			<button
				type="button"
				onclick={() => (activeTab = 'bahan')}
				class="inline-flex items-center gap-2 border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-wider transition {activeTab ===
				'bahan'
					? 'bg-[#FFA94D] text-black shadow-[3px_3px_0px_0px_#000] -translate-y-0.5'
					: 'bg-white text-black hover:bg-slate-100'}"
			>
				<Boxes class="h-4 w-4" />
				[ 📦 TAB 1: BAHAN BAKU (ITEMTYPE B) ]
				<span class="border border-black bg-black px-1.5 py-0.2 text-[10px] text-white">
					{bahanList.length} Item
				</span>
			</button>

			<!-- TAB 2: HASIL PRODUKSI -->
			<button
				type="button"
				onclick={() => (activeTab = 'hasil')}
				class="inline-flex items-center gap-2 border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-wider transition {activeTab ===
				'hasil'
					? 'bg-[#51CF66] text-black shadow-[3px_3px_0px_0px_#000] -translate-y-0.5'
					: 'bg-white text-black hover:bg-slate-100'}"
			>
				<PackageCheck class="h-4 w-4" />
				[ 🏆 TAB 2: HASIL PRODUKSI (ITEMTYPE H) ]
				<span class="border border-black bg-black px-1.5 py-0.2 text-[10px] text-white">
					{hasilList.length} Item
				</span>
			</button>

			<!-- TAB 3: DUAL PANEL (SPLIT) -->
			<button
				type="button"
				onclick={() => (activeTab = 'split')}
				class="inline-flex items-center gap-2 border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-wider transition {activeTab ===
				'split'
					? 'bg-[#CC5DE8] text-white shadow-[3px_3px_0px_0px_#000] -translate-y-0.5'
					: 'bg-white text-black hover:bg-slate-100'}"
			>
				<Columns3 class="h-4 w-4" />
				[ ⚡ TAMPILKAN KEDUANYA (SPLIT SCREEN) ]
			</button>
		</div>

		<!-- PANEL DETAIL CONTENT (TERPISAH ATAU SPLIT) -->
		<div class="grid grid-cols-1 gap-6 {activeTab === 'split' ? 'lg:grid-cols-2' : ''}">
			<!-- SECTION A: BAHAN BAKU (ItemType = 'B') -->
			{#if activeTab === 'bahan' || activeTab === 'split'}
				<div class="space-y-4 border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
					<div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
						<div class="flex items-center gap-2">
							<div class="border-2 border-black bg-[#FFA94D] p-1.5 text-black">
								<Boxes class="h-5 w-5" />
							</div>
							<div>
								<h2 class="text-base font-black uppercase tracking-wider">
									BAHAN BAKU YANG DIPAKAI (OUT)
								</h2>
								<p class="text-xs font-bold text-black/70">
									Kurangi stok dari: <span class="border border-black bg-black px-1.5 py-0.5 text-xs font-bold text-white">{currentWarehouseName}</span>
								</p>
							</div>
						</div>

						<button
							type="button"
							onclick={addBahanRow}
							class="inline-flex items-center gap-1.5 border-2 border-black bg-[#FFA94D] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] transition hover:bg-[#FF922B] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
						>
							<Plus class="h-4 w-4" />
							TAMBAH BARIS BAHAN
						</button>
					</div>

					<div class="space-y-3">
						{#each bahanList as row, idx (row.id)}
							<div class="border-2 border-black bg-[#FFF4E6] p-3 shadow-[3px_3px_0px_0px_#000]">
								<div class="mb-2 flex items-center justify-between border-b border-black/20 pb-1.5 text-xs font-black uppercase">
									<span>BARIS #{idx + 1} BAHAN</span>
									<button
										type="button"
										onclick={() => requestRemoveItem(row, 'B')}
										class="inline-flex items-center gap-1 border border-black bg-[#FF6B6B] px-2 py-0.5 text-[10px] font-black uppercase text-black transition hover:bg-red-500 hover:text-white active:translate-x-0.5 active:translate-y-0.5"
									>
										<Trash2 class="h-3 w-3" />
										HAPUS
									</button>
								</div>

								<div class="space-y-2">
									<!-- Kode & Nama Barang -->
									<div>
										<span class="block text-[11px] font-black uppercase text-black">
											Kode Barang / ItemID *
										</span>
										<button
											type="button"
											onclick={() => openItemSearch(row.id, 'B')}
											class="w-full border-2 border-black bg-white px-3 py-2 text-left font-bold shadow-[2px_2px_0px_0px_#000] hover:bg-yellow-50"
										>
											{#if row.itemId}
												<div class="flex items-center justify-between gap-2">
													<span class="font-mono text-sm font-black text-black">{row.itemId}</span>
													<span class="border border-black bg-amber-200 px-1.5 py-0.5 text-[10px] font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
														SATUAN: {row.satuan || 'Pcs'}
													</span>
												</div>
												<div class="text-xs text-black/70">{row.itemName || '-'}</div>
											{:else}
												<span class="text-xs font-bold text-slate-400">
													🔍 Klik di sini untuk pilih bahan...
												</span>
											{/if}
										</button>
									</div>

									<!-- 2 INPUT SAJA: BAGS & QTY (HANYA ANGKA / DIGITS ONLY) -->
									<div class="grid grid-cols-2 gap-3">
										<div>
											<label for="bahan-bags-{row.id}" class="block text-xs font-black uppercase text-black">
												Bags (Zak) *
											</label>
											<input
												id="bahan-bags-{row.id}"
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												value={row.bags}
												placeholder="0"
												onkeydown={preventNonDigits}
												onpaste={handlePasteDigitsOnly}
												onfocus={(e) => {
													if (e.currentTarget.value === '0') e.currentTarget.select();
												}}
												oninput={(e) => handleIntegerInput(e, (val) => (row.bags = val))}
												onblur={(e) => handleIntegerBlur(e, (val) => (row.bags = val))}
												class="w-full border-2 border-black bg-white px-3 py-2 text-right font-mono text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none"
											/>
										</div>
										<div>
											<label for="bahan-qty-{row.id}" class="block text-xs font-black uppercase text-black">
												Qty ({row.satuan || 'Kg'}) *
											</label>
											<input
												id="bahan-qty-{row.id}"
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												value={row.qty}
												placeholder="0"
												onkeydown={preventNonDigits}
												onpaste={handlePasteDigitsOnly}
												onfocus={(e) => {
													if (e.currentTarget.value === '0') e.currentTarget.select();
												}}
												oninput={(e) => handleIntegerInput(e, (val) => (row.qty = val))}
												onblur={(e) => handleIntegerBlur(e, (val) => (row.qty = val))}
												class="w-full border-2 border-black bg-[#FFE8CC] px-3 py-2 text-right font-mono text-sm font-black shadow-[2px_2px_0px_0px_#000] focus:bg-white focus:outline-none"
											/>
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Total Bahan Box -->
					<div class="border-2 border-black bg-[#FFE8CC] p-3 font-mono font-black">
						<div class="flex justify-between text-xs">
							<span>TOTAL BAGS BAHAN:</span>
							<span>{totalBahanBags.toLocaleString('id-ID')} BAGS</span>
						</div>
						<div class="mt-1 flex justify-between border-t-2 border-black pt-1 text-sm font-black text-black">
							<span>TOTAL QTY BAHAN:</span>
							<span class="bg-black px-1.5 text-white">{totalBahanQty.toLocaleString('id-ID')} QTY</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- SECTION B: HASIL JADI (ItemType = 'H') -->
			{#if activeTab === 'hasil' || activeTab === 'split'}
				<div class="space-y-4 border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
					<div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
						<div class="flex items-center gap-2">
							<div class="border-2 border-black bg-[#51CF66] p-1.5 text-black">
								<PackageCheck class="h-5 w-5" />
							</div>
							<div>
								<h2 class="text-base font-black uppercase tracking-wider">
									HASIL JADI PRODUKSI (IN)
								</h2>
								<p class="text-xs font-bold text-black/70">
									Masuk stok ke: <span class="border border-black bg-black px-1.5 py-0.5 text-xs font-bold text-white">{currentWarehouseName}</span>
								</p>
							</div>
						</div>

						<button
							type="button"
							onclick={addHasilRow}
							class="inline-flex items-center gap-1.5 border-2 border-black bg-[#51CF66] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] transition hover:bg-[#40C057] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
						>
							<Plus class="h-4 w-4" />
							TAMBAH BARIS HASIL
						</button>
					</div>

					<div class="space-y-3">
						{#each hasilList as row, idx (row.id)}
							<div class="border-2 border-black bg-[#EBFBEE] p-3 shadow-[3px_3px_0px_0px_#000]">
								<div class="mb-2 flex items-center justify-between border-b border-black/20 pb-1.5 text-xs font-black uppercase">
									<span>BARIS #{idx + 1} HASIL</span>
									<button
										type="button"
										onclick={() => requestRemoveItem(row, 'H')}
										class="inline-flex items-center gap-1 border border-black bg-[#FF6B6B] px-2 py-0.5 text-[10px] font-black uppercase text-black transition hover:bg-red-500 hover:text-white active:translate-x-0.5 active:translate-y-0.5"
									>
										<Trash2 class="h-3 w-3" />
										HAPUS
									</button>
								</div>

								<div class="space-y-2">
									<!-- Kode & Nama Barang Hasil -->
									<div>
										<span class="block text-[11px] font-black uppercase text-black">
											Kode Barang Hasil (ItemID) *
										</span>
										<button
											type="button"
											onclick={() => openItemSearch(row.id, 'H')}
											class="w-full border-2 border-black bg-white px-3 py-2 text-left font-bold shadow-[2px_2px_0px_0px_#000] hover:bg-yellow-50"
										>
											{#if row.itemId}
												<div class="flex items-center justify-between gap-2">
													<span class="font-mono text-sm font-black text-black">{row.itemId}</span>
													<span class="border border-black bg-emerald-200 px-1.5 py-0.5 text-[10px] font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
														SATUAN: {row.satuan || 'Pcs'}
													</span>
												</div>
												<div class="text-xs text-black/70">{row.itemName || '-'}</div>
											{:else}
												<span class="text-xs font-bold text-slate-400">
													🔍 Klik di sini untuk pilih barang hasil...
												</span>
											{/if}
										</button>
									</div>

									<!-- 2 INPUT SAJA: BAGS & QTY (HANYA ANGKA / DIGITS ONLY) -->
									<div class="grid grid-cols-2 gap-3">
										<div>
											<label for="hasil-bags-{row.id}" class="block text-xs font-black uppercase text-black">
												Bags (Zak) *
											</label>
											<input
												id="hasil-bags-{row.id}"
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												value={row.bags}
												placeholder="0"
												onkeydown={preventNonDigits}
												onpaste={handlePasteDigitsOnly}
												onfocus={(e) => {
													if (e.currentTarget.value === '0') e.currentTarget.select();
												}}
												oninput={(e) => handleIntegerInput(e, (val) => (row.bags = val))}
												onblur={(e) => handleIntegerBlur(e, (val) => (row.bags = val))}
												class="w-full border-2 border-black bg-white px-3 py-2 text-right font-mono text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:bg-yellow-50 focus:outline-none"
											/>
										</div>
										<div>
											<label for="hasil-qty-{row.id}" class="block text-xs font-black uppercase text-black">
												Qty ({row.satuan || 'Pcs'}) *
											</label>
											<input
												id="hasil-qty-{row.id}"
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												value={row.qty}
												placeholder="0"
												onkeydown={preventNonDigits}
												onpaste={handlePasteDigitsOnly}
												onfocus={(e) => {
													if (e.currentTarget.value === '0') e.currentTarget.select();
												}}
												oninput={(e) => handleIntegerInput(e, (val) => (row.qty = val))}
												onblur={(e) => handleIntegerBlur(e, (val) => (row.qty = val))}
												class="w-full border-2 border-black bg-[#D3F9D8] px-3 py-2 text-right font-mono text-sm font-black shadow-[2px_2px_0px_0px_#000] focus:bg-white focus:outline-none"
											/>
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Total Hasil Box -->
					<div class="border-2 border-black bg-[#D3F9D8] p-3 font-mono font-black">
						<div class="flex justify-between text-xs">
							<span>TOTAL BAGS HASIL:</span>
							<span>{totalHasilBags.toLocaleString('id-ID')} BAGS</span>
						</div>
						<div class="mt-1 flex justify-between border-t-2 border-black pt-1 text-sm font-black text-black">
							<span>TOTAL QTY HASIL:</span>
							<span class="bg-black px-1.5 text-white">{totalHasilQty.toLocaleString('id-ID')} QTY</span>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- 3. SUMMARY & SUBMIT BAR (NEO-BRUTAL FOOTER BAR) -->
		<div class="sticky bottom-4 z-20 border-[3px] border-black bg-[#FFDF00] p-4 shadow-[6px_6px_0px_0px_#000]">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<!-- Stat Indicators -->
				<div class="flex flex-wrap items-center gap-3 font-mono text-xs font-black sm:text-sm">
					<div class="border-2 border-black bg-white px-3 py-1.5 shadow-[2px_2px_0px_0px_#000]">
						TOTAL BAHAN: <span class="bg-black px-1 text-[#FFA94D]">{totalBahanQty.toLocaleString('id-ID')} QTY ({totalBahanBags} Bags)</span>
					</div>
					<div class="border-2 border-black bg-white px-3 py-1.5 shadow-[2px_2px_0px_0px_#000]">
						TOTAL HASIL: <span class="bg-black px-1 text-[#51CF66]">{totalHasilQty.toLocaleString('id-ID')} QTY ({totalHasilBags} Bags)</span>
					</div>
					<div class="border-2 border-black bg-white px-3 py-1.5 shadow-[2px_2px_0px_0px_#000]">
						OUTPUT RATIO: <span class="bg-black px-1 text-yellow-300">{rasioPersen}%</span>
					</div>
				</div>

				<!-- Tombol Simpan & Hapus -->
				<div class="flex flex-col items-end gap-1.5">
					{#if !data.canInputProduction}
						<span class="border border-black bg-red-500 px-2 py-0.5 text-[11px] font-black uppercase text-white shadow-[2px_2px_0px_0px_#000]">
							🚫 ROLE '{data.userRole}' TIDAK BERWENANG MENGINPUT
						</span>
					{:else if !orderId}
						<span class="border border-black bg-red-100 px-2 py-0.5 text-[11px] font-black uppercase text-red-700 shadow-[2px_2px_0px_0px_#000]">
							⚠️ SPK WAJIB DIPILIH
						</span>
					{:else if !hasValidItems}
						<span class="border border-black bg-amber-100 px-2 py-0.5 text-[11px] font-black uppercase text-amber-800 shadow-[2px_2px_0px_0px_#000]">
							⚠️ PILIH MINIMAL 1 KODE BARANG
						</span>
					{/if}

					<div class="flex items-center gap-2">
						{#if isEditMode}
							<button
								type="button"
								onclick={() => openDeleteConfirm(prodId)}
								class="inline-flex items-center justify-center gap-2 border-[3px] border-black bg-[#FF6B6B] px-5 py-3 text-sm font-black uppercase tracking-wider text-black shadow-[4px_4px_0px_0px_#000] transition hover:bg-red-500 hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
							>
								<Trash2 class="h-5 w-5" />
								HAPUS
							</button>
						{/if}

						<button
							type="submit"
							disabled={!canSubmit}
							class="inline-flex items-center justify-center gap-2 border-[3px] border-black bg-black px-7 py-3 text-sm font-black uppercase tracking-wider text-white shadow-[4px_4px_0px_0px_#fff] transition hover:bg-[#333] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#fff] disabled:cursor-not-allowed disabled:opacity-40"
						>
							{#if isSubmitting}
								<RefreshCw class="h-5 w-5 animate-spin" />
								MENYIMPAN KE SQL SERVER...
							{:else if isEditMode}
								<CheckCircle2 class="h-5 w-5 text-yellow-300" />
								SIMPAN PERUBAHAN #{prodId}
							{:else}
								<CheckCircle2 class="h-5 w-5 text-[#51CF66]" />
								SIMPAN BUKTI PRODUKSI
							{/if}
						</button>
					</div>
				</div>
			</div>
		</div>
	</form>
</div>

<!-- ==================== MODAL PILIH SPK ==================== -->
<Modal bind:open={isSpkModalOpen} title="PILIH SURAT PERINTAH KERJA (SPK)" size="2xl">
	<div class="space-y-4">
		<div class="text-xs font-bold text-black/70">
			Departemen: <strong>{currentDeptName}</strong> ({spkList.length} SPK terdeteksi)
		</div>

		<SearchInput
			value={spkSearchQuery}
			onsearch={performSearchSpk}
			placeholder="Ketik nomor SPK (misal: {selectedDept}-26/...) atau nama PO..."
			loading={isSearchingSpk}
		/>

		<div class="max-h-96 overflow-y-auto">
			{#if isSearchingSpk}
				<div class="flex items-center justify-center p-8 font-black uppercase text-xs">
					<RefreshCw class="mr-2 h-4 w-4 animate-spin" /> Memuat daftar SPK...
				</div>
			{:else if spkList.length === 0}
				<div class="p-8 text-center text-xs font-bold text-slate-500">
					Tidak ada SPK ditemukan untuk pencarian ini.
				</div>
			{:else}
				<div class="space-y-2">
					{#each spkList as spk}
						<button
							type="button"
							onclick={() => selectSpk(spk)}
							class="flex w-full items-center justify-between border-2 border-black bg-white p-3 text-left shadow-[2px_2px_0px_0px_#000] transition hover:-translate-y-0.5 hover:bg-[#FFF9DB] active:translate-x-0.5 active:translate-y-0.5"
						>
							<div>
								<div class="flex items-center gap-2">
									<span class="font-mono text-sm font-black text-black">{spk.OrderID}</span>
									{#if spk.Completed}
										<span class="border border-black bg-slate-200 px-1 text-[10px] font-bold">SELESAI</span>
									{:else}
										<span class="border border-black bg-[#51CF66] px-1 text-[10px] font-black text-black">AKTIF</span>
									{/if}
								</div>
								<div class="text-xs font-bold text-black/70">
									{spk.Remark ? `PO: ${spk.Remark}` : 'Tanpa catatan PO'}
								</div>
							</div>
							<div class="text-right text-xs font-mono font-bold text-black/60">
								{spk.OrderDate || '-'}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<button
			type="button"
			onclick={() => (isSpkModalOpen = false)}
			class="border-2 border-black bg-white px-4 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200"
		>
			Tutup
		</button>
	{/snippet}
</Modal>

<!-- ==================== MODAL PILIH BARANG ==================== -->
<Modal bind:open={itemSearchOpen} title={`PILIH BARANG (${targetRowType === 'B' ? 'BAHAN BAKU' : 'HASIL PRODUKSI'})`} size="2xl">
	<div class="space-y-4">
		<SearchInput
			value={itemSearchQuery}
			onsearch={performSearchItem}
			placeholder="Ketik kode barang atau nama barang..."
			loading={isSearchingItems}
		/>

		<div class="max-h-96 overflow-y-auto">
			{#if isSearchingItems}
				<div class="flex items-center justify-center p-8 font-black uppercase text-xs">
					<RefreshCw class="mr-2 h-4 w-4 animate-spin" /> Mencari di database...
				</div>
			{:else if itemSearchResults.length === 0}
				<div class="p-8 text-center text-xs font-bold text-slate-500">
					{itemSearchQuery ? 'Tidak ada barang yang cocok.' : 'Silakan ketik kode atau nama barang.'}
				</div>
			{:else}
				<div class="space-y-2">
					{#each itemSearchResults as item}
						<button
							type="button"
							onclick={() => selectItem(item)}
							class="flex w-full items-center justify-between border-2 border-black bg-white p-3 text-left shadow-[2px_2px_0px_0px_#000] transition hover:-translate-y-0.5 hover:bg-[#FFF9DB] active:translate-x-0.5 active:translate-y-0.5"
						>
							<div class="min-w-0 flex-1">
								<div class="font-mono text-sm font-black text-black">{item.ItemID}</div>
								<div class="truncate text-xs font-bold text-black/70">{item.ItemName}</div>
							</div>
							<div class="ml-2 border border-black bg-black px-2 py-0.5 font-mono text-xs font-black text-white shrink-0">
								{item.Satuan || 'Pcs'}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<button
			type="button"
			onclick={() => (itemSearchOpen = false)}
			class="border-2 border-black bg-white px-4 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200"
		>
			Tutup
		</button>
	{/snippet}
</Modal>

<!-- ==================== MODAL CARI / LOAD TRANSAKSI ==================== -->
<Modal bind:open={isLoadModalOpen} title="CARI / LOAD TRANSAKSI PRODUKSI" size="3xl">
	<div class="space-y-4">
		<SearchInput
			value={loadSearchProdId}
			onsearch={performSearchTransaction}
			placeholder="Ketik no. produksi (misal: 2608344) atau no. SPK..."
			loading={isSearchingTransactions}
		/>

		{#if loadError}
			<Alert variant="error" title="Gagal Memuat:">
				{loadError}
			</Alert>
		{/if}

		<div class="max-h-96 overflow-y-auto">
			{#if loadSearchProdId.trim() && searchTransactionsResult.length > 0}
				<div class="space-y-2">
					<div class="flex items-center justify-between text-xs font-black uppercase text-black">
						<span>🔍 Hasil Pencarian ({searchTransactionsResult.length} Transaksi):</span>
						<span class="text-[10px] text-black/60">Klik untuk edit</span>
					</div>
					<div class="space-y-1.5">
						{#each searchTransactionsResult as rx}
							<div class="flex items-center gap-1.5 border-2 border-black bg-white p-2 shadow-[2px_2px_0px_0px_#000] transition hover:bg-yellow-50">
								<button
									type="button"
									onclick={() => loadTransactionById(rx.prodId)}
									class="flex flex-1 items-center justify-between text-left"
								>
									<div class="space-y-0.5">
										<div class="flex flex-wrap items-center gap-2">
											<span class="font-mono text-sm font-black text-black">#{rx.prodId}</span>
											{#if rx.prodType}
												<span class="border border-black bg-purple-100 px-1 text-[10px] font-black uppercase">
													{rx.prodType}
												</span>
											{/if}
											<span class="border border-black bg-slate-100 px-1 text-[10px] font-bold">
												{rx.prodDate}
											</span>
											<span class="border border-black bg-sky-100 px-1 text-[10px] font-bold">
												SPK: {rx.orderId}
											</span>
										</div>
										<div class="text-[11px] font-bold text-black/70">
											Gudang: {rx.locId} | {rx.totalBahan} Bahan, {rx.totalHasil} Hasil
											{#if rx.remark}
												| <span class="italic text-black/60">"{rx.remark}"</span>
											{/if}
										</div>
									</div>

									<div class="mr-2 shrink-0">
										{#if rx.totalHasil === 0}
											<span class="border border-black bg-amber-300 px-1.5 py-0.5 text-[10px] font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
												Bahan Saja
											</span>
										{:else}
											<span class="border border-black bg-emerald-300 px-1.5 py-0.5 text-[10px] font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
												Lengkap
											</span>
										{/if}
									</div>
								</button>

								<button
									type="button"
									onclick={() => openDeleteConfirm(rx.prodId)}
									title="Hapus transaksi #{rx.prodId}"
									class="border border-black bg-red-100 p-1.5 text-red-700 transition hover:bg-red-500 hover:text-white"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{:else if loadSearchProdId.trim() && !isSearchingTransactions}
				<div class="border-2 border-dashed border-black/40 bg-slate-50 p-4 text-center text-xs font-bold text-black/70">
					Tidak ditemukan transaksi dengan kata kunci "{loadSearchProdId}".
				</div>
			{:else if data.recentTransactions && data.recentTransactions.length > 0}
				<div class="space-y-2">
					<div class="flex items-center justify-between text-xs font-black uppercase text-black">
						<span>📋 Transaksi Terakhir (Semua Departemen):</span>
						<span class="text-[10px] text-black/60">Klik untuk edit</span>
					</div>
					<div class="space-y-1.5">
						{#each data.recentTransactions as rx}
							<div class="flex items-center gap-1.5 border-2 border-black bg-white p-2 shadow-[2px_2px_0px_0px_#000] transition hover:bg-yellow-50">
								<button
									type="button"
									onclick={() => loadTransactionById(rx.prodId)}
									class="flex flex-1 items-center justify-between text-left"
								>
									<div class="space-y-0.5">
										<div class="flex flex-wrap items-center gap-2">
											<span class="font-mono text-sm font-black text-black">#{rx.prodId}</span>
											{#if rx.prodType}
												<span class="border border-black bg-purple-100 px-1 text-[10px] font-black uppercase">
													{rx.prodType}
												</span>
											{/if}
											<span class="border border-black bg-slate-100 px-1 text-[10px] font-bold">
												{rx.prodDate}
											</span>
											<span class="border border-black bg-sky-100 px-1 text-[10px] font-bold">
												SPK: {rx.orderId}
											</span>
										</div>
										<div class="text-[11px] font-bold text-black/70">
											Gudang: {rx.locId} | {rx.totalBahan} Bahan, {rx.totalHasil} Hasil
										</div>
									</div>

									<div class="mr-2 shrink-0">
										{#if rx.totalHasil === 0}
											<span class="border border-black bg-amber-300 px-1.5 py-0.5 text-[10px] font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
												Bahan Saja
											</span>
										{:else}
											<span class="border border-black bg-emerald-300 px-1.5 py-0.5 text-[10px] font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
												Lengkap
											</span>
										{/if}
									</div>
								</button>

								<button
									type="button"
									onclick={() => openDeleteConfirm(rx.prodId)}
									title="Hapus transaksi #{rx.prodId}"
									class="border border-black bg-red-100 p-1.5 text-red-700 transition hover:bg-red-500 hover:text-white"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<button
			type="button"
			onclick={() => {
				isLoadModalOpen = false;
				loadError = '';
			}}
			class="border-2 border-black bg-white px-4 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200"
		>
			Tutup
		</button>
	{/snippet}
</Modal>

<!-- ==================== MODAL KONFIRMASI HAPUS DATA TRANSAKSI ==================== -->
<ConfirmModal
	bind:open={isDeleteModalOpen}
	title="KONFIRMASI HAPUS DATA"
	message={`Bukti Transaksi Produksi #${targetDeleteProdId} beserta seluruh rincian bahan baku dan hasil produksi yang tercatat akan dihapus secara permanen dari database.`}
	confirmLabel="YA, HAPUS DATANYA"
	confirmVariant="danger"
	loading={isDeleting}
	onconfirm={executeDelete}
	oncancel={closeDeleteModal}
/>

<!-- ==================== MODAL KONFIRMASI HAPUS ITEM ==================== -->
<ConfirmModal
	bind:open={isDeleteItemModalOpen}
	title="KONFIRMASI HAPUS ITEM"
	message={`Item #${targetDeleteItem?.itemId || ''} (${targetDeleteItem?.itemName || ''}) dengan jumlah ${targetDeleteItem?.bags || 0} Bags / ${targetDeleteItem?.qty || 0} ${targetDeleteItem?.satuan || 'Pcs'} akan dikeluarkan dari tabel ${targetDeleteItem?.type === 'B' ? 'Bahan Baku' : 'Hasil Produksi'}.`}
	confirmLabel="YA, HAPUS ITEM"
	confirmVariant="danger"
	onconfirm={confirmExecuteRemoveItem}
	oncancel={closeDeleteItemModal}
/>

<!-- ==================== MODAL IMPORT EXCEL ==================== -->
<Modal bind:open={isImportModalOpen} title="IMPORT TRANSAKSI PRODUKSI DARI EXCEL" size="4xl">
	<div class="space-y-4">
		<FileUploadZone
			templateUrl={`/api/production/template${selectedDept ? `?dept=${selectedDept}` : ''}`}
			templateLabel="Download Template Produksi (.xlsx)"
			accept=".xlsx, .xls"
			loading={isUploadingImport}
			onfile={handleUploadFile}
		/>

		<!-- Error Banner -->
		{#if importError}
			<Alert variant="error" title="GAGAL MEMPROSES FILE:">
				{importError}
			</Alert>
		{/if}

		<!-- Preview & Validasi Data -->
		{#if parsedImportData}
			<div class="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] space-y-4">
				<!-- Summary Info -->
				<div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
					<div>
						<div class="text-xs font-black uppercase text-black/70">File Terpilih:</div>
						<div class="font-mono text-sm font-black text-black truncate max-w-sm">
							📄 {parsedImportData.fileName || 'Excel Import'}
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<span class="border border-black bg-[#FFA94D] px-2.5 py-1 text-xs font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
							Bahan: {parsedImportData.summary?.totalBahanRows || 0} Baris ({parsedImportData.summary?.totalBahanQty || 0} Qty)
						</span>
						<span class="border border-black bg-[#51CF66] px-2.5 py-1 text-xs font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
							Hasil: {parsedImportData.summary?.totalHasilRows || 0} Baris ({parsedImportData.summary?.totalHasilQty || 0} Qty)
						</span>
						{#if parsedImportData.summary?.invalidCount > 0}
							<span class="border border-black bg-[#FF6B6B] px-2.5 py-1 text-xs font-black uppercase text-black shadow-[1px_1px_0px_0px_#000]">
								⚠️ {parsedImportData.summary?.invalidCount} Kode Tidak Dikenal
							</span>
						{:else}
							<span class="border border-black bg-emerald-100 px-2.5 py-1 text-xs font-black uppercase text-emerald-800">
								✓ Semua Kode Valid
							</span>
						{/if}
					</div>
				</div>

				<!-- Status SPK & Informasi Transaksi -->
				<div class="border-2 border-black bg-slate-50 p-3 text-xs">
					<div class="font-black text-black uppercase text-[11px] mb-2 flex flex-wrap items-center justify-between gap-2">
						<span class="flex items-center gap-1.5">
							<span>🎯</span>
							<span>Status SPK & Header Transaksi:</span>
						</span>
						{#if parsedImportData.header?.orderId}
							{#if parsedImportData.header?.isSpkValid}
								<span class="border border-black bg-[#51CF66] px-2 py-0.5 text-[10px] font-black uppercase text-black">
									✓ SPK VALID (DARI EXCEL)
								</span>
							{:else}
								<span class="border border-black bg-[#FF6B6B] px-2 py-0.5 text-[10px] font-black uppercase text-black" title={parsedImportData.header?.spkError}>
									✕ SPK TIDAK DITEMUKAN
								</span>
							{/if}
						{:else if orderId}
							<span class="border border-black bg-sky-200 px-2 py-0.5 text-[10px] font-black uppercase text-sky-950">
								✓ MENGGUNAKAN SPK AKTIF DI WEB
							</span>
						{:else}
							<span class="border border-black bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase text-amber-950">
								⚠️ SPK BELUM DIPILIH
							</span>
						{/if}
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
						<!-- SPK Info Box -->
						<div class="border border-black bg-white p-2">
							<div class="text-[10px] font-black uppercase text-black/60">Nomor SPK:</div>
							{#if parsedImportData.header?.orderId}
								<div class="font-black text-sm {parsedImportData.header?.isSpkValid ? 'text-black' : 'text-red-600'}">
									{parsedImportData.header.orderId}
								</div>
								{#if parsedImportData.header?.spkRemark}
									<div class="text-[11px] text-muted-foreground truncate">{parsedImportData.header.spkRemark}</div>
								{/if}
								{#if !parsedImportData.header?.isSpkValid}
									<div class="text-[10px] text-red-600 font-sans mt-0.5">
										⚠️ SPK ini tidak ada di database taPROrder. Silakan pilih SPK valid di form web.
									</div>
								{/if}
							{:else if orderId}
								<div class="font-black text-sm text-black">{orderId}</div>
								<div class="text-[10px] text-emerald-700 font-sans">
									✓ Menggunakan SPK yang dipilih di formulir: {selectedSpkRemark || 'Aktif'}
								</div>
							{:else}
								<div class="font-black text-red-600 text-sm">- Belum Ada SPK -</div>
								<div class="text-[10px] text-red-700 font-sans">
									File Excel tidak mencantumkan No SPK & form web belum memilih SPK. Wajib cantumkan SPK sebelum menerapkan.
								</div>
							{/if}
						</div>

						<!-- Tanggal, Gudang, Shift, No Rator -->
						<div class="border border-black bg-white p-2 space-y-1">
							<div class="text-[10px] font-black uppercase text-black/60">Detail Transaksi Lainnya:</div>
							<div class="flex flex-wrap gap-2 text-[11px]">
								<span>Tgl: <strong>{parsedImportData.header?.prodDate || prodDate}</strong></span>
								<span>Gdg: <strong>{parsedImportData.header?.locId || locId || '-'}</strong></span>
								<span>Shift: <strong>{parsedImportData.header?.shift || shift}</strong></span>
								<span>No. Rator: <strong>{parsedImportData.header?.noRator != null ? parsedImportData.header.noRator : (noRator ?? '-')}</strong></span>
							</div>
							{#if parsedImportData.header?.remark}
								<div class="text-[11px] text-muted-foreground truncate">
									Ket: {parsedImportData.header.remark}
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Tab Rincian Preview -->
				<div>
					<div class="flex border-b-2 border-black">
						<button
							type="button"
							onclick={() => (importActiveTab = 'bahan')}
							class="px-4 py-2 text-xs font-black uppercase tracking-wider border-r-2 border-black transition {importActiveTab === 'bahan' ? 'bg-[#FFA94D] text-black shadow-[inset_0px_3px_0px_0px_#000]' : 'bg-slate-100 text-black/70 hover:bg-slate-200'}"
						>
							Bahan Baku ({parsedImportData.bahanList?.length || 0})
						</button>
						<button
							type="button"
							onclick={() => (importActiveTab = 'hasil')}
							class="px-4 py-2 text-xs font-black uppercase tracking-wider transition {importActiveTab === 'hasil' ? 'bg-[#51CF66] text-black shadow-[inset_0px_3px_0px_0px_#000]' : 'bg-slate-100 text-black/70 hover:bg-slate-200'}"
						>
							Hasil Produksi ({parsedImportData.hasilList?.length || 0})
						</button>
					</div>

					<!-- Tabel Preview Items -->
					<div class="overflow-x-auto max-h-56 border-2 border-t-0 border-black">
						<table class="w-full border-collapse text-left text-xs font-mono">
							<thead>
								<tr class="bg-black text-white uppercase text-[10px]">
									<th class="border border-black px-2 py-1.5 w-10 text-center">No</th>
									<th class="border border-black px-2 py-1.5 w-32">Kode Barang</th>
									<th class="border border-black px-2 py-1.5">Nama Barang (taGoods)</th>
									<th class="border border-black px-2 py-1.5 w-16">Satuan</th>
									<th class="border border-black px-2 py-1.5 w-20 text-right">Bags</th>
									<th class="border border-black px-2 py-1.5 w-24 text-right">Qty</th>
									<th class="border border-black px-2 py-1.5 w-28 text-center">Status</th>
								</tr>
							</thead>
							<tbody>
								{#if !currentImportItems || currentImportItems.length === 0}
									<tr>
										<td colspan={7} class="p-4 text-center text-muted-foreground font-sans text-xs">
											Tidak ada baris {importActiveTab === 'bahan' ? 'Bahan Baku' : 'Hasil Produksi'} pada file Excel ini.
										</td>
									</tr>
								{:else}
									{#each currentImportItems as it, idx}
										<tr class="border-b border-black/10 hover:bg-slate-50 {it.isValid ? '' : 'bg-red-50 text-red-900'}">
											<td class="border-r border-black/10 px-2 py-1 text-center font-bold">{idx + 1}</td>
											<td class="border-r border-black/10 px-2 py-1 font-black">{it.itemId}</td>
											<td class="border-r border-black/10 px-2 py-1 truncate max-w-xs">{it.itemName}</td>
											<td class="border-r border-black/10 px-2 py-1">{it.satuan}</td>
											<td class="border-r border-black/10 px-2 py-1 text-right">{it.bags}</td>
											<td class="border-r border-black/10 px-2 py-1 text-right font-black">{it.qty}</td>
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
								{/if}
							</tbody>
						</table>
					</div>
				</div>

				<!-- Warning Box jika Kode Barang atau SPK Tidak Sesuai -->
				{#if hasInvalidItems || isSpkInvalid}
					<Alert variant="error" title="Tidak Dapat Menerapkan ke Formulir:">
						<ul class="list-disc list-inside space-y-1 text-xs">
							{#if hasInvalidItems}
								<li>
									Terdapat <strong>{parsedImportData.summary?.invalidCount} barang</strong> dengan kode barang yang tidak terdaftar di master taGoods atau kuantiti tidak valid (&le; 0). Lihat baris berstatus <span class="bg-red-200 text-red-800 px-1 font-bold">✕ TIDAK ADA</span> pada tabel di atas.
								</li>
							{/if}
							{#if isSpkInvalid}
								{#if parsedImportData.header?.orderId}
									<li>
										Nomor SPK <strong>'{parsedImportData.header.orderId}'</strong> tidak ditemukan di database. Pastikan nomor SPK valid sesuai dengan Sheet <strong>MASTER_SPK</strong>.
									</li>
								{:else}
									<li>
										Nomor SPK belum diisi pada file Excel dan belum dipilih pada formulir web. Silakan cantumkan No. SPK di file Excel atau pilih SPK di web sebelum menerapkan.
									</li>
								{/if}
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
				title={!canApplyImport ? 'Perbaiki kode barang atau SPK terlebih dahulu agar dapat diterapkan' : 'Terapkan data ke form'}
			>
				<CheckCircle2 class="h-4 w-4" />
				TERAPKAN KE FORM INPUT PRODUKSI
			</button>
		</div>
	{/snippet}
</Modal>
