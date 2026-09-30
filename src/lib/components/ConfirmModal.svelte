<script lang="ts">
	import { AlertTriangle, Loader2 } from '@lucide/svelte';
	import Modal from './Modal.svelte';

	interface Props {
		open?: boolean;
		title?: string;
		message?: string;
		confirmText?: string;
		confirmLabel?: string;
		cancelText?: string;
		cancelLabel?: string;
		confirmVariant?: 'danger' | 'warning' | 'primary';
		loading?: boolean;
		onconfirm?: () => void;
		oncancel?: () => void;
	}

	let {
		open = $bindable(false),
		title = 'Konfirmasi Tindakan',
		message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
		confirmText,
		confirmLabel,
		cancelText,
		cancelLabel,
		confirmVariant = 'danger',
		loading = false,
		onconfirm,
		oncancel
	}: Props = $props();

	let resolvedConfirmText = $derived(confirmLabel || confirmText || 'Ya, Lanjutkan');
	let resolvedCancelText = $derived(cancelLabel || cancelText || 'Batal');

	function handleConfirm() {
		if (onconfirm) onconfirm();
	}

	function handleCancel() {
		open = false;
		if (oncancel) oncancel();
	}

	const btnStyles: Record<string, string> = {
		danger: 'bg-red-400 hover:bg-red-500 text-black',
		warning: 'bg-amber-400 hover:bg-amber-500 text-black',
		primary: 'bg-[#FFD43B] hover:bg-yellow-400 text-black'
	};
</script>

<Modal bind:open size="md" {title} icon={AlertTriangle}>
	<div class="py-2">
		<p class="text-xs sm:text-sm font-bold text-slate-700">
			{message}
		</p>
	</div>

	{#snippet footer()}
		<button
			type="button"
			onclick={handleCancel}
			disabled={loading}
			class="border-2 border-black bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200 disabled:opacity-50"
		>
			{resolvedCancelText}
		</button>
		<button
			type="button"
			onclick={handleConfirm}
			disabled={loading}
			class="inline-flex items-center gap-1.5 border-2 border-black {btnStyles[confirmVariant] || btnStyles.danger} px-4 py-2 text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] disabled:opacity-50"
		>
			{#if loading}
				<Loader2 class="h-3.5 w-3.5 animate-spin" />
				<span>Memproses...</span>
			{:else}
				<span>{resolvedConfirmText}</span>
			{/if}
		</button>
	{/snippet}
</Modal>
