<script lang="ts">
	import { Search, Loader2, X } from '@lucide/svelte';

	interface Props {
		value?: string;
		placeholder?: string;
		debounceMs?: number;
		loading?: boolean;
		disabled?: boolean;
		autofocus?: boolean;
		class?: string;
		onsearch?: (query: string) => void;
		oninput?: (e: Event) => void;
	}

	let {
		value = $bindable(''),
		placeholder = 'Cari...',
		debounceMs = 0,
		loading = false,
		disabled = false,
		autofocus = false,
		class: className = '',
		onsearch,
		oninput
	}: Props = $props();

	let debounceTimer: any;

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const val = target.value;
		value = val;

		if (oninput) oninput(e);

		if (onsearch) {
			if (debounceMs > 0) {
				clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					onsearch(val);
				}, debounceMs);
			} else {
				onsearch(val);
			}
		}
	}

	function handleClear() {
		value = '';
		if (onsearch) onsearch('');
	}
</script>

<div class="relative flex items-center w-full {className}">
	<div class="pointer-events-none absolute left-3 flex items-center justify-center text-slate-500">
		{#if loading}
			<Loader2 class="h-4 w-4 animate-spin text-black" />
		{:else}
			<Search class="h-4 w-4 text-black" />
		{/if}
	</div>

	<input
		type="text"
		{placeholder}
		{disabled}
		{value}
		oninput={handleInput}
		class="h-10 w-full border-2 border-black bg-white text-black pl-9 pr-8 text-xs sm:text-sm font-bold shadow-[2px_2px_0px_0px_#000] placeholder:text-slate-400 placeholder:font-normal focus:bg-amber-50/50 focus:outline-none disabled:opacity-50"
	/>

	{#if value}
		<button
			type="button"
			onclick={handleClear}
			aria-label="Bersihkan pencarian"
			class="absolute right-2.5 flex items-center justify-center text-slate-400 hover:text-black"
		>
			<X class="h-3.5 w-3.5" />
		</button>
	{/if}
</div>
