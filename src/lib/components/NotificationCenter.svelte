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
		canVote
	}: {
		shifts: Shift[];
		projects: UpcomingProjectAssignment[];
		availableShifts: Shift[];
		canVote: boolean;
	} = $props();

	let open = $state(false);
	let pendingVotes = $state<EligibleVote[]>([]);
	let votesLoading = $state(false);

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

	function followNotice() {
		open = false;
	}

	onMount(loadVotes);
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (open = false)} />

<div class="notification-center">
	<button
		class="notification-trigger"
		type="button"
		aria-label={`Open notifications${notices.length ? `, ${notices.length} items` : ''}`}
		aria-expanded={open}
		aria-controls="notification-panel"
		onclick={() => (open = !open)}
	>
		<span aria-hidden="true">●</span>
		{#if notices.length}<strong>{notices.length > 9 ? '9+' : notices.length}</strong>{/if}
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

			{#if votesLoading && notices.length === 0}
				<p class="notification-empty" role="status">Checking for updates…</p>
			{:else if notices.length}
				<div class="notification-list">
					{#each notices as notice (notice.id)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={notice.href} onclick={followNotice}>
							<span class={`notification-icon notice-${notice.kind}`} aria-hidden="true"></span>
							<span>
								<strong>{notice.title}</strong>
								<small>{notice.detail}</small>
							</span>
							<b>{notice.action}</b>
						</a>
					{/each}
				</div>
			{:else}
				<p class="notification-empty">You’re all caught up. Nothing needs your attention.</p>
			{/if}
		</div>
	{/if}
</div>
