<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';
	import { tv, type VariantProps } from 'tailwind-variants';

	export const buttonVariants = tv({
		base: [
			'inline-flex items-center justify-center gap-1.5 rounded-md font-bold uppercase tracking-wide whitespace-nowrap',
			'[&_svg]:pointer-events-none [&_svg]:shrink-0',
			'transition-all outline-none focus-visible:ring-3',
			'disabled:pointer-events-none disabled:opacity-50',
			'data-disabled:pointer-events-none data-disabled:opacity-50',
			'aria-invalid:border-error aria-invalid:focus-visible:ring-error/40',
			'cursor-pointer'
		],
		variants: {
			variant: {
				default: 'bg-foreground text-background hover:bg-foreground/90 focus-visible:ring-outline/50',
				primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/50',
				secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 focus-visible:ring-secondary/50',
				outline: 'bg-card border-border hover:bg-muted text-foreground border-2',
				ghost: 'hover:bg-muted hover:text-foreground focus-visible:ring-outline/50',
				info: 'bg-info text-info-foreground hover:bg-info/90 focus-visible:ring-info/50',
				success: 'bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/50',
				warning: 'bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning/50',
				error: 'bg-error text-error-foreground hover:bg-error/90 focus-visible:ring-error/50'
			},
			size: {
				sm: 'h-9 px-4 text-xs [&_svg]:size-3.5',
				md: 'h-11 px-5 text-sm [&_svg]:size-4',
				lg: 'h-12 px-8 text-base [&_svg]:size-5',
				'icon-sm': 'size-9 [&_svg]:size-3.5',
				icon: 'size-11 [&_svg]:size-4.5',
				'icon-lg': 'size-12 [&_svg]:size-5'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'md'
		}
	});

	type Props = (
		| ({ href?: undefined } & HTMLButtonAttributes)
		| ({ href: string } & HTMLAnchorAttributes)
	) & {
		variant?: VariantProps<typeof buttonVariants>['variant'];
		size?: VariantProps<typeof buttonVariants>['size'];
		children?: Snippet;
	};

	let {
		variant = 'default',
		size = 'md',
		class: className = '',
		href,
		children,
		...rest
	}: Props = $props();

	let classes = $derived(buttonVariants({ variant, size, class: className as any }));
</script>

{#if href}
	<a {href} class={classes} data-slot="button" {...rest as HTMLAnchorAttributes}>
		{@render children?.()}
	</a>
{:else}
	<button class={classes} data-slot="button" {...rest as HTMLButtonAttributes}>
		{@render children?.()}
	</button>
{/if}
