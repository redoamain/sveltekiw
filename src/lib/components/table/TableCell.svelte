<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLTdAttributes } from 'svelte/elements';

	type Props = HTMLTdAttributes & {
		children?: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<td class="p-3 align-middle text-sm font-bold whitespace-nowrap {className}" {...rest}>
	{@render children?.()}
</td>
