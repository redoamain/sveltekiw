<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from '@lucide/svelte';

	interface Props {
		variant?: 'success' | 'error' | 'warning' | 'info' | 'default';
		title?: string;
		message?: string;
		dismissible?: boolean;
		ondismiss?: () => void;
		actions?: Snippet;
		children?: Snippet;
		class?: string;
	}

	let {
		variant = 'info',
		title,
		message,
		dismissible = false,
		ondismiss,
		actions,
		children,
		class: className = ''
	}: Props = $props();

	let dismissed = $state(false);

	function handleDismiss() {
		dismissed = true;
		if (ondismiss) ondismiss();
	}

	const variantStyles: Record<string, { bg: string; border: string; text: string; icon: any }> = {
		success: {
			bg: 'bg-emerald-100',
			border: 'border-black',
			text: 'text-emerald-950',
			icon: CheckCircle2
		},
		error: {
			bg: 'bg-red-100',
			border: 'border-black',
			text: 'text-red-950',
			icon: AlertCircle
		},
		warning: {
			bg: 'bg-amber-100',
			border: 'border-black',
			text: 'text-amber-950',
			icon: AlertTriangle
		},
		info: {
			bg: 'bg-sky-100',
			border: 'border-black',
			text: 'text-sky-950',
			icon: Info
		},
		default: {
			bg: 'bg-slate-100',
			border: 'border-black',
			text: 'text-slate-900',
			icon: Info
		}
	};

	const style = $derived(variantStyles[variant] || variantStyles.default);
	const IconComp = $derived(style.icon);
</script>

{#if !dismissed}
	<div
		role="alert"
		class="border-2 {style.border} {style.bg} p-3.5 shadow-[2px_2px_0px_0px_#000] {className}"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="flex items-start gap-2.5 min-w-0 flex-1">
				<IconComp class="h-5 w-5 shrink-0 mt-0.5 {style.text}" />
				<div class="min-w-0 flex-1 text-xs">
					{#if title}
						<div class="font-black uppercase tracking-wide {style.text}">
							{title}
						</div>
					{/if}
					{#if message}
						<div class="font-bold {style.text} {title ? 'mt-0.5' : ''}">
							{message}
						</div>
					{/if}
					{#if children}
						<div class="font-bold {style.text} {title || message ? 'mt-1' : ''}">
							{@render children()}
						</div>
					{/if}
				</div>
			</div>

			<div class="flex items-center gap-2 shrink-0">
				{#if actions}
					{@render actions()}
				{/if}
				{#if dismissible}
					<button
						type="button"
						onclick={handleDismiss}
						aria-label="Tutup pemberitahuan"
						class="border border-black bg-white/70 p-1 text-xs font-black shadow-[1px_1px_0px_0px_#000] hover:bg-white active:translate-x-0.5 active:translate-y-0.5"
					>
						<X class="h-3.5 w-3.5 text-black" />
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
