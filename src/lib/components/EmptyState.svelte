<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Inbox } from '@lucide/svelte';

	interface Props {
		title?: string;
		description?: string;
		icon?: any;
		actionText?: string;
		onaction?: () => void;
		actionSnippet?: Snippet;
		class?: string;
	}

	let {
		title = 'Tidak Ada Data',
		description = 'Tidak ditemukan data yang sesuai dengan pencarian atau filter Anda.',
		icon: IconComponent = Inbox,
		actionText,
		onaction,
		actionSnippet,
		class: className = ''
	}: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center border-2 border-dashed border-black/40 bg-slate-50/60 p-8 text-center {className}"
>
	<div class="flex h-12 w-12 items-center justify-center border-2 border-black bg-yellow-200 shadow-[2px_2px_0px_0px_#000]">
		<IconComponent class="h-6 w-6 text-black" />
	</div>

	<h4 class="mt-3 text-sm font-black uppercase tracking-wider text-black">
		{title}
	</h4>

	{#if description}
		<p class="mt-1 text-xs font-bold text-slate-500 max-w-sm">
			{description}
		</p>
	{/if}

	{#if actionSnippet}
		<div class="mt-4">
			{@render actionSnippet()}
		</div>
	{:else if actionText && onaction}
		<div class="mt-4">
			<button
				type="button"
				onclick={onaction}
				class="border-2 border-black bg-[#FFD43B] px-4 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-yellow-400 active:translate-x-0.5 active:translate-y-0.5"
			>
				{actionText}
			</button>
		</div>
	{/if}
</div>
