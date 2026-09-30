<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import {
		Plus,
		Trash2,
		Save,
		RotateCcw,
		FileSpreadsheet,
		FolderOpen,
		Search,
		CheckCircle2,
		AlertTriangle,
		UploadCloud,
		Download,
		Copy,
		Clock,
		Tag,
		Calendar,
		Building2,
		FileText,
		CheckSquare,
		Layers,
		ExternalLink
	} from '@lucide/svelte';
	import { Modal, Alert, SearchInput, FileUploadZone, toast } from '$lib/components';

	let { data, form } = $props();

	// Mode edit / transaksi aktif
	const initTx = untrack(() => data.existingTransaction);
	let isEditMode = $state(Boolean(initTx));

	// Header State
	let orderId = $state(initTx?.header?.orderId || untrack(() => data.nextOrderId) || '');
	let deptId = $state(initTx?.header?.deptId || 'IN');
	let orderDate = $state(initTx?.header?.orderDate || untrack(() => data.defaultDate) || new Date().toISOString().slice(0, 10));
	let planDate = $state(initTx?.header?.planDate || untrack(() => data.defaultPlanDate) || untrack(() => data.defaultDate) || new Date().toISOString().slice(0, 10));
	let remark = $state(initTx?.header?.remark || 'BORINE');
	let noSo = $state(initTx?.header?.noSo || '');
	let shift = $state<number | null>(initTx?.header?.shift ?? null);
	let completed = $state(Boolean(initTx?.header?.completed));
	let finishedDate = $state(initTx?.header?.finishedDate || '');

	// Detail Rows State
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
		orderId = String(txData.header.orderId || '').trim();
		deptId = String(txData.header.deptId || 'IN').trim();
		orderDate = txData.header.orderDate || new Date().toISOString().slice(0, 10);
		planDate = txData.header.planDate || orderDate;
		remark = String(txData.header.remark || '').trim();
		noSo = String(txData.header.noSo || '').trim();
		shift = txData.header.shift != null ? parseInt(String(txData.header.shift), 10) : null;
		completed = Boolean(txData.header.completed);
		finishedDate = txData.header.finishedDate || '';

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
		if (data.existingTransaction) {
			untrack(() => {
				applyTransactionData(data.existingTransaction);
			});
		}
	});

	// Hitung Ringkasan Total
	let totalItems = $derived(rows.filter((r) => r.itemId.trim()).length);
	let totalBags = $derived(rows.reduce((acc, r) => acc + (Number(r.bags) || 0), 0));
	let totalKgs = $derived(rows.reduce((acc, r) => acc + (Number(r.kgs) || 0), 0));

	// Update Next OrderID saat Departemen atau Tanggal berubah
	async function updateNextId(newDept: string, date: string) {
		if (isEditMode) return;
		try {
			const res = await fetch(`/api/spk/next-id?deptId=${encodeURIComponent(newDept)}&date=${encodeURIComponent(date)}`);
			const json = await res.json();
			if (json.nextOrderId) {
				orderId = json.nextOrderId;
			}
		} catch (e) {
			console.error('Gagal mengambil next OrderID', e);
		}
	}

	function handleDeptChange(newDept: string) {
		deptId = newDept;
		updateNextId(newDept, orderDate);
	}

	function handleOrderDateChange(newDate: string) {
		orderDate = newDate;
		updateNextId(deptId, newDate);
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
		}
		isGoodsModalOpen = false;
	}

	async function handleItemIdBlur(row: DetailRow) {
		const code = row.itemId.trim().toUpperCase();
		if (!code) {
			row.itemName = '';
			return;
		}
		row.itemId = code;
		try {
			const res = await fetch(`/api/production/search-items?q=${encodeURIComponent(code)}`);
			const json = await res.json();
			const match = (json.items || []).find((i: any) => i.ItemID.toUpperCase() === code);
			if (match) {
				row.itemName = match.ItemName;
				row.satuan = match.Satuan || 'Pcs';
			} else {
				row.itemName = '';
			}
		} catch (err) {
			console.error(err);
		}
	}

	// ==================== BARIS ITEM MANAGEMENT ====================
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

	// ==================== BUKA / CARI SPK MODAL ====================
	let isLoadModalOpen = $state(false);
	let loadSearchQuery = $state('');
	let isSearchingSpk = $state(false);
	let searchSpkResult = $state<any[]>(untrack(() => data.recentSpks) || []);
	let searchSpkDebounce: any;

	function openLoadModal() {
		loadSearchQuery = '';
		searchSpkResult = data.recentSpks || [];
		isLoadModalOpen = true;
	}

	function handleSearchSpkInput(e: Event) {
		clearTimeout(searchSpkDebounce);
		const val = (e.target as HTMLInputElement).value;
		loadSearchQuery = val;
		searchSpkDebounce = setTimeout(async () => {
			isSearchingSpk = true;
			try {
				const res = await fetch(`/api/spk/search?q=${encodeURIComponent(val)}&dept=${encodeURIComponent(deptId)}`);
				const json = await res.json();
				searchSpkResult = json.spks || [];
			} catch (err) {
				console.error(err);
			} finally {
				isSearchingSpk = false;
			}
		}, 300);
	}

	async function loadExistingTransaction(selOrderId: string) {
		try {
			const res = await fetch(`/api/spk/get-transaction?id=${encodeURIComponent(selOrderId)}`);
			const json = await res.json();
			if (!res.ok || !json.success) {
				alert(json.message || 'Gagal memuat SPK.');
				return;
			}

			const txData = json.data;
			applyTransactionData(txData);

			if (typeof history !== 'undefined') {
				history.pushState({}, '', `/dashboard/input-spk?id=${encodeURIComponent(txData.header.orderId)}`);
			}

			isLoadModalOpen = false;
			toast.info(`SPK #${txData.header.orderId} berhasil dimuat ke formulir.`, { title: 'Mode Edit Aktif' });
		} catch (e: any) {
			toast.error('Terjadi kesalahan saat memuat SPK: ' + e?.message);
		}
	}

	function resetToNewMode() {
		isEditMode = false;
		deptId = 'IN';
		orderDate = data.defaultDate || new Date().toISOString().slice(0, 10);
		planDate = data.defaultPlanDate || orderDate;
		remark = 'BORINE';
		noSo = '';
		shift = null;
		completed = false;
		finishedDate = '';
		rows = [{ id: crypto.randomUUID(), itemId: '', itemName: '', satuan: 'Pcs', bags: 0, kgs: 0, notes: '' }];
		updateNextId('IN', orderDate);
		if (typeof history !== 'undefined') {
			history.pushState({}, '', '/dashboard/input-spk');
		}
	}

	// ==================== MODAL IMPORT EXCEL STATE & LOGIC ====================
	let isImportModalOpen = $state(false);
	let isUploadingImport = $state(false);
	let importError = $state('');
	let importSuccessMessage = $state('');
	let parsedImportData = $state<any>(null);
	let importFileInputRef = $state<HTMLInputElement | null>(null);

	// Multi-Dept batch state
	let selectedDepts = $state<string[]>([]);
	let activePreviewDept = $state<string | null>(null);
	let isBatchSaving = $state(false);
	let batchSaveResult = $state<any>(null);

	let hasInvalidItems = $derived(Boolean(parsedImportData && parsedImportData.summary?.invalidCount > 0));
	let canApplyImport = $derived(
		Boolean(
			parsedImportData &&
			parsedImportData.items &&
			parsedImportData.items.length > 0 &&
			!hasInvalidItems
		)
	);

	let activePreviewGroup = $derived(
		parsedImportData?.groups?.find((g: any) => g.deptId === activePreviewDept) ||
		parsedImportData?.groups?.[0] ||
		null
	);

	let selectedGroups = $derived(
		parsedImportData?.groups?.filter((g: any) => selectedDepts.includes(g.deptId)) || []
	);

	let canBatchSave = $derived(
		Boolean(
			parsedImportData?.isMultiDept &&
			selectedDepts.length > 0 &&
			selectedGroups.length > 0 &&
			!selectedGroups.some((g: any) => g.invalidCount > 0)
		)
	);

	function openImportModal() {
		importError = '';
		parsedImportData = null;
		batchSaveResult = null;
		selectedDepts = [];
		activePreviewDept = null;
		if (importFileInputRef) importFileInputRef.value = '';
		isImportModalOpen = true;
	}

	function closeImportModal() {
		isImportModalOpen = false;
	}

	function toggleDeptSelection(dId: string) {
		if (selectedDepts.includes(dId)) {
			selectedDepts = selectedDepts.filter((id) => id !== dId);
		} else {
			selectedDepts = [...selectedDepts, dId];
		}
	}

	function selectAllDepts(select: boolean) {
		if (!parsedImportData?.groups) return;
		if (select) {
			selectedDepts = parsedImportData.groups.map((g: any) => g.deptId);
		} else {
			selectedDepts = [];
		}
	}

	async function handleImportFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		importError = '';
		parsedImportData = null;
		batchSaveResult = null;
		isUploadingImport = true;

		try {
			const fd = new FormData();
			fd.append('file', file);

			const res = await fetch('/api/spk/import-excel', {
				method: 'POST',
				body: fd
			});
			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.message || 'Gagal memproses file Excel.');
			}
			parsedImportData = json.data;
			if (parsedImportData?.groups && parsedImportData.groups.length > 0) {
				selectedDepts = parsedImportData.groups.map((g: any) => g.deptId);
				activePreviewDept = parsedImportData.groups[0]?.deptId || null;
			}
		} catch (err: any) {
			importError = err?.message || 'Terjadi kesalahan saat mengunggah template Excel.';
		} finally {
			isUploadingImport = false;
		}
	}

	function applyImportData() {
		if (!parsedImportData) return;

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
			if (h.deptId) {
				deptId = h.deptId;
				updateNextId(h.deptId, orderDate);
			}
			if (h.orderDate) orderDate = h.orderDate;
			if (h.planDate) planDate = h.planDate;
			if (h.remark) remark = h.remark;
			if (h.noSo) noSo = h.noSo;
		}

		importSuccessMessage = `Berhasil menerapkan ${parsedImportData.summary?.totalRows || 0} baris barang dari file Excel.`;
		toast.success(importSuccessMessage, { title: 'Import Excel Selesai' });
		closeImportModal();
	}

	function applyGroupToForm(grp: any) {
		if (!grp || !grp.items || grp.items.length === 0) return;

		deptId = grp.deptId;
		updateNextId(grp.deptId, orderDate);

		rows = grp.items.map((item: any) => ({
			id: crypto.randomUUID(),
			itemId: item.itemId || '',
			itemName: item.itemName || '',
			satuan: item.satuan || 'Pcs',
			bags: Math.max(0, parseInt(String(item.bags || 0), 10) || 0),
			kgs: Math.max(0, parseInt(String(item.kgs || 0), 10) || 0),
			notes: item.notes || ''
		}));

		const h = parsedImportData?.header;
		if (h) {
			if (h.orderDate) orderDate = h.orderDate;
			if (h.planDate) planDate = h.planDate;
			if (h.remark) remark = h.remark;
			if (h.noSo) noSo = h.noSo;
		}

		importSuccessMessage = `Berhasil menerapkan ${grp.items.length} barang untuk Departemen ${grp.deptName} (${grp.deptId}) ke formulir.`;
		toast.info(importSuccessMessage, { title: 'Dimuat ke Formulir' });
		closeImportModal();
	}

	async function handleBatchSave() {
		if (!canBatchSave || !parsedImportData) return;

		isBatchSaving = true;
		importError = '';

		try {
			const h = parsedImportData.header || {};
			const groupsToSave = selectedGroups.map((g: any) => ({
				deptId: g.deptId,
				orderId: g.nextOrderId,
				details: g.items.map((it: any) => ({
					itemId: it.itemId,
					itemName: it.itemName,
					satuan: it.satuan,
					bags: it.bags,
					kgs: it.kgs,
					notes: it.notes
				}))
			}));

			const payload = {
				orderDate: h.orderDate || orderDate,
				planDate: h.planDate || planDate,
				remark: h.remark || remark,
				noSo: h.noSo || null,
				shift: h.shift != null ? h.shift : (shift || null),
				groups: groupsToSave
			};

			const res = await fetch('/api/spk/batch-save', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.message || 'Gagal menyimpan transaksi SPK multi-departemen.');
			}

			batchSaveResult = json;
			toast.success(json.message, {
				title: 'Batch SPK Diterbitkan',
				action: { label: 'Monitoring SPK', href: '/dashboard/spk' }
			});
			updateNextId(deptId, orderDate);
		} catch (err: any) {
			importError = err?.message || 'Terjadi kesalahan saat memproses batch save SPK.';
			toast.error(importError, { title: 'Gagal Batch Save' });
		} finally {
			isBatchSaving = false;
		}
	}

	// ==================== SUBMISSION STATE ====================
	let isSubmitting = $state(false);
	let savePayloadJson = $derived(
		JSON.stringify({
			orderId,
			deptId,
			orderDate,
			planDate,
			remark,
			noSo: noSo || null,
			shift: shift || null,
			completed,
			finishedDate: completed && finishedDate ? finishedDate : null,
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
	<title>{isEditMode ? `Edit SPK #${orderId}` : 'Input SPK'} | KIW Inventory</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Bar / Page Header -->
	<div class="flex flex-col gap-4 border-b-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] md:flex-row md:items-center md:justify-between">
		<div>
			<div class="flex items-center gap-2">
				<span class="border-2 border-black bg-[#FFD43B] p-1.5 shadow-[2px_2px_0px_0px_#000]">
					<Tag class="h-5 w-5 text-black" />
				</span>
				<h1 class="text-xl font-black uppercase tracking-tight text-black sm:text-2xl">
					{isEditMode ? `Edit SPK #${orderId}` : 'Input SPK (Surat Perintah Kerja)'}
				</h1>
			</div>
			<p class="mt-1 text-xs font-bold text-slate-600">
				Formulir pembuatan & penerbitan Surat Perintah Kerja (taPROrder) produksi pabrik
			</p>
		</div>

		<!-- Action Buttons Top Bar -->
		<div class="flex flex-wrap items-center gap-2">
			{#if isEditMode}
				<button
					type="button"
					onclick={resetToNewMode}
					class="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-slate-100"
				>
					<Plus class="h-4 w-4" />
					SPK Baru
				</button>
			{/if}

			<button
				type="button"
				onclick={openLoadModal}
				class="flex items-center gap-1.5 border-2 border-black bg-sky-200 px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-sky-300"
			>
				<FolderOpen class="h-4 w-4" />
				Buka SPK
			</button>

			<button
				type="button"
				onclick={openImportModal}
				class="flex items-center gap-1.5 border-2 border-black bg-emerald-200 px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-emerald-300"
			>
				<UploadCloud class="h-4 w-4" />
				Import Excel
			</button>

			<a
				href="/api/spk/template"
				download
				class="flex items-center gap-1.5 border-2 border-black bg-amber-100 px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-amber-200"
			>
				<Download class="h-4 w-4" />
				Template
			</a>
		</div>
	</div>

	<!-- Alert Feedback Form Action -->
	{#if form?.success}
		<Alert variant="success" message={form.message}>
			{#snippet actions()}
				{#if form.orderId}
					<span class="border border-black bg-white px-2 py-0.5 font-mono text-xs font-black">
						#{form.orderId}
					</span>
				{/if}
			{/snippet}
		</Alert>
	{:else if form?.message}
		<Alert variant="error" message={form.message} />
	{/if}

	{#if importSuccessMessage}
		<Alert
			variant="success"
			message={importSuccessMessage}
			dismissible
			ondismiss={() => (importSuccessMessage = '')}
		/>
	{/if}

	<!-- FORM CONTAINER -->
	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ result, update }) => {
				await update();
				isSubmitting = false;
				if (result.type === 'success') {
					const data = result.data as any;
					if (data?.message) {
						toast.success(data.message, {
							title: isEditMode ? 'SPK Diperbarui' : 'SPK Diterbitkan',
							action: data.orderId
								? { label: 'Buka SPK', href: `/dashboard/input-spk?id=${encodeURIComponent(data.orderId)}` }
								: undefined
						});
					}
				} else if (result.type === 'failure') {
					const data = result.data as any;
					toast.error(data?.message || data?.error || 'Gagal menyimpan transaksi SPK.', { title: 'Gagal Menyimpan' });
				} else if (result.type === 'error') {
					toast.error('Terjadi kesalahan pada server saat memproses transaksi SPK.', { title: 'Kesalahan Sistem' });
				}
			};
		}}
		class="space-y-6"
	>
		<input type="hidden" name="payload" value={savePayloadJson} />
		<input type="hidden" name="isEdit" value={isEditMode ? 'true' : 'false'} />

		<!-- SECTION 1: HEADER TRANSAKSI -->
		<div class="border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] md:p-6">
			<div class="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
				<h2 class="text-sm font-black uppercase tracking-wider text-black">
					Informasi Header SPK
				</h2>
				<span class="border border-black bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-black uppercase">
					{isEditMode ? 'Mode Edit' : 'Penerbitan Baru'}
				</span>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
				<!-- Departemen -->
				<div>
					<label for="dept-id" class="block text-xs font-black uppercase tracking-wider text-black">
						Departemen *
					</label>
					<select
						id="dept-id"
						value={deptId}
						disabled={isEditMode}
						onchange={(e) => handleDeptChange((e.target as HTMLSelectElement).value)}
						class="mt-1 w-full border-2 border-black bg-emerald-50 px-3 py-2 text-sm font-black shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					>
						{#each data.departments as dept}
							<option value={dept.PRDeptID}>{dept.PRDeptID} - {dept.PRDeptName}</option>
						{/each}
					</select>
				</div>

				<!-- Nomor SPK (OrderID) -->
				<div>
					<div class="flex items-center justify-between">
						<label for="order-id" class="block text-xs font-black uppercase tracking-wider text-black">
							Nomor SPK (OrderID) *
						</label>
						<span class="border border-black bg-emerald-100 px-1.5 py-0.2 font-mono text-[10px] font-black uppercase">
							Otomatis
						</span>
					</div>
					<input
						id="order-id"
						type="text"
						value={orderId}
						readonly
						tabindex="-1"
						placeholder="Misal: IN-26/09/001"
						class="mt-1 w-full border-2 border-black bg-slate-200 px-3 py-2 font-mono text-sm font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-not-allowed select-none opacity-90 focus:outline-none"
					/>
				</div>

				<!-- Tanggal Order -->
				<div>
					<label for="order-date" class="block text-xs font-black uppercase tracking-wider text-black">
						Tanggal Order (SPK) *
					</label>
					<input
						id="order-date"
						type="date"
						value={orderDate}
						onchange={(e) => handleOrderDateChange((e.target as HTMLInputElement).value)}
						class="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					/>
				</div>

				<!-- Target Selesai (Plan Date) -->
				<div>
					<label for="plan-date" class="block text-xs font-black uppercase tracking-wider text-black">
						Target Selesai (Plan Date) *
					</label>
					<input
						id="plan-date"
						type="date"
						bind:value={planDate}
						class="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					/>
				</div>

				<!-- Keterangan / Remark -->
				<div class="sm:col-span-2">
					<label for="remark" class="block text-xs font-black uppercase tracking-wider text-black">
						Keterangan SPK / Remark
					</label>
					<div class="mt-1 flex flex-col gap-1 sm:flex-row">
						<input
							id="remark"
							type="text"
							bind:value={remark}
							placeholder="Contoh: BORINE 30PO260828040, LSB PO#LASV12043, TECH PO"
							class="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
						/>
						<div class="flex items-center gap-1 shrink-0 overflow-x-auto pb-1 sm:pb-0">
							<button
								type="button"
								onclick={() => (remark = 'BORINE')}
								class="border border-black bg-slate-100 px-2 py-1 text-[10px] font-bold hover:bg-slate-200"
							>
								BORINE
							</button>
							<button
								type="button"
								onclick={() => (remark = 'LSB PO')}
								class="border border-black bg-slate-100 px-2 py-1 text-[10px] font-bold hover:bg-slate-200"
							>
								LSB PO
							</button>
							<button
								type="button"
								onclick={() => (remark = 'TECH PO')}
								class="border border-black bg-slate-100 px-2 py-1 text-[10px] font-bold hover:bg-slate-200"
							>
								TECH PO
							</button>
						</div>
					</div>
				</div>

				<!-- Nomor Sales Order (NoSO) -->
				<div>
					<label for="no-so" class="block text-xs font-black uppercase tracking-wider text-black">
						Nomor SO (Sales Order)
					</label>
					<input
						id="no-so"
						type="text"
						bind:value={noSo}
						placeholder="Misal: 2608040"
						class="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
					/>
				</div>

				<!-- Status Selesai / Completed -->
				<div class="flex flex-col justify-end">
					<div class="flex items-center gap-2 border-2 border-black bg-slate-50 p-2 shadow-[2px_2px_0px_0px_#000]">
						<input
							id="is-completed"
							type="checkbox"
							bind:checked={completed}
							class="h-4 w-4 border-2 border-black text-emerald-600 focus:ring-0"
						/>
						<label for="is-completed" class="text-xs font-black uppercase text-black cursor-pointer">
							Status Selesai (Completed)
						</label>
					</div>
					{#if completed}
						<input
							type="date"
							bind:value={finishedDate}
							placeholder="Tgl Selesai"
							class="mt-1 w-full border-2 border-black bg-emerald-50 px-2 py-1 font-mono text-xs font-bold"
						/>
					{/if}
				</div>
			</div>
		</div>

		<!-- SECTION 2: RINCIAN BARANG SPK -->
		<div class="border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] md:p-6">
			<div class="mb-3 flex flex-col gap-2 border-b-2 border-black pb-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 class="text-sm font-black uppercase tracking-wider text-black">
						Rincian Barang & Target Produksi (taPROrderDT)
					</h2>
					<p class="text-[11px] font-bold text-slate-500">
						Masukkan target kuantiti (Kgs) dan jumlah kemasan (Bags). Kuantiti wajib berupa bilangan bulat.
					</p>
				</div>
				<button
					type="button"
					onclick={addRow}
					class="flex items-center justify-center gap-1.5 border-2 border-black bg-[#FFD43B] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-400"
				>
					<Plus class="h-4 w-4" />
					Tambah Baris
				</button>
			</div>

			<!-- TABEL DETAIL -->
			<div class="overflow-x-auto border-2 border-black shadow-[2px_2px_0px_0px_#000]">
				<table class="w-full text-left text-xs">
					<thead class="border-b-2 border-black bg-black text-white">
						<tr>
							<th class="w-10 px-2 py-2 text-center font-black">#</th>
							<th class="w-64 px-2 py-2 font-black uppercase tracking-wider">Kode Barang (taGoods) *</th>
							<th class="px-2 py-2 font-black uppercase tracking-wider">Nama Barang</th>
							<th class="w-20 px-2 py-2 text-center font-black uppercase tracking-wider">Satuan</th>
							<th class="w-28 px-2 py-2 text-right font-black uppercase tracking-wider">Target Qty (Kgs) *</th>
							<th class="w-24 px-2 py-2 text-right font-black uppercase tracking-wider">Bags (Zak)</th>
							<th class="w-20 px-2 py-2 text-center font-black uppercase tracking-wider">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-black/20 bg-white">
						{#each rows as row, idx (row.id)}
							<tr class="hover:bg-yellow-50/50">
								<!-- No -->
								<td class="border-r border-black/20 px-2 py-1 text-center font-mono font-bold text-slate-500">
									{idx + 1}
								</td>

								<!-- Kode Barang -->
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

								<!-- Target Qty (Kgs) -->
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
											class="border border-black bg-red-50 p-1 hover:bg-red-200"
										>
											<Trash2 class="h-3.5 w-3.5 text-red-600" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>

					<!-- FOOTER RINGKASAN TOTAL -->
					<tfoot class="border-t-2 border-black bg-slate-100 font-bold">
						<tr>
							<td colspan="4" class="border-r border-black/20 px-3 py-2 text-right uppercase tracking-wider">
								Total Target ({totalItems} Barang)
							</td>
							<td class="border-r border-black/20 px-2 py-2 text-right font-mono text-sm font-black text-black">
								{totalKgs.toLocaleString('id-ID')}
							</td>
							<td class="border-r border-black/20 px-2 py-2 text-right font-mono text-sm font-black text-black">
								{totalBags.toLocaleString('id-ID')}
							</td>
							<td class="px-2 py-2"></td>
						</tr>
					</tfoot>
				</table>
			</div>

			<!-- SUBMIT / SIMPAN BAR -->
			<div class="mt-6 flex flex-col gap-3 border-t-2 border-black pt-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="text-xs font-bold text-slate-500">
					User: <span class="font-mono text-black">{data.currentUser}</span> • SPK akan disimpan ke tabel <span class="font-mono text-black">taPROrder</span> dan <span class="font-mono text-black">taPROrderDT</span>.
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={resetToNewMode}
						class="flex items-center gap-1.5 border-2 border-black bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-slate-100"
					>
						<RotateCcw class="h-4 w-4" />
						Reset
					</button>

					<button
						type="submit"
						disabled={isSubmitting || totalItems === 0 || totalKgs <= 0}
						class="flex items-center gap-2 border-2 border-black bg-emerald-400 px-6 py-2.5 text-sm font-black uppercase tracking-wider text-black shadow-[4px_4px_0px_0px_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Save class="h-4 w-4" />
						{isSubmitting ? 'Menyimpan...' : isEditMode ? 'Perbarui SPK' : 'Simpan SPK'}
					</button>
				</div>
			</div>
		</div>
	</form>

	<!-- SECTION 3: TABEL SPK TERAKHIR -->
	<div class="border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] md:p-6">
		<div class="mb-3 flex items-center justify-between border-b-2 border-black pb-2">
			<h2 class="text-sm font-black uppercase tracking-wider text-black">
				Daftar SPK Terakhir (Top 20)
			</h2>
			<a
				href="/dashboard/spk"
				class="text-xs font-black text-sky-700 underline hover:text-sky-900"
			>
				Lihat Semua di Halaman SPK →
			</a>
		</div>

		<div class="overflow-x-auto border-2 border-black">
			<table class="w-full text-left text-xs">
				<thead class="border-b-2 border-black bg-slate-200">
					<tr>
						<th class="px-2 py-1.5 font-black uppercase">No. SPK (OrderID)</th>
						<th class="px-2 py-1.5 font-black uppercase">Dept</th>
						<th class="px-2 py-1.5 font-black uppercase">Tgl Order</th>
						<th class="px-2 py-1.5 font-black uppercase">Target Plan</th>
						<th class="px-2 py-1.5 font-black uppercase">Keterangan / Remark</th>
						<th class="px-2 py-1.5 text-right font-black uppercase">Qty Target (Kgs)</th>
						<th class="px-2 py-1.5 text-center font-black uppercase">Status</th>
						<th class="px-2 py-1.5 text-center font-black uppercase">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-black/20">
					{#each data.recentSpks as spk}
						<tr class="hover:bg-slate-50">
							<td class="border-r border-black/10 px-2 py-1.5 font-mono font-black">{spk.orderId}</td>
							<td class="border-r border-black/10 px-2 py-1.5 font-bold text-center">{spk.deptId}</td>
							<td class="border-r border-black/10 px-2 py-1.5 font-mono">{spk.orderDate}</td>
							<td class="border-r border-black/10 px-2 py-1.5 font-mono">{spk.planDate}</td>
							<td class="border-r border-black/10 px-2 py-1.5 truncate max-w-xs">{spk.remark}</td>
							<td class="border-r border-black/10 px-2 py-1.5 text-right font-mono font-black">{spk.totalKgs.toLocaleString('id-ID')}</td>
							<td class="border-r border-black/10 px-2 py-1.5 text-center">
								<span class="inline-block px-1.5 py-0.5 text-[10px] font-black uppercase border border-black {spk.completed ? 'bg-emerald-200 text-emerald-950' : 'bg-amber-200 text-amber-950'}">
									{spk.completed ? 'Selesai' : 'Aktif'}
								</span>
							</td>
							<td class="px-2 py-1.5 text-center">
								<button
									type="button"
									onclick={() => loadExistingTransaction(spk.orderId)}
									class="border border-black bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase hover:bg-sky-200"
								>
									Edit
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- ==================== MODAL 1: CARI BARANG (taGoods) ==================== -->
<Modal bind:open={isGoodsModalOpen} title="Cari Master Barang (taGoods)" size="2xl">
	<SearchInput
		value={goodsSearchQuery}
		oninput={handleGoodsSearchInput}
		loading={isSearchingGoods}
		placeholder="Ketik Kode Barang atau Nama Barang..."
	/>

	<div class="mt-4 max-h-72 overflow-y-auto border-2 border-black">
		<table class="w-full text-left text-xs">
			<thead class="border-b-2 border-black bg-black text-white">
				<tr>
					<th class="px-2 py-1.5 font-black uppercase">Kode Barang</th>
					<th class="px-2 py-1.5 font-black uppercase">Nama Barang</th>
					<th class="px-2 py-1.5 font-black uppercase">Satuan</th>
					<th class="px-2 py-1.5 text-center font-black uppercase">Pilih</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-black/20">
				{#each goodsSearchResults as it}
					<tr class="hover:bg-yellow-50">
						<td class="border-r border-black/10 px-2 py-1.5 font-mono font-black">{it.ItemID}</td>
						<td class="border-r border-black/10 px-2 py-1.5 font-bold">{it.ItemName}</td>
						<td class="border-r border-black/10 px-2 py-1.5 text-center">{it.Satuan || 'Pcs'}</td>
						<td class="px-2 py-1.5 text-center">
							<button
								type="button"
								onclick={() => selectGoodsItem(it)}
								class="border border-black bg-emerald-300 px-2 py-1 text-[10px] font-black uppercase hover:bg-emerald-400"
							>
								Pilih
							</button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="4" class="p-4 text-center font-bold text-slate-400">
							{goodsSearchQuery ? 'Barang tidak ditemukan.' : 'Silakan ketik pencarian...'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</Modal>

<!-- ==================== MODAL 2: BUKA / CARI SPK ==================== -->
<Modal bind:open={isLoadModalOpen} title="Cari & Buka SPK" size="3xl">
	<SearchInput
		value={loadSearchQuery}
		oninput={handleSearchSpkInput}
		loading={isSearchingSpk}
		placeholder="Cari berdasarkan Nomor SPK, Keterangan, atau Kode Barang..."
	/>

	<div class="mt-4 max-h-80 overflow-y-auto border-2 border-black">
		<table class="w-full text-left text-xs">
			<thead class="border-b-2 border-black bg-black text-white">
				<tr>
					<th class="px-2 py-1.5 font-black uppercase">No. SPK</th>
					<th class="px-2 py-1.5 font-black uppercase">Dept</th>
					<th class="px-2 py-1.5 font-black uppercase">Tgl Order</th>
					<th class="px-2 py-1.5 font-black uppercase">Target Plan</th>
					<th class="px-2 py-1.5 font-black uppercase">Keterangan</th>
					<th class="px-2 py-1.5 text-right font-black uppercase">Qty Target</th>
					<th class="px-2 py-1.5 text-center font-black uppercase">Pilih</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-black/20">
				{#each searchSpkResult as item}
					<tr class="hover:bg-sky-50">
						<td class="border-r border-black/10 px-2 py-1.5 font-mono font-black">{item.orderId}</td>
						<td class="border-r border-black/10 px-2 py-1.5 font-bold text-center">{item.deptId}</td>
						<td class="border-r border-black/10 px-2 py-1.5 font-mono">{item.orderDate}</td>
						<td class="border-r border-black/10 px-2 py-1.5 font-mono">{item.planDate}</td>
						<td class="border-r border-black/10 px-2 py-1.5 truncate max-w-xs">{item.remark}</td>
						<td class="border-r border-black/10 px-2 py-1.5 text-right font-mono font-black">{item.totalKgs.toLocaleString('id-ID')}</td>
						<td class="px-2 py-1.5 text-center">
							<button
								type="button"
								onclick={() => loadExistingTransaction(item.orderId)}
								class="border border-black bg-[#FFD43B] px-2 py-1 text-[10px] font-black uppercase hover:bg-yellow-400"
							>
								Buka
							</button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="7" class="p-4 text-center font-bold text-slate-400">
							Tidak ditemukan SPK yang sesuai.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</Modal>

<!-- ==================== MODAL 3: IMPORT EXCEL SPK ==================== -->
{#if isImportModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
		<div class="w-full max-w-4xl max-h-[92vh] overflow-y-auto border-4 border-black bg-white p-5 sm:p-6 shadow-[8px_8px_0px_0px_#000]">
			<!-- Header Modal -->
			<div class="flex items-center justify-between border-b-2 border-black pb-3">
				<div class="flex items-center gap-3">
					<div class="border-2 border-black bg-yellow-300 p-1.5 shadow-[2px_2px_0px_0px_#000]">
						<FileSpreadsheet class="h-5 w-5 text-black" />
					</div>
					<div>
						<h3 class="text-base font-black uppercase tracking-wider text-black">
							Import SPK dari File Excel
						</h3>
						<p class="text-[11px] font-bold text-slate-600">
							Mendukung single departemen maupun terbitan multi-departemen (Injeksi, Spraying, Plating, Assembling, Molding).
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeImportModal}
					class="border-2 border-black bg-slate-100 px-2 py-1 text-xs font-black shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200"
				>
					✕
				</button>
			</div>

			<!-- Success Batch Save Screen -->
			{#if batchSaveResult}
				<div class="mt-4 border-2 border-black bg-emerald-50 p-5 space-y-4 shadow-[4px_4px_0px_0px_#000]">
					<div class="flex items-center gap-3">
						<CheckCircle2 class="h-8 w-8 text-emerald-600 shrink-0" />
						<div>
							<h4 class="text-sm font-black uppercase text-emerald-950">
								Semua SPK Berhasil Diterbitkan!
							</h4>
							<p class="text-xs text-emerald-800 font-bold">
								{batchSaveResult.message}
							</p>
						</div>
					</div>

					<div class="divide-y-2 divide-black/20 border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]">
						{#each batchSaveResult.createdOrders || [] as ord}
							<div class="flex flex-wrap items-center justify-between p-3 gap-2">
								<div class="flex items-center gap-2">
									<span class="inline-block px-2.5 py-1 font-mono font-black text-xs border border-black bg-yellow-200 shadow-[1px_1px_0px_0px_#000]">
										{ord.orderId}
									</span>
									<span class="text-xs font-bold text-slate-700">
										Dept: <strong class="font-black text-black">{ord.deptId}</strong> ({ord.totalItems} Barang, {ord.totalKgs.toLocaleString('id-ID')} Kgs)
									</span>
								</div>
								<div class="flex items-center gap-2">
									<a
										href="/dashboard/input-spk?id={encodeURIComponent(ord.orderId)}"
										target="_blank"
										class="inline-flex items-center gap-1 border border-black bg-white px-2.5 py-1 text-xs font-black uppercase shadow-[1px_1px_0px_0px_#000] hover:bg-slate-100"
									>
										Buka / Edit SPK <ExternalLink class="h-3 w-3" />
									</a>
								</div>
							</div>
						{/each}
					</div>

					<div class="flex flex-wrap items-center justify-between pt-2 gap-2">
						<a
							href="/dashboard/spk"
							class="inline-flex items-center gap-1.5 border-2 border-black bg-[#FFD43B] px-4 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-yellow-400"
						>
							Lihat Semua SPK di Monitoring <ExternalLink class="h-3.5 w-3.5" />
						</a>
						<button
							type="button"
							onclick={closeImportModal}
							class="border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_#000] hover:bg-slate-800"
						>
							Selesai & Tutup
						</button>
					</div>
				</div>
			{:else}
				<!-- Upload Box -->
				<div class="mt-4 border-2 border-dashed border-black bg-slate-50 p-4 sm:p-5 text-center">
					<UploadCloud class="mx-auto h-7 w-7 text-slate-500" />
					<p class="mt-1 text-xs font-bold text-slate-700">
						Pilih file template Excel SPK (.xlsx atau .xls)
					</p>
					<input
						type="file"
						accept=".xlsx,.xls"
						bind:this={importFileInputRef}
						onchange={handleImportFileChange}
						class="mt-2.5 block w-full text-xs font-bold text-slate-500 file:mr-3 file:border-2 file:border-black file:bg-[#FFD43B] file:px-3 file:py-1.5 file:text-xs file:font-black file:uppercase file:shadow-[2px_2px_0px_0px_#000] hover:file:bg-yellow-400"
					/>
					<div class="mt-2.5 flex items-center justify-center gap-4 text-xs">
						<a
							href="/api/spk/template"
							download
							class="inline-flex items-center gap-1 font-black text-sky-800 underline hover:text-black"
						>
							<Download class="h-3.5 w-3.5" /> Unduh Template Excel Multi-Dept
						</a>
					</div>
				</div>

				{#if isUploadingImport}
					<div class="mt-3 p-3 text-center text-xs font-black text-sky-800 bg-sky-50 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
						Memvalidasi data Excel & master taGoods...
					</div>
				{/if}

				{#if importError}
					<div class="mt-3 border-2 border-black bg-red-100 p-3 text-xs font-black text-red-900 shadow-[2px_2px_0px_0px_#000]">
						{importError}
					</div>
				{/if}

				{#if parsedImportData}
					<div class="mt-4 space-y-4">
						<!-- Summary Bar -->
						<div class="border-2 border-black bg-slate-100 p-3 text-xs shadow-[2px_2px_0px_0px_#000] flex flex-wrap items-center justify-between gap-2">
							<div class="font-bold flex items-center flex-wrap gap-1.5">
								{#if parsedImportData.isMultiDept}
									<span class="inline-block border border-black bg-indigo-200 px-2 py-0.5 text-[10px] font-black uppercase">
										Multi-Dept ({parsedImportData.groups?.length || 0} Departemen)
									</span>
								{:else}
									<span class="inline-block border border-black bg-slate-300 px-2 py-0.5 text-[10px] font-black uppercase">
										Dept: {parsedImportData.header?.deptId || deptId}
									</span>
								{/if}
								<span>Tgl Order: <strong class="font-mono font-black">{parsedImportData.header?.orderDate || orderDate}</strong></span>
								<span>| Target: <strong class="font-mono font-black">{parsedImportData.header?.planDate || planDate}</strong></span>
								{#if parsedImportData.header?.remark}
									<span>| Ket: <strong>{parsedImportData.header.remark}</strong></span>
								{/if}
							</div>
							<div class="font-bold text-right">
								Total: <span class="font-mono font-black">{parsedImportData.summary?.totalRows} Barang</span>
								({parsedImportData.summary?.totalKgs?.toLocaleString('id-ID')} Kgs)
								{#if parsedImportData.summary?.invalidCount > 0}
									<span class="ml-2 inline-block border border-black bg-red-200 px-1.5 py-0.5 text-[10px] font-black text-red-900">
										{parsedImportData.summary.invalidCount} Error
									</span>
								{/if}
							</div>
						</div>

						<!-- Multi-Department View -->
						{#if parsedImportData.isMultiDept}
							<div class="border-2 border-black bg-yellow-50/60 p-3 shadow-[2px_2px_0px_0px_#000]">
								<div class="flex items-center justify-between mb-2">
									<span class="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
										<Layers class="h-4 w-4" />
										Pilih Departemen SPK yang Akan Diterbitkan:
									</span>
									<div class="flex items-center gap-2">
										<button
											type="button"
											onclick={() => selectAllDepts(true)}
											class="border border-black bg-white px-2 py-0.5 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] hover:bg-slate-100"
										>
											Pilih Semua
										</button>
										<button
											type="button"
											onclick={() => selectAllDepts(false)}
											class="border border-black bg-white px-2 py-0.5 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] hover:bg-slate-100"
										>
											Batal Semua
										</button>
									</div>
								</div>

								<!-- Grid of Department Cards -->
								<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
									{#each parsedImportData.groups as grp}
										{@const isSelected = selectedDepts.includes(grp.deptId)}
										{@const isActivePreview = activePreviewDept === grp.deptId}
										<div
											class="border-2 border-black p-2.5 transition-all text-xs shadow-[2px_2px_0px_0px_#000] {isActivePreview ? 'ring-2 ring-black bg-yellow-100' : 'bg-white'}"
										>
											<div class="flex items-start justify-between gap-1">
												<label class="flex items-center gap-2 cursor-pointer font-black text-xs">
													<input
														type="checkbox"
														checked={isSelected}
														onchange={() => toggleDeptSelection(grp.deptId)}
														class="h-4 w-4 rounded-none border-2 border-black accent-black"
													/>
													<span>{grp.deptName} ({grp.deptId})</span>
												</label>
												{#if grp.invalidCount > 0}
													<span class="border border-black bg-red-200 px-1 py-0.5 text-[9px] font-black text-red-900 uppercase">
														{grp.invalidCount} Error
													</span>
												{:else}
													<span class="border border-black bg-emerald-200 px-1 py-0.5 text-[9px] font-black text-emerald-950 uppercase">
														Siap
													</span>
												{/if}
											</div>

											<div class="mt-2 flex items-center justify-between text-[11px] text-slate-700">
												<span class="font-mono font-bold">SPK: {grp.nextOrderId || '-'}</span>
												<span class="font-bold">{grp.totalItems} Item ({grp.totalKgs.toLocaleString('id-ID')} Kg)</span>
											</div>

											<div class="mt-2 pt-2 border-t border-black/10 flex items-center justify-between">
												<button
													type="button"
													onclick={() => (activePreviewDept = grp.deptId)}
													class="text-[10px] font-black uppercase underline {isActivePreview ? 'text-black font-extrabold' : 'text-slate-600 hover:text-black'}"
												>
													{isActivePreview ? 'Sedang Ditinjau ▼' : 'Tinjau Rincian ▶'}
												</button>
												<button
													type="button"
													onclick={() => applyGroupToForm(grp)}
													class="border border-black bg-white px-2 py-0.5 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] hover:bg-slate-100"
													title="Terapkan departemen ini saja ke lembar formulir"
												>
													Muat ke Form
												</button>
											</div>
										</div>
									{/each}
								</div>
							</div>

							<!-- Table of Active Department Items -->
							{#if activePreviewGroup}
								<div class="space-y-1.5">
									<div class="flex items-center justify-between text-xs font-black">
										<div class="flex items-center gap-2">
											<span>Rincian Barang Departemen:</span>
											<span class="font-bold bg-yellow-200 border border-black px-1.5 py-0.5">
												{activePreviewGroup.deptName} ({activePreviewGroup.deptId})
											</span>
											<span class="font-mono text-slate-600">
												(Rencana SPK: {activePreviewGroup.nextOrderId})
											</span>
										</div>
										<div class="text-slate-600">
											Total {activePreviewGroup.items.length} barang
										</div>
									</div>

									<div class="max-h-56 overflow-y-auto border-2 border-black">
										<table class="w-full text-left text-xs">
											<thead class="border-b-2 border-black bg-black text-white sticky top-0">
												<tr>
													<th class="px-2 py-1">Kode Barang</th>
													<th class="px-2 py-1">Nama Barang</th>
													<th class="px-2 py-1 text-center">Bags</th>
													<th class="px-2 py-1 text-right">Target (Kg)</th>
													<th class="px-2 py-1 text-center">Status</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-black/20">
												{#each activePreviewGroup.items as item}
													<tr class={item.isValid ? 'bg-white' : 'bg-red-50'}>
														<td class="px-2 py-1 font-mono font-black">{item.itemId}</td>
														<td class="px-2 py-1">
															{item.itemName || item.error}
															{#if item.notes}
																<span class="text-[10px] text-slate-500 block italic">{item.notes}</span>
															{/if}
														</td>
														<td class="px-2 py-1 text-center font-mono">{item.bags || '-'}</td>
														<td class="px-2 py-1 text-right font-mono font-black">{item.kgs.toLocaleString('id-ID')}</td>
														<td class="px-2 py-1 text-center">
															<span class="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase border border-black {item.isValid ? 'bg-emerald-200' : 'bg-red-200 text-red-900'}">
																{item.isValid ? 'Valid' : 'Gagal'}
															</span>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								</div>
							{/if}

							<!-- Action Buttons for Multi-Dept -->
							<div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-black">
								<div>
									{#if selectedDepts.length === 0}
										<span class="text-xs font-bold text-amber-800">
											Pilih minimal 1 departemen untuk diterbitkan.
										</span>
									{:else if !canBatchSave}
										<span class="text-xs font-bold text-red-800">
											Terdapat barang gagal pada departemen terpilih. Harap perbaiki sebelum menerbitkan.
										</span>
									{:else}
										<span class="text-xs font-bold text-slate-600">
											Siap menerbitkan <strong class="text-black font-black">{selectedDepts.length} transaksi SPK</strong> sekaligus ke database ERP.
										</span>
									{/if}
								</div>

								<div class="flex items-center gap-2">
									{#if activePreviewGroup}
										<button
											type="button"
											onclick={() => applyGroupToForm(activePreviewGroup)}
											class="border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-slate-100"
										>
											Terapkan Dept Ini ke Form
										</button>
									{/if}
									<button
										type="button"
										onclick={handleBatchSave}
										disabled={!canBatchSave || isBatchSaving}
										class="border-2 border-black bg-emerald-400 px-5 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-emerald-300 disabled:opacity-50"
									>
										{#if isBatchSaving}
											Menyimpan...
										{:else}
											⚡ Terbitkan {selectedDepts.length} SPK Sekaligus
										{/if}
									</button>
								</div>
							</div>
						{:else}
							<!-- Single Department View (Normal) -->
							<div class="max-h-56 overflow-y-auto border-2 border-black">
								<table class="w-full text-left text-xs">
									<thead class="border-b-2 border-black bg-black text-white sticky top-0">
										<tr>
											<th class="px-2 py-1">Kode Barang</th>
											<th class="px-2 py-1">Nama Barang</th>
											<th class="px-2 py-1 text-center">Bags</th>
											<th class="px-2 py-1 text-right">Target (Kg)</th>
											<th class="px-2 py-1 text-center">Status</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-black/20">
										{#each parsedImportData.items as item}
											<tr class={item.isValid ? 'bg-white' : 'bg-red-50'}>
												<td class="px-2 py-1 font-mono font-black">{item.itemId}</td>
												<td class="px-2 py-1">
													{item.itemName || item.error}
													{#if item.notes}
														<span class="text-[10px] text-slate-500 block italic">{item.notes}</span>
													{/if}
												</td>
												<td class="px-2 py-1 text-center font-mono">{item.bags || '-'}</td>
												<td class="px-2 py-1 text-right font-mono font-black">{item.kgs.toLocaleString('id-ID')}</td>
												<td class="px-2 py-1 text-center">
													<span class="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase border border-black {item.isValid ? 'bg-emerald-200' : 'bg-red-200 text-red-900'}">
														{item.isValid ? 'Valid' : 'Gagal'}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							<div class="flex justify-end gap-2 pt-2 border-t-2 border-black">
								<button
									type="button"
									onclick={applyImportData}
									disabled={!canApplyImport}
									class="border-2 border-black bg-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-emerald-300 disabled:opacity-50"
								>
									Terapkan Data ke Formulir
								</button>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
