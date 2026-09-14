<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		actions?: Snippet;
	}

	let { title, description, actions }: Props = $props();
</script>

<header class="flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-black uppercase tracking-tight md:text-3xl" style="font-family: var(--font-display)">
			{title}
		</h1>
		{#if description}
			<p class="text-muted-foreground mt-1 font-mono text-xs font-bold uppercase tracking-wide md:text-sm">
				{description}
			</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</header>
