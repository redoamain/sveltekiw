<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		children?: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<div class="flex flex-col space-y-1.5 p-5 {className}" data-slot="card-header" {...rest}>
	{@render children?.()}
</div>
