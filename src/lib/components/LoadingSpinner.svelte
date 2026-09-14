<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
		ariaLabel?: string;
		class?: string;
	}

	let { size = 'md', ariaLabel = 'Memuat...', class: className = '' }: Props = $props();

	const sizeClasses = {
		sm: 'size-4 border-2',
		md: 'size-6 border-[3px]',
		lg: 'size-10 border-4'
	};
</script>

<div
	class="inline-block animate-spin rounded-full border-solid border-primary border-t-transparent {sizeClasses[size]} {className}"
	role="status"
	aria-label={ariaLabel}
>
	<span class="sr-only">{ariaLabel}</span>
</div>
