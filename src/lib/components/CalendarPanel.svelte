<script lang="ts">
	import { datesInRange, monthBounds } from '$lib/calendar/month';
	import ContentState from '$lib/components/ContentState.svelte';
	import type { CalendarEvent } from '$lib/types/domain';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	let { readOnly = false }: { readOnly?: boolean } = $props();
	const today = new Date().toISOString().slice(0, 10);
	let month = $state(today.slice(0, 7));
	let events = $state<CalendarEvent[]>([]);
	let loading = $state(true);
	let message = $state('');
	let selected = $state<CalendarEvent | null>(null);
	let signingUp = $state(false);
	let signupMessage = $state('');

	const bounds = $derived(monthBounds(month)!);
	const monthDate = $derived(new Date(`${month}-01T12:00:00Z`));
	const title = $derived(
		new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
			monthDate
		)
	);
	const days = $derived.by(() => {
		const firstWeekday = new Date(`${bounds.from}T12:00:00Z`).getUTCDay();
		const count = Number(bounds.through.slice(-2));
		return [
			...Array.from({ length: firstWeekday }, () => ''),
			...Array.from(
				{ length: count },
				(_, index) => `${month}-${String(index + 1).padStart(2, '0')}`
			)
		];
	});
	const eventsByDate = $derived.by(() => {
		const grouped = new SvelteMap<string, CalendarEvent[]>();
		for (const event of events) {
			for (const date of datesInRange(event.startDate, event.endDate)) {
				if (date.startsWith(month)) grouped.set(date, [...(grouped.get(date) ?? []), event]);
			}
		}
		return grouped;
	});

	function safeUrl(value: string): string {
		try {
			const parsed = new URL(value);
			return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
		} catch {
			return '';
		}
	}

	async function load() {
		loading = true;
		message = '';
		try {
			const response = await fetch(`/api/calendar?month=${month}`);
			const result = (await response.json()) as { events?: CalendarEvent[]; message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not load the calendar.');
			events = result.events ?? [];
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not load the calendar.';
		} finally {
			loading = false;
		}
	}

	async function moveMonth(offset: number) {
		const [year, monthNumber] = month.split('-').map(Number);
		const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1, 12));
		month = next.toISOString().slice(0, 7);
		await load();
	}

	function openDetails(event: CalendarEvent) {
		selected = event;
		signupMessage = '';
	}

	async function volunteer() {
		if (!selected || selected.source === 'shift') return;
		signingUp = true;
		signupMessage = '';
		try {
			const response = await fetch('/api/events/volunteer', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ source: selected.source, eventId: selected.id })
			});
			const result = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not record your signup.');
			selected.isVolunteering = true;
			events = events.map((event) =>
				event.source === selected?.source && event.id === selected?.id
					? { ...event, isVolunteering: true }
					: event
			);
			signupMessage = result.message || 'Volunteer signup recorded.';
		} catch (cause) {
			signupMessage = cause instanceof Error ? cause.message : 'Could not record your signup.';
		} finally {
			signingUp = false;
		}
	}

	onMount(load);
</script>

<section class="calendar-panel" id="calendar" aria-labelledby="calendar-title">
	<div class="calendar-heading">
		<div>
			<p class="eyebrow">Studio schedule</p>
			<h2 id="calendar-title">{title}</h2>
		</div>
		<div class="calendar-controls">
			<button
				type="button"
				class="secondary-button"
				onclick={() => moveMonth(-1)}
				aria-label="Previous month">←</button
			>
			<button
				type="button"
				class="secondary-button"
				onclick={() => moveMonth(1)}
				aria-label="Next month">→</button
			>
		</div>
	</div>

	{#if loading}
		<ContentState kind="loading" title="Loading calendar" message="Gathering shifts and events." />
	{:else if message}
		<ContentState kind="error" title="Calendar unavailable" {message} />
	{:else}
		<div class="calendar-grid" aria-label={title}>
			{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as weekday (weekday)}
				<div class="weekday">{weekday}</div>
			{/each}
			{#each days as date, index (`${date}-${index}`)}
				{#if date}
					<div class:today={date === today} class="calendar-day">
						<time datetime={date}>{Number(date.slice(-2))}</time>
						<div class="day-events">
							{#each eventsByDate.get(date) ?? [] as event (`${event.source}-${event.id}`)}
								<button
									type="button"
									onclick={() => openDetails(event)}
									class={`calendar-event event-${event.source}`}
									aria-label={`View details for ${event.title}`}
								>
									<strong>{event.title}</strong><span>{event.status}</span>
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<div class="calendar-day outside" aria-hidden="true"></div>
				{/if}
			{/each}
		</div>

		<div class="agenda-list" aria-label={`${title} agenda`}>
			{#if events.length === 0}
				<ContentState
					kind="empty"
					title="No calendar entries"
					message="Nothing is scheduled this month."
				/>
			{:else}
				{#each events as event (`agenda-${event.source}-${event.id}`)}
					<button type="button" class="agenda-event" onclick={() => openDetails(event)}>
						<time datetime={event.startDate}>{event.startDate}</time>
						<div><strong>{event.title}</strong><span>{event.location || event.status}</span></div>
						<span class={`source-pill source-${event.source}`}>{event.source}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}

	{#if selected}
		<div class="event-dialog-backdrop" role="presentation">
			<div
				class="event-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="event-dialog-title"
			>
				<div class="card-heading">
					<span class={`source-pill source-${selected.source}`}>{selected.source}</span>
					<button type="button" class="text-button" onclick={() => (selected = null)}>Close</button>
				</div>
				<h3 id="event-dialog-title">{selected.title}</h3>
				<dl>
					<div>
						<dt>Date</dt>
						<dd>
							{selected.startDate}{selected.endDate !== selected.startDate
								? ` – ${selected.endDate}`
								: ''}
						</dd>
					</div>
					{#if selected.location}<div>
							<dt>Location</dt>
							<dd>{selected.location}</dd>
						</div>{/if}
					{#if selected.status}<div>
							<dt>Status</dt>
							<dd>{selected.status}</dd>
						</div>{/if}
				</dl>
				{#if selected.details}<p>{selected.details}</p>{/if}
				<div class="event-dialog-actions">
					{#if selected.canVolunteer}
						<button
							type="button"
							onclick={volunteer}
							disabled={signingUp || selected.isVolunteering || readOnly}
						>
							{selected.isVolunteering
								? 'Signed up to volunteer'
								: readOnly
									? 'View only'
									: signingUp
										? 'Signing up…'
										: 'Volunteer for this'}
						</button>
					{/if}
					{#if safeUrl(selected.url)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={safeUrl(selected.url)} target="_blank" rel="noreferrer"
							>Registration/details ↗</a
						>
					{/if}
				</div>
				{#if signupMessage}<p role="status" class="calendar-message">{signupMessage}</p>{/if}
			</div>
		</div>
	{/if}
</section>
