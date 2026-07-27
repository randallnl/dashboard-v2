<script lang="ts">
	import type { Shift, UpcomingProjectAssignment, Vote } from '$lib/types/domain';
	import { onMount } from 'svelte';

	type EligibleVote = Vote & { hasVoted: boolean };
	type Notice = {
		id: string;
		kind: 'vote' | 'shift' | 'project' | 'opportunity';
		title: string;
		detail: string;
		href: string;
		action: string;
	};

	let {
		shifts,
		projects,
		availableShifts,
		canVote,
		readOnly = false
	}: {
		shifts: Shift[];
		projects: UpcomingProjectAssignment[];
		availableShifts: Shift[];
		canVote: boolean;
		readOnly?: boolean;
	} = $props();

	let open = $state(false);
	let pendingVotes = $state<EligibleVote[]>([]);
	let votesLoading = $state(false);
	let readsLoading = $state(true);
	let readKeys = $state<Set<string>>(new Set());
	let markingRead = $state('');
	let readMessage = $state('');

	const notices = $derived.by(() => {
		const items: Notice[] = [];
		for (const vote of pendingVotes.slice(0, 3)) {
			items.push({
				id: `vote:${vote.id}`,
				kind: 'vote',
				title: vote.question,
				detail: vote.deadline
					? `Respond by ${dateLabel(vote.deadline)}`
					: 'Your response is needed',
				href: '#votes',
				action: 'Vote now'
			});
		}
		for (const shift of shifts.slice(0, 3)) {
			items.push({
				id: `shift:${shift.id}`,
				kind: 'shift',
				title: shift.title,
				detail: `${dateLabel(shift.dateValue)}${shift.timeLabel ? ` · ${shift.timeLabel}` : ''}`,
				href: '#calendar',
				action: 'View shift'
			});
		}
		for (const assignment of projects.slice(0, 3)) {
			const role = assignment.roles.includes('Host') ? 'You’re hosting' : 'You’re attending';
			items.push({
				id: `${assignment.record.source}:${assignment.record.id}`,
				kind: 'project',
				title: assignment.record.title,
				detail: `${role} · ${dateLabel(assignment.record.dateValue)}`,
				href: `/items/${assignment.record.source}/${assignment.record.id}`,
				action: assignment.roles.includes('Host') ? 'Manage' : 'View'
			});
		}
		if (availableShifts[0]) {
			items.push({
				id: `opportunity:${availableShifts[0].id}`,
				kind: 'opportunity',
				title: `${availableShifts.length} open shift${availableShifts.length === 1 ? '' : 's'}`,
				detail: `Next opening ${dateLabel(availableShifts[0].dateValue)}`,
				href: '#available-shifts-title',
				action: 'Sign up'
			});
		}
		return items;
	});
	const unreadCount = $derived(notices.filter((notice) => !readKeys.has(notice.id)).length);

	function dateLabel(value: string): string {
		if (!value) return 'Date unavailable';
		const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00Z`);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					month: 'short',
					day: 'numeric',
					timeZone: 'UTC'
				}).format(parsed);
	}

	async function loadVotes() {
		if (!canVote) return;
		votesLoading = true;
		try {
			const response = await fetch('/api/votes');
			const result = (await response.json()) as { votes?: EligibleVote[] };
			if (response.ok) pendingVotes = (result.votes ?? []).filter((vote) => !vote.hasVoted);
		} finally {
			votesLoading = false;
		}
	}

	async function loadReadKeys() {
		try {
			const response = await fetch('/api/notifications/read');
			const result = (await response.json()) as { readKeys?: string[] };
			if (response.ok) readKeys = new Set(result.readKeys ?? []);
		} finally {
			readsLoading = false;
		}
	}

	async function markRead(notice: Notice) {
		if (readOnly || readKeys.has(notice.id)) return;
		markingRead = notice.id;
		readMessage = '';
		try {
			const response = await fetch('/api/notifications/read', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ key: notice.id })
			});
			if (!response.ok) throw new Error('Could not mark this item as read.');
			readKeys = new Set([...readKeys, notice.id]);
		} catch (cause) {
			readMessage = cause instanceof Error ? cause.message : 'Could not mark this item as read.';
		} finally {
			markingRead = '';
		}
	}

	function followNotice() {
		open = false;
	}

	onMount(() => {
		void Promise.all([loadVotes(), loadReadKeys()]);
	});
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (open = false)} />

<div class="notification-center">
	<button
		class="notification-trigger"
		type="button"
		aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
		aria-expanded={open}
		aria-controls="notification-panel"
		onclick={() => (open = !open)}
	>
		<span aria-hidden="true">●</span>
		{#if unreadCount}<strong>{unreadCount > 9 ? '9+' : unreadCount}</strong>{/if}
	</button>

	{#if open}
		<div class="notification-panel" id="notification-panel">
			<div class="notification-heading">
				<div>
					<p class="eyebrow">Action center</p>
					<h2>Needs your attention</h2>
				</div>
				<button type="button" class="text-button" onclick={() => (open = false)}>Close</button>
			</div>
			{#if readMessage}<p class="notification-message" role="alert">{readMessage}</p>{/if}

			{#if (votesLoading || readsLoading) && notices.length === 0}
				<p class="notification-empty" role="status">Checking for updates…</p>
			{:else if notices.length}
				<div class="notification-list">
					{#each notices as notice (notice.id)}
						<article class:read={readKeys.has(notice.id)}>
							<span class={`notification-icon notice-${notice.kind}`} aria-hidden="true"></span>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={notice.href} onclick={followNotice}>
								<strong>{notice.title}</strong>
								<small>{notice.detail}</small>
								<b>{notice.action}</b>
							</a>
							<button
								type="button"
								onclick={() => markRead(notice)}
								disabled={readOnly || markingRead === notice.id || readKeys.has(notice.id)}
							>
								{readKeys.has(notice.id)
									? 'Read'
									: markingRead === notice.id
										? 'Saving…'
										: 'Mark as read'}
							</button>
						</article>
					{/each}
				</div>
			{:else}
				<p class="notification-empty">You’re all caught up. Nothing needs your attention.</p>
			{/if}
		</div>
	{/if}
</div>
