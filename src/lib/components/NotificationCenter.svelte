<script lang="ts">
	import { onMount } from 'svelte';
	import { toast, type ToastType } from '$lib/toast.svelte';
	import {
		Bell,
		CheckCheck,
		Trash2,
		CheckCircle2,
		AlertCircle,
		AlertTriangle,
		Info,
		ExternalLink,
		Volume2,
		VolumeX
	} from '@lucide/svelte';

	let isOpen = $state(false);

	function toggleOpen() {
		isOpen = !isOpen;
		if (isOpen) {
			toast.markAllAsRead();
		}
	}

	function handleBackdrop(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('#notification-center-container')) {
			isOpen = false;
		}
	}

	const typeIcons: Record<ToastType, any> = {
		success: CheckCircle2,
		error: AlertCircle,
		warning: AlertTriangle,
		info: Info
	};

	const typeColors: Record<ToastType, string> = {
		success: 'text-emerald-700 bg-emerald-100',
		error: 'text-red-700 bg-red-100',
		warning: 'text-amber-800 bg-amber-100',
		info: 'text-sky-800 bg-sky-100'
	};

	function formatTime(d: Date) {
		const now = new Date();
		const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
		if (diffSec < 60) return 'Baru saja';
		const diffMin = Math.floor(diffSec / 60);
		if (diffMin < 60) return `${diffMin}m lalu`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `${diffHr}j lalu`;
		return d.toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}

	onMount(() => {
		toast.initBrowserState();
	});
</script>

<svelte:window onclick={handleBackdrop} />

