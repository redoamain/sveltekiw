<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		ShoppingCart,
		PlusCircle,
		ListFilter,
		Search,
		Printer,
		Download,
		Edit3,
		Trash2,
		XCircle,
		CheckCircle2,
		RotateCcw,
		FileSpreadsheet,
		Eye,
		Calendar,
		Building2,
		Tag,
		ExternalLink,
		FileText,
		Layers,
		AlertTriangle,
		Coins,
		Plus,
		X,
		ArrowRight,
		Clock,
		Check,
		Copy
	} from '@lucide/svelte';
	import { toast } from '$lib/toast.svelte';
	import { KopSuratCitiPlumb } from '$lib/components';
	import type { PurchaseOrderItemInput, PurchaseOrderHeader } from '$lib/types/purchase-order';
	import { terbilang } from '$lib/terbilang';

	let { data } = $props();

	// Active tab: 'form' | 'list'
	let activeTab = $state<'form' | 'list'>('form');

	// Form State
	let isEditing = $state(false);
	let editingOrderId = $state('');
	let orderIdInput = $state('');
	let orderDateInput = $state('');
	let dueDateInput = $state('');
	let deliveryDateInput = $state('');
	let selectedCompanyId = $state('');
	let currInput = $state('IDR');
	let rateInput = $state(1);
	let taxPercentInput = $state(11); // Default 11% PPN
	let tipeDokInput = $state('BC 4.0');
	let tipefakturInput = $state('070');
	let remarkInput = $state('');
	let contractNoInput = $state('');

	// Line items state
	interface FormItemRow extends PurchaseOrderItemInput {
		tempId: string;
	}

	let lineItems = $state<FormItemRow[]>([
		{
			tempId: 'row-1',
			itemId: '',
			itemName: '',
			kgs: 100,
			bags: 1,
			satuan: 'PCS',
			price: 0,
			ogReason: '',
			bagMarking: ''
		}
	]);

	// Filter & Search State for List Tab
	let searchQuery = $state('');
	let filterTgl1 = $state('');
	let filterTgl2 = $state('');
	let filterStatus = $state('all');
	let filterCompanyId = $state('');
	let currentPage = $state(1);

	// Sync initial data into states
	$effect.pre(() => {
		if (!orderIdInput && data.initialData?.nextOrderId) {
			orderIdInput = data.initialData.nextOrderId;
		}
		if (!orderDateInput && data.initialData?.today) {
			orderDateInput = data.initialData.today;
			dueDateInput = data.initialData.today;
		}
		if (!selectedCompanyId && data.initialData?.suppliers?.[0]?.companyId) {
			selectedCompanyId = data.initialData.suppliers[0].companyId;
		}
		if (data.filter) {
			activeTab = data.filter.tab === 'list' ? 'list' : 'form';
			searchQuery = data.filter.q || '';
			filterTgl1 = data.filter.tgl1 || '';
			filterTgl2 = data.filter.tgl2 || '';
			filterStatus = data.filter.status || 'all';
			filterCompanyId = data.filter.companyId || '';
			currentPage = data.filter.page || 1;
		}
	});

	// Modals & Preview State
	let previewModalOpen = $state(false);
	let previewPoData = $state<any>(null);
	let previewLoading = $state(false);

	let cancelModalOpen = $state(false);
	let cancelTargetId = $state('');
	let cancelReasonInput = $state('');

	let isSubmitting = $state(false);

	// Quick Goods Search Modal / Drawer
	let goodsSearchQuery = $state('');
	let activeRowIndexForPicker = $state<number | null>(null);
	let goodsPickerOpen = $state(false);

	// Calculated totals for form
	let dppTotal = $derived.by(() => {
		return lineItems.reduce((acc, it) => acc + (Number(it.kgs) || 0) * (Number(it.price) || 0), 0);
	});

	let taxAmountTotal = $derived.by(() => {
		return Math.round((dppTotal * (Number(taxPercentInput) || 0)) / 100);
	});

	let grandTotal = $derived.by(() => {
		return dppTotal + taxAmountTotal;
	});

	let liveTerbilang = $derived.by(() => {
		return terbilang(grandTotal);
	});

	// Selected supplier object
	let selectedSupplier = $derived.by(() => {
		return data.initialData.suppliers.find((s) => s.companyId === selectedCompanyId);
	});

	// Filtered goods for picker
	let filteredCommonGoods = $derived.by(() => {
		const q = goodsSearchQuery.trim().toLowerCase();
		if (!q) return data.initialData.commonGoods;
		return data.initialData.commonGoods.filter(
			(g) => g.itemId.toLowerCase().includes(q) || g.itemName.toLowerCase().includes(q)
		);
	});

	function addRow() {
		const newTempId = `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		lineItems.push({
			tempId: newTempId,
			itemId: '',
			itemName: '',
			kgs: 1,
			bags: 1,
			satuan: 'PCS',
			price: 0,
			ogReason: '',
			bagMarking: ''
		});
	}

	function removeRow(index: number) {
		if (lineItems.length <= 1) {
			toast.warning('Minimal satu baris barang', { description: 'PO harus memiliki minimal 1 item.' });
			return;
		}
		lineItems.splice(index, 1);
	}

	function openGoodsPicker(index: number) {
		activeRowIndexForPicker = index;
		goodsSearchQuery = '';
		goodsPickerOpen = true;
	}

	function selectGoodsForActiveRow(goods: { itemId: string; itemName: string; satuan: string }) {
		if (activeRowIndexForPicker !== null && lineItems[activeRowIndexForPicker]) {
			lineItems[activeRowIndexForPicker].itemId = goods.itemId;
			lineItems[activeRowIndexForPicker].itemName = goods.itemName;
			lineItems[activeRowIndexForPicker].satuan = goods.satuan || 'PCS';
		}
		goodsPickerOpen = false;
		activeRowIndexForPicker = null;
	}

	async function updateNextOrderIdForDate(newDate: string) {
		if (isEditing || !newDate) return;
		try {
			const res = await fetch(`/api/purchase-order?action=next-id&date=${newDate}`);
			if (res.ok) {
				const resData = await res.json();
				if (resData.nextId) {
					orderIdInput = resData.nextId;
				}
			}
		} catch {}
	}

	function resetForm() {
		isEditing = false;
		editingOrderId = '';
		orderIdInput = data.initialData.nextOrderId;
		orderDateInput = data.initialData.today;
		dueDateInput = data.initialData.today;
		deliveryDateInput = '';
		selectedCompanyId = data.initialData.suppliers[0]?.companyId || '';
		updateNextOrderIdForDate(data.initialData.today);
		currInput = 'IDR';
		rateInput = 1;
		taxPercentInput = 11;
		tipeDokInput = 'BC 4.0';
		tipefakturInput = '070';
		remarkInput = '';
		contractNoInput = '';
		lineItems = [
			{
				tempId: `row-${Date.now()}`,
				itemId: '',
				itemName: '',
				kgs: 100,
				bags: 1,
				satuan: 'PCS',
				price: 0,
				ogReason: '',
				bagMarking: ''
			}
		];
	}

	async function startEditPO(po: PurchaseOrderHeader) {
		isSubmitting = true;
		try {
			const res = await fetch(`/api/purchase-order/${po.orderId}`);
			if (!res.ok) throw new Error('Gagal memuat detail PO untuk diedit.');
			const detail = await res.json();

			isEditing = true;
			editingOrderId = detail.header.orderId;
			orderIdInput = detail.header.orderId;
			orderDateInput = detail.header.orderDate;
			dueDateInput = detail.header.dueDate || detail.header.orderDate;
			deliveryDateInput = detail.header.deliveryDate || '';
			selectedCompanyId = detail.header.companyId;
			currInput = detail.header.curr || 'IDR';
			rateInput = detail.header.rate || 1;
			taxPercentInput = detail.header.tax || 0;
			tipeDokInput = detail.header.tipeDok || 'BC 4.0';
			tipefakturInput = detail.header.tipefaktur || '070';
			remarkInput = detail.header.remark || '';
			contractNoInput = detail.header.contractNo || '';

			lineItems = detail.items.map((it: any, idx: number) => ({
				tempId: `row-${it.rjn || idx}`,
				rjn: it.rjn,
				itemId: it.itemId,
				itemName: it.itemName,
				kgs: it.kgs,
				bags: it.bags || 1,
				satuan: it.satuan || 'PCS',
				price: it.price,
				ogReason: it.ogReason || '',
				bagMarking: it.bagMarking || '',
				maxEta: it.maxEta || null
			}));

			activeTab = 'form';
			toast.info(`Mode Edit PO #${po.orderId}`, {
				description: 'Silakan ubah data header atau baris barang yang diinginkan.'
			});
		} catch (err: any) {
			toast.error('Gagal Mengedit PO', { description: err?.message });
		} finally {
			isSubmitting = false;
		}
	}

	async function openPreview(orderId: string) {
		previewLoading = true;
		previewModalOpen = true;
		try {
			const res = await fetch(`/api/purchase-order/${orderId}`);
			if (!res.ok) throw new Error('Gagal memuat rincian PO.');
			previewPoData = await res.json();
		} catch (err: any) {
			toast.error('Gagal Membuka Preview', { description: err?.message });
			previewModalOpen = false;
		} finally {
			previewLoading = false;
		}
	}

	function printDirectly(orderId: string) {
		if (typeof window !== 'undefined') {
			window.open(`/dashboard/input-po/print/${orderId}`, '_blank');
		}
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (searchQuery.trim()) params.set('q', searchQuery.trim());
		if (filterTgl1) params.set('tgl1', filterTgl1);
		if (filterTgl2) params.set('tgl2', filterTgl2);
		if (filterStatus !== 'all') params.set('status', filterStatus);
		if (filterCompanyId) params.set('companyId', filterCompanyId);
		params.set('tab', 'list');
		params.set('page', '1');

		goto(`?${params.toString()}`);
	}

	function resetFilters() {
		searchQuery = '';
		filterTgl1 = '';
		filterTgl2 = '';
		filterStatus = 'all';
		filterCompanyId = '';
		goto(`?tab=list&page=1`);
	}

	function getPageUrl(pageNum: number) {
		const p = new URLSearchParams();
		if (data.filter.q) p.set('q', data.filter.q);
		if (data.filter.tgl1) p.set('tgl1', data.filter.tgl1);
		if (data.filter.tgl2) p.set('tgl2', data.filter.tgl2);
		if (data.filter.status && data.filter.status !== 'all') p.set('status', data.filter.status);
		if (data.filter.companyId) p.set('companyId', data.filter.companyId);
		p.set('tab', 'list');
		p.set('page', String(pageNum));
		return `?${p.toString()}`;
	}

	function formatRupiah(val: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(val);
	}
