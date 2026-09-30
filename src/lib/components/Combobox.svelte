<script lang="ts">
	import { ChevronDown, Check, X, Plus, Search } from '@lucide/svelte';

	export interface ComboboxOption {
		value: string;
		label?: string;
		code?: string;
		name?: string;
		badge?: string;
		disabled?: boolean;
	}

	interface Props {
		id?: string;
		name?: string;
		value?: string;
		options: ComboboxOption[];
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		allowCustom?: boolean;
		class?: string;
		dropdownClass?: string;
		onchange?: (val: string) => void;
	}

	let {
		id = '',
		name = '',
		value = $bindable(''),
		options = [],
		placeholder = 'Ketik nomor atau nama akun...',
		disabled = false,
		required = false,
		allowCustom = true,
		class: className = '',
		dropdownClass = '',
		onchange
	}: Props = $props();

	let isOpen = $state(false);
	let isTyping = $state(false);
	let displayText = $state('');
	let containerRef = $state<HTMLDivElement | null>(null);
	let inputRef = $state<HTMLInputElement | null>(null);
	let listContainerRef = $state<HTMLDivElement | null>(null);
	let highlightedIndex = $state(0);

	// Sinkronisasi displayText ketika value berubah dari luar (misal preset diklik atau inisialisasi)
	$effect(() => {
		if (!isTyping) {
			const found = options.find((o) => o.value === value);
			if (found) {
				displayText = found.label || (found.code ? `${found.code} — ${found.name}` : found.value);
			} else if (value) {
				displayText = value;
			} else {
				displayText = '';
			}
		}
	});

	// Filter options berdasarkan ketikan pengguna di input langsung
	let filteredOptions = $derived.by(() => {
		const q = displayText.trim().toLowerCase();
		if (!q || !isTyping) {
			return options;
		}

		return options.filter((o) => {
			const vMatch = o.value.toLowerCase().includes(q);
			const cMatch = o.code ? o.code.toLowerCase().includes(q) : false;
			const nMatch = o.name ? o.name.toLowerCase().includes(q) : false;
			const lMatch = o.label ? o.label.toLowerCase().includes(q) : false;
			return vMatch || cMatch || nMatch || lMatch;
		});
	});

	// Cek apakah teks yang diketik persis sama dengan salah satu kode opsi
	let hasExactMatch = $derived.by(() => {
		const q = displayText.trim().toLowerCase();
		if (!q) return false;
		return options.some((o) => o.value.toLowerCase() === q || (o.code && o.code.toLowerCase() === q));
	});

	function handleFocus(e: FocusEvent) {
		isOpen = true;
		highlightedIndex = 0;
		// Otomatis blok teks agar pengguna bisa langsung mengetik untuk mengganti/mencari
		const target = e.target as HTMLInputElement;
		setTimeout(() => {
			target.select();
		}, 10);
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		displayText = target.value;
		isTyping = true;
		isOpen = true;
		highlightedIndex = 0;

		// Jika input dikosongkan sama sekali
		if (!displayText.trim()) {
			value = '';
			if (onchange) onchange('');
		}
	}

	function toggleDropdown() {
		if (disabled) return;
		isOpen = !isOpen;
		if (isOpen) {
			isTyping = false;
			highlightedIndex = 0;
			inputRef?.focus();
		}
	}

	function selectOption(opt: ComboboxOption) {
		if (opt.disabled) return;
		value = opt.value;
		displayText = opt.label || (opt.code ? `${opt.code} — ${opt.name}` : opt.value);
		isTyping = false;
		isOpen = false;
		if (onchange) onchange(opt.value);
	}

	function selectCustom(customVal: string) {
		const trimmed = customVal.trim();
		value = trimmed;
		displayText = trimmed;
		isTyping = false;
		isOpen = false;
		if (onchange) onchange(trimmed);
	}

	function clearInput(e: MouseEvent) {
		e.stopPropagation();
		value = '';
		displayText = '';
		isTyping = false;
		if (onchange) onchange('');
		inputRef?.focus();
	}

	function closeDropdown() {
		isOpen = false;
		if (isTyping) {
			isTyping = false;
			const trimmed = displayText.trim();

			// Cek apakah ada exact match
			const exactMatch = options.find(
				(o) =>
					o.value.toLowerCase() === trimmed.toLowerCase() ||
					(o.code && o.code.toLowerCase() === trimmed.toLowerCase()) ||
					(o.label && o.label.toLowerCase() === trimmed.toLowerCase())
			);

			if (exactMatch) {
				selectOption(exactMatch);
			} else if (allowCustom && trimmed) {
				value = trimmed;
				displayText = trimmed;
				if (onchange) onchange(trimmed);
			} else {
				// Kembalikan ke pilihan valid sebelumnya
				const prev = options.find((o) => o.value === value);
				if (prev) {
					displayText = prev.label || (prev.code ? `${prev.code} — ${prev.name}` : prev.value);
				} else if (value) {
					displayText = value;
				} else {
					displayText = '';
				}
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!isOpen) {
				isOpen = true;
				isTyping = false;
			} else if (filteredOptions.length > 0) {
				highlightedIndex = (highlightedIndex + 1) % filteredOptions.length;
				scrollHighlightedIntoView();
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (!isOpen) {
				isOpen = true;
				isTyping = false;
			} else if (filteredOptions.length > 0) {
				highlightedIndex = (highlightedIndex - 1 + filteredOptions.length) % filteredOptions.length;
				scrollHighlightedIntoView();
			}
		} else if (e.key === 'Enter') {
			if (isOpen) {
				e.preventDefault();
				if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
					selectOption(filteredOptions[highlightedIndex]);
				} else if (allowCustom && displayText.trim()) {
					selectCustom(displayText);
				} else {
					closeDropdown();
				}
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			closeDropdown();
		} else if (e.key === 'Tab') {
			closeDropdown();
		}
	}

	function scrollHighlightedIntoView() {
		if (!listContainerRef) return;
		const items = listContainerRef.querySelectorAll('[data-combobox-item]');
		const current = items[highlightedIndex] as HTMLElement;
		if (current) {
			current.scrollIntoView({ block: 'nearest' });
		}
	}

	function handleClickOutside(e: PointerEvent) {
		if (isOpen && containerRef && !containerRef.contains(e.target as Node)) {
			closeDropdown();
		}
	}

	$effect(() => {
		if (isOpen) {
			window.addEventListener('pointerdown', handleClickOutside);
			return () => {
				window.removeEventListener('pointerdown', handleClickOutside);
			};
		}
	});
</script>

<div class="relative w-full" bind:this={containerRef}>
	<!-- Hidden input untuk standar form submit HTML (mengirimkan nomor kode akun saja) -->
	{#if name}
		<input type="hidden" {name} value={value} {required} />
	{/if}

	<!-- Inline Input Langsung (Neo-Brutalist) -->
	<div class="relative flex items-center w-full">
		<input
			bind:this={inputRef}
			type="text"
			{id}
			{disabled}
			{placeholder}
			value={displayText}
			onfocus={handleFocus}
			oninput={handleInput}
			onkeydown={handleKeydown}
			autocomplete="off"
			spellcheck="false"
			class="bg-card border-border h-11 w-full rounded-lg border-[3px] pl-3 pr-16 font-mono text-xs sm:text-sm font-bold brutal-shadow-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed {className}"
		/>

		<!-- Tombol Action di dalam Input (Clear & Toggle Dropdown) -->
		<div class="absolute right-2 flex items-center gap-1 shrink-0 text-muted-foreground">
			{#if displayText && !disabled}
				<button
					type="button"
					onclick={clearInput}
					class="p-1 rounded hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
					title="Bersihkan input"
				>
					<X class="size-3.5" />
				</button>
			{/if}

			<button
				type="button"
				tabindex="-1"
				onclick={toggleDropdown}
				class="p-1 rounded hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
				title="Buka daftar akun"
			>
				<ChevronDown
					class="size-4 transition-transform duration-200 {isOpen ? 'rotate-180 text-primary' : ''}"
				/>
			</button>
		</div>
	</div>

	<!-- Dropdown Melayang Instan (Neo-Brutalist Floating Popover) -->
	{#if isOpen}
		<div
			class="absolute left-0 top-full mt-1.5 w-full min-w-[280px] sm:min-w-[400px] max-w-[540px] z-50 bg-card rounded-xl border-[3px] border-border brutal-shadow-lg overflow-hidden shadow-2xl flex flex-col {dropdownClass}"
		>
			<!-- Header Ringkasan Status -->
			<div
				class="px-3 py-1.5 border-b-2 border-border bg-muted/50 text-[11px] font-bold text-muted-foreground flex items-center justify-between"
			>
				{#if isTyping && displayText.trim()}
					<span class="flex items-center gap-1.5 truncate">
						<Search class="size-3 text-primary shrink-0" />
						Hasil pencarian: <span class="text-foreground font-black font-mono">"{displayText.trim()}"</span>
					</span>
				{:else}
					<span class="font-mono uppercase tracking-wider text-[10px] font-black text-foreground">
						Daftar Akun COA ({options.length} Akun)
					</span>
				{/if}
				<span class="text-[10px] font-mono shrink-0 ml-2">
					{filteredOptions.length} akun
				</span>
			</div>

			<!-- Daftar Opsi Akun -->
			<div
				bind:this={listContainerRef}
				class="max-h-64 overflow-y-auto divide-y divide-border/20 p-1"
			>
				<!-- Tombol Gunakan Nilai Kustom jika tidak ada match persis -->
				{#if allowCustom && isTyping && displayText.trim() && !hasExactMatch}
					<button
						type="button"
						onclick={() => selectCustom(displayText)}
						class="w-full px-3 py-2 text-left rounded-lg bg-primary/10 hover:bg-primary hover:text-primary-foreground flex items-center justify-between gap-2 text-xs font-bold text-primary transition-colors cursor-pointer mb-1 border-2 border-dashed border-primary/30"
					>
						<span class="flex items-center gap-1.5 truncate">
							<Plus class="size-3.5 shrink-0" />
							Gunakan nilai kustom: <span class="font-mono font-black underline">{displayText.trim()}</span>
						</span>
						<span class="text-[10px] uppercase font-black tracking-wider opacity-80 shrink-0">
							(Kustom)
						</span>
					</button>
				{/if}

				{#if filteredOptions.length === 0 && (!allowCustom || !displayText.trim())}
					<div class="py-8 text-center text-xs text-muted-foreground font-bold">
						Tidak ada akun yang cocok dengan kata kunci
					</div>
				{:else}
					{#each filteredOptions as opt, i}
						<button
							type="button"
							data-combobox-item
							disabled={opt.disabled}
							onclick={() => selectOption(opt)}
							class="w-full px-2.5 py-2 text-left rounded-lg flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer {opt.value === value ? 'bg-primary text-primary-foreground font-black' : highlightedIndex === i ? 'bg-muted text-foreground' : 'hover:bg-muted/70 text-foreground'}"
						>
							<div class="flex items-center gap-2 min-w-0 flex-1">
								<span
									class="font-mono font-black px-1.5 py-0.5 rounded text-[11px] shrink-0 {opt.value === value ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted/80 text-foreground border border-border/50'}"
								>
									{opt.code || opt.value}
								</span>
								<span class="truncate font-bold">
									{opt.name || opt.label}
								</span>
							</div>

							<div class="flex items-center gap-1 shrink-0">
								{#if opt.badge}
									<span
										class="text-[10px] px-1 py-0.5 rounded font-mono font-bold {opt.value === value ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}"
									>
										{opt.badge}
									</span>
								{/if}
								{#if opt.value === value}
									<Check class="size-3.5 shrink-0 text-primary-foreground" />
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>

			<!-- Footer Bantuan Tombol Keyboard -->
			<div
				class="px-3 py-1.5 border-t border-border/40 bg-muted/20 text-[10px] text-muted-foreground font-mono font-bold flex items-center justify-between"
			>
				<span>↑↓ navigasi • Enter pilih</span>
				<span>Esc tutup</span>
			</div>
		</div>
	{/if}
</div>
