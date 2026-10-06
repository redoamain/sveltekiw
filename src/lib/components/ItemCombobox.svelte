<script lang="ts">
	import { Search, Loader2, X, Plus, CornerDownLeft } from '@lucide/svelte';

	export interface ItemOption {
		ItemID: string;
		ItemName: string;
		Satuan?: string;
		Departemen?: string;
		KodeJenis?: string;
	}

	interface Props {
		value?: string;
		placeholder?: string;
		autofocus?: boolean;
		suggestedItems?: ItemOption[];
		class?: string;
		dropdownClass?: string;
		allowCustom?: boolean;
		onselect?: (item: ItemOption) => void;
		oncancel?: () => void;
	}

	let {
		value = '',
		placeholder = 'Ketik kode barang...',
		autofocus = true,
		suggestedItems = [],
		class: className = '',
		dropdownClass = '',
		allowCustom = true,
		onselect,
		oncancel
	}: Props = $props();

	let searchQuery = $state('');
	let isTyping = $state(false);
	let isOpen = $state(true);
	let isLoading = $state(false);
	let searchResults = $state<ItemOption[]>([]);
	let activeIndex = $state(0);
	let dropdownStyle = $state('');

	let containerRef = $state<HTMLDivElement | null>(null);
	let dropdownRef = $state<HTMLDivElement | null>(null);
	let inputRef = $state<HTMLInputElement | null>(null);
	let listContainerRef = $state<HTMLDivElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Opsi yang ditampilkan: hasil pencarian API jika ada query, atau suggestedItems dari BOM jika query kosong
	let displayOptions = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) {
			return suggestedItems.slice(0, 15);
		}
		return searchResults;
	});

	// Cek apakah query persis sama dengan salah satu kode barang
	let hasExactMatch = $derived.by(() => {
		const q = searchQuery.trim().toUpperCase();
		if (!q) return false;
		return displayOptions.some((item) => item.ItemID.toUpperCase() === q);
	});

	// Cari barang ke backend dengan debounce
	function handleSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		searchQuery = val;
		isTyping = true;
		isOpen = true;
		activeIndex = 0;

		if (debounceTimer) clearTimeout(debounceTimer);

		const trimmed = val.trim();
		if (!trimmed) {
			searchResults = [];
			isLoading = false;
			updatePosition();
			return;
		}

		isLoading = true;
		debounceTimer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/production/search-items?q=${encodeURIComponent(trimmed)}`);
				const json = await res.json();
				searchResults = json.items || [];
			} catch (err) {
				console.error('Gagal mencari barang:', err);
				searchResults = [];
			} finally {
				isLoading = false;
				updatePosition();
			}
		}, 180);
	}

	// Pilih item
	function selectItem(item: ItemOption) {
		isOpen = false;
		if (onselect) {
			onselect(item);
		}
	}

	// Gunakan kode kustom jika tidak ada di database
	function selectCustomCode() {
		const code = searchQuery.trim().toUpperCase();
		if (!code) return;
		isOpen = false;
		if (onselect) {
			onselect({
				ItemID: code,
				ItemName: code,
				Satuan: 'Pcs'
			});
		}
	}

	// Navigasi Keyboard
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!isOpen) {
				isOpen = true;
				updatePosition();
			} else if (displayOptions.length > 0) {
				activeIndex = (activeIndex + 1) % displayOptions.length;
				scrollActiveIntoView();
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (!isOpen) {
				isOpen = true;
				updatePosition();
			} else if (displayOptions.length > 0) {
				activeIndex = (activeIndex - 1 + displayOptions.length) % displayOptions.length;
				scrollActiveIntoView();
			}
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (displayOptions.length > 0 && activeIndex >= 0 && activeIndex < displayOptions.length) {
				selectItem(displayOptions[activeIndex]);
			} else if (allowCustom && searchQuery.trim()) {
				selectCustomCode();
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			isOpen = false;
			if (oncancel) oncancel();
		}
	}

	function scrollActiveIntoView() {
		if (!listContainerRef) return;
		const items = listContainerRef.querySelectorAll('[data-option-item]');
		const current = items[activeIndex] as HTMLElement;
		if (current) {
			current.scrollIntoView({ block: 'nearest' });
		}
	}

	// Posisi Fixed agar tidak terpotong oleh overflow-x-auto atau overflow-hidden tabel
	function updatePosition() {
		if (!containerRef) return;
		const rect = containerRef.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const upward = spaceBelow < 280 && rect.top > spaceBelow;
		const width = Math.max(300, Math.min(420, window.innerWidth - 32));

		let left = rect.left;
		if (left + width > window.innerWidth - 16) {
			left = Math.max(8, window.innerWidth - width - 16);
		}

		if (upward) {
			dropdownStyle = `position: fixed; left: ${left}px; bottom: ${window.innerHeight - rect.top + 4}px; width: ${width}px; z-index: 99999;`;
		} else {
			dropdownStyle = `position: fixed; left: ${left}px; top: ${rect.bottom + 4}px; width: ${width}px; z-index: 99999;`;
		}
	}

	// Klik di luar hanya menutup dropdown popover, TIDAK membatalkan input
	function handleClickOutside(e: MouseEvent) {
		const target = e.target as Node;
		if (containerRef && containerRef.contains(target)) return;
		if (dropdownRef && dropdownRef.contains(target)) return;
		isOpen = false;
	}

	$effect(() => {
		if (!isTyping) {
			searchQuery = value || '';
		}
	});

	$effect(() => {
		if (autofocus && inputRef) {
			inputRef.focus();
			inputRef.select();
		}
		updatePosition();

		// Pasang listener dengan sedikit delay agar event klik pembuka tidak langsung menutupnya
		const timer = setTimeout(() => {
			window.addEventListener('click', handleClickOutside);
		}, 100);

		window.addEventListener('resize', updatePosition);
		window.addEventListener('scroll', updatePosition, true);

		return () => {
			clearTimeout(timer);
			if (debounceTimer) clearTimeout(debounceTimer);
			window.removeEventListener('click', handleClickOutside);
			window.removeEventListener('resize', updatePosition);
			window.removeEventListener('scroll', updatePosition, true);
		};
	});
</script>

<div class="relative inline-block {className}" bind:this={containerRef}>
	<!-- Input Box -->
	<div
		class="flex items-center gap-1.5 bg-background rounded-md border-2 border-primary shadow-xs px-2 py-0.5 min-w-[240px] max-w-[340px]"
	>
		<Search class="size-3.5 text-primary shrink-0" />

		<input
			bind:this={inputRef}
			type="text"
			value={searchQuery}
			oninput={handleSearchInput}
			onkeydown={handleKeyDown}
			onclick={(e) => {
				e.stopPropagation();
				isOpen = true;
				updatePosition();
			}}
			onfocus={() => {
				isOpen = true;
				updatePosition();
			}}
			{placeholder}
			class="h-6 w-full border-none bg-transparent px-1 font-mono text-xs font-bold text-foreground focus:outline-none placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground/60"
		/>

		<!-- Loading Spinner -->
		{#if isLoading}
			<Loader2 class="size-3.5 text-primary animate-spin shrink-0" />
		{/if}

		<!-- Clear Query -->
		{#if searchQuery}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					searchQuery = '';
					searchResults = [];
					inputRef?.focus();
					updatePosition();
				}}
				class="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
				title="Hapus ketikan"
			>
				<X class="size-3" />
			</button>
		{/if}

		<!-- Cancel Button -->
		{#if oncancel}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					isOpen = false;
					oncancel();
				}}
				class="rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground px-1.5 py-0.5 text-[10px] font-bold cursor-pointer transition-colors shrink-0 ml-0.5"
				title="Batal (Esc)"
			>
				Batal
			</button>
		{/if}
	</div>

	<!-- Dropdown Panel Popover (Fixed Position) -->
	{#if isOpen}
		<div
			bind:this={dropdownRef}
			style={dropdownStyle}
			class="rounded-lg border-2 border-border bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden brutal-shadow-sm {dropdownClass}"
		>
			<!-- Header Ringkasan Status -->
			<div class="flex items-center justify-between border-b border-border/60 bg-muted/60 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
				{#if searchQuery.trim()}
					<span class="flex items-center gap-1 truncate font-mono uppercase">
						<Search class="size-3 text-primary shrink-0" />
						Pencarian: <strong class="text-foreground">"{searchQuery.trim()}"</strong>
					</span>
					<span class="font-mono text-[9px] shrink-0">
						{isLoading ? 'Mencari...' : `${displayOptions.length} ditemukan`}
					</span>
				{:else}
					<span class="font-mono text-[10px] font-black uppercase text-foreground">
						Saran Bahan Dari BOM Ini
					</span>
					<span class="font-mono text-[9px] text-muted-foreground">
						{displayOptions.length} item
					</span>
				{/if}
			</div>

			<!-- List Opsi -->
			<div
				bind:this={listContainerRef}
				class="max-h-56 overflow-y-auto divide-y divide-border/20 p-1"
			>
				<!-- Tombol Gunakan Kode Manual jika tidak ada match persis -->
				{#if allowCustom && searchQuery.trim() && !hasExactMatch}
					<button
						type="button"
						onclick={selectCustomCode}
						class="w-full text-left rounded-md px-2 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-between gap-2 text-xs font-bold transition-colors cursor-pointer mb-1 border border-dashed border-primary/40"
					>
						<span class="flex items-center gap-1.5 truncate">
							<Plus class="size-3.5 shrink-0" />
							Gunakan kode manual: <strong class="font-mono font-black">{searchQuery.trim().toUpperCase()}</strong>
						</span>
						<span class="text-[9px] uppercase font-mono px-1 rounded bg-primary text-primary-foreground shrink-0">
							Enter ↵
						</span>
					</button>
				{/if}

				{#if displayOptions.length === 0}
					<div class="py-6 text-center text-xs text-muted-foreground">
						{#if isLoading}
							<div class="flex items-center justify-center gap-2">
								<Loader2 class="size-4 animate-spin text-primary" />
								<span>Memuat daftar barang...</span>
							</div>
						{:else}
							<span>Tidak ada barang yang cocok dengan kata kunci.</span>
						{/if}
					</div>
				{:else}
					{#each displayOptions as item, i (item.ItemID)}
						{@const isSelected = i === activeIndex}
						<button
							type="button"
							data-option-item
							onclick={() => selectItem(item)}
							onmouseenter={() => (activeIndex = i)}
							class="w-full text-left rounded-md px-2 py-1.5 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer
								{isSelected ? 'bg-primary/15 text-primary font-bold' : 'hover:bg-muted text-foreground'}"
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-1.5">
									<span class="font-mono font-black text-xs {isSelected ? 'text-primary' : 'text-foreground'}">
										{item.ItemID}
									</span>
									{#if item.Departemen}
										<span class="rounded bg-muted px-1 py-0.2 font-mono text-[9px] text-muted-foreground uppercase">
											{item.Departemen}
										</span>
									{/if}
								</div>
								<div class="truncate text-[11px] text-muted-foreground">
									{item.ItemName || item.ItemID}
								</div>
							</div>

							<div class="shrink-0 flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
								<span>{item.Satuan || 'Pcs'}</span>
								{#if isSelected}
									<CornerDownLeft class="size-3 text-primary ml-1" />
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>

			<!-- Footer Petunjuk Singkat -->
			<div class="border-t border-border/40 bg-muted/40 px-2 py-0.5 text-[9px] text-muted-foreground flex items-center justify-between font-mono">
				<span>↑↓ Navigasi • Enter Pilih</span>
				<span>Esc Batal</span>
			</div>
		</div>
	{/if}
</div>
