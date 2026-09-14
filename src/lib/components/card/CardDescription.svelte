<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLParagraphElement> & {
		children?: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<p class="text-muted-foreground font-mono text-xs font-bold uppercase tracking-wide {className}" data-slot="card-description" {...rest}>
	{@render children?.()}
</p>
