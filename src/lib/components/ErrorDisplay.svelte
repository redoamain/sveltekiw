<script lang="ts">
	import { page } from '$app/stores';
	import {
		FileQuestion,
		ServerCrash,
		ShieldAlert,
		AlertTriangle,
		Home,
		RotateCcw,
		ArrowLeft,
		Copy,
		Check,
		ChevronDown,
		ChevronUp,
		LifeBuoy,
		Terminal,
		ExternalLink,
		Sparkles,
		Layers,
		Compass,
		LogIn
	} from '@lucide/svelte';

	interface Props {
		status?: number;
		message?: string;
		standalone?: boolean;
	}

	let {
		status = $page.status || 404,
		message = $page.error?.message || '',
		standalone = false
	}: Props = $props();

	let showDetails = $state(false);
	let copied = $state(false);
	let timestamp = $state(new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' }));

	interface ErrorConfig {
		code: string;
		badge: string;
		title: string;
		description: string;
		badgeBg: string;
		badgeText: string;
		borderAccent: string;
		glowColor: string;
		icon: any;
		suggestions: string[];
	}

	const errorConfigs: Record<number, ErrorConfig> = {
		404: {
			code: '404',
			badge: 'ERROR 404 • NOT FOUND',
			title: 'Halaman Tidak Ditemukan',
			description:
				'Halaman atau dokumen yang Anda cari tidak tersedia, telah dihapus, atau tautan URL yang Anda tuju salah ketik.',
			badgeBg: 'bg-amber-400',
			badgeText: 'text-black',
			borderAccent: 'border-amber-400',
			glowColor: 'bg-amber-300',
			icon: FileQuestion,
			suggestions: [
				'Periksa kembali ejaan alamat URL pada address bar peramban Anda.',
				'Menu atau halaman mungkin telah dipindahkan ke submenu lain di sidebar.',
				'Gunakan tombol navigasi di bawah untuk kembali ke halaman Dashboard utama.'
			]
		},
		500: {
			code: '500',
			badge: 'ERROR 500 • INTERNAL SERVER ERROR',
			title: 'Terjadi Kesalahan Server',
			description:
				'Sistem mendeteksi kendala pada server saat memproses data Anda. Data transaksi tersimpan Anda tetap aman.',
			badgeBg: 'bg-rose-500',
			badgeText: 'text-white',
			borderAccent: 'border-rose-500',
			glowColor: 'bg-rose-400',
			icon: ServerCrash,
			suggestions: [
				'Muat ulang halaman (Refresh) setelah beberapa saat untuk mengulang permintaan.',
				'Pastikan koneksi jaringan Anda stabil dan server database tidak sedang maintenance.',
				'Buka bagian rincian teknis di bawah lalu salin dan laporkan ke IT Administrator.'
			]
		},
		403: {
			code: '403',
			badge: 'ERROR 403 • ACCESS FORBIDDEN',
			title: 'Akses Ditolak',
			description:
				'Akun Anda saat ini tidak memiliki izin (hak akses) untuk membuka halaman atau modul yang diminta.',
			badgeBg: 'bg-orange-500',
			badgeText: 'text-white',
			borderAccent: 'border-orange-500',
			glowColor: 'bg-orange-400',
			icon: ShieldAlert,
			suggestions: [
				'Pastikan Anda masuk menggunakan akun dengan wewenang yang sesuai.',
				'Hubungi SuperAdmin / IT jika bagian kerja Anda memerlukan hak akses ke modul ini.',
				'Kembali ke halaman Dashboard utama untuk mengakses modul yang diizinkan.'
			]
		},
		401: {
			code: '401',
			badge: 'ERROR 401 • UNAUTHORIZED',
			title: 'Sesi Tidak Sah / Belum Login',
			description: 'Sesi login Anda telah berakhir atau belum terautentikasi untuk membuka halaman ini.',
			badgeBg: 'bg-sky-400',
			badgeText: 'text-black',
			borderAccent: 'border-sky-400',
			glowColor: 'bg-sky-300',
			icon: ShieldAlert,
			suggestions: [
				'Silakan masuk kembali melalui halaman Login resmi.',
				'Pastikan cookies dan session browser tidak diblokir.',
				'Gunakan tombol "Masuk ke Sistem" untuk login ulang.'
			]
		}
	};

	const currentConfig = $derived<ErrorConfig>(
		errorConfigs[status] || {
			code: String(status || 'ERR'),
			badge: `ERROR ${status || 'UNKNOWN'}`,
			title: 'Terjadi Kendala Teknis',
			description:
				message ||
				'Sistem mengalami gangguan saat memproses permintaan ini. Silakan coba kembali atau hubungi tim IT.',
			badgeBg: 'bg-primary',
			badgeText: 'text-white',
			borderAccent: 'border-primary',
			glowColor: 'bg-blue-400',
			icon: AlertTriangle,
			suggestions: [
				'Muat ulang halaman atau coba beberapa saat lagi.',
				'Periksa parameter atau input data yang Anda kirimkan.',
				'Laporkan kode error ini kepada tim IT support jika terus berulang.'
			]
		}
	);

	const IconComponent = $derived(currentConfig.icon);

	function handleReload() {
		if (typeof window !== 'undefined') {
			window.location.reload();
		}
	}

	function handleGoBack() {
		if (typeof window !== 'undefined') {
			if (window.history.length > 1) {
				window.history.back();
			} else {
				window.location.href = '/dashboard';
			}
		}
	}

	async function copyDiagnostics() {
		if (typeof navigator === 'undefined' || !navigator.clipboard) return;

		const currentUrl = typeof window !== 'undefined' ? window.location.href : ($page.url?.href || '-');
		const diagText = [
			'=== LAPORAN GANGGUAN KIW ERP ===',
			`Waktu     : ${new Date().toISOString()} (${timestamp})`,
			`Status    : ${status}`,
			`Judul     : ${currentConfig.title}`,
			`URL       : ${currentUrl}`,
			`Pesan     : ${message || currentConfig.description}`,
			`User-Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : '-'}`,
			'================================'
		].join('\n');

		try {
			await navigator.clipboard.writeText(diagText);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2500);
		} catch (err) {
			console.error('Gagal menyalin:', err);
		}
	}
