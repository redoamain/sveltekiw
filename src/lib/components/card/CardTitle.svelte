<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLHeadingElement> & {
		children?: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<h3
	class="font-black uppercase tracking-tight text-foreground text-lg md:text-xl {className}"
	style="font-family: var(--font-display)"
	data-slot="card-title"
	{...rest}
>
	{@render children?.()}
</h3>
