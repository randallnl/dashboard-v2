<script lang="ts">
	import type { ProjectEventComment, ProjectEventSource } from '$lib/types/domain';
	import { onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	let {
		source,
		eventId,
		readOnly = false
	}: { source: ProjectEventSource; eventId: string; readOnly?: boolean } = $props();

	let comments = $state<ProjectEventComment[]>([]);
	let members = $state<Array<{ id: string; label: string }>>([]);
	let body = $state('');
	let mentionIds = $state<string[]>([]);
	let loading = $state(true);
	let submitting = $state(false);
	let message = $state('');
	let showAllComments = $state(false);
	const visibleComments = $derived(showAllComments ? comments : comments.slice(-5));

	function dateLabel(value: string): string {
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					dateStyle: 'medium',
					timeStyle: 'short'
				}).format(date);
	}

	async function load() {
		loading = true;
		const params = new SvelteURLSearchParams({ source, eventId });
		try {
			const requests = [fetch(`/api/events/comments?${params}`)];
			if (!readOnly) requests.push(fetch('/api/members/mentions'));
			const responses = await Promise.all(requests);
			const commentResult = (await responses[0].json()) as {
				comments?: ProjectEventComment[];
				message?: string;
			};
			if (!responses[0].ok) throw new Error(commentResult.message || 'Could not load comments.');
			comments = commentResult.comments ?? [];
			if (responses[1]) {
				const memberResult = (await responses[1].json()) as {
					members?: Array<{ id: string; label: string }>;
				};
				if (responses[1].ok) members = memberResult.members ?? [];
			}
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not load comments.';
		} finally {
			loading = false;
		}
	}

	async function submit() {
		if (!body.trim()) return;
		submitting = true;
		message = '';
		try {
			const response = await fetch('/api/events/comments', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ source, eventId, body, mentionIds })
			});
			const result = (await response.json()) as {
				comment?: ProjectEventComment;
				message?: string;
			};
			if (!response.ok || !result.comment) {
				throw new Error(result.message || 'Could not post comment.');
			}
			comments = [...comments, result.comment];
			body = '';
			mentionIds = [];
			message = 'Comment posted.';
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not post comment.';
		} finally {
			submitting = false;
		}
	}

	onMount(load);
</script>

<section class="item-comments" aria-labelledby={`comments-${source}-${eventId}`}>
	<h4 id={`comments-${source}-${eventId}`}>Comments</h4>
	{#if loading}
		<p>Loading comments…</p>
	{:else if comments.length}
		<ul>
			{#each visibleComments as comment (comment.id)}
				<li>
					<div>
						<strong>{comment.authorLabel}</strong>
						<time datetime={comment.createdAt}>{dateLabel(comment.createdAt)}</time>
					</div>
					{#if comment.mentionLabels.length}
						<p class="comment-mentions">
							{comment.mentionLabels.map((label) => `@${label}`).join(' ')}
						</p>
					{/if}
					<p>{comment.body}</p>
				</li>
			{/each}
		</ul>
		{#if comments.length > 5}
			<button
				class="show-more-button"
				type="button"
				onclick={() => (showAllComments = !showAllComments)}
			>
				{showAllComments ? 'Show fewer comments' : `Show ${comments.length - 5} earlier comments`}
			</button>
		{/if}
	{:else}
		<p>No comments yet.</p>
	{/if}

	{#if !readOnly}
		<form
			onsubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<label>
				<span>Tag members (optional)</span>
				<select multiple bind:value={mentionIds} size={Math.min(5, Math.max(2, members.length))}>
					{#each members as member (member.id)}
						<option value={member.id}>@{member.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Add a comment</span>
				<textarea bind:value={body} maxlength="2000" rows="3" required></textarea>
			</label>
			<button type="submit" disabled={submitting || !body.trim()}>
				{submitting ? 'Posting…' : 'Post comment'}
			</button>
		</form>
	{/if}
	{#if message}<p role="status" class="calendar-message">{message}</p>{/if}
</section>
