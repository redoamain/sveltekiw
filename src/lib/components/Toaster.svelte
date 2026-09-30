<script lang="ts">
	import { toast, type ToastType } from '$lib/toast.svelte';
	import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, ExternalLink } from '@lucide/svelte';

	interface Props {
		position?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';
	}

	let { position = 'bottom-right' }: Props = $props();

	const positionClasses: Record<string, string> = {
		'bottom-right': 'bottom-4 right-4 sm:bottom-6 sm:right-6',
		'top-right': 'top-4 right-4 sm:top-6 sm:right-6',
		'bottom-left': 'bottom-4 left-4 sm:bottom-6 sm:left-6',
		'top-left': 'top-4 left-4 sm:top-6 sm:left-6'
	};

	const typeStyles: Record<ToastType, { bg: string; text: string; iconBg: string; icon: any }> = {
		success: {
			bg: 'bg-emerald-50',
			text: 'text-emerald-950',
			iconBg: 'bg-emerald-300',
			icon: CheckCircle2
		},
		error: {
			bg: 'bg-red-50',
			text: 'text-red-950',
			iconBg: 'bg-red-300',
			icon: AlertCircle
		},
		warning: {
			bg: 'bg-amber-50',
			text: 'text-amber-950',
			iconBg: 'bg-[#FFD43B]',
			icon: AlertTriangle
		},
		info: {
			bg: 'bg-sky-50',
			text: 'text-sky-950',
			iconBg: 'bg-sky-300',
			icon: Info
		}
	};
</script>

<div
	class="fixed z-100 flex flex-col gap-3 pointer-events-none max-w-sm sm:max-w-md w-full p-2 sm:p-0 {positionClasses[position] || positionClasses['bottom-right']}"
	aria-live="polite"
	aria-atomic="true"
>
	{#each toast.toasts.slice(-3) as item (item.id)}
		{@const style = typeStyles[item.type] || typeStyles.info}
		{@const IconComponent = style.icon}
		<div
			class="pointer-events-auto relative border-3 border-black {style.bg} p-3 sm:p-4 shadow-[4px_4px_0px_0px_#000] transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
		>
			<div class="flex items-start justify-between gap-3">
				<div class="flex items-start gap-2.5 min-w-0 flex-1">
					<div
						class="flex size-7 shrink-0 items-center justify-center border-2 border-black {style.iconBg} shadow-[1px_1px_0px_0px_#000] mt-0.5"
					>
						<IconComponent class="h-4 w-4 text-black" />
					</div>

					<div class="min-w-0 flex-1 text-xs">
						{#if item.title}
							<div class="font-black uppercase tracking-wider {style.text} text-[11px] sm:text-xs">
								{item.title}
							</div>
						{/if}
						<div class="font-bold {style.text} {item.title ? 'mt-0.5' : ''} leading-relaxed">
							{item.message}
						</div>
						{#if item.description && item.description !== item.message}
							<div class="text-[11px] font-medium {style.text}/80 mt-0.5">
								{item.description}
							</div>
						{/if}

						{#if item.action}
							<div class="mt-2">
								{#if item.action.href}
									<a
										href={item.action.href}
										class="inline-flex items-center gap-1 border border-black bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow-[1px_1px_0px_0px_#000] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5"
									>
										{item.action.label}
										<ExternalLink class="h-2.5 w-2.5" />
									</a>
								{:else if item.action.onclick}
									<button
										type="button"
										onclick={item.action.onclick}
										class="inline-flex items-center gap-1 border border-black bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow-[1px_1px_0px_0px_#000] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5"
									>
										{item.action.label}
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<button
					type="button"
					onclick={() => toast.dismiss(item.id)}
					aria-label="Tutup notifikasi"
					class="border border-black bg-white/80 p-1 text-black shadow-[1px_1px_0px_0px_#000] hover:bg-white active:translate-x-0.5 active:translate-y-0.5"
				>
					<X class="h-3 w-3" />
				</button>
			</div>
		</div>
	{/each}
</div>
