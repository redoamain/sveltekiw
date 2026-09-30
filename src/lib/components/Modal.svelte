<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '@lucide/svelte';

	interface Props {
		open?: boolean;
		title?: string;
		subtitle?: string;
		icon?: any;
		size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
		closeOnEscape?: boolean;
		closeOnClickOutside?: boolean;
		headerExtra?: Snippet;
		footer?: Snippet;
		children?: Snippet;
		onclose?: () => void;
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		subtitle,
		icon: IconComponent,
		size = '2xl',
		closeOnEscape = true,
		closeOnClickOutside = true,
		headerExtra,
		footer,
		children,
		onclose,
		class: className = ''
	}: Props = $props();

	function handleClose() {
		open = false;
		if (onclose) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (open && closeOnEscape && e.key === 'Escape') {
			handleClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (closeOnClickOutside && e.target === e.currentTarget) {
			handleClose();
		}
	}

	const sizeClasses: Record<string, string> = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
		'2xl': 'max-w-2xl',
		'3xl': 'max-w-3xl',
		'4xl': 'max-w-4xl',
		full: 'max-w-[95vw]'
	};
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		role="presentation"
		onclick={handleBackdropClick}
		onkeydown={(e) => {
			if (e.key === 'Escape') handleClose();
		}}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
	>
		<div
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			class="relative flex max-h-[92vh] w-full flex-col border-4 border-black bg-white shadow-[8px_8px_0px_0px_#000] {sizeClasses[size] || 'max-w-2xl'} {className}"
		>
			<!-- Header -->
			{#if title || headerExtra || IconComponent}
				<div class="flex items-center justify-between border-b-2 border-black bg-white p-4 sm:p-5">
					<div class="flex items-center gap-3">
						{#if IconComponent}
							<div class="border-2 border-black bg-[#FFD43B] p-1.5 shadow-[2px_2px_0px_0px_#000]">
								<IconComponent class="h-5 w-5 text-black" />
							</div>
						{/if}
						<div>
							{#if title}
								<h3 class="text-base font-black uppercase tracking-wider text-black">
									{title}
								</h3>
							{/if}
							{#if subtitle}
								<p class="text-xs font-bold text-slate-600">
									{subtitle}
								</p>
							{/if}
						</div>
					</div>

					<div class="flex items-center gap-2">
						{#if headerExtra}
							{@render headerExtra()}
						{/if}
						<button
							type="button"
							onclick={handleClose}
							aria-label="Tutup Modal"
							class="border-2 border-black bg-slate-100 p-1.5 text-xs font-black shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200 active:translate-x-0.5 active:translate-y-0.5"
						>
							<X class="h-4 w-4 text-black" />
						</button>
					</div>
				</div>
			{/if}

			<!-- Body -->
			<div class="overflow-y-auto p-4 sm:p-6 space-y-4">
				{@render children?.()}
			</div>

			<!-- Footer -->
			{#if footer}
				<div class="flex flex-wrap items-center justify-end gap-2 border-t-2 border-black bg-slate-50 p-4">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
