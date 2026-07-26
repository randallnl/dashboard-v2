<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import type { Vote } from '$lib/types/domain';
	import { onMount } from 'svelte';

	type EligibleVote = Vote & { hasVoted: boolean };
	const objection = "Don't Approve(With Comment)";
	let { readOnly = false }: { readOnly?: boolean } = $props();

	let votes = $state<EligibleVote[]>([]);
	let responses = $state<Record<string, string>>({});
	let comments = $state<Record<string, string>>({});
	let submitting = $state('');
	let loading = $state(true);
	let message = $state('');
	let failed = $state(false);

	async function load() {
		loading = true;
		try {
			const response = await fetch('/api/votes');
			const result = (await response.json()) as { votes?: EligibleVote[]; message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not load votes.');
			votes = result.votes ?? [];
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not load votes.';
		} finally {
			loading = false;
		}
	}

	async function submit(vote: EligibleVote) {
		const responseValue = responses[vote.id] ?? '';
		if (!responseValue) {
			failed = true;
			message = 'Choose a response before submitting.';
			return;
		}
		submitting = vote.id;
		message = '';
		try {
			const response = await fetch('/api/votes/submit', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					voteId: vote.id,
					response: responseValue,
					comment: comments[vote.id] ?? ''
				})
			});
			const result = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not record your vote.');
			votes = votes.map((candidate) =>
				candidate.id === vote.id ? { ...candidate, hasVoted: true } : candidate
			);
			failed = false;
			message = `Your response to “${vote.question}” was recorded.`;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not record your vote.';
		} finally {
			submitting = '';
		}
	}

	onMount(load);
</script>

<section class="vote-panel" id="votes" aria-labelledby="votes-title">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Community decisions</p>
			<h2 id="votes-title">Open motions</h2>
		</div>
		<p>Each member may respond once. Objections require a comment.</p>
	</div>

	{#if message}
		<p class="vote-message" class:error={failed} role={failed ? 'alert' : 'status'}>{message}</p>
	{/if}
	{#if readOnly}
		<p class="vote-message">Voting is disabled in administrator member view.</p>
	{/if}

	{#if loading}
		<ContentState
			kind="loading"
			title="Loading motions"
			message="Checking current community votes."
		/>
	{:else if failed && votes.length === 0}
		<ContentState kind="error" title="Votes unavailable" {message} />
	{:else if votes.length === 0}
		<ContentState
			kind="empty"
			title="No open motions"
			message="There is nothing to vote on right now."
		/>
	{:else}
		<div class="vote-list">
			{#each votes as vote (vote.id)}
				<article class:voted={vote.hasVoted}>
					<div class="vote-meta">
						<span>{vote.type}</span>
						{#if vote.deadline}<time datetime={vote.deadline}>Consent deadline {vote.deadline}</time
							>{/if}
					</div>
					<h3>{vote.question}</h3>
					{#if vote.details}<p>{vote.details}</p>{/if}
					{#if vote.hasVoted}
						<span class="recorded-pill">Response recorded</span>
					{:else}
						<div class="vote-form">
							<label>
								<span>Your response</span>
								<select bind:value={responses[vote.id]} disabled={readOnly}>
									<option value="">Choose…</option>
									<option value="Approve">Approve</option>
									<option value={objection}>Don’t approve (with comment)</option>
									<option value="Abstain">Abstain</option>
								</select>
							</label>
							{#if responses[vote.id] === objection}
								<label>
									<span>Required comment</span>
									<textarea bind:value={comments[vote.id]} rows="3" required></textarea>
								</label>
							{/if}
							<button
								type="button"
								onclick={() => submit(vote)}
								disabled={Boolean(submitting) || readOnly}
							>
								{submitting === vote.id ? 'Recording…' : readOnly ? 'View only' : 'Submit response'}
							</button>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>
