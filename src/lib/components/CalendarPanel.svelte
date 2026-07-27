<script lang="ts">
	import { datesInRange, monthBounds } from '$lib/calendar/month';
	import ContentState from '$lib/components/ContentState.svelte';
	import ItemComments from '$lib/components/ItemComments.svelte';
	import MemberPredictivePicker from '$lib/components/MemberPredictivePicker.svelte';
	import type { CalendarEvent } from '$lib/types/domain';
	import { onMount } from 'svelte';
	import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';

	let { isAdmin = false, readOnly = false }: { isAdmin?: boolean; readOnly?: boolean } = $props();
	const today = new Date().toISOString().slice(0, 10);
	let month = $state(today.slice(0, 7));
	let view = $state<'month' | 'week' | 'agenda'>('month');
	let focusDate = $state(today);
	let myScheduleOnly = $state(false);
	let showShifts = $state(true);
	let showProjects = $state(true);
	let showEvents = $state(true);
	let showDeadlines = $state(true);
	let events = $state<CalendarEvent[]>([]);
	let loading = $state(true);
	let message = $state('');
	let selected = $state<CalendarEvent | null>(null);
	let signingUp = $state(false);
	let signupMessage = $state('');
	let shiftHostSelection = $state<{ id: string; label: string } | null>(null);
	let shiftPickerKey = $state(0);
	let subscriptionUrl = $state('');
	let subscriptionLoading = $state(false);
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';

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
	const visibleEvents = $derived(
		events.filter((event) => {
			if (myScheduleOnly && !event.isMine) return false;
			if (event.isDeadline) return showDeadlines;
			if (event.source === 'shift') return showShifts;
			if (event.source === 'community') return showEvents;
			return showProjects;
		})
	);
	const weekDates = $derived.by(() => {
		const date = new SvelteDate(`${focusDate}T12:00:00Z`);
		date.setUTCDate(date.getUTCDate() - date.getUTCDay());
		return Array.from({ length: 7 }, (_, index) => {
			const day = new SvelteDate(date);
			day.setUTCDate(date.getUTCDate() + index);
			return day.toISOString().slice(0, 10);
		});
	});
	const viewTitle = $derived(
		view === 'week' ? `${dateLabel(weekDates[0])} – ${dateLabel(weekDates[6])}` : title
	);
	const eventsByDate = $derived.by(() => {
		const grouped = new SvelteMap<string, CalendarEvent[]>();
		for (const event of visibleEvents) {
			for (const date of datesInRange(event.startDate, event.endDate)) {
				grouped.set(date, [...(grouped.get(date) ?? []), event]);
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

	function dateLabel(value: string): string {
		const parsed = new Date(`${value}T12:00:00Z`);
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		}).format(parsed);
	}

	function additionalAttachments(event: CalendarEvent) {
		return event.attachments.filter((attachment) => attachment.url !== event.imageUrl);
	}

	async function load() {
		loading = true;
		message = '';
		try {
			const requestedMonths = new SvelteSet([month]);
			if (view === 'week') {
				for (const date of weekDates) requestedMonths.add(date.slice(0, 7));
			}
			const responses = await Promise.all(
				[...requestedMonths].map((requestedMonth) => fetch(`/api/calendar?month=${requestedMonth}`))
			);
			const results = await Promise.all(
				responses.map(
					(response) => response.json() as Promise<{ events?: CalendarEvent[]; message?: string }>
				)
			);
			const failedIndex = responses.findIndex((response) => !response.ok);
			if (failedIndex >= 0) {
				throw new Error(results[failedIndex].message || 'Could not load the calendar.');
			}
			events = [
				...new Map(
					results
						.flatMap((result) => result.events ?? [])
						.map((event) => [`${event.source}:${event.id}`, event])
				).values()
			];
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not load the calendar.';
		} finally {
			loading = false;
		}
	}

	async function changeView(nextView: typeof view) {
		view = nextView;
		if (nextView === 'week') await load();
	}

	async function moveMonth(offset: number) {
		if (view === 'week') {
			const next = new SvelteDate(`${focusDate}T12:00:00Z`);
			next.setUTCDate(next.getUTCDate() + offset * 7);
			focusDate = next.toISOString().slice(0, 10);
			const nextMonth = focusDate.slice(0, 7);
			if (nextMonth !== month) {
				month = nextMonth;
				await load();
			}
			return;
		}
		const [year, monthNumber] = month.split('-').map(Number);
		const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1, 12));
		month = next.toISOString().slice(0, 7);
		focusDate = `${month}-01`;
		await load();
	}

	function openDetails(event: CalendarEvent) {
		selected = event;
		signupMessage = '';
	}

	function compactDate(value: string): string {
		return value.replaceAll('-', '');
	}

	function exclusiveEndDate(event: CalendarEvent): string {
		const date = new SvelteDate(`${event.endDate || event.startDate}T12:00:00Z`);
		date.setUTCDate(date.getUTCDate() + 1);
		return date.toISOString().slice(0, 10);
	}

	function exclusiveEnd(event: CalendarEvent): string {
		return compactDate(exclusiveEndDate(event));
	}

	function googleCalendarUrl(event: CalendarEvent): string {
		const parameters = new URLSearchParams({
			action: 'TEMPLATE',
			text: event.title,
			dates: `${compactDate(event.startDate)}/${exclusiveEnd(event)}`,
			details: event.details,
			location: event.location
		});
		return `https://calendar.google.com/calendar/render?${parameters.toString()}`;
	}

	function outlookCalendarUrl(event: CalendarEvent): string {
		const parameters = new URLSearchParams({
			path: '/calendar/action/compose',
			rru: 'addevent',
			subject: event.title,
			startdt: event.startDate,
			enddt: exclusiveEndDate(event),
			body: event.details,
			location: event.location,
			allday: 'true'
		});
		return `https://outlook.live.com/calendar/0/deeplink/compose?${parameters.toString()}`;
	}

	function downloadCalendarEvent(event: CalendarEvent) {
		const escape = (value: string) =>
			value
				.replaceAll('\\', '\\\\')
				.replaceAll('\n', '\\n')
				.replaceAll(',', '\\,')
				.replaceAll(';', '\\;');
		const content = [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//Queerlective CoLab//Dashboard//EN',
			'BEGIN:VEVENT',
			`UID:${event.source}-${event.id}@nhciviccommons.com`,
			`DTSTART;VALUE=DATE:${compactDate(event.startDate)}`,
			`DTEND;VALUE=DATE:${exclusiveEnd(event)}`,
			`SUMMARY:${escape(event.title)}`,
			`DESCRIPTION:${escape(event.details)}`,
			`LOCATION:${escape(event.location)}`,
			'END:VEVENT',
			'END:VCALENDAR'
		].join('\r\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
		link.download = `${event.title.replace(/[^\w-]+/gu, '-').toLocaleLowerCase('en-US')}.ics`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(link.href), 0);
	}

	async function loadSubscriptionUrl() {
		subscriptionLoading = true;
		try {
			const response = await fetch('/api/calendar/subscription');
			const result = (await response.json()) as { url?: string };
			if (!response.ok || !result.url) throw new Error('Could not create subscription link.');
			subscriptionUrl = result.url;
			await navigator.clipboard?.writeText(result.url);
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not create subscription link.';
		} finally {
			subscriptionLoading = false;
		}
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
			selected.isMine = true;
			events = events.map((event) =>
				event.source === selected?.source && event.id === selected?.id
					? { ...event, isVolunteering: true, isMine: true }
					: event
			);
			signupMessage = result.message || 'Volunteer signup recorded.';
		} catch (cause) {
			signupMessage = cause instanceof Error ? cause.message : 'Could not record your signup.';
		} finally {
			signingUp = false;
		}
	}

	async function coverShift() {
		if (!selected || selected.source !== 'shift') return;
		signingUp = true;
		signupMessage = '';
		try {
			const response = await fetch('/api/shifts/signup', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ shiftId: selected.id })
			});
			const result = (await response.json()) as {
				shift?: { coveredBy: string };
				message?: string;
			};
			if (!response.ok || !result.shift) {
				throw new Error(result.message || 'Could not cover this shift.');
			}
			selected.status = 'Covered';
			selected.canVolunteer = false;
			selected.isMine = true;
			selected.details = `${selected.details.split(' · ')[0]} · ${result.shift.coveredBy}`;
			events = events.map((event) =>
				event.source === 'shift' && event.id === selected?.id
					? {
							...event,
							status: 'Covered',
							canVolunteer: false,
							isMine: true,
							details: selected.details
						}
					: event
			);
			signupMessage = 'You’re now covering this shift.';
		} catch (cause) {
			signupMessage = cause instanceof Error ? cause.message : 'Could not cover this shift.';
		} finally {
			signingUp = false;
		}
	}

	async function reassignShift() {
		if (!selected || selected.source !== 'shift') return;
		if (!shiftHostSelection) {
			signupMessage = 'Type and choose a member from the suggestions.';
			return;
		}
		const member = shiftHostSelection;
		signingUp = true;
		try {
			const response = await fetch('/api/admin/shifts/host', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ shiftId: selected.id, memberId: member.id })
			});
			const result = (await response.json()) as {
				shift?: { coveredBy: string };
				message?: string;
			};
			if (!response.ok || !result.shift) {
				throw new Error(result.message || 'Could not reassign this shift.');
			}
			selected.details = `${selected.details.split(' · ')[0]} · ${result.shift.coveredBy}`;
			events = events.map((event) =>
				event.source === 'shift' && event.id === selected?.id
					? { ...event, details: selected.details }
					: event
			);
			shiftHostSelection = null;
			shiftPickerKey += 1;
			signupMessage = result.message || 'Shift reassigned.';
		} catch (cause) {
			signupMessage = cause instanceof Error ? cause.message : 'Could not reassign this shift.';
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
			<h2 id="calendar-title">{viewTitle}</h2>
		</div>
		<div class="calendar-controls">
			<button
				type="button"
				class="secondary-button"
				onclick={() => moveMonth(-1)}
				aria-label={view === 'week' ? 'Previous week' : 'Previous month'}>←</button
			>
			<button
				type="button"
				class="secondary-button"
				onclick={() => moveMonth(1)}
				aria-label={view === 'week' ? 'Next week' : 'Next month'}>→</button
			>
		</div>
	</div>
	<div class="calendar-legend" aria-label="Calendar color legend">
		<span><i class="legend-swatch legend-shift-open"></i>Open CoLab shift</span>
		<span><i class="legend-swatch legend-shift-covered"></i>Covered CoLab shift</span>
		<span><i class="legend-swatch legend-project"></i>Project</span>
		<span><i class="legend-swatch legend-community"></i>Community event</span>
	</div>
	<div class="calendar-personalization">
		<div class="calendar-view-switcher" aria-label="Calendar view">
			{#each ['month', 'week', 'agenda'] as option (option)}
				<button
					type="button"
					class:active={view === option}
					onclick={() => changeView(option as typeof view)}
				>
					{option[0].toUpperCase() + option.slice(1)}
				</button>
			{/each}
		</div>
		<label class="calendar-toggle">
			<input type="checkbox" bind:checked={myScheduleOnly} />
			<span>My schedule</span>
		</label>
		<div class="calendar-filters" aria-label="Calendar filters">
			<label><input type="checkbox" bind:checked={showShifts} /> Shifts</label>
			<label><input type="checkbox" bind:checked={showProjects} /> Projects</label>
			<label><input type="checkbox" bind:checked={showEvents} /> Events</label>
			<label><input type="checkbox" bind:checked={showDeadlines} /> Deadlines</label>
		</div>
		<span class="calendar-timezone">Times shown in {timeZone}</span>
		<button
			type="button"
			class="calendar-subscribe-button"
			onclick={loadSubscriptionUrl}
			disabled={subscriptionLoading || readOnly}
		>
			{subscriptionLoading
				? 'Creating…'
				: subscriptionUrl
					? 'Link copied'
					: 'Subscribe to my calendar'}
		</button>
	</div>
	{#if subscriptionUrl}
		<div class="calendar-subscription-result">
			<label for="calendar-subscription-url">Private calendar subscription URL</label>
			<input id="calendar-subscription-url" value={subscriptionUrl} readonly />
			<p>Paste this link into Google Calendar, Apple Calendar, or Outlook. Keep it private.</p>
		</div>
	{/if}

	{#if loading}
		<ContentState kind="loading" title="Loading calendar" message="Gathering shifts and events." />
	{:else if message}
		<ContentState kind="error" title="Calendar unavailable" {message} />
	{:else}
		{#if view === 'month'}
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
										class:shift-open={event.source === 'shift' && event.status === 'Open'}
										class:shift-covered={event.source === 'shift' && event.status === 'Covered'}
										aria-label={`View details for ${event.title}`}
									>
										{#if safeUrl(event.imageUrl)}
											<img class="calendar-event-thumbnail" src={safeUrl(event.imageUrl)} alt="" />
										{/if}
										<span class="calendar-event-copy">
											<strong>{event.title}</strong><span>{event.status}</span>
										</span>
									</button>
								{/each}
							</div>
						</div>
					{:else}
						<div class="calendar-day outside" aria-hidden="true"></div>
					{/if}
				{/each}
			</div>
		{:else if view === 'week'}
			<div class="calendar-grid calendar-week-grid" aria-label="Week calendar">
				{#each weekDates as date (date)}
					<div class:today={date === today} class="calendar-day">
						<time datetime={date}>{dateLabel(date)}</time>
						<div class="day-events">
							{#each eventsByDate.get(date) ?? [] as event (`week-${event.source}-${event.id}`)}
								<button
									type="button"
									onclick={() => openDetails(event)}
									class={`calendar-event event-${event.source}`}
									class:shift-open={event.source === 'shift' && event.status === 'Open'}
									class:shift-covered={event.source === 'shift' && event.status === 'Covered'}
								>
									<span class="calendar-event-copy">
										<strong>{event.title}</strong><span>{event.status}</span>
									</span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if view === 'agenda'}
			<div class="agenda-list calendar-agenda-view" aria-label={`${title} agenda`}>
				{#if visibleEvents.length === 0}
					<ContentState
						kind="empty"
						title="No calendar entries"
						message="Nothing is scheduled this month."
					/>
				{:else}
					{#each visibleEvents as event (`agenda-${event.source}-${event.id}`)}
						<button
							type="button"
							class="agenda-event"
							class:shift-open={event.source === 'shift' && event.status === 'Open'}
							class:shift-covered={event.source === 'shift' && event.status === 'Covered'}
							onclick={() => openDetails(event)}
						>
							{#if safeUrl(event.imageUrl)}
								<img class="agenda-event-thumbnail" src={safeUrl(event.imageUrl)} alt="" />
							{/if}
							<time datetime={event.startDate}>{event.startDate}</time>
							<div><strong>{event.title}</strong><span>{event.location || event.status}</span></div>
							<span class={`source-pill source-${event.source}`}>
								{event.source === 'shift' ? `${event.status} shift` : event.source}
							</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
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
				{#if safeUrl(selected.imageUrl)}
					<img class="event-preview-image" src={safeUrl(selected.imageUrl)} alt="" />
				{/if}
				{#if additionalAttachments(selected).length}
					<div class="event-attachment-previews">
						{#each additionalAttachments(selected) as attachment (`${attachment.name}-${attachment.url}`)}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={safeUrl(attachment.url)} target="_blank" rel="noreferrer">
								{#if attachment.isImage}
									<img src={safeUrl(attachment.url)} alt={attachment.name} />
								{:else}
									<span class="file-preview-icon" aria-hidden="true">↗</span>
								{/if}
								<strong>{attachment.name}</strong>
							</a>
						{/each}
					</div>
				{/if}
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
				{#if selected.fields.length}
					<dl class="event-extra-fields">
						{#each selected.fields as field (`${field.label}-${field.value}`)}
							<div>
								<dt>{field.label}</dt>
								<dd>
									{#if field.url && safeUrl(field.value)}
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href={safeUrl(field.value)} target="_blank" rel="noreferrer"
											>{field.value} ↗</a
										>
									{:else}
										{field.value}
									{/if}
								</dd>
							</div>
						{/each}
					</dl>
				{/if}
				<div class="event-dialog-actions">
					{#if selected.source === 'shift' && selected.canVolunteer}
						<button type="button" onclick={coverShift} disabled={signingUp || readOnly}>
							{readOnly ? 'View only' : signingUp ? 'Saving…' : 'Cover this shift'}
						</button>
					{:else if selected.canVolunteer}
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
					{#if selected.pageUrl}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={selected.pageUrl}>Open project dashboard →</a>
					{/if}
				</div>
				<div class="add-calendar-actions" aria-label="Add to calendar">
					<span>Add to calendar</span>
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a href={googleCalendarUrl(selected)} target="_blank" rel="noreferrer">Google</a>
					<a href={outlookCalendarUrl(selected)} target="_blank" rel="noreferrer">Outlook</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<button type="button" onclick={() => selected && downloadCalendarEvent(selected)}
						>Apple / ICS</button
					>
				</div>
				{#if isAdmin && selected.source === 'shift' && selected.status === 'Covered'}
					<div class="calendar-shift-reassign">
						<label>
							<span>Change shift coverage</span>
							{#key shiftPickerKey}
								<MemberPredictivePicker
									id="calendar-shift-member"
									placeholder="Type @ and a member’s name"
									includeSelf={true}
									bind:selection={shiftHostSelection}
									disabled={signingUp}
								/>
							{/key}
						</label>
						<button type="button" onclick={reassignShift} disabled={signingUp}>
							{signingUp ? 'Saving…' : 'Assign new person'}
						</button>
					</div>
				{/if}
				{#if signupMessage}<p role="status" class="calendar-message">{signupMessage}</p>{/if}
				{#if selected.source !== 'shift' && !selected.isDeadline}
					<ItemComments source={selected.source} eventId={selected.id} {readOnly} />
				{/if}
			</div>
		</div>
	{/if}
</section>
