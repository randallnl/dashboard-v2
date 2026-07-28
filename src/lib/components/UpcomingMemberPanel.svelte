<script lang="ts">
	import MemberPredictivePicker from '$lib/components/MemberPredictivePicker.svelte';
	import type { Shift, ShiftSwitchRequest, UpcomingProjectAssignment } from '$lib/types/domain';
	import { onMount } from 'svelte';

	let {
		shifts,
		projects,
		availableShifts,
		readOnly = false
	}: {
		shifts: Shift[];
		projects: UpcomingProjectAssignment[];
		availableShifts: Shift[];
		readOnly?: boolean;
	} = $props();

	const visibleShifts = $derived(shifts.slice(0, 3));
	let showAllProjects = $state(false);
	const visibleProjects = $derived(showAllProjects ? projects : projects.slice(0, 3));
	const visibleOpenShifts = $derived(availableShifts.slice(0, 3));
	let switchRequests = $state<ShiftSwitchRequest[]>([]);
	let selectedShift = $state<Shift | null>(null);
	let replacement = $state<{ id: string; label: string } | null>(null);
	let switchMessage = $state('');
	let switching = $state(false);

	async function loadSwitchRequests() {
		const response = await fetch('/api/shifts/switch');
		if (!response.ok) return;
		const result = (await response.json()) as { requests?: ShiftSwitchRequest[] };
		switchRequests = result.requests ?? [];
	}

	async function requestSwitch(release = false) {
		if (!selectedShift || (!release && !replacement)) return;
		if (
			release &&
			!window.confirm('Release this shift as open? This will update Monday immediately.')
		)
			return;
		switching = true;
		switchMessage = '';
		try {
			const response = await fetch('/api/shifts/switch', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					shiftId: selectedShift.id,
					replacementMemberId: replacement?.id,
					release
				})
			});
			const result = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not create the switch request.');
			switchMessage = result.message || 'Switch request created.';
			selectedShift = null;
			replacement = null;
			await loadSwitchRequests();
		} catch (cause) {
			switchMessage =
				cause instanceof Error ? cause.message : 'Could not create the switch request.';
		} finally {
			switching = false;
		}
	}

	async function respond(request: ShiftSwitchRequest, responseChoice: 'accept' | 'decline') {
		switching = true;
		try {
			const response = await fetch('/api/shifts/switch', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ requestId: request.id, response: responseChoice })
			});
			const result = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not respond to this request.');
			switchMessage =
				result.message || (responseChoice === 'accept' ? 'Switch accepted.' : 'Switch declined.');
			await loadSwitchRequests();
		} catch (cause) {
			switchMessage = cause instanceof Error ? cause.message : 'Could not respond.';
		} finally {
			switching = false;
		}
	}

	onMount(loadSwitchRequests);

	function dateLabel(value: string): string {
		const parsed = new Date(`${value}T12:00:00Z`);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
					timeZone: 'UTC'
				}).format(parsed);
	}

	function safeImage(record: UpcomingProjectAssignment['record']): string {
		const values = [
			record.record.posterUrl,
			...(Array.isArray(record.record.attachments)
				? record.record.attachments
						.filter(
							(attachment): attachment is { url: string; isImage: boolean } =>
								typeof attachment === 'object' &&
								attachment !== null &&
								'isImage' in attachment &&
								attachment.isImage === true &&
								'url' in attachment &&
								typeof attachment.url === 'string'
						)
						.map((attachment) => attachment.url)
				: [])
		];

		for (const value of values) {
			if (typeof value !== 'string' || !value.trim()) continue;
			try {
				const url = new URL(value);
				if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
			} catch {
				// Try the next available project image.
			}
		}
		return '';
	}
</script>

