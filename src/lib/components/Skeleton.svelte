<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<div class="animate-pulse rounded-lg bg-muted/80 border-2 border-border/30 {className}"></div>
