export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
	label: string;
	href?: string;
	onclick?: () => void;
}

export interface ToastOptions {
	title?: string;
	description?: string;
	duration?: number; // ms, default 4000 (0 = persistent)
	action?: ToastAction;
}

export interface ToastItem {
	id: string;
	type: ToastType;
	title?: string;
	description?: string;
	message: string;
	duration: number;
	action?: ToastAction;
	createdAt: Date;
	read: boolean;
}

class ToastManager {
	toasts = $state<ToastItem[]>([]);
	history = $state<ToastItem[]>([]);
	browserPermission = $state<'default' | 'granted' | 'denied' | 'unsupported'>('default');
	enableBrowserNotification = $state<boolean>(true);
	enableSound = $state<boolean>(true);

	private timers = new Map<string, any>();
	private lastToastTimes = new Map<string, number>();

	constructor() {
		if (typeof window !== 'undefined') {
			this.initBrowserState();
		}
	}

	initBrowserState() {
		if (typeof window === 'undefined') return;
		if (!('Notification' in window)) {
			this.browserPermission = 'unsupported';
			return;
		}
		this.browserPermission = Notification.permission;
		const savedEnabled = localStorage.getItem('kiw_browser_notif_enabled');
		if (savedEnabled !== null) {
			this.enableBrowserNotification = savedEnabled === 'true';
		}
		const savedSound = localStorage.getItem('kiw_sound_enabled');
		if (savedSound !== null) {
			this.enableSound = savedSound === 'true';
		}
	}

	async requestBrowserPermission(): Promise<boolean> {
		if (typeof window === 'undefined' || !('Notification' in window)) {
			this.browserPermission = 'unsupported';
			return false;
		}

		try {
			const permission = await Notification.requestPermission();
			this.browserPermission = permission;
			if (permission === 'granted') {
				this.enableBrowserNotification = true;
				localStorage.setItem('kiw_browser_notif_enabled', 'true');
				this.sendBrowserNotification(
					'success',
					'Notifikasi Browser Aktif',
					'Anda sekarang akan menerima notifikasi desktop langsung dari sistem ERP SvelteKiw.',
					'perm-granted'
				);
				return true;
			}
			return false;
		} catch (err) {
			console.warn('Gagal meminta izin notifikasi browser:', err);
			return false;
		}
	}

	toggleBrowserNotification(force?: boolean) {
		this.enableBrowserNotification = force !== undefined ? force : !this.enableBrowserNotification;
		if (typeof window !== 'undefined') {
			localStorage.setItem('kiw_browser_notif_enabled', String(this.enableBrowserNotification));
		}
	}

	toggleSound(force?: boolean) {
		this.enableSound = force !== undefined ? force : !this.enableSound;
		if (typeof window !== 'undefined') {
			localStorage.setItem('kiw_sound_enabled', String(this.enableSound));
		}
	}

	private sendBrowserNotification(type: ToastType, title: string | undefined, message: string, id: string) {
		if (typeof window === 'undefined' || !('Notification' in window)) return;
		if (this.browserPermission !== 'granted' || !this.enableBrowserNotification) return;

		try {
			const typeTitles: Record<ToastType, string> = {
				success: 'Berhasil — ERP SvelteKiw',
				error: 'Peringatan / Error — ERP SvelteKiw',
				warning: 'Peringatan — ERP SvelteKiw',
				info: 'Informasi — ERP SvelteKiw'
			};
			const notifTitle = title || typeTitles[type] || 'Sistem ERP SvelteKiw';

			const n = new Notification(notifTitle, {
				body: message,
				icon: '/favicon.ico',
				badge: '/favicon.ico',
				tag: `kiw-${id}`
			});

			n.onclick = () => {
				window.focus();
				n.close();
			};
		} catch (err) {
			console.warn('Browser notification error:', err);
		}
	}

