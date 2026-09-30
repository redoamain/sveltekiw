<script lang="ts">
	import { UploadCloud, Download, Loader2 } from '@lucide/svelte';

	interface Props {
		accept?: string;
		title?: string;
		subtitle?: string;
		loading?: boolean;
		loadingMessage?: string;
		templateUrl?: string;
		templateLabel?: string;
		class?: string;
		onfile?: (file: File) => void;
	}

	let {
		accept = '.xlsx,.xls',
		title = 'Pilih file template Excel (.xlsx atau .xls)',
		subtitle = 'Tarik & lepas file ke kotak ini atau klik untuk memilih file',
		loading = false,
		loadingMessage = 'Memvalidasi data Excel...',
		templateUrl,
		templateLabel = 'Unduh Template Excel Resmi',
		class: className = '',
		onfile
	}: Props = $props();

	let fileInputRef = $state<HTMLInputElement | null>(null);
	let isDragOver = $state(false);

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file && onfile) {
			onfile(file);
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file && onfile) {
			onfile(file);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	export function reset() {
		if (fileInputRef) fileInputRef.value = '';
	}
</script>

<div
	role="region"
	aria-label="Upload file dropzone"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	class="border-2 border-dashed border-black p-5 text-center transition-colors {isDragOver ? 'bg-yellow-100 border-solid' : 'bg-slate-50'} {className}"
>
	{#if loading}
		<div class="flex flex-col items-center justify-center py-3 space-y-2">
			<Loader2 class="h-8 w-8 animate-spin text-black" />
			<p class="text-xs font-black text-black uppercase tracking-wide">
				{loadingMessage}
			</p>
		</div>
	{:else}
		<UploadCloud class="mx-auto h-8 w-8 text-slate-500" />
		<p class="mt-2 text-xs font-black uppercase tracking-wide text-black">
			{title}
		</p>
		<p class="mt-0.5 text-[11px] font-bold text-slate-500">
			{subtitle}
		</p>

		<input
			type="file"
			{accept}
			bind:this={fileInputRef}
			onchange={handleChange}
			class="mt-3 block w-full text-xs font-bold text-slate-600 file:mr-3 file:border-2 file:border-black file:bg-[#FFD43B] file:px-3 file:py-1.5 file:text-xs file:font-black file:uppercase file:shadow-[2px_2px_0px_0px_#000] hover:file:bg-yellow-400 file:cursor-pointer"
		/>

		{#if templateUrl}
			<div class="mt-3 pt-2 border-t border-black/10 flex items-center justify-center">
				<a
					href={templateUrl}
					download
					class="inline-flex items-center gap-1.5 text-xs font-black text-sky-800 underline hover:text-black"
				>
					<Download class="h-3.5 w-3.5" /> {templateLabel}
				</a>
			</div>
		{/if}
	{/if}
</div>
