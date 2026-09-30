<script lang="ts">
	export interface MetricItem {
		label: string;
		value: string | number;
		unit?: string;
		tone?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
		icon?: any;
	}

	interface Props {
		items: MetricItem[];
		columns?: 2 | 3 | 4 | 5 | 6;
		class?: string;
	}

	let { items = [], columns = 4, class: className = '' }: Props = $props();

	const toneStyles: Record<string, { bg: string; text: string; badgeBg: string }> = {
		default: { bg: 'bg-white', text: 'text-black', badgeBg: 'bg-slate-100' },
		primary: { bg: 'bg-yellow-50', text: 'text-black', badgeBg: 'bg-[#FFD43B]' },
		success: { bg: 'bg-emerald-50', text: 'text-emerald-950', badgeBg: 'bg-emerald-300' },
		warning: { bg: 'bg-amber-50', text: 'text-amber-950', badgeBg: 'bg-amber-300' },
		error: { bg: 'bg-red-50', text: 'text-red-950', badgeBg: 'bg-red-300' },
		info: { bg: 'bg-sky-50', text: 'text-sky-950', badgeBg: 'bg-sky-300' }
	};

	const gridColsClasses: Record<number, string> = {
		2: 'grid-cols-1 sm:grid-cols-2',
		3: 'grid-cols-1 sm:grid-cols-3',
		4: 'grid-cols-2 sm:grid-cols-4',
		5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5',
		6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6'
	};
</script>

<div class="grid gap-2.5 sm:gap-3 {gridColsClasses[columns] || gridColsClasses[4]} {className}">
	{#each items as item}
		{@const style = toneStyles[item.tone || 'default'] || toneStyles.default}
		{@const IconComp = item.icon}
		<div
			class="border-2 border-black {style.bg} p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_#000] flex items-center justify-between gap-2"
		>
			<div class="min-w-0 flex-1">
				<div class="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 truncate">
					{item.label}
				</div>
				<div class="mt-0.5 flex items-baseline gap-1 truncate font-mono">
					<span class="text-base sm:text-lg font-black tracking-tight {style.text}">
						{typeof item.value === 'number' ? item.value.toLocaleString('id-ID') : item.value}
					</span>
					{#if item.unit}
						<span class="text-[10px] sm:text-xs font-bold text-slate-600">
							{item.unit}
						</span>
					{/if}
				</div>
			</div>

			{#if IconComp}
				<div class="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center border border-black {style.badgeBg} shadow-[1px_1px_0px_0px_#000]">
					<IconComp class="h-4 w-4 sm:h-4.5 sm:w-4.5 text-black" />
				</div>
			{/if}
		</div>
	{/each}
</div>