</script>

<svelte:head>
	<title>Input Purchase Order (PO) | PT. CITI PLUMB</title>
</svelte:head>

<div class="space-y-6 pb-12 font-sans">
	<!-- 1. Top Neo-Brutalist Header -->
	<div class="bg-card border-[3px] border-border rounded-2xl p-5 sm:p-6 brutal-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
		<div class="flex items-center gap-3.5">
			<div class="size-14 bg-primary text-white border-2 border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_#000] shrink-0">
				<ShoppingCart class="size-7" />
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-2xl sm:text-3xl font-black font-display tracking-tight text-foreground">
						INPUT PURCHASE ORDER (PO)
					</h1>
					<span class="px-2 py-0.5 bg-amber-400 text-black border border-black rounded text-[10px] font-mono font-black uppercase shadow-[1px_1px_0px_0px_#000]">
						CRUDS & EXPORT
					</span>
				</div>
				<p class="text-xs sm:text-sm font-semibold text-muted-foreground mt-0.5">
					Sistem Pengadaan Barang & Penerbitan Surat Pesanan Resmi — <span class="font-bold text-foreground">PT. CITI PLUMB</span>
				</p>
			</div>
		</div>

		<!-- Action & Tab Toggles -->
		<div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
			<button
				type="button"
				onclick={() => (activeTab = 'form')}
				class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-black font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer {activeTab === 'form' ? 'bg-primary text-white' : 'bg-card text-foreground hover:bg-muted'}"
			>
				<PlusCircle class="size-4" />
				<span>{isEditing ? `Edit PO #${editingOrderId}` : 'Form Input PO'}</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'list')}
				class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-black font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer {activeTab === 'list' ? 'bg-primary text-white' : 'bg-card text-foreground hover:bg-muted'}"
			>
				<ListFilter class="size-4" />
				<span>Daftar & Riwayat PO ({data.poList.totalRows})</span>
			</button>

			<a
				href="/api/purchase-order/export/excel?{new URLSearchParams({ q: searchQuery, tgl1: filterTgl1, tgl2: filterTgl2, status: filterStatus }).toString()}"
				class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border-2 border-black bg-emerald-400 text-black font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] hover:bg-emerald-300 active:translate-x-0.5 active:translate-y-0.5 transition-all"
				title="Unduh seluruh daftar PO ke file Excel"
			>
				<FileSpreadsheet class="size-4" />
				<span class="hidden sm:inline">Export Excel</span>
			</a>
		</div>
	</div>

	<!-- 2. Metric Cards -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
		<div class="bg-card border-2 border-border rounded-xl p-4 brutal-shadow-sm">
			<span class="text-[10px] font-mono font-black uppercase text-muted-foreground block">TOTAL PURCHASE ORDER</span>
			<span class="text-2xl font-black font-display text-foreground mt-1 block">
				{data.poList.totalRows}
			</span>
			<span class="text-[10px] font-bold text-neutral-500">Dokumen PO Terdaftar</span>
		</div>

		<div class="bg-card border-2 border-border rounded-xl p-4 brutal-shadow-sm">
			<span class="text-[10px] font-mono font-black uppercase text-muted-foreground block">TOTAL NILAI PEMBELIAN</span>
			<span class="text-xl sm:text-2xl font-black font-display text-foreground mt-1 block truncate">
				{formatRupiah(data.poList.summary.totalDpp)}
			</span>
			<span class="text-[10px] font-bold text-neutral-500">Subtotal DPP Bersih</span>
		</div>

		<div class="bg-card border-2 border-border rounded-xl p-4 brutal-shadow-sm">
			<span class="text-[10px] font-mono font-black uppercase text-emerald-700 block">PO AKTIF / OPEN</span>
			<span class="text-2xl font-black font-display text-emerald-800 mt-1 block">
				{data.poList.summary.totalOpen}
			</span>
			<span class="text-[10px] font-bold text-emerald-600">Menunggu Penerimaan</span>
		</div>

		<div class="bg-card border-2 border-border rounded-xl p-4 brutal-shadow-sm">
			<span class="text-[10px] font-mono font-black uppercase text-sky-700 block">PO SELESAI (COMPLETED)</span>
			<span class="text-2xl font-black font-display text-sky-800 mt-1 block">
				{data.poList.summary.totalCompleted}
			</span>
			<span class="text-[10px] font-bold text-sky-600">Telah Terpenuhi</span>
		</div>
	</div>

	<!-- TAB 1: FORM INPUT & EDIT PURCHASE ORDER -->
	{#if activeTab === 'form'}
		<div class="bg-card border-[3px] border-border rounded-2xl p-5 sm:p-8 brutal-shadow">
			<!-- Form Header Title & Mode Indicator -->
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b-2 border-border/80 gap-3">
				<div>
					<div class="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-black text-xs font-mono font-black uppercase shadow-[1px_1px_0px_0px_#000] {isEditing ? 'bg-amber-400 text-black' : 'bg-primary text-white'}">
						{#if isEditing}
							<Edit3 class="size-3.5" />
							<span>MODE EDIT: PO #{editingOrderId}</span>
						{:else}
							<PlusCircle class="size-3.5" />
							<span>MODE ENTRY: PURCHASE ORDER BARU</span>
						{/if}
					</div>
					<h2 class="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground mt-2">
						{isEditing ? `Perbarui Transaksi Purchase Order #${editingOrderId}` : 'Formulir Pembelian Barang (PO)'}
					</h2>
				</div>

				<div class="flex items-center gap-2">
					{#if isEditing}
						<button
							type="button"
							onclick={resetForm}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
						>
							<XCircle class="size-4 text-red-600" />
							<span>Batal Edit (PO Baru)</span>
						</button>
					{/if}
					<button
						type="button"
						onclick={resetForm}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
					>
						<RotateCcw class="size-3.5" />
						<span>Reset Form</span>
					</button>
				</div>
			</div>

			<!-- Main Form -->
			<form
				method="POST"
				action={isEditing ? '?/update' : '?/create'}
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						isSubmitting = false;
						if (result.type === 'success') {
							const resData = result.data as any;
							toast.success(resData?.message || 'Purchase Order berhasil disimpan.');
							if (!isEditing) {
								resetForm();
							}
							await update();
							// Refresh data list & open list tab
							activeTab = 'list';
						} else if (result.type === 'failure') {
							const resData = result.data as any;
							toast.error('Gagal Menyimpan PO', { description: resData?.message || 'Terjadi kesalahan sistem.' });
						}
					};
				}}
				class="space-y-6 mt-6"
			>
				<!-- Hidden Input for Payload JSON -->
				<input
					type="hidden"
					name="payload"
					value={JSON.stringify({
						orderId: orderIdInput,
						orderDate: orderDateInput,
						dueDate: dueDateInput,
						deliveryDate: deliveryDateInput,
						companyId: selectedCompanyId,
						curr: currInput,
						rate: Number(rateInput) || 1,
						tax: Number(taxPercentInput) || 0,
						tipeDok: tipeDokInput,
						tipefaktur: tipefakturInput,
						remark: remarkInput,
						contractNo: contractNoInput,
						details: lineItems.map((it) => ({
							rjn: it.rjn,
							itemId: it.itemId.trim(),
							itemName: it.itemName,
							bags: Number(it.bags) || 1,
							kgs: Number(it.kgs) || 0,
							satuan: it.satuan || 'PCS',
							price: Number(it.price) || 0,
							total: (Number(it.kgs) || 0) * (Number(it.price) || 0),
							ogReason: it.ogReason || '',
							bagMarking: it.bagMarking || ''
						}))
					})}
				/>

				<!-- Section A: Header Metadata -->
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border-2 border-black bg-muted/30">
					<!-- 1. Nomor PO (Otomatis & Tidak Dapat Diedit) -->
					<div>
						<div class="flex items-center justify-between mb-1">
							<label for="po-number" class="block text-xs font-mono font-black uppercase text-foreground">
								Nomor PO:
							</label>
							<span class="px-1.5 py-0.5 rounded bg-amber-400 text-black border border-black text-[9px] font-mono font-black uppercase shadow-[1px_1px_0px_0px_#000]">
								OTOMATIS (SISTEM)
							</span>
						</div>
						<div class="relative">
							<input
								id="po-number"
								type="text"
								value={isEditing ? editingOrderId : orderIdInput}
								readonly
								tabindex="-1"
								class="w-full px-3 py-2 rounded-lg border-2 border-black font-mono font-black text-sm bg-neutral-100 text-neutral-800 shadow-[2px_2px_0px_0px_#000] cursor-not-allowed select-none outline-none"
							/>
						</div>
						<span class="text-[10px] text-muted-foreground font-semibold mt-1 block">
							{isEditing
								? 'Nomor PO bersifat permanen dan tidak dapat diubah.'
								: 'Dibuat otomatis berurutan oleh sistem saat disimpan.'}
						</span>
					</div>

					<!-- 2. Tanggal PO -->
					<div>
						<label for="po-date" class="block text-xs font-mono font-black uppercase text-foreground mb-1">
							Tanggal PO:
						</label>
						<input
							id="po-date"
							type="date"
							bind:value={orderDateInput}
							onchange={() => updateNextOrderIdForDate(orderDateInput)}
							required
							class="w-full px-3 py-2 rounded-lg border-2 border-black font-mono font-bold text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none"
						/>
						{#if data.initialData.lockDate}
							<span class="text-[10px] text-amber-800 font-mono mt-0.5 block">
								Batas Kunci: {data.initialData.lockDate}
							</span>
						{/if}
					</div>

					<!-- 3. Jatuh Tempo -->
					<div>
						<label for="po-due" class="block text-xs font-mono font-black uppercase text-foreground mb-1">
							Jatuh Tempo:
						</label>
						<input
							id="po-due"
							type="date"
							bind:value={dueDateInput}
							class="w-full px-3 py-2 rounded-lg border-2 border-black font-mono font-bold text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none"
						/>
					</div>

					<!-- 4. Estimasi Kirim (ETA) -->
					<div>
						<label for="po-delivery" class="block text-xs font-mono font-black uppercase text-foreground mb-1">
							Estimasi Kirim (ETA):
						</label>
						<input
							id="po-delivery"
							type="date"
							bind:value={deliveryDateInput}
							class="w-full px-3 py-2 rounded-lg border-2 border-black font-mono font-bold text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none"
						/>
					</div>

					<!-- 5. Pemasok (Supplier) -->
					<div class="sm:col-span-2">
						<label for="po-supplier" class="block text-xs font-mono font-black uppercase text-foreground mb-1">
							Pemasok (Supplier / Vendor):
						</label>
						<select
							id="po-supplier"
							bind:value={selectedCompanyId}
							required
							class="w-full px-3 py-2 rounded-lg border-2 border-black font-bold text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none cursor-pointer"
						>
							{#each data.initialData.suppliers as sup}
								<option value={sup.companyId}>
									{sup.companyName} ({sup.companyId}) - {sup.city || 'Lokal'}
								</option>
							{/each}
						</select>
						{#if selectedSupplier}
							<div class="mt-1 text-[11px] font-medium text-neutral-600 truncate">
								Alamat: {selectedSupplier.address || '-'} | Telp: {selectedSupplier.phone || '-'} | NPWP: {selectedSupplier.taxId || '-'}
							</div>
						{/if}
					</div>

					<!-- 6. Dokumen Pabean & Tipe Faktur -->
					<div>
						<label for="po-tipedok" class="block text-xs font-mono font-black uppercase text-foreground mb-1">
							Dokumen Pabean:
						</label>
						<select
							id="po-tipedok"
							bind:value={tipeDokInput}
							class="w-full px-3 py-2 rounded-lg border-2 border-black font-bold text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none cursor-pointer"
						>
							{#each data.initialData.documentTypes as dt}
								<option value={dt}>{dt}</option>
							{/each}
						</select>
					</div>

					<!-- 7. Pajak (PPN) -->
					<div>
						<label for="po-tax" class="block text-xs font-mono font-black uppercase text-foreground mb-1">
							Tarif PPN (%):
						</label>
						<select
							id="po-tax"
							bind:value={taxPercentInput}
							class="w-full px-3 py-2 rounded-lg border-2 border-black font-bold text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none cursor-pointer"
						>
							{#each data.initialData.taxRates as tr}
								<option value={tr.value}>{tr.label}</option>
							{/each}
						</select>
					</div>

					<!-- 8. Valuta & Kurs -->
					<div>
						<label for="po-curr" class="block text-xs font-mono font-black uppercase text-foreground mb-1">
							Mata Uang & Kurs:
						</label>
						<div class="flex gap-2">
							<select
								id="po-curr"
								bind:value={currInput}
								class="w-24 px-2 py-2 rounded-lg border-2 border-black font-mono font-bold text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none"
							>
								{#each data.initialData.currencies as c}
									<option value={c}>{c}</option>
								{/each}
							</select>
							<input
								type="number"
								step="0.0001"
								bind:value={rateInput}
								placeholder="Kurs"
								title="Kurs Valuta Asing"
								class="w-full px-2 py-2 rounded-lg border-2 border-black font-mono font-bold text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none"
							/>
						</div>
					</div>

					<!-- 9. Catatan / Remarks -->
					<div class="sm:col-span-3">
						<label for="po-remark" class="block text-xs font-mono font-black uppercase text-foreground mb-1">
							Keterangan / Catatan Tambahan:
						</label>
						<input
							id="po-remark"
							type="text"
							bind:value={remarkInput}
							placeholder="Catatan pesanan, nomor penawaran supplier, atau instruksi pengiriman..."
							class="w-full px-3 py-2 rounded-lg border-2 border-black font-semibold text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none"
						/>
					</div>
				</div>

				<!-- Section B: Line Items Table (Rincian Barang) -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Layers class="size-5 text-foreground" />
							<h3 class="font-display font-black text-base sm:text-lg uppercase tracking-wide text-foreground">
								Rincian Barang Pesanan ({lineItems.length} Baris)
							</h3>
						</div>

						<button
							type="button"
							onclick={addRow}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-primary text-white text-xs font-display font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-primary/90 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
						>
							<Plus class="size-4" />
							<span>Tambah Baris Barang</span>
						</button>
					</div>

					<div class="overflow-x-auto border-[3px] border-black rounded-xl shadow-[3px_3px_0px_0px_#000] bg-white">
						<table class="w-full border-collapse text-xs">
							<thead>
								<tr class="bg-black text-white font-mono uppercase text-[11px] tracking-wider text-left">
									<th class="p-2.5 text-center w-10">No</th>
									<th class="p-2.5 w-44">Kode Barang</th>
									<th class="p-2.5 min-w-[180px]">Nama Barang / Spesifikasi</th>
									<th class="p-2.5 w-24 text-right">Qty</th>
									<th class="p-2.5 w-20 text-center">Satuan</th>
									<th class="p-2.5 w-20 text-center">Kemasan</th>
									<th class="p-2.5 w-32 text-right">Harga Satuan</th>
									<th class="p-2.5 w-32 text-right">Subtotal</th>
									<th class="p-2.5 w-36">Keterangan Baris</th>
									<th class="p-2.5 text-center w-12">Aksi</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-neutral-200">
								{#each lineItems as item, idx}
									<tr class="hover:bg-neutral-50">
										<!-- No -->
										<td class="p-2 text-center font-mono font-bold text-neutral-500">
											{idx + 1}
										</td>

										<!-- Kode Barang -->
										<td class="p-2">
											<div class="flex items-center gap-1">
												<input
													type="text"
													bind:value={item.itemId}
													placeholder="Kode Barang"
													required
													class="w-full px-2 py-1.5 rounded border border-black font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-black outline-none"
												/>
												<button
													type="button"
													onclick={() => openGoodsPicker(idx)}
													class="p-1.5 rounded border border-black bg-amber-300 hover:bg-amber-400 text-black shadow-[1px_1px_0px_0px_#000] cursor-pointer shrink-0"
													title="Cari dari Master Barang"
												>
													<Search class="size-3.5" />
												</button>
											</div>
										</td>

										<!-- Nama Barang -->
										<td class="p-2">
											<input
												type="text"
												bind:value={item.itemName}
												placeholder="Nama Barang & Spesifikasi Teknis"
												class="w-full px-2 py-1.5 rounded border border-black font-semibold text-xs bg-white focus:ring-1 focus:ring-black outline-none"
											/>
										</td>

										<!-- Kuantitas (Qty) -->
										<td class="p-2 text-right">
											<input
												type="number"
												step="any"
												min="0.001"
												bind:value={item.kgs}
												required
												class="w-full px-2 py-1.5 rounded border border-black font-mono font-bold text-xs text-right bg-white focus:ring-1 focus:ring-black outline-none"
											/>
										</td>

										<!-- Satuan -->
										<td class="p-2 text-center">
											<input
												type="text"
												bind:value={item.satuan}
												placeholder="PCS"
												class="w-full px-1.5 py-1.5 rounded border border-black font-mono font-bold text-xs text-center bg-white focus:ring-1 focus:ring-black outline-none"
											/>
										</td>

										<!-- Kemasan (Bags) -->
										<td class="p-2 text-center">
											<input
												type="number"
												min="1"
												bind:value={item.bags}
												placeholder="1"
												class="w-full px-1.5 py-1.5 rounded border border-black font-mono font-bold text-xs text-center bg-white focus:ring-1 focus:ring-black outline-none"
											/>
										</td>

										<!-- Harga Satuan -->
										<td class="p-2 text-right">
											<input
												type="number"
												step="any"
												min="0"
												bind:value={item.price}
												required
												class="w-full px-2 py-1.5 rounded border border-black font-mono font-bold text-xs text-right bg-white focus:ring-1 focus:ring-black outline-none"
											/>
										</td>

										<!-- Subtotal -->
										<td class="p-2 text-right font-mono font-black text-black">
											{formatRupiah((Number(item.kgs) || 0) * (Number(item.price) || 0))}
										</td>

										<!-- Keterangan Baris -->
										<td class="p-2">
											<input
												type="text"
												bind:value={item.ogReason}
												placeholder="Catatan item..."
												class="w-full px-2 py-1.5 rounded border border-black font-medium text-xs bg-white focus:ring-1 focus:ring-black outline-none"
											/>
										</td>

										<!-- Aksi Hapus -->
										<td class="p-2 text-center">
											<button
												type="button"
												onclick={() => removeRow(idx)}
												class="p-1 rounded border border-black bg-rose-100 hover:bg-rose-200 text-rose-800 shadow-[1px_1px_0px_0px_#000] cursor-pointer"
												title="Hapus baris ini"
											>
												<Trash2 class="size-3.5" />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<!-- Section C: Summary Kalkulasi & Terbilang -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t-2 border-border/80">
					<!-- Terbilang & Kop Preview Note -->
					<div class="border-2 border-black rounded-xl p-4 bg-amber-50/70 shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between">
						<div>
							<span class="text-[11px] font-mono font-black uppercase text-amber-900 block mb-1">
								TERBILANG NILAI TRANSAKSI:
							</span>
							<p class="font-display font-black text-sm text-foreground capitalize leading-snug">
								# {liveTerbilang} #
							</p>
						</div>

						<div class="mt-4 pt-3 border-t border-amber-300 text-[11px] text-neutral-600 flex items-center gap-2">
							<CheckCircle2 class="size-4 text-emerald-600 shrink-0" />
							<span>Dokumen PO resmi dicetak dengan Kop Surat & Logo PT. CITI PLUMB.</span>
						</div>
					</div>

					<!-- Rincian Angka Subtotal, PPN, Grand Total -->
					<div class="border-2 border-black rounded-xl p-4 bg-muted/20 shadow-[2px_2px_0px_0px_#000] space-y-2 font-mono">
						<div class="flex items-center justify-between text-xs">
							<span class="font-bold text-muted-foreground">Subtotal DPP:</span>
							<span class="font-black text-foreground text-sm">{formatRupiah(dppTotal)}</span>
						</div>
						<div class="flex items-center justify-between text-xs">
							<span class="font-bold text-muted-foreground">PPN ({taxPercentInput}%):</span>
							<span class="font-black text-foreground text-sm">{formatRupiah(taxAmountTotal)}</span>
						</div>
						<div class="border-t-2 border-black pt-2 flex items-center justify-between text-base">
							<span class="font-display font-black uppercase text-foreground">Grand Total PO:</span>
							<span class="font-black text-lg text-primary">{formatRupiah(grandTotal)}</span>
						</div>
					</div>
				</div>

				<!-- Section D: Submit Buttons -->
				<div class="flex flex-wrap items-center justify-end gap-3 pt-4 border-t-2 border-border/80">
					<button
						type="button"
						onclick={resetForm}
						class="px-5 py-3 rounded-xl border-2 border-black bg-white text-black font-display font-bold text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
					>
						Batal
					</button>

					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex items-center gap-2 px-8 py-3 rounded-xl border-2 border-black bg-primary text-white font-display font-black text-sm uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 cursor-pointer"
					>
						{#if isSubmitting}
							<div class="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
							<span>Menyimpan...</span>
						{:else}
							<Check class="size-4.5" />
							<span>{isEditing ? 'Simpan Perubahan PO' : 'Terbitkan Purchase Order (PO)'}</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- TAB 2: DAFTAR & RIWAYAT PURCHASE ORDER (CRUDS - READ & SEARCH) -->
	{#if activeTab === 'list'}
		<div class="bg-card border-[3px] border-border rounded-2xl p-5 sm:p-6 brutal-shadow space-y-5">
			<!-- Filter & Search Toolbar -->
			<div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-4 border-b-2 border-border/80">
				<!-- Search Keyword -->
				<div class="relative flex-1 min-w-[240px]">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<input
						type="text"
						bind:value={searchQuery}
						onkeydown={(e) => e.key === 'Enter' && applyFilters()}
						placeholder="Cari nomor PO, nama supplier, kode barang..."
						class="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-black font-semibold text-xs sm:text-sm bg-white shadow-[2px_2px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none"
					/>
				</div>

				<!-- Date Range & Status Filters -->
				<div class="flex flex-wrap items-center gap-2">
					<input
						type="date"
						bind:value={filterTgl1}
						title="Dari Tanggal"
						class="px-2.5 py-1.5 rounded-lg border-2 border-black font-mono font-bold text-xs bg-white shadow-[2px_2px_0px_0px_#000] outline-none"
					/>
					<span class="text-xs font-mono font-bold">s/d</span>
					<input
						type="date"
						bind:value={filterTgl2}
						title="Sampai Tanggal"
						class="px-2.5 py-1.5 rounded-lg border-2 border-black font-mono font-bold text-xs bg-white shadow-[2px_2px_0px_0px_#000] outline-none"
					/>

					<select
						bind:value={filterStatus}
						class="px-3 py-2 rounded-lg border-2 border-black font-bold text-xs bg-white shadow-[2px_2px_0px_0px_#000] outline-none cursor-pointer"
					>
						<option value="all">Semua Status</option>
						<option value="open">Aktif / Open</option>
						<option value="completed">Selesai (Completed)</option>
						<option value="canceled">Dibatalkan (Canceled)</option>
					</select>

					<button
						type="button"
						onclick={applyFilters}
						class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-black bg-primary text-white text-xs font-display font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-primary/90 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
					>
						<Search class="size-3.5" />
						<span>Cari</span>
					</button>

					<button
						type="button"
						onclick={resetFilters}
						class="px-3 py-2 rounded-lg border-2 border-black bg-card text-foreground text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
						title="Reset Filter"
					>
						<RotateCcw class="size-3.5" />
					</button>
				</div>
			</div>

			<!-- Table Data PO -->
			<div class="overflow-x-auto border-[3px] border-black rounded-xl shadow-[4px_4px_0px_0px_#000] bg-white">
				<table class="w-full border-collapse text-xs">
					<thead>
						<tr class="bg-black text-white font-mono uppercase text-[11px] tracking-wider text-left">
							<th class="p-3 text-center w-12">No</th>
							<th class="p-3 w-28">No. PO</th>
							<th class="p-3 w-24">Tanggal</th>
							<th class="p-3 min-w-[200px]">Pemasok (Supplier)</th>
							<th class="p-3 w-20 text-center">Dokumen</th>
							<th class="p-3 w-28 text-right">Total Qty</th>
							<th class="p-3 w-32 text-right">Nilai Total (PO)</th>
							<th class="p-3 w-24 text-center">Status</th>
							<th class="p-3 text-center w-36">Aksi & Dokumen</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-neutral-200">
						{#if data.poList.items.length === 0}
							<tr>
								<td colspan="9" class="p-8 text-center text-neutral-500 font-medium">
									Tidak ada data Purchase Order yang sesuai dengan kriteria pencarian.
								</td>
							</tr>
						{:else}
							{#each data.poList.items as po, idx}
								<tr class="hover:bg-neutral-50/80 transition-colors {po.canceled ? 'bg-rose-50/40 opacity-75' : ''}">
									<!-- No -->
									<td class="p-3 text-center font-mono font-bold text-neutral-500">
										{(data.poList.currentPage - 1) * data.poList.pageSize + idx + 1}
									</td>

									<!-- No PO -->
									<td class="p-3 font-mono font-black text-black">
										<button
											type="button"
											onclick={() => openPreview(po.orderId)}
											class="text-primary hover:underline flex items-center gap-1 cursor-pointer"
										>
											<span>#{po.orderId}</span>
										</button>
										<span class="text-[10px] font-mono text-neutral-500 block">
											{po.itemCount} Barang
										</span>
									</td>

									<!-- Tanggal -->
									<td class="p-3 font-mono text-neutral-800">
										{po.orderDate}
									</td>

									<!-- Supplier -->
									<td class="p-3">
										<div class="font-bold text-black">{po.supplierName}</div>
										<div class="text-[11px] text-neutral-500 truncate max-w-xs">
											{po.supplierCity || 'Lokal'} &bull; {po.companyId}
										</div>
									</td>

									<!-- Dokumen -->
									<td class="p-3 text-center">
										<span class="px-2 py-0.5 rounded border border-black bg-neutral-100 font-mono font-bold text-[10px] shadow-[1px_1px_0px_0px_#000]">
											{po.tipeDok}
										</span>
									</td>

									<!-- Total Qty & Sisa -->
									<td class="p-3 text-right font-mono">
										<div class="font-bold text-black">{po.totalKgs.toLocaleString('id-ID')}</div>
										{#if po.totalReceivedKgs > 0}
											<div class="text-[10px] text-emerald-700 font-bold">
												Terima: {po.totalReceivedKgs.toLocaleString('id-ID')}
											</div>
										{:else}
											<div class="text-[10px] text-neutral-500">Belum diterima</div>
										{/if}
									</td>

									<!-- Nilai Total -->
									<td class="p-3 text-right font-mono font-black text-black">
										<div>{formatRupiah(po.total)}</div>
										{#if po.tax > 0}
											<div class="text-[10px] text-neutral-500 font-normal">
												DPP: {formatRupiah(po.dpp)}
											</div>
										{/if}
									</td>

									<!-- Status -->
									<td class="p-3 text-center">
										{#if po.canceled}
											<span class="px-2 py-0.5 rounded border border-red-600 bg-red-100 text-red-900 font-mono font-black text-[10px] shadow-[1px_1px_0px_0px_#000]">
												BATAL
											</span>
										{:else if po.completed}
											<span class="px-2 py-0.5 rounded border border-sky-600 bg-sky-100 text-sky-900 font-mono font-black text-[10px] shadow-[1px_1px_0px_0px_#000]">
												SELESAI
											</span>
										{:else}
											<span class="px-2 py-0.5 rounded border border-emerald-600 bg-emerald-100 text-emerald-900 font-mono font-black text-[10px] shadow-[1px_1px_0px_0px_#000]">
												AKTIF
											</span>
										{/if}
									</td>

									<!-- Aksi & Dokumen (Cetak, Export, Edit, Batal) -->
									<td class="p-3 text-center">
										<div class="flex items-center justify-center gap-1.5">
											<!-- Preview & Cetak Modal -->
											<button
												type="button"
												onclick={() => openPreview(po.orderId)}
												class="p-1.5 rounded border border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_0px_#000] cursor-pointer"
												title="Lihat Detail & Kop PT. CITI PLUMB"
											>
												<Eye class="size-3.5 text-neutral-800" />
											</button>

											<!-- Cetak Langsung / Print PDF -->
											<button
												type="button"
												onclick={() => printDirectly(po.orderId)}
												class="p-1.5 rounded border border-black bg-primary text-white hover:bg-primary/90 shadow-[1px_1px_0px_0px_#000] cursor-pointer"
												title="Cetak / Simpan PDF (Kop PT. CITI PLUMB)"
											>
												<Printer class="size-3.5" />
											</button>

											<!-- Unduh Excel -->
											<a
												href="/api/purchase-order/{po.orderId}/export/excel"
												class="p-1.5 rounded border border-black bg-emerald-400 text-black hover:bg-emerald-300 shadow-[1px_1px_0px_0px_#000]"
												title="Unduh Dokumen PO dalam format Excel (.xlsx)"
											>
												<FileSpreadsheet class="size-3.5" />
											</a>

											<!-- Edit PO (Hanya jika belum batal dan tidak terkunci) -->
											{#if !po.canceled && !po.isLocked}
												<button
													type="button"
													onclick={() => startEditPO(po)}
													class="p-1.5 rounded border border-black bg-amber-300 hover:bg-amber-400 text-black shadow-[1px_1px_0px_0px_#000] cursor-pointer"
													title="Edit Purchase Order ini"
												>
													<Edit3 class="size-3.5" />
												</button>
											{/if}

											<!-- Batalkan PO -->
											{#if !po.canceled && po.totalReceivedKgs === 0}
												<button
													type="button"
													onclick={() => {
														cancelTargetId = po.orderId;
														cancelReasonInput = '';
														cancelModalOpen = true;
													}}
													class="p-1.5 rounded border border-black bg-rose-100 hover:bg-rose-200 text-rose-800 shadow-[1px_1px_0px_0px_#000] cursor-pointer"
													title="Batalkan PO ini"
												>
													<XCircle class="size-3.5" />
												</button>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>

			<!-- Pagination Toolbar -->
			{#if data.poList.totalPages > 1}
				<div class="flex items-center justify-between pt-4 border-t-2 border-border/80 text-xs">
					<span class="font-mono font-bold text-muted-foreground">
						Halaman {data.poList.currentPage} dari {data.poList.totalPages} (Total {data.poList.totalRows} data)
					</span>

					<div class="flex items-center gap-1.5">
						{#each Array(data.poList.totalPages) as _, i}
							{#if i + 1 === 1 || i + 1 === data.poList.totalPages || Math.abs(i + 1 - data.poList.currentPage) <= 1}
								<a
									href={getPageUrl(i + 1)}
									class="px-3 py-1.5 rounded border border-black font-mono font-bold {data.poList.currentPage === i + 1 ? 'bg-black text-white' : 'bg-white text-black hover:bg-muted'} shadow-[1px_1px_0px_0px_#000]"
								>
									{i + 1}
								</a>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- ======================================================== -->
<!-- MODAL PREVIEW & CETAK DOKUMEN (KOP PT. CITI PLUMB)      -->
<!-- ======================================================== -->
{#if previewModalOpen}
	<div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
		<div class="bg-white border-[3px] border-black rounded-2xl max-w-4xl w-full brutal-shadow-lg max-h-[92vh] flex flex-col overflow-hidden text-neutral-900">
			<!-- Modal Header Toolbar -->
			<div class="flex items-center justify-between p-4 border-b-2 border-black bg-neutral-100">
				<div class="flex items-center gap-2">
					<Printer class="size-5 text-black" />
					<h3 class="font-display font-black text-base uppercase text-black">
						Pratinjau Dokumen Resmi Purchase Order
					</h3>
				</div>

				<div class="flex items-center gap-2">
					{#if previewPoData?.header}
						<!-- Cetak PDF Langsung -->
						<button
							type="button"
							onclick={() => printDirectly(previewPoData.header.orderId)}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-primary text-white text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-primary/90 cursor-pointer"
						>
							<Printer class="size-4" />
							<span>Cetak PDF</span>
						</button>

						<!-- Export Excel -->
						<a
							href="/api/purchase-order/{previewPoData.header.orderId}/export/excel"
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-emerald-400 text-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-emerald-300"
						>
							<FileSpreadsheet class="size-4" />
							<span>Excel</span>
						</a>
					{/if}

					<button
						type="button"
						onclick={() => (previewModalOpen = false)}
						class="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-200 cursor-pointer"
					>
						<X class="size-4 text-black" />
					</button>
				</div>
			</div>

			<!-- Modal Body (The Formatted Document) -->
			<div class="p-6 sm:p-8 overflow-y-auto space-y-4">
				{#if previewLoading}
					<div class="p-12 text-center">
						<div class="size-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
						<p class="font-mono font-bold text-xs uppercase">Memuat Dokumen PO PT. CITI PLUMB...</p>
					</div>
				{:else if previewPoData}
					<!-- 1. Kop Surat Resmi PT. CITI PLUMB -->
					<KopSuratCitiPlumb
						documentTitle="PURCHASE ORDER (SURAT PESANAN PEMBELIAN)"
						documentNumber={previewPoData.header.orderId}
						documentDate={previewPoData.header.orderDate}
					/>

					<!-- 2. Grid Info Vendor & Pengiriman -->
					<div class="grid grid-cols-2 gap-4 text-xs my-3">
						<div class="border-2 border-black p-3 rounded bg-neutral-50/70">
							<span class="text-[10px] font-mono font-black uppercase text-neutral-500 block mb-1">
								KEPADA / PEMASOK:
							</span>
							<h4 class="font-black text-sm text-black uppercase">{previewPoData.header.supplierName}</h4>
							<p class="text-neutral-700 leading-tight mt-0.5">{previewPoData.header.supplierAddress || '-'}</p>
							<p class="text-neutral-700 mt-0.5">Kota: {previewPoData.header.supplierCity || '-'}</p>
							<div class="mt-2 pt-2 border-t border-dashed border-neutral-300 text-[11px]">
								<div>Telp: {previewPoData.header.supplierPhone || '-'}</div>
								<div>NPWP: {previewPoData.header.supplierTaxId || '-'}</div>
							</div>
						</div>

						<div class="border-2 border-black p-3 rounded bg-neutral-50/70 text-[11px] space-y-1">
							<div class="flex justify-between border-b pb-1">
								<span class="font-bold text-neutral-600">Nomor PO:</span>
								<span class="font-mono font-black">#{previewPoData.header.orderId}</span>
							</div>
							<div class="flex justify-between border-b pb-1">
								<span class="font-bold text-neutral-600">Tanggal PO:</span>
								<span class="font-mono">{previewPoData.header.orderDate}</span>
							</div>
							<div class="flex justify-between border-b pb-1">
								<span class="font-bold text-neutral-600">Jatuh Tempo:</span>
								<span class="font-mono">{previewPoData.header.dueDate || '-'}</span>
							</div>
							<div class="flex justify-between border-b pb-1">
								<span class="font-bold text-neutral-600">Tipe Dokumen:</span>
								<span class="font-mono font-bold">{previewPoData.header.tipeDok}</span>
							</div>
							<div class="pt-1 text-[10.5px]">
								<span class="font-bold text-neutral-600 block">Tujuan Pengiriman:</span>
								<span class="font-semibold text-neutral-800 leading-tight block">
									{previewPoData.companyInfo?.deliveryAddress}
								</span>
							</div>
						</div>
					</div>

					<!-- 3. Tabel Items -->
					<div class="overflow-x-auto border-2 border-black rounded">
						<table class="w-full border-collapse text-xs">
							<thead>
								<tr class="bg-neutral-100 border-b-2 border-black font-mono uppercase text-[10.5px]">
									<th class="p-2 border-r border-black text-center w-8">No</th>
									<th class="p-2 border-r border-black text-left w-28">Kode Barang</th>
									<th class="p-2 border-r border-black text-left">Nama Barang & Spesifikasi</th>
									<th class="p-2 border-r border-black text-right w-20">Qty</th>
									<th class="p-2 border-r border-black text-center w-16">Satuan</th>
									<th class="p-2 border-r border-black text-right w-24">Harga</th>
									<th class="p-2 text-right w-28">Total</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-neutral-200">
								{#each previewPoData.items as item, index}
									<tr>
										<td class="p-2 border-r border-black text-center font-mono font-bold text-neutral-500">{index + 1}</td>
										<td class="p-2 border-r border-black font-mono font-black">{item.itemId}</td>
										<td class="p-2 border-r border-black font-semibold text-neutral-900">{item.itemName}</td>
										<td class="p-2 border-r border-black text-right font-mono font-bold">{item.kgs.toLocaleString('id-ID')}</td>
										<td class="p-2 border-r border-black text-center font-mono">{item.satuan}</td>
										<td class="p-2 border-r border-black text-right font-mono">{formatRupiah(item.price)}</td>
										<td class="p-2 text-right font-mono font-black">{formatRupiah(item.total)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- 4. Rincian Total & Terbilang -->
					<div class="grid grid-cols-2 gap-4 text-xs">
						<div class="border-2 border-black p-3 rounded bg-neutral-50">
							<span class="text-[10px] font-mono font-black uppercase text-neutral-500 block mb-1">TERBILANG:</span>
							<p class="font-display font-black text-xs capitalize leading-tight">
								# {previewPoData.header.terbilang} #
							</p>
						</div>

						<div class="border-2 border-black p-3 rounded bg-neutral-50 space-y-1 font-mono text-xs">
							<div class="flex justify-between">
								<span class="font-bold text-neutral-600">Subtotal (DPP):</span>
								<span class="font-bold">{formatRupiah(previewPoData.header.dpp)}</span>
							</div>
							<div class="flex justify-between">
								<span class="font-bold text-neutral-600">PPN ({previewPoData.header.tax}%):</span>
								<span class="font-bold">{formatRupiah(previewPoData.header.taxAmount)}</span>
							</div>
							<div class="border-t-2 border-black pt-1 flex justify-between font-black text-sm">
								<span>Grand Total:</span>
								<span class="text-primary">{formatRupiah(previewPoData.header.total)}</span>
							</div>
						</div>
					</div>

					<!-- 5. Tanda Tangan 3 Kolom -->
					<div class="grid grid-cols-3 gap-3 text-center text-xs pt-4 border-t-2 border-black">
						<div>
							<span class="font-bold text-[10px] text-neutral-500 uppercase">Dibuat Oleh:</span>
							<div class="font-black text-xs mt-0.5">PURCHASING</div>
							<div class="mt-8 font-mono font-bold">( __________________ )</div>
						</div>
						<div>
							<span class="font-bold text-[10px] text-neutral-500 uppercase">Disetujui Oleh:</span>
							<div class="font-black text-xs mt-0.5">DIREKTUR / MANAJER</div>
							<div class="mt-8 font-mono font-bold">( __________________ )</div>
						</div>
						<div>
							<span class="font-bold text-[10px] text-neutral-500 uppercase">Pemasok / Supplier:</span>
							<div class="font-black text-xs mt-0.5">{previewPoData.header.supplierName.slice(0, 20)}</div>
							<div class="mt-8 font-mono font-bold">( __________________ )</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- ======================================================== -->
<!-- MODAL PICKER MASTER BARANG                               -->
<!-- ======================================================== -->
{#if goodsPickerOpen}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-card border-[3px] border-border rounded-2xl max-w-xl w-full brutal-shadow-lg overflow-hidden flex flex-col max-h-[85vh]">
			<div class="flex items-center justify-between p-4 border-b-2 border-border bg-neutral-100">
				<h3 class="font-display font-black text-sm uppercase text-foreground">
					Pilih Barang dari Master Barang
				</h3>
				<button
					type="button"
					onclick={() => (goodsPickerOpen = false)}
					class="p-1 rounded border border-black bg-white hover:bg-neutral-200 cursor-pointer"
				>
					<X class="size-4" />
				</button>
			</div>

			<div class="p-3 border-b-2 border-border">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<input
						type="text"
						bind:value={goodsSearchQuery}
						placeholder="Ketik kode atau nama barang..."
						class="w-full pl-9 pr-3 py-2 rounded-lg border-2 border-black font-bold text-xs bg-white focus:ring-2 focus:ring-black outline-none"
					/>
				</div>
			</div>

			<div class="overflow-y-auto p-2 divide-y divide-neutral-200">
				{#each filteredCommonGoods as g}
					<button
						type="button"
						onclick={() => selectGoodsForActiveRow(g)}
						class="w-full p-2.5 flex items-center justify-between text-left hover:bg-muted/50 rounded transition-colors cursor-pointer"
					>
						<div>
							<span class="font-mono font-black text-xs text-primary">{g.itemId}</span>
							<p class="font-semibold text-xs text-foreground mt-0.5">{g.itemName}</p>
						</div>
						<span class="px-2 py-0.5 rounded border border-black bg-white text-[10px] font-mono font-bold">
							{g.satuan}
						</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<!-- ======================================================== -->
<!-- MODAL KONFIRMASI BATAL PO                               -->
<!-- ======================================================== -->
{#if cancelModalOpen}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-card border-[3px] border-border rounded-2xl max-w-md w-full brutal-shadow-lg p-6 space-y-4">
			<div class="flex items-center gap-3">
				<div class="size-10 rounded-full bg-rose-100 border-2 border-black flex items-center justify-center text-rose-700 shrink-0">
					<XCircle class="size-6" />
				</div>
				<div>
					<h3 class="font-display font-black text-base uppercase text-foreground">
						Batalkan Purchase Order #{cancelTargetId}?
					</h3>
					<p class="text-xs text-muted-foreground mt-0.5">
						Tindakan ini akan membatalkan PO secara resmi di sistem.
					</p>
				</div>
			</div>

			<form
				method="POST"
				action="?/cancel"
				use:enhance={() => {
					return async ({ result, update }) => {
						cancelModalOpen = false;
						if (result.type === 'success') {
							toast.success(`PO #${cancelTargetId} berhasil dibatalkan.`);
							await update();
						} else if (result.type === 'failure') {
							const resData = result.data as any;
							toast.error('Gagal Membatalkan PO', { description: resData?.message });
						}
					};
				}}
				class="space-y-3"
			>
				<input type="hidden" name="orderId" value={cancelTargetId} />
				<div>
					<label for="cancel-reason" class="block text-xs font-mono font-black uppercase text-foreground mb-1">
						Alasan Pembatalan:
					</label>
					<input
						id="cancel-reason"
						type="text"
						name="reason"
						bind:value={cancelReasonInput}
						placeholder="Misal: Salah input barang / Supplier kehabisan stok..."
						required
						class="w-full px-3 py-2 rounded-lg border-2 border-black font-bold text-xs bg-white focus:ring-2 focus:ring-black outline-none"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={() => (cancelModalOpen = false)}
						class="px-4 py-2 rounded-lg border-2 border-black bg-white text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-muted cursor-pointer"
					>
						Kembali
					</button>
					<button
						type="submit"
						class="px-5 py-2 rounded-lg border-2 border-black bg-rose-600 text-white text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-rose-700 cursor-pointer"
					>
						Ya, Batalkan PO
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	/* Hilangkan panah spinner bawaan browser pada input numerik */
	:global(input[type='number']::-webkit-outer-spin-button),
	:global(input[type='number']::-webkit-inner-spin-button) {
		-webkit-appearance: none;
		margin: 0;
	}
	:global(input[type='number']) {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>

