<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import type { Vote } from '$lib/types/domain';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	type EligibleVote = Vote & {
		hasVoted: boolean;
		recordedResponse: string;
		recordedComment: string;
		submissions: VoteSubmission[];
	};
	type VoteSubmission = {
		id: string;
		memberId: string;
		memberName: string;
		response: string;
		comment: string;
	};
	const objection = "Don't Approve(With Comment)";
	let { isAdmin = false, readOnly = false }: { isAdmin?: boolean; readOnly?: boolean } = $props();

	let votes = $state<EligibleVote[]>([]);
	let responses = $state<Record<string, string>>({});
	let comments = $state<Record<string, string>>({});
	let submitting = $state('');
	let loading = $state(true);
	let message = $state('');
	let failed = $state(false);
	let showAllVotes = $state(false);
	let notifyingDiscord = $state(false);
	const expandedVotedVotes = new SvelteSet<string>();
	const visibleVotes = $derived(showAllVotes ? votes : votes.slice(0, 4));

	function toggleVotedDetails(voteId: string) {
		if (expandedVotedVotes.has(voteId)) expandedVotedVotes.delete(voteId);
		else expandedVotedVotes.add(voteId);
	}

	async function notifyDiscord() {
		notifyingDiscord = true;
		message = '';
		try {
			const response = await fetch('/api/admin/votes/notify', { method: 'POST' });
			const result = (await response.json()) as {
				posted?: number;
				failed?: number;
				message?: string;
			};
			if (!response.ok) throw new Error(result.message || 'Could not send vote notifications.');
			failed = Boolean(result.failed);
			message = result.message || 'Discord notifications checked.';
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not send vote notifications.';
		} finally {
			notifyingDiscord = false;
		}
	}

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
			const result = (await response.json()) as {
				response?: string;
				message?: string;
				submission?: VoteSubmission;
			};
			if (!response.ok) throw new Error(result.message || 'Could not record your vote.');
			votes = votes.map((candidate) =>
				candidate.id === vote.id
					? {
							...candidate,
							hasVoted: true,
							recordedResponse: result.response || responseValue,
							recordedComment: comments[vote.id] ?? '',
							submissions: result.submission
								? [...candidate.submissions, result.submission]
								: candidate.submissions
						}
					: candidate
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
	{#if isAdmin}
		<div class="vote-admin-actions">
			<button type="button" onclick={notifyDiscord} disabled={notifyingDiscord}>
				{notifyingDiscord ? 'Sending…' : 'Send new motions to Discord'}
			</button>
			<small>Previously announced motions will not be posted again.</small>
		</div>
	{/if}

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
		<ContentState kind="error" title="Votes unavailable" {message} onretry={load} />
	{:else if votes.length === 0}
		<ContentState
			kind="empty"
			title="No open motions"
			message="There is nothing to vote on right now."
		/>
	{:else}
		<div class="vote-list">
			{#each visibleVotes as vote (vote.id)}
				{@const detailsExpanded = !vote.hasVoted || expandedVotedVotes.has(vote.id)}
				<article class:voted={vote.hasVoted} class:vote-collapsed={!detailsExpanded}>
					<div class="vote-meta">
						<span>{vote.type}</span>
						{#if vote.deadline}<time datetime={vote.deadline}>Consent deadline {vote.deadline}</time
							>{/if}
					</div>
					<h3>
						{#if vote.titleUrl}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a class="vote-title-link" href={vote.titleUrl}>{vote.question}</a>
						{:else}
							{vote.question}
						{/if}
					</h3>
					{#if vote.hasVoted}
						<div class="recorded-vote recorded-vote-heading">
							<span class="recorded-pill">Your vote: {vote.recordedResponse || 'Recorded'}</span>
							<button
								type="button"
								class="vote-details-toggle"
								onclick={() => toggleVotedDetails(vote.id)}
								aria-expanded={detailsExpanded}
							>
								{detailsExpanded ? 'Hide vote details' : 'Show vote details'}
							</button>
						</div>
					{/if}
					{#if detailsExpanded}
						{#if vote.details}<p>{vote.details}</p>{/if}
						{#if vote.linkUrl}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a class="vote-resource-link" href={vote.linkUrl} target="_blank" rel="noreferrer">
								{vote.linkLabel || 'View related link'} ↗
							</a>
						{/if}
						{#if vote.hasVoted && vote.recordedComment}
							<p class="recorded-comment">Your comment: {vote.recordedComment}</p>
						{/if}
					{/if}
					{#if !vote.hasVoted}
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
								{submitting === vote.id ? 'Recording…' : readOnly ? 'View only' : 'Vote now'}
							</button>
						</div>
					{/if}
					{#if detailsExpanded}
						<div class="vote-summary">
							<h4>Submitted votes <span>{vote.submissions.length}</span></h4>
							{#if vote.submissions.length}
								<ul>
									{#each vote.submissions as submission (submission.id)}
										<li>
											<div>
												<strong>{submission.memberName}</strong>
												<span>{submission.response || 'Recorded'}</span>
											</div>
											{#if submission.comment}<p>{submission.comment}</p>{/if}
										</li>
									{/each}
								</ul>
							{:else}
								<p>No votes submitted yet.</p>
							{/if}
						</div>
					{/if}
				</article>
			{/each}
		</div>
		{#if votes.length > 4}
			<button class="show-more-button" type="button" onclick={() => (showAllVotes = !showAllVotes)}>
				{showAllVotes ? 'Show fewer motions' : `Show ${votes.length - 4} more motions`}
			</button>
		{/if}
	{/if}
</section>
