<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLThAttributes } from 'svelte/elements';

	type Props = HTMLThAttributes & {
		children?: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<th
	class="h-11 px-3 text-left align-middle font-mono text-xs font-black uppercase tracking-wider text-foreground whitespace-nowrap {className}"
	{...rest}
>
	{@render children?.()}
</th>
