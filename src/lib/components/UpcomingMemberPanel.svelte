<script lang="ts">
	import type { Shift, UpcomingProjectAssignment } from '$lib/types/domain';

	let {
		shifts,
		projects,
		availableShifts
	}: {
		shifts: Shift[];
		projects: UpcomingProjectAssignment[];
		availableShifts: Shift[];
	} = $props();

	const visibleShifts = $derived(shifts.slice(0, 3));
	const visibleProjects = $derived(projects.slice(0, 3));
	const visibleOpenShifts = $derived(availableShifts.slice(0, 3));

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
		const value = record.record.posterUrl;
		if (typeof value !== 'string') return '';
		try {
			const url = new URL(value);
			return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
		} catch {
			return '';
		}
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

	<div class="upcoming-member-grid">
		<div class="upcoming-group">
			<div class="upcoming-group-heading">
				<h3>Your shifts</h3>
				<a href="#calendar">View calendar</a>
			</div>
			{#if visibleShifts.length}
				<div class="upcoming-shift-list">
					{#each visibleShifts as shift (shift.id)}
						<a href="#calendar">
							<time datetime={shift.dateValue}>{dateLabel(shift.dateValue)}</time>
							<div>
								<strong>{shift.title}</strong>
								<span>{shift.timeLabel || shift.dateLabel}</span>
							</div>
							<span class="upcoming-action-label secondary">View details</span>
						</a>
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
</section>
