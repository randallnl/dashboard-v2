<script lang="ts">
	import type { ProjectEventRecord } from '$lib/types/domain';
	import { SvelteDate } from 'svelte/reactivity';

	type ScheduledProject = {
		project: ProjectEventRecord;
		start: Date;
		end: Date;
	};

	const WEEKS_VISIBLE = 13;
	const DAY_MS = 24 * 60 * 60 * 1000;

	let { projects }: { projects: ProjectEventRecord[] } = $props();

	function parseDate(value: string): Date | null {
		if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
		const date = new Date(`${value}T12:00:00Z`);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	function startOfWeek(date: Date): Date {
		const start = new SvelteDate(date);
		start.setUTCDate(start.getUTCDate() - start.getUTCDay());
		return start;
	}

	function addDays(date: Date, days: number): Date {
		const next = new SvelteDate(date);
		next.setUTCDate(next.getUTCDate() + days);
		return next;
	}

	function addMonths(date: Date, months: number): Date {
		const next = new SvelteDate(date);
		next.setUTCMonth(next.getUTCMonth() + months);
		return startOfWeek(next);
	}

	function daysBetween(left: Date, right: Date): number {
		return Math.round((left.getTime() - right.getTime()) / DAY_MS);
	}

	function sameOrAfter(left: Date, right: Date): boolean {
		return left.getTime() >= right.getTime();
	}

	function sameOrBefore(left: Date, right: Date): boolean {
		return left.getTime() <= right.getTime();
	}

	function dateLabel(date: Date, options: Intl.DateTimeFormatOptions): string {
		return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
	}

	function timelineLabel(start: Date, end: Date): string {
		const startMonth = dateLabel(start, { month: 'short', year: 'numeric' });
		const endMonth = dateLabel(end, { month: 'short', year: 'numeric' });
		return startMonth === endMonth ? startMonth : `${startMonth} – ${endMonth}`;
	}

	function projectRange(project: ProjectEventRecord): ScheduledProject | null {
		const start = parseDate(project.dateValue);
		if (!start) return null;
		const requestedEnd = parseDate(project.endDateValue);
		return {
			project,
			start,
			end: requestedEnd && sameOrAfter(requestedEnd, start) ? requestedEnd : start
		};
	}

	function dateRangeLabel(project: ScheduledProject): string {
		const start = dateLabel(project.start, { month: 'short', day: 'numeric', year: 'numeric' });
		if (project.start.getTime() === project.end.getTime()) return start;
		const end = dateLabel(project.end, { month: 'short', day: 'numeric', year: 'numeric' });
		return `${start} – ${end}`;
	}

	function statusTone(status: string): string {
		const normalized = status.trim().toLocaleLowerCase('en-US');
		if (normalized === 'ongoing') return 'ongoing';
		if (normalized.includes('working') || normalized.includes('progress')) return 'in-progress';
		if (normalized.includes('complete')) return 'complete';
		if (normalized.includes('hold') || normalized.includes('cancel')) return 'paused';
		return 'planned';
	}

	let timelineStart = $state(startOfWeek(new Date()));

	const timelineEnd = $derived(addDays(timelineStart, WEEKS_VISIBLE * 7 - 1));
	const weeks = $derived(
		Array.from({ length: WEEKS_VISIBLE }, (_, index) => addDays(timelineStart, index * 7))
	);
	const scheduledProjects = $derived(
		projects
			.map(projectRange)
			.filter((project): project is ScheduledProject => project !== null)
			.sort((left, right) => left.start.getTime() - right.start.getTime())
	);
	const visibleProjects = $derived(
		scheduledProjects.filter(
			(project) =>
				sameOrBefore(project.start, timelineEnd) && sameOrAfter(project.end, timelineStart)
		)
	);
	const unscheduledProjects = $derived(projects.filter((project) => !parseDate(project.dateValue)));

	function moveTimeline(offset: number) {
		timelineStart = addMonths(timelineStart, offset * 3);
	}

	function jumpToToday() {
		timelineStart = startOfWeek(new Date());
	}

	function barStyle(project: ScheduledProject): string {
		const visibleStart = sameOrAfter(project.start, timelineStart) ? project.start : timelineStart;
		const visibleEnd = sameOrBefore(project.end, timelineEnd) ? project.end : timelineEnd;
		const startColumn = Math.floor(daysBetween(visibleStart, timelineStart) / 7) + 1;
		const endColumn = Math.floor(daysBetween(visibleEnd, timelineStart) / 7) + 1;
		return `--gantt-start: ${startColumn}; --gantt-span: ${Math.max(1, endColumn - startColumn + 1)};`;
	}
</script>

<section class="project-gantt" aria-labelledby="project-gantt-title">
	<div class="project-gantt-heading">
		<div>
			<p class="eyebrow">Project calendar</p>
			<h2 id="project-gantt-title">Gantt timeline</h2>
			<p>Projects with a start date appear across their scheduled weeks.</p>
		</div>
		<div class="project-gantt-controls" aria-label="Gantt timeline controls">
			<button type="button" onclick={() => moveTimeline(-1)} aria-label="Show the previous three months">
				←
			</button>
			<button type="button" class="project-gantt-today" onclick={jumpToToday}>Today</button>
			<button type="button" onclick={() => moveTimeline(1)} aria-label="Show the next three months">
				→
			</button>
		</div>
	</div>

	<div class="project-gantt-summary" aria-live="polite">
		<span>{timelineLabel(timelineStart, timelineEnd)}</span>
		<span>{visibleProjects.length} scheduled project{visibleProjects.length === 1 ? '' : 's'}</span>
	</div>

	{#if visibleProjects.length}
		<div class="project-gantt-scroll">
			<div class="project-gantt-table" style={`--gantt-weeks: ${WEEKS_VISIBLE};`}>
				<div class="project-gantt-weeks" aria-hidden="true">
					<span>Project</span>
					<div class="project-gantt-week-labels">
						{#each weeks as week (week.toISOString())}
							<time datetime={week.toISOString().slice(0, 10)}>{dateLabel(week, { month: 'short', day: 'numeric' })}</time>
						{/each}
					</div>
				</div>

				<div class="project-gantt-rows">
					{#each visibleProjects as project (`${project.project.source}:${project.project.id}`)}
						<article class="project-gantt-row">
							<div class="project-gantt-project">
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={`/items/${project.project.source}/${project.project.id}`}>{project.project.title}</a>
								<span>{dateRangeLabel(project)}</span>
							</div>
							<div class="project-gantt-track">
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a
									class={`project-gantt-bar ${statusTone(project.project.status)}`}
									href={`/items/${project.project.source}/${project.project.id}`}
									style={barStyle(project)}
									aria-label={`${project.project.title}: ${dateRangeLabel(project)}${project.project.status ? `, ${project.project.status}` : ''}`}
								>
									<span>{project.project.status || 'Scheduled'}</span>
								</a>
							</div>
						</article>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<p class="project-gantt-empty">No projects have dates in this three-month window.</p>
	{/if}

	{#if unscheduledProjects.length}
		<section class="project-gantt-unscheduled" aria-labelledby="unscheduled-projects-title">
			<div>
				<h3 id="unscheduled-projects-title">Not scheduled yet</h3>
				<p>{unscheduledProjects.length} project{unscheduledProjects.length === 1 ? '' : 's'} without a start date.</p>
			</div>
			<div class="project-gantt-unscheduled-list">
				{#each unscheduledProjects as project (`${project.source}:${project.id}`)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={`/items/${project.source}/${project.id}`}>
						<span>{project.title}</span>{#if project.status}<small>{project.status}</small>{/if}
					</a>
				{/each}
			</div>
		</section>
	{/if}
</section>
