<script lang="ts">
	import LoadingSpinner from './LoadingSpinner.svelte';

	interface Props {
		id?: string;
		show?: boolean;
		message?: string;
		submessage?: string;
	}

	let {
		id = 'app-loading-overlay',
		show = false,
		message = 'Memuat...',
		submessage
	}: Props = $props();

	let visible = $state(false);

	$effect(() => {
		visible = Boolean(show);
		if (show) {
			// Safety timeout maksimal 6 detik agar user tidak pernah stuck
			const timer = setTimeout(() => {
				visible = false;
			}, 6000);
			return () => clearTimeout(timer);
		}
	});
</script>

{#if visible}
	<div
		{id}
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs"
		role="alert"
		aria-live="assertive"
		aria-busy="true"
	>
		<div
			class="bg-card border-border flex flex-col items-center gap-4 rounded-2xl border-4 p-8 brutal-shadow-lg"
		>
			<LoadingSpinner size="lg" ariaLabel={message} />
			<div class="text-center">
				<p class="font-black uppercase tracking-tight text-base" style="font-family: var(--font-display)">
					{message}
				</p>
				{#if submessage}
					<p class="text-muted-foreground mt-1 font-mono text-xs font-bold uppercase tracking-wide">
						{submessage}
					</p>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => (visible = false)}
				class="mt-1 text-[11px] font-mono font-bold text-muted-foreground hover:text-foreground underline cursor-pointer"
			>
				Tutup jika tidak selesai
			</button>
		</div>
	</div>
{/if}
