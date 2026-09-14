<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, LoadingOverlay } from '$lib/components';
	import { Lock, ShieldCheck, AlertCircle } from '@lucide/svelte';

	let { data, form } = $props();

	let loading = $state(false);
	let error = $derived(form?.error ?? data.error ?? '');
</script>

<svelte:head>
	<title>Login — KIW Monitoring Inventori</title>
</svelte:head>

<LoadingOverlay show={loading} message="Memverifikasi..." submessage="Mohon tunggu" />

<div class="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 bg-background">
	<!-- Brutal background pattern -->
	<div class="pointer-events-none absolute inset-0">
		<div
			class="absolute inset-0 bg-[linear-gradient(to_right,#0F0F0F08_1px,transparent_1px),linear-gradient(to_bottom,#0F0F0F08_1px,transparent_1px)] bg-[size:32px_32px]"
		></div>
		<div class="absolute -top-24 -right-24 size-96 rounded-full border-4 border-border bg-primary opacity-20"></div>
		<div class="absolute -bottom-32 -left-32 size-112 rounded-full border-4 border-border bg-accent opacity-15"></div>
		<div class="absolute top-1/2 left-1/2 size-240 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-dashed border-border/20"></div>
	</div>

	<!-- Floating brutal shapes -->
	<div class="pointer-events-none absolute top-12 left-12 hidden rotate-3 rounded-xl border-[3px] border-border bg-card px-3 py-1 text-xs font-black uppercase tracking-widest brutal-shadow-sm md:block">
		SECURE • KIW
	</div>
	<div class="pointer-events-none absolute top-20 right-16 hidden -rotate-2 rounded-full border-[3px] border-border bg-success px-3 py-1 text-xs font-black uppercase brutal-shadow-sm text-success-foreground md:block">
		● LIVE SYSTEM
	</div>

	<div class="relative w-full max-w-md">
		<!-- Brutal badge on top -->
		<div class="mb-4 flex justify-center">
			<div class="bg-secondary text-secondary-foreground inline-flex items-center gap-2 rounded-full border-[3px] border-border px-4 py-1.5 brutal-shadow-sm">
				<span class="size-2 rounded-full border-2 border-border bg-primary"></span>
				<span class="font-mono text-[10px] font-black uppercase tracking-[0.15em]">
					KIW Monitoring Inventori • Neo-Brutal
				</span>
			</div>
		</div>

		<Card class="rounded-2xl border-4 bg-card p-0 brutal-shadow-lg overflow-hidden">
			<!-- Brutal header stripe -->
			<div class="bg-primary border-b-4 border-border px-8 py-4">
				<div class="flex items-center gap-3">
					<div class="bg-secondary text-secondary-foreground flex size-11 items-center justify-center rounded-xl border-[3px] border-border brutal-shadow-sm">
						<Lock class="size-5" />
					</div>
					<div>
						<p class="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground">
							Authentication
						</p>
						<p class="font-black uppercase tracking-tight text-primary-foreground text-lg" style="font-family: var(--font-display)">
							Secure Access
						</p>
					</div>
					<div class="ml-auto hidden size-3 rounded-full border-2 border-border bg-success md:block"></div>
				</div>
			</div>

			<CardHeader class="space-y-1 px-8 pt-6 text-center">
				<CardTitle class="text-2xl font-black uppercase tracking-tight" style="font-family: var(--font-display)">
					Welcome Back
				</CardTitle>
				<CardDescription class="font-mono text-xs font-bold uppercase tracking-wide">
					Login ke KIW Monitoring Inventori — kredensial sama dengan wincp
				</CardDescription>
			</CardHeader>

			<CardContent class="space-y-5 px-8 pb-8">
				<form
					method="post"
					action="/login"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							loading = false;
							await update();
						};
					}}
					class="space-y-4"
				>
					<input type="hidden" name="next" value={data.nextParam} />

					<div class="space-y-2">
						<Label for="username">Username</Label>
						<Input
							id="username"
							name="username"
							placeholder="Masukkan username"
							required
							autocomplete="username"
							class="h-12 border-[3px] font-bold"
						/>
					</div>

					<div class="space-y-2">
						<Label for="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							placeholder="Masukkan password"
							required
							autocomplete="current-password"
							class="h-12 border-[3px] font-bold"
						/>
					</div>

					<div class="space-y-2">
						<Label for="db_source">Database</Label>
						<select
							id="db_source"
							name="db_source"
							class="border-input bg-background h-12 w-full rounded-lg border-[3px] border-border px-3 font-bold text-sm brutal-shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
						>
							<option value="live">Live (Realtime)</option>
							<option value="backup">Backup</option>
						</select>
					</div>

					{#if error}
						<div
							class="bg-error text-error-foreground flex items-center gap-2 rounded-xl border-[3px] border-border px-4 py-3 text-sm font-black uppercase tracking-wide brutal-shadow-sm"
							role="alert"
						>
							<span class="bg-card text-error flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border text-xs font-black">
								!
							</span>
							<span>{error}</span>
						</div>
					{/if}

					<Button
						type="submit"
						class="bg-primary text-primary-foreground hover:bg-primary-accent h-12 w-full border-[3px] border-border text-base font-black uppercase tracking-widest brutal-shadow transition-all hover:-translate-x-px hover:-translate-y-px hover:brutal-shadow-lg active:translate-x-0.5 active:translate-y-0.5"
					>
						Login →
					</Button>
				</form>
			</CardContent>
		</Card>
	</div>
</div>