</script>

<svelte:head>
	<title>{currentConfig.code} - {currentConfig.title} | KIW ERP</title>
</svelte:head>

<div
	class={standalone
		? 'min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-black selection:text-white'
		: 'w-full py-4 sm:py-8 font-sans'}
>
	{#if standalone}
		<!-- Header Standalone -->
		<header class="w-full max-w-5xl mx-auto flex items-center justify-between pb-6 border-b-3 border-border">
			<a
				href="/dashboard"
				class="inline-flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-black rounded"
			>
				<div
					class="w-10 h-10 bg-primary text-white font-black text-xl flex items-center justify-center border-2 border-black brutal-shadow-sm group-hover:scale-105 transition-transform"
				>
					K
				</div>
				<div class="flex flex-col">
					<span class="font-display font-black text-lg tracking-tight leading-none text-foreground">
						KIW ERP SYSTEM
					</span>
					<span class="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
						PT Karya Indah Wahana
					</span>
				</div>
			</a>

			<div class="flex items-center gap-3">
				<div
					class="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 bg-white border-2 border-black rounded text-xs font-mono font-bold brutal-shadow-sm"
				>
					<span class="size-2 rounded-full {status >= 500 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}"></span>
					<span>{status >= 500 ? 'SERVER ISSUE' : 'SYSTEM ONLINE'}</span>
				</div>

				<a
					href="/login"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card text-foreground font-black text-xs uppercase tracking-wide border-2 border-black rounded brutal-shadow-sm hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all"
				>
					<LogIn class="size-3.5" />
					<span>Login</span>
				</a>
			</div>
		</header>
	{/if}

	<!-- Main Content Area -->
	<main class="w-full max-w-4xl mx-auto my-auto py-6 sm:py-10">
		<div
			class="relative bg-card border-[3px] border-border rounded-2xl p-6 sm:p-10 brutal-shadow-lg overflow-hidden"
		>
			<!-- Top Accent Stripe -->
			<div class="absolute top-0 left-0 right-0 h-2 {currentConfig.badgeBg} border-b-2 border-black"></div>

			<!-- Header Section with Giant Badge -->
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b-2 border-border/20">
				<div>
					<div class="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-md border-2 border-black font-mono text-xs font-black tracking-wider uppercase {currentConfig.badgeBg} {currentConfig.badgeText} shadow-[2px_2px_0px_0px_#000]">
						<IconComponent class="size-4" />
						<span>{currentConfig.badge}</span>
					</div>
					<h1 class="text-3xl sm:text-4xl lg:text-5xl font-black font-display tracking-tight text-foreground leading-tight">
						{currentConfig.title}
					</h1>
					<p class="mt-2 text-sm sm:text-base font-semibold text-muted-foreground max-w-xl leading-relaxed">
						{currentConfig.description}
					</p>
				</div>

				<!-- Sticker Number Graphic -->
				<div class="self-center sm:self-auto shrink-0 select-none">
					<div
						class="relative flex flex-col items-center justify-center px-6 py-4 rounded-xl border-[3px] border-black bg-white shadow-[6px_6px_0px_0px_#000] -rotate-2 hover:rotate-0 transition-transform duration-200"
					>
						<span class="absolute -top-3 -right-2 px-2 py-0.5 bg-black text-white text-[9px] font-mono font-black uppercase tracking-widest rounded border border-black shadow-[1px_1px_0px_0px_#fff]">
							HTTP STATUS
						</span>
						<span
							class="text-6xl sm:text-7xl font-mono font-black tracking-tighter text-foreground leading-none"
						>
							{currentConfig.code}
						</span>
						<span class="mt-1 text-[10px] font-mono font-black tracking-widest text-muted-foreground uppercase">
							{status >= 500 ? 'SERVER ERROR' : status === 404 ? 'PAGE NOT FOUND' : 'CLIENT ERROR'}
						</span>
					</div>
				</div>
			</div>

			<!-- Custom Specific Message Alert (If Provided) -->
			{#if message && message !== currentConfig.description}
				<div
					class="mt-6 p-4 rounded-lg border-2 border-black bg-amber-50 text-amber-950 shadow-[3px_3px_0px_0px_#000] flex items-start gap-3"
				>
					<AlertTriangle class="size-5 shrink-0 mt-0.5 text-amber-700" />
					<div class="min-w-0 flex-1 text-xs sm:text-sm">
						<span class="font-black uppercase tracking-wider block mb-0.5 text-amber-900">
							Keterangan Error Sistem:
						</span>
						<span class="font-bold font-mono break-words">{message}</span>
					</div>
				</div>
			{/if}

			<!-- Suggested Actions Checklist -->
			<div class="mt-6 p-4 sm:p-5 rounded-xl border-2 border-black bg-muted/40 shadow-[2px_2px_0px_0px_#000]">
				<div class="flex items-center gap-2 mb-3">
					<Compass class="size-4 text-foreground" />
					<h3 class="font-display font-black text-sm uppercase tracking-wider text-foreground">
						Langkah yang Disarankan:
					</h3>
				</div>
				<ul class="space-y-2 text-xs sm:text-sm">
					{#each currentConfig.suggestions as suggestion}
						<li class="flex items-start gap-2.5">
							<span class="size-5 shrink-0 rounded-full border border-black bg-white font-mono font-black text-[10px] flex items-center justify-center mt-0.5 shadow-[1px_1px_0px_0px_#000]">
								✓
							</span>
							<span class="font-semibold text-foreground/90">{suggestion}</span>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Primary Action Buttons -->
			<div class="mt-8 flex flex-wrap items-center gap-3">
				<a
					href="/dashboard"
					class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border-2 border-black bg-primary text-white font-display font-black text-sm uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all"
				>
					<Home class="size-4.5" />
					<span>Ke Dashboard Utama</span>
				</a>

				<button
					type="button"
					onclick={handleReload}
					class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border-2 border-black bg-amber-300 text-black font-display font-black text-sm uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all cursor-pointer"
				>
					<RotateCcw class="size-4.5" />
					<span>Muat Ulang Halaman</span>
				</button>

				<button
					type="button"
					onclick={handleGoBack}
					class="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-black bg-card text-foreground font-display font-bold text-sm uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all cursor-pointer"
				>
					<ArrowLeft class="size-4.5" />
					<span>Halaman Sebelumnya</span>
				</button>
			</div>

			<!-- Technical Diagnostics Accordion -->
			<div class="mt-8 pt-6 border-t-2 border-border/30">
				<div class="flex items-center justify-between">
					<button
						type="button"
						onclick={() => (showDetails = !showDetails)}
						class="inline-flex items-center gap-2 text-xs font-mono font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
					>
						<Terminal class="size-4" />
						<span>{showDetails ? 'Sembunyikan Rincian Teknis' : 'Tampilkan Rincian Teknis (IT Support)'}</span>
						{#if showDetails}
							<ChevronUp class="size-3.5" />
						{:else}
							<ChevronDown class="size-3.5" />
						{/if}
					</button>

					{#if showDetails}
						<button
							type="button"
							onclick={copyDiagnostics}
							class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-black bg-white text-xs font-mono font-bold shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
						>
							{#if copied}
								<Check class="size-3.5 text-emerald-600" />
								<span class="text-emerald-700 font-black">Tersalin!</span>
							{:else}
								<Copy class="size-3.5" />
								<span>Salin Info Error</span>
							{/if}
						</button>
					{/if}
				</div>

				{#if showDetails}
					<div
						class="mt-3 p-4 rounded-xl border-2 border-black bg-slate-900 text-slate-100 font-mono text-xs shadow-[3px_3px_0px_0px_#000] overflow-x-auto space-y-2 select-text"
					>
						<div class="flex items-center justify-between pb-2 border-b border-slate-700 text-slate-400 text-[11px]">
							<span>KIW-ERP // SYSTEM DIAGNOSTIC LOG</span>
							<span>{timestamp}</span>
						</div>
						<div class="grid grid-cols-1 sm:grid-cols-4 gap-1 text-[11px]">
							<span class="text-slate-400">HTTP Status:</span>
							<span class="sm:col-span-3 font-bold text-amber-400">{status} ({currentConfig.title})</span>

							<span class="text-slate-400">Target Path:</span>
							<span class="sm:col-span-3 font-bold text-emerald-400 break-all">
								{$page.url?.pathname || '-'}
							</span>

							{#if $page.url?.search}
								<span class="text-slate-400">Query Params:</span>
								<span class="sm:col-span-3 font-bold text-sky-400 break-all">
									{$page.url.search}
								</span>
							{/if}

							<span class="text-slate-400">Error Message:</span>
							<span class="sm:col-span-3 font-bold text-rose-400 break-all">
								{message || currentConfig.description}
							</span>

							{#if typeof navigator !== 'undefined'}
								<span class="text-slate-400">Client Agent:</span>
								<span class="sm:col-span-3 text-slate-300 break-all text-[10px]">
									{navigator.userAgent}
								</span>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Quick Navigation Links (Neo-Brutalist Badges) -->
			<div class="mt-8 pt-6 border-t-2 border-border/30">
				<div class="flex items-center gap-2 mb-3">
					<Layers class="size-4 text-muted-foreground" />
					<span class="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
						Pintasan Menu Populer:
					</span>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<a
						href="/dashboard"
						class="px-2.5 py-1 text-xs font-mono font-bold bg-white text-black border border-black rounded shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all"
					>
						Dashboard
					</a>
					<a
						href="/dashboard/master-barang"
						class="px-2.5 py-1 text-xs font-mono font-bold bg-white text-black border border-black rounded shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all"
					>
						Master Barang
					</a>
					<a
						href="/dashboard/input-spk"
						class="px-2.5 py-1 text-xs font-mono font-bold bg-white text-black border border-black rounded shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all"
					>
						Input SPK
					</a>
					<a
						href="/dashboard/lbm"
						class="px-2.5 py-1 text-xs font-mono font-bold bg-white text-black border border-black rounded shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all"
					>
						Gudang LBM
					</a>
					<a
						href="/dashboard/buku-besar"
						class="px-2.5 py-1 text-xs font-mono font-bold bg-white text-black border border-black rounded shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all"
					>
						Buku Besar
					</a>
					<a
						href="/dashboard/log-akses"
						class="px-2.5 py-1 text-xs font-mono font-bold bg-white text-black border border-black rounded shadow-[2px_2px_0px_0px_#000] hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 transition-all"
					>
						Log Akses
					</a>
				</div>
			</div>
		</div>
	</main>

	{#if standalone}
		<!-- Footer Standalone -->
		<footer class="w-full max-w-5xl mx-auto pt-6 border-t-3 border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono font-bold text-muted-foreground">
			<div class="flex items-center gap-2">
				<LifeBuoy class="size-4 text-foreground" />
				<span>Butuh bantuan teknis? Hubungi IT Support / System Administrator</span>
			</div>
			<div>
				<span>&copy; {new Date().getFullYear()} PT Karya Indah Wahana. All rights reserved.</span>
			</div>
		</footer>
	{/if}
</div>
