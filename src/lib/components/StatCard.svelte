<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		tone?: 'primary' | 'success' | 'warning' | 'error' | 'muted';
		icon?: string;
		class?: string;
	}

	let { label, value, tone = 'primary', icon, class: className = '' }: Props = $props();

	const tones: Record<string, string> = {
		primary: 'bg-primary text-primary-foreground border-border',
		success: 'bg-success text-success-foreground border-border',
		warning: 'bg-warning text-warning-foreground border-border',
		error: 'bg-error text-error-foreground border-border',
		muted: 'bg-card text-foreground border-border'
	};
</script>

<div
	class="bg-card flex items-center gap-3 rounded-xl border-[3px] border-border p-4 brutal-shadow transition-all hover:-translate-x-px hover:-translate-y-px hover:brutal-shadow-lg {className}"
>
	<div
		class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-[3px] font-black brutal-shadow-sm {tones[tone]}"
	>
		{icon ?? label.charAt(0)}
	</div>
	<div class="min-w-0">
		<div class="text-muted-foreground font-mono text-[10px] font-black uppercase tracking-[0.15em]">
			{label}
		</div>
		<div class="truncate font-black uppercase tracking-tight text-lg" style="font-family: var(--font-display)">
			{value}
		</div>
	</div>
</div>
