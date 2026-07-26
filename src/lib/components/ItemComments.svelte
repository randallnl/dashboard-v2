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
	let body = $state('');
	let loading = $state(true);
	let submitting = $state(false);
	let message = $state('');
	let commentForm = $state<HTMLFormElement>();
	let showAllComments = $state(false);
	const visibleComments = $derived(showAllComments ? comments : comments.slice(-5));
	const memberTaggerMarkup = `
		<div class="member-tagger" x-data="memberTagger()" x-on:clear-member-tags.window="selected = []">
			<label>
				<span>Tag members (optional)</span>
				<input
					type="search"
					name="q"
					placeholder="Type a member’s name"
					hx-get="/api/members/mentions"
					hx-trigger="input changed delay:250ms"
					hx-target="next .member-search-results"
				/>
			</label>
			<div class="member-search-results" aria-live="polite"></div>
			<div class="member-tag-chips">
				<template x-for="member in selected" x-bind:key="member.id">
					<span>
						<span x-text="'@' + member.label"></span>
						<button
							type="button"
							x-on:click="removeMember(member.id)"
							x-bind:aria-label="'Remove ' + member.label"
						>×</button>
						<input type="hidden" name="mentionIds" x-bind:value="member.id" />
					</span>
				</template>
			</div>
		</div>
	`;

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
		const mentionIds = commentForm
			? new FormData(commentForm).getAll('mentionIds').map(String)
			: [];
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
			window.dispatchEvent(new CustomEvent('clear-member-tags'));
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
			bind:this={commentForm}
			onsubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<!-- Static, application-owned markup lets Alpine and HTMX own this small enhancement island. -->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html memberTaggerMarkup}
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
