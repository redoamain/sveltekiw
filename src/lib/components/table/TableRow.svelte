<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLTableRowElement> & {
		children?: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<tr class="border-b-2 border-border transition-colors hover:bg-muted/40 {className}" {...rest}>
	{@render children?.()}
</tr>