<section class="upcoming-member-panel" aria-labelledby="coming-up-title">
	<div class="section-heading compact">
		<div>
			<p class="eyebrow">Your week</p>
			<h2 id="coming-up-title">What’s next</h2>
		</div>
		<p>Your commitments and the next ways to participate.</p>
	</div>

	<div class="upcoming-summary" aria-label="Upcoming summary">
		<div><strong>{shifts.length}</strong><span>Assigned shifts</span></div>
		<div><strong>{projects.length}</strong><span>Projects and events</span></div>
		<div><strong>{availableShifts.length}</strong><span>Open shifts</span></div>
	</div>
	{#if switchMessage}<p class="shift-message" role="status">{switchMessage}</p>{/if}
	{#if switchRequests.length}
		<div class="shift-switch-statuses">
			{#each switchRequests as request (request.id)}
				<article>
					<div>
						<strong>{request.shiftTitle}</strong>
						<span>
							{request.direction === 'incoming'
								? `${request.requesterLabel} requested you as replacement`
								: request.requestType === 'release'
									? 'Released as open'
									: `Requested ${request.replacementLabel}`}
						</span>
					</div>
					<span class={`switch-status status-${request.status}`}>{request.status}</span>
					{#if request.direction === 'incoming' && request.status === 'pending'}
						<div class="switch-response-actions">
							<button type="button" onclick={() => respond(request, 'accept')} disabled={switching}
								>Accept</button
							>
							<button type="button" onclick={() => respond(request, 'decline')} disabled={switching}
								>Decline</button
							>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}

	<div class="upcoming-member-grid">
		<div class="upcoming-group">
			<div class="upcoming-group-heading">
				<h3>Your shifts</h3>
				<a href="#calendar">View calendar</a>
			</div>
			{#if visibleShifts.length}
				<div class="upcoming-shift-list">
					{#each visibleShifts as shift (shift.id)}
						<article class="assigned-shift-row">
							<a href="#calendar">
								<time datetime={shift.dateValue}>{dateLabel(shift.dateValue)}</time>
								<div>
									<strong>{shift.title}</strong>
									<span>{shift.timeLabel || shift.dateLabel}</span>
								</div>
								<span class="upcoming-action-label secondary">View details</span>
							</a>
							<button type="button" onclick={() => (selectedShift = shift)} disabled={readOnly}
								>Request a switch</button
							>
						</article>
					{/each}
				</div>
			{:else}
				<p class="upcoming-empty">You don’t have an upcoming CoLab shift.</p>
			{/if}
		</div>

		<div class="upcoming-group">
			<div class="upcoming-group-heading">
				<h3>Your projects</h3>
				<a href="#calendar">View calendar</a>
			</div>
			{#if visibleProjects.length}
				<div class="upcoming-project-list">
					{#each visibleProjects as assignment (`${assignment.record.source}:${assignment.record.id}`)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={`/items/${assignment.record.source}/${assignment.record.id}`}>
							{#if safeImage(assignment.record)}
								<img src={safeImage(assignment.record)} alt="" />
							{:else}
								<span class="upcoming-project-placeholder" aria-hidden="true">
									{assignment.record.source === 'project' ? 'P' : 'E'}
								</span>
							{/if}
							<div>
								<time datetime={assignment.record.dateValue}>
									{dateLabel(assignment.record.dateValue)}
								</time>
								<strong>{assignment.record.title}</strong>
								<span>{assignment.record.location || assignment.record.status}</span>
							</div>
							<span class="upcoming-action-label secondary">
								{assignment.roles.includes('Host')
									? 'Manage'
									: assignment.record.source === 'community'
										? 'View event'
										: 'View project'}
							</span>
						</a>
					{/each}
				</div>
				{#if projects.length > 3}
					<button
						type="button"
						class="upcoming-show-more"
						onclick={() => (showAllProjects = !showAllProjects)}
					>
						{showAllProjects ? 'Show fewer' : `Show all ${projects.length}`}
					</button>
				{/if}
			{:else}
				<p class="upcoming-empty">You aren’t assigned to an upcoming project or event.</p>
			{/if}
		</div>

		<div class="upcoming-group upcoming-action-group">
			<div class="upcoming-group-heading">
				<h3>Ways to help</h3>
				<a href="#available-shifts-title">See all</a>
			</div>
			{#if visibleOpenShifts.length}
				<div class="upcoming-open-shift-list">
					{#each visibleOpenShifts as shift (shift.id)}
						<a href="#available-shifts-title">
							<div>
								<time datetime={shift.dateValue}>{dateLabel(shift.dateValue)}</time>
								<strong>{shift.title}</strong>
								<span>{shift.timeLabel || shift.dateLabel}</span>
							</div>
							<span class="upcoming-action-label">View & sign up</span>
						</a>
					{/each}
				</div>
			{:else}
				<p class="upcoming-empty">All currently listed shifts are covered.</p>
			{/if}
		</div>
	</div>

	{#if selectedShift}
		<div class="event-dialog-backdrop" role="presentation">
			<div
				class="event-dialog shift-switch-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="switch-title"
			>
				<div class="card-heading">
					<div>
						<p class="eyebrow">Shift exchange</p>
						<h3 id="switch-title">Request a switch</h3>
					</div>
					<button type="button" class="text-button" onclick={() => (selectedShift = null)}
						>Close</button
					>
				</div>
				<p>
					<strong>{selectedShift.title}</strong> · {dateLabel(selectedShift.dateValue)} · {selectedShift.timeLabel}
				</p>
				<MemberPredictivePicker
					id="shift-switch-replacement"
					placeholder="Type @ and choose a replacement"
					includeSelf={false}
					bind:selection={replacement}
					disabled={switching}
				/>
				<div class="switch-dialog-actions">
					<button
						type="button"
						onclick={() => requestSwitch(false)}
						disabled={!replacement || switching}>Send request</button
					>
					<button type="button" onclick={() => requestSwitch(true)} disabled={switching}
						>Release as open</button
					>
				</div>
				<p class="automatic-sync-note">
					Monday updates only after acceptance. The replacement will be notified by email.
				</p>
			</div>
		</div>
	{/if}
</section>
