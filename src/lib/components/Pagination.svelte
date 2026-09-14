<script lang="ts">
	interface Props {
		page: number;
		pageSize: number;
		total: number;
		basePath: string;
		params?: Record<string, string | undefined>;
		pageSizeOptions?: number[];
	}

	let {
		page,
		pageSize,
		total,
		basePath,
		params = {},
		pageSizeOptions = [25, 50, 100, 200]
	}: Props = $props();

	let totalPages = $derived(Math.max(1, Math.ceil(total / Math.max(1, pageSize))));
	let cur = $derived(Math.min(Math.max(1, page), totalPages));
	let start = $derived(total === 0 ? 0 : (cur - 1) * pageSize + 1);
	let end = $derived(Math.min(cur * pageSize, total));

	function href(p: number, ps: number = pageSize): string {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined && v !== '') qs.set(k, v);
		}
		qs.set('page', String(p));
		qs.set('pageSize', String(ps));
		return `${basePath}?${qs.toString()}`;
	}

	function pages(): (number | '...')[] {
		if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
		const out: (number | '...')[] = [1];
		let lo = Math.max(2, cur - 2);
		let hi = Math.min(totalPages - 1, cur + 2);
		if (lo > 2) out.push('...');
		for (let i = lo; i <= hi; i++) out.push(i);
		if (hi < totalPages - 1) out.push('...');
		out.push(totalPages);
		return out;
	}
</script>

<div class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
	<span class="text-muted-foreground font-mono text-xs font-bold uppercase tracking-wider">
		{total === 0 ? 'Tidak ada data' : `Menampilkan ${start}–${end} dari ${total.toLocaleString('id-ID')}`}
	</span>

	<div class="flex flex-wrap items-center gap-1.5">
		<span class="text-muted-foreground mr-1 hidden font-mono text-xs font-black uppercase sm:inline">
			Per halaman:
		</span>
		{#each pageSizeOptions as ps}
			<a
				href={href(1, ps)}
				class="rounded-lg border-2 px-2.5 py-1 font-mono text-xs font-black transition-all brutal-shadow-sm {ps === pageSize ? 'bg-primary text-primary-foreground border-border' : 'bg-card text-foreground border-border hover:bg-muted'}"
			>
				{ps}
			</a>
		{/each}

		<a
			href={href(cur - 1)}
			class="ml-2 rounded-lg border-2 border-border px-3 py-1 font-bold text-xs transition-all brutal-shadow-sm {cur <= 1 ? 'pointer-events-none opacity-40 bg-muted' : 'bg-card hover:bg-muted'}"
		>
			‹ Prev
		</a>

		{#each pages() as p}
			{#if p === '...'}
				<span class="text-muted-foreground font-mono font-bold px-1">…</span>
			{:else}
				<a
					href={href(p as number)}
					class="min-w-8 rounded-lg border-2 px-2.5 py-1 text-center font-mono text-xs font-black transition-all brutal-shadow-sm {p === cur ? 'bg-primary text-primary-foreground border-border' : 'bg-card text-foreground border-border hover:bg-muted'}"
				>
					{p}
				</a>
			{/if}
		{/each}

		<a
			href={href(cur + 1)}
			class="rounded-lg border-2 border-border px-3 py-1 font-bold text-xs transition-all brutal-shadow-sm {cur >= totalPages ? 'pointer-events-none opacity-40 bg-muted' : 'bg-card hover:bg-muted'}"
		>
			Next ›
		</a>
	</div>
</div>
