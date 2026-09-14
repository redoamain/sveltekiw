<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		children?: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<div
	class="bg-card text-card-foreground rounded-xl border-[3px] border-border brutal-shadow {className}"
	data-slot="card"
	{...rest}
>
	{@render children?.()}
</div>
