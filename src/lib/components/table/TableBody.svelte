<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLTableSectionElement> & {
		children?: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<tbody class="divide-y-2 divide-border [&_tr:last-child]:border-0 {className}" {...rest}>
	{@render children?.()}
</tbody>
