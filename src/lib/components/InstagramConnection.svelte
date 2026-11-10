<script lang="ts">
	import { onMount } from 'svelte';

	type Connection = {
		instagramUsername: string;
		facebookPageName: string;
		connectedAt: string;
		updatedAt: string;
		lastVerifiedAt: string;
		lastError: string;
	};

	type Candidate = {
		selectionId: string;
		facebookPageId: string;
		facebookPageName: string;
		instagramUsername: string;
	};

	type InstagramStatus = {
		configured: boolean;
		connection: Connection | null;
		candidates: Candidate[];
	};

	function dateLabel(value: string): string {
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? ''
			: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
	}

	let configured = $state(false);
	let connection = $state<Connection | null>(null);
	let candidates = $state<Candidate[]>([]);
	let loading = $state(true);
	let selectingPageId = $state('');
	let message = $state('');
	let failed = $state(false);
	let callbackUrl = $state('');

	async function load() {
		loading = true;
		try {
			const response = await fetch('/api/social/instagram/status');
			const result = (await response.json()) as InstagramStatus & { message?: string };
			if (!response.ok)
				throw new Error(result.message || 'Could not load Instagram connection details.');
			configured = result.configured;
			connection = result.connection;
			candidates = result.candidates;
			failed = false;
		} catch (cause) {
			failed = true;
			message =
				cause instanceof Error ? cause.message : 'Could not load Instagram connection details.';
		} finally {
			loading = false;
		}
	}

	async function chooseAccount(candidate: Candidate) {
		selectingPageId = candidate.facebookPageId;
		message = '';
		try {
			const response = await fetch('/api/social/instagram/select-account', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					selectionId: candidate.selectionId,
					facebookPageId: candidate.facebookPageId
				})
			});
			const result = (await response.json()) as { message?: string };
			if (!response.ok)
				throw new Error(result.message || 'Could not connect that Instagram account.');
			message = result.message || 'Instagram account connected.';
			failed = false;
			await load();
		} catch (cause) {
			failed = true;
			message =
				cause instanceof Error ? cause.message : 'Could not connect that Instagram account.';
		} finally {
			selectingPageId = '';
		}
	}

	onMount(() => {
		callbackUrl = new URL('/api/social/instagram/callback', window.location.origin).toString();
		const outcome = new URLSearchParams(window.location.search).get('instagram');
		if (outcome === 'connected')
			message = 'Instagram is connected and ready for the publishing step.';
		if (outcome === 'choose')
			message = 'Choose the Page and Instagram account to use for publishing.';
		if (outcome === 'declined') {
			failed = true;
			message = 'Instagram authorization was cancelled. You can try again whenever you are ready.';
		}
		void load();
	});
</script>

<section
	class="social-rail-card social-instagram-connection"
	aria-labelledby="instagram-connection-title"
>
	<div class="social-instagram-heading">
		<div>
			<p class="eyebrow">Channel connection</p>
			<h2 id="instagram-connection-title">Instagram</h2>
		</div>
		<span class:connected={Boolean(connection)}>{connection ? 'Connected' : 'Not connected'}</span>
	</div>

	{#if message}
		<p class:error={failed} class="social-instagram-message" role={failed ? 'alert' : 'status'}>
			{message}
		</p>
	{/if}

	{#if loading}
		<p class="social-instagram-copy">Checking the secure publishing connection…</p>
	{:else if failed && !connection && !configured}
		<button type="button" class="secondary-action" onclick={() => void load()}>Try again</button>
	{:else if !configured}
		<div class="social-instagram-setup">
			<strong>Meta app credentials needed</strong>
			<p>
				Add the Meta app ID, app secret, and token-encryption key in Cloudflare before connecting
				the account.
			</p>
			{#if callbackUrl}
				<code>{callbackUrl}</code>
			{/if}
		</div>
	{:else if candidates.length}
		<div class="social-instagram-setup">
			<strong>Choose the account to publish from</strong>
			<div class="social-instagram-account-list">
				{#each candidates as candidate (candidate.facebookPageId)}
					<button
						type="button"
						disabled={Boolean(selectingPageId)}
						onclick={() => void chooseAccount(candidate)}
					>
						<span
							>{candidate.instagramUsername
								? `@${candidate.instagramUsername}`
								: 'Instagram account'}</span
						>
						<small>{candidate.facebookPageName}</small>
						{#if selectingPageId === candidate.facebookPageId}<em>Connecting…</em>{/if}
					</button>
				{/each}
			</div>
		</div>
	{:else if connection}
		<div class="social-instagram-connected">
			<strong
				>{connection.instagramUsername
					? `@${connection.instagramUsername}`
					: 'Instagram account'}</strong
			>
			<p>
				{connection.facebookPageName || 'Linked Facebook Page'} · connected {dateLabel(
					connection.connectedAt
				)}
			</p>
			{#if connection.lastError}<p class="social-instagram-warning">{connection.lastError}</p>{/if}
			<a class="secondary-action" href="/api/social/instagram/connect"
				>Reconnect or change account</a
			>
		</div>
	{:else}
		<div class="social-instagram-setup">
			<strong>Ready to connect</strong>
			<p>
				Use a Meta administrator login for the Facebook Page linked to your Instagram professional
				account.
			</p>
			<a class="social-instagram-connect" href="/api/social/instagram/connect">Connect Instagram</a>
		</div>
	{/if}
</section>
