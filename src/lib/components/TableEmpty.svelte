<script lang="ts">
	interface Props {
		colspan: number;
		message: string;
	}

	let { colspan, message }: Props = $props();
</script>

<tr>
	<td {colspan} class="text-muted-foreground h-24 text-center font-bold font-mono text-sm uppercase">
		{message}
	</td>
</tr>
