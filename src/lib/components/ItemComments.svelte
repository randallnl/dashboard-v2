<script lang="ts">
	import type { ProjectEventComment, ProjectEventSource } from '$lib/types/domain';
	import { onMount, tick } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	let {
		source,
		eventId,
		readOnly = false
	}: { source: ProjectEventSource; eventId: string; readOnly?: boolean } = $props();

	let comments = $state<ProjectEventComment[]>([]);
	let body = $state('');
	let loading = $state(true);
	let submitting = $state(false);
	let message = $state('');
	let showAllComments = $state(false);
	let suggestions = $state<Array<{ id: string; label: string }>>([]);
	let selectedMentions = $state<Array<{ id: string; label: string }>>([]);
	let commentTextarea = $state<HTMLTextAreaElement>();
	let suggestionRequest = 0;
	let suggestionTimer: ReturnType<typeof setTimeout> | undefined;
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
			const responses = await Promise.all([fetch(`/api/events/comments?${params}`)]);
			const commentResult = (await responses[0].json()) as {
				comments?: ProjectEventComment[];
				message?: string;
			};
			if (!responses[0].ok) throw new Error(commentResult.message || 'Could not load comments.');
			comments = commentResult.comments ?? [];
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
				body: JSON.stringify({
					source,
					eventId,
					body,
					mentionIds: selectedMentions.map((member) => member.id)
				})
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
			selectedMentions = [];
			suggestions = [];
			message = 'Comment posted.';
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not post comment.';
		} finally {
			submitting = false;
		}
	}

	function mentionQuery(value: string, caret: number): string {
		const match = value.slice(0, caret).match(/(?:^|\s)@([\p{L}\p{N}.' -]{1,40})$/u);
		return match?.[1]?.trim() ?? '';
	}

	function updateSuggestions() {
		selectedMentions = selectedMentions.filter((member) => body.includes(`@${member.label}`));
		const query = mentionQuery(body, commentTextarea?.selectionStart ?? body.length);
		const requestId = ++suggestionRequest;
		if (!query) {
			suggestions = [];
			return;
		}
		if (suggestionTimer) clearTimeout(suggestionTimer);
		suggestionTimer = setTimeout(async () => {
			const response = await fetch(`/api/members/mentions?q=${encodeURIComponent(query)}`);
			if (!response.ok || requestId !== suggestionRequest) return;
			const result = (await response.json()) as {
				members?: Array<{ id: string; label: string }>;
			};
			suggestions = result.members ?? [];
		}, 180);
	}

	async function selectMention(member: { id: string; label: string }) {
		const caret = commentTextarea?.selectionStart ?? body.length;
		const before = body.slice(0, caret);
		const match = before.match(/(?:^|\s)@([\p{L}\p{N}.' -]{1,40})$/u);
		if (!match || match.index === undefined) return;
		const prefix = before.slice(0, match.index);
		const leadingSpace = match[0].startsWith(' ') ? ' ' : '';
		const inserted = `${leadingSpace}@${member.label} `;
		body = `${prefix}${inserted}${body.slice(caret)}`;
		if (!selectedMentions.some((candidate) => candidate.id === member.id)) {
			selectedMentions = [...selectedMentions, member];
		}
		suggestions = [];
		await tick();
		const nextCaret = prefix.length + inserted.length;
		commentTextarea?.focus();
		commentTextarea?.setSelectionRange(nextCaret, nextCaret);
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
			<label class="inline-mention-composer">
				<span>Add a comment</span>
				<textarea
					bind:this={commentTextarea}
					bind:value={body}
					oninput={updateSuggestions}
					onkeyup={updateSuggestions}
					maxlength="2000"
					rows="3"
					placeholder="Write a comment. Type @ and a member’s name to tag them."
					aria-autocomplete="list"
					aria-controls={`mention-suggestions-${source}-${eventId}`}
					required></textarea>
				{#if suggestions.length}
					<div
						class="inline-mention-suggestions"
						id={`mention-suggestions-${source}-${eventId}`}
						role="listbox"
						aria-label="Matching members"
					>
						{#each suggestions as member (member.id)}
							<button
								type="button"
								role="option"
								aria-selected="false"
								onclick={() => selectMention(member)}
							>
								@{member.label}
							</button>
						{/each}
					</div>
				{/if}
			</label>
			<button type="submit" disabled={submitting || !body.trim()}>
				{submitting ? 'Posting…' : 'Post comment'}
			</button>
		</form>
	{/if}
	{#if message}<p role="status" class="calendar-message">{message}</p>{/if}
</section>
