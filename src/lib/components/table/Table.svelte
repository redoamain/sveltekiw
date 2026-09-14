<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLTableAttributes } from 'svelte/elements';

	type Props = HTMLTableAttributes & {
		children?: Snippet;
		wrapperClass?: string;
	};

	let { class: className = '', wrapperClass = '', children, ...rest }: Props = $props();
</script>

<div class="relative w-full overflow-x-auto rounded-xl border-[3px] border-border bg-card brutal-shadow {wrapperClass}">
	<table class="w-full caption-bottom text-sm {className}" data-slot="table" {...rest}>
		{@render children?.()}
	</table>
</div>
