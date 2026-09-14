<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';

	type Props = HTMLLabelAttributes & {
		children?: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<label
	class="font-mono text-xs font-black uppercase tracking-widest text-foreground {className}"
	{...rest}
>
	{@render children?.()}
</label>
