<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = HTMLInputAttributes & {
		value?: string | number;
	};

	let {
		value = $bindable(''),
		class: className = '',
		type = 'text',
		...rest
	}: Props = $props();
</script>

<input
	{type}
	bind:value
	class="bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-primary flex h-11 w-full rounded-lg border-[3px] border-border px-3 py-2 text-sm font-bold brutal-shadow-sm outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50 {className}"
	data-slot="input"
	{...rest}
/>
