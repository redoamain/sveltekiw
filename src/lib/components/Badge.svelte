<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { tv, type VariantProps } from 'tailwind-variants';

	export const badgeVariants = tv({
		base: [
			'inline-flex items-center gap-1.5 rounded-full font-mono font-black uppercase whitespace-nowrap tracking-wider',
			'[&_svg]:pointer-events-none [&_svg]:shrink-0',
			'transition-all outline-none border-2'
		],
		variants: {
			variant: {
				default: 'bg-foreground text-background border-border',
				primary: 'bg-primary text-primary-foreground border-border',
				secondary: 'bg-secondary text-secondary-foreground border-border',
				outline: 'bg-card text-foreground border-border',
				ghost: 'bg-foreground/10 text-foreground border-transparent',
				info: 'bg-info text-info-foreground border-border',
				success: 'bg-success text-success-foreground border-border',
				warning: 'bg-warning text-warning-foreground border-border',
				error: 'bg-error text-error-foreground border-border'
			},
			size: {
				sm: 'px-2.5 py-0.5 text-[10px] [&_svg]:size-3',
				md: 'px-3 py-1 text-xs [&_svg]:size-3.5',
				lg: 'px-4 py-1.5 text-sm [&_svg]:size-4'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'sm'
		}
	});

	type Props = HTMLAttributes<HTMLSpanElement> & {
		variant?: VariantProps<typeof badgeVariants>['variant'];
		size?: VariantProps<typeof badgeVariants>['size'];
		children?: Snippet;
	};

	let {
		variant = 'default',
		size = 'sm',
		class: className = '',
		children,
		...rest
	}: Props = $props();

	let classes = $derived(badgeVariants({ variant, size, class: className as any }));
</script>

<span class={classes} data-slot="badge" {...rest}>
	{@render children?.()}
</span>