<div id="notification-center-container" class="relative">
	<button
		type="button"
		onclick={toggleOpen}
		aria-label="Pemberitahuan ({toast.unreadCount} belum dibaca)"
		class="relative flex size-9 items-center justify-center rounded-lg border-[3px] border-border bg-card text-foreground brutal-shadow-sm hover:bg-muted active:translate-x-px active:translate-y-px transition-all cursor-pointer"
		title="Pemberitahuan Sistem"
	>
		<Bell class="size-4.5" />
		{#if toast.unreadCount > 0}
			<span
				class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-black bg-red-500 px-1 text-[9px] font-black text-white shadow-[1px_1px_0px_0px_#000] animate-pulse"
			>
				{toast.unreadCount > 9 ? '9+' : toast.unreadCount}
			</span>
		{/if}
	</button>

	{#if isOpen}
		<div
			class="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-xl border-[3px] border-black bg-white shadow-[6px_6px_0px_0px_#000] animate-in fade-in zoom-in-95 duration-150 text-black"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b-2 border-black bg-yellow-200 px-4 py-2.5">
				<div class="flex items-center gap-2">
					<Bell class="h-4 w-4 text-black" />
					<h3 class="text-xs font-black uppercase tracking-wider text-black">
						Notifikasi
					</h3>
					{#if toast.history.length > 0}
						<span class="rounded-full border border-black bg-white px-1.5 py-0.2 text-[10px] font-black font-mono">
							{toast.history.length}
						</span>
					{/if}
				</div>

				{#if toast.history.length > 0}
					<div class="flex items-center gap-1">
						<button
							type="button"
							onclick={() => toast.clearHistory()}
							class="flex items-center gap-1 border border-black bg-white px-1.5 py-0.5 text-[9px] font-black uppercase hover:bg-red-100"
							title="Hapus riwayat notifikasi"
						>
							<Trash2 class="h-2.5 w-2.5" /> Bersihkan
						</button>
					</div>
				{/if}
			</div>

			<!-- Browser Notification Bar -->
			<div class="border-b-2 border-black bg-slate-50 px-3 py-2 text-[11px]">
				{#if toast.browserPermission === 'default'}
					<div class="flex items-center justify-between gap-2">
						<span class="font-bold text-slate-700 leading-tight">
							Notifikasi desktop browser belum aktif
						</span>
						<button
							type="button"
							onclick={async () => {
								const ok = await toast.requestBrowserPermission();
								if (ok) toast.success('Notifikasi desktop browser berhasil diaktifkan!');
								else toast.warning('Izin notifikasi belum diizinkan oleh browser.');
							}}
							class="shrink-0 rounded border border-black bg-yellow-300 px-2 py-1 font-black uppercase text-[10px] shadow-[1px_1px_0px_0px_#000] hover:bg-yellow-400 active:translate-x-px active:translate-y-px transition-all cursor-pointer"
						>
							🔔 Izinkan
						</button>
					</div>
				{:else if toast.browserPermission === 'granted'}
					<div class="flex items-center justify-between gap-2">
						<div class="flex items-center gap-1.5 font-bold text-slate-700">
							<span class="inline-block size-2 rounded-full {toast.enableBrowserNotification ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
							<span>Desktop:</span>
							<button
								type="button"
								onclick={() => toast.toggleBrowserNotification()}
								class={`px-1.5 py-0.5 rounded border border-black font-black uppercase text-[9px] shadow-[1px_1px_0px_0px_#000] cursor-pointer ${toast.enableBrowserNotification ? 'bg-emerald-300 text-black' : 'bg-slate-200 text-slate-600'}`}
								title={toast.enableBrowserNotification ? 'Klik untuk mematikan notifikasi desktop' : 'Klik untuk menyalakan notifikasi desktop'}
							>
								{toast.enableBrowserNotification ? 'AKTIF' : 'NONAKTIF'}
							</button>
						</div>

						<div class="flex items-center gap-1.5">
							<span class="font-bold text-slate-600">Suara:</span>
							<button
								type="button"
								onclick={() => toast.toggleSound()}
								class={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-black font-black uppercase text-[9px] shadow-[1px_1px_0px_0px_#000] cursor-pointer ${toast.enableSound ? 'bg-sky-300 text-black' : 'bg-slate-200 text-slate-600'}`}
								title={toast.enableSound ? 'Klik untuk mematikan audio notifikasi' : 'Klik untuk menyalakan audio notifikasi'}
							>
								{#if toast.enableSound}
									<Volume2 class="size-2.5" /> ON
								{:else}
									<VolumeX class="size-2.5" /> OFF
								{/if}
							</button>
						</div>
					</div>
				{:else if toast.browserPermission === 'denied'}
					<div class="text-[10px] font-bold text-red-600 flex items-center gap-1">
						<span>⚠️</span>
						<span>Notifikasi desktop diblokir di setelan browser ini.</span>
					</div>
				{/if}
			</div>

			<!-- List Notifikasi -->
			<div class="max-h-80 overflow-y-auto divide-y-2 divide-black/10">
				{#each toast.history as item}
					{@const IconComp = typeIcons[item.type] || Info}
					<div class="p-3 text-xs hover:bg-slate-50 transition-colors flex items-start gap-2.5">
						<div
							class="flex size-6 shrink-0 items-center justify-center border border-black {typeColors[item.type]} shadow-[1px_1px_0px_0px_#000] mt-0.5"
						>
							<IconComp class="size-3.5" />
						</div>

						<div class="min-w-0 flex-1">
							{#if item.title}
								<div class="font-black uppercase tracking-wide text-[11px] text-black">
									{item.title}
								</div>
							{/if}
							<div class="font-bold text-slate-700 leading-snug">
								{item.message}
							</div>
							{#if item.description && item.description !== item.message}
								<div class="text-[10px] text-slate-500 font-medium mt-0.5">
									{item.description}
								</div>
							{/if}
							<div class="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono font-bold">
								<span>{formatTime(item.createdAt)}</span>
								{#if item.action?.href}
									<a
										href={item.action.href}
										onclick={() => (isOpen = false)}
										class="inline-flex items-center gap-0.5 font-sans font-black uppercase text-sky-800 underline hover:text-black"
									>
										{item.action.label} <ExternalLink class="size-2.5" />
									</a>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="p-6 text-center text-xs font-bold text-slate-400">
						Belum ada notifikasi aktivitas terbaru.
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
