<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		FolderOpen,
		FileSpreadsheet,
		RotateCcw,
		Save,
		Loader2,
		Sparkles,
		SquarePen
	} from '@lucide/svelte';

	interface Props {
		title: string;
		subtitle?: string;
		isEditMode?: boolean;
		transactionId?: string;
		isSubmitting?: boolean;
		saveButtonText?: string;
		openButtonText?: string;
		hideImport?: boolean;
		hideOpen?: boolean;
		hideReset?: boolean;
		hideSave?: boolean;
		onopen?: () => void;
		onimport?: () => void;
		onreset?: () => void;
		onsave?: () => void;
		extraActions?: Snippet;
		class?: string;
	}

	let {
		title,
		subtitle,
		isEditMode = false,
		transactionId,
		isSubmitting = false,
		saveButtonText = isEditMode ? 'Perbarui Transaksi' : 'Simpan Transaksi',
		openButtonText = 'Buka / Cari',
		hideImport = false,
		hideOpen = false,
		hideReset = false,
		hideSave = false,
		onopen,
		onimport,
		onreset,
		onsave,
		extraActions,
		class: className = ''
	}: Props = $props();
</script>

<header class="flex flex-col gap-4 border-4 border-black bg-white p-4 sm:p-5 shadow-[6px_6px_0px_0px_#000] md:flex-row md:items-center md:justify-between {className}">
	<div>
		<div class="flex flex-wrap items-center gap-2">
			<h1 class="text-xl sm:text-2xl font-black uppercase tracking-tight text-black" style="font-family: var(--font-display)">
				{title}
			</h1>

			{#if isEditMode}
				<span class="inline-flex items-center gap-1 border-2 border-black bg-amber-300 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000]">
					<SquarePen class="h-3 w-3" /> Mode Edit {#if transactionId}({transactionId}){/if}
				</span>
			{:else}
				<span class="inline-flex items-center gap-1 border-2 border-black bg-emerald-300 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000]">
					<Sparkles class="h-3 w-3" /> Transaksi Baru
				</span>
			{/if}
		</div>

		{#if subtitle}
			<p class="mt-1 text-xs font-bold text-slate-600 max-w-2xl">
				{subtitle}
			</p>
		{/if}
	</div>

	<!-- Action Buttons -->
	<div class="flex flex-wrap items-center gap-2">
		{#if !hideOpen && onopen}
			<button
				type="button"
				onclick={onopen}
				class="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5"
			>
				<FolderOpen class="h-4 w-4" />
				<span class="hidden sm:inline">{openButtonText}</span>
			</button>
		{/if}

		{#if !hideImport && onimport}
			<button
				type="button"
				onclick={onimport}
				class="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5"
			>
				<FileSpreadsheet class="h-4 w-4 text-emerald-700" />
				<span class="hidden sm:inline">Import Excel</span>
			</button>
		{/if}

		{#if !hideReset && onreset}
			<button
				type="button"
				onclick={onreset}
				class="inline-flex items-center gap-1.5 border-2 border-black bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-800 shadow-[2px_2px_0px_0px_#000] hover:bg-slate-200 active:translate-x-0.5 active:translate-y-0.5"
			>
				<RotateCcw class="h-4 w-4" />
				<span class="hidden sm:inline">Reset</span>
			</button>
		{/if}

		{#if extraActions}
			{@render extraActions()}
		{/if}

		{#if !hideSave}
			<button
				type={onsave ? 'button' : 'submit'}
				onclick={onsave}
				disabled={isSubmitting}
				class="inline-flex items-center gap-2 border-2 border-black bg-[#FFD43B] px-4 py-2 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_#000] hover:bg-yellow-400 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
			>
				{#if isSubmitting}
					<Loader2 class="h-4 w-4 animate-spin" />
					<span>Menyimpan...</span>
				{:else}
					<Save class="h-4 w-4" />
					<span>{saveButtonText}</span>
				{/if}
			</button>
		{/if}
	</div>
</header>
