<script lang="ts">
	import { untrack } from 'svelte';

	let { authStatus = null }: { authStatus?: string | null } = $props();
	const invalidInitially = untrack(() => authStatus === 'invalid');

	let email = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let message = $state(
		invalidInitially ? 'That sign-in link is invalid or has expired. Request a new one below.' : ''
	);
	let isError = $state(invalidInitially);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		isError = false;
		message = '';

		try {
			const response = await fetch('/api/auth/request', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const result = (await response.json()) as { ok: boolean; message: string };
			submitted = response.ok && result.ok;
			isError = !submitted;
			message = result.message;
		} catch {
			submitted = false;
			isError = true;
			message = 'We could not request a sign-in link. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<main class="auth-layout">
	<section class="auth-panel" aria-labelledby="login-title">
		<div class="brand">
			<span class="brand-mark" aria-hidden="true">Q</span>
			<span>Queerlective</span>
		</div>

		<div class="auth-content">
			<p class="eyebrow">CoLab member portal</p>
			<h1 id="login-title">Welcome back<br />to the studio.</h1>
			<p class="lede">
				Enter the email connected to your CoLab membership. We’ll send you a secure sign-in link—no
				password needed.
			</p>

			{#if submitted}
				<div class="notice success" role="status">
					<span aria-hidden="true">✓</span>
					<div>
						<strong>Check your inbox</strong>
						<p>{message}</p>
					</div>
				</div>
			{:else}
				<form onsubmit={submit}>
					<label for="member-email">Member email</label>
					<div class="input-row">
						<input
							id="member-email"
							name="email"
							type="email"
							autocomplete="email"
							placeholder="you@example.com"
							required
							bind:value={email}
						/>
						<button type="submit" disabled={submitting}>
							{submitting ? 'Sending…' : 'Send sign-in link'}
						</button>
					</div>
					{#if message}
						<p class:error={isError} class="form-message" role={isError ? 'alert' : 'status'}>
							{message}
						</p>
					{/if}
				</form>
			{/if}
		</div>

		<p class="help">
			Need help? Email <a href="mailto:Randall@queerlective.com">Randall@queerlective.com</a>.
		</p>
	</section>

	<aside class="studio-panel" aria-label="About the CoLab">
		<div class="panel-top">
			<p>Community studio</p>
			<span>Member access</span>
		</div>
		<div class="panel-content">
			<p class="panel-kicker">Built for making together</p>
			<h2>A shared home for artists, creators, and organizers.</h2>
			<div class="pill-row" aria-label="Portal areas">
				<span>Shifts</span>
				<span>Calendar</span>
				<span>Votes</span>
				<span>Resources</span>
			</div>
		</div>
		<p class="panel-footer">Queerlective CoLab</p>
	</aside>
</main>
