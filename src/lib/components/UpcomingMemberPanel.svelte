<script lang="ts">
	import type { Shift, UpcomingProjectAssignment } from '$lib/types/domain';

	let {
		shifts,
		projects
	}: {
		shifts: Shift[];
		projects: UpcomingProjectAssignment[];
	} = $props();

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

{#if shifts.length || projects.length}
	<section class="upcoming-member-panel" aria-labelledby="coming-up-title">
		<div class="section-heading compact">
			<div>
				<p class="eyebrow">Your schedule</p>
				<h2 id="coming-up-title">Coming up</h2>
			</div>
			<p>Your next shifts, hosted projects, and volunteer commitments.</p>
		</div>

		<div class="upcoming-member-grid">
			{#if shifts.length}
				<div class="upcoming-group">
					<div class="upcoming-group-heading">
						<h3>CoLab shifts</h3>
						<a href="#calendar">View calendar</a>
					</div>
					<div class="upcoming-shift-list">
						{#each shifts as shift (shift.id)}
							<a href="#calendar">
								<time datetime={shift.dateValue}>{dateLabel(shift.dateValue)}</time>
								<div>
									<strong>{shift.title}</strong>
									<span>{shift.timeLabel || shift.dateLabel}</span>
								</div>
								<span class="upcoming-role role-shift">Your shift</span>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			{#if projects.length}
				<div class="upcoming-group">
					<div class="upcoming-group-heading">
						<h3>Projects and events</h3>
						<a href="#calendar">View calendar</a>
					</div>
					<div class="upcoming-project-list">
						{#each projects as assignment (`${assignment.record.source}:${assignment.record.id}`)}
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
								<span class="upcoming-role role-project">{assignment.roles.join(' · ')}</span>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</section>
{/if}