	private playNotificationSound(type: ToastType = 'info') {
		if (!this.enableSound || typeof window === 'undefined') return;
		try {
			const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
			if (!AudioCtx) return;
			const ctx = new AudioCtx();
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(ctx.destination);

			const freq = type === 'error' ? 330 : type === 'warning' ? 440 : 587.33;
			osc.frequency.setValueAtTime(freq, ctx.currentTime);
			if (type === 'success') {
				osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
			}
			gain.gain.setValueAtTime(0.12, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
			osc.start(ctx.currentTime);
			osc.stop(ctx.currentTime + 0.22);
		} catch {
			// Autoplay audio mungkin dibatasi browser jika belum ada interaksi pengguna
		}
	}

	private add(type: ToastType, titleOrMessage: string, descriptionOrOptions?: string | ToastOptions): string {
		let title: string | undefined;
		let message: string;
		let description: string | undefined;
		let duration: number | undefined;
		let action: ToastAction | undefined;

		if (typeof descriptionOrOptions === 'string') {
			title = titleOrMessage;
			message = descriptionOrOptions;
			description = descriptionOrOptions;
		} else {
			title = descriptionOrOptions?.title;
			message = titleOrMessage;
			description = descriptionOrOptions?.description;
			duration = descriptionOrOptions?.duration;
			action = descriptionOrOptions?.action;
		}

		// 1. Anti-spam / deduplikasi: abaikan pesan identik yang dipicu dalam 1500ms
		const dedupKey = `${type}::${title || ''}::${message}`;
		const now = Date.now();
		const prevTime = this.lastToastTimes.get(dedupKey) || 0;
		if (now - prevTime < 1500) {
			return '';
		}
		this.lastToastTimes.set(dedupKey, now);

		const id = typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2);

		const finalDuration = duration ?? (type === 'error' ? 5000 : 3500);

		const item: ToastItem = {
			id,
			type,
			title,
			description,
			message,
			duration: finalDuration,
			action,
			createdAt: new Date(),
			read: false
		};

		// 2. Maksimal 3 notifikasi aktif di layar (buang tertua agar tidak bertumpuk)
		const nextToasts = [...this.toasts, item];
		while (nextToasts.length > 3) {
			const oldest = nextToasts.shift();
			if (oldest) {
				const t = this.timers.get(oldest.id);
				if (t) clearTimeout(t);
				this.timers.delete(oldest.id);
			}
		}
		this.toasts = nextToasts;

		// 3. Simpan juga ke histori notifikasi (maksimal 50 item)
		const nextHistory = [{ ...item }, ...this.history];
		if (nextHistory.length > 50) {
			nextHistory.pop();
		}
		this.history = nextHistory;

		// 4. Timer auto dismiss
		if (finalDuration > 0) {
			const timer = setTimeout(() => {
				this.dismiss(id);
			}, finalDuration);
			this.timers.set(id, timer);
		}

		// 5. Trigger Web Browser Desktop Notification & Sound
		this.sendBrowserNotification(type, title, message, id);
		this.playNotificationSound(type);

		return id;
	}

	success(titleOrMessage: string, descriptionOrOptions?: string | ToastOptions): string {
		return this.add('success', titleOrMessage, descriptionOrOptions);
	}

	error(titleOrMessage: string, descriptionOrOptions?: string | ToastOptions): string {
		return this.add('error', titleOrMessage, descriptionOrOptions);
	}

	warning(titleOrMessage: string, descriptionOrOptions?: string | ToastOptions): string {
		return this.add('warning', titleOrMessage, descriptionOrOptions);
	}

	info(titleOrMessage: string, descriptionOrOptions?: string | ToastOptions): string {
		return this.add('info', titleOrMessage, descriptionOrOptions);
	}

	dismiss(id: string): void {
		const t = this.timers.get(id);
		if (t) clearTimeout(t);
		this.timers.delete(id);
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	clear(): void {
		for (const t of this.timers.values()) {
			clearTimeout(t);
		}
		this.timers.clear();
		this.toasts = [];
	}

	markAllAsRead(): void {
		for (const h of this.history) {
			h.read = true;
		}
	}

	clearHistory(): void {
		this.history = [];
	}

	get unreadCount(): number {
		return this.history.filter((h) => !h.read).length;
	}
}

export const toast = new ToastManager();
