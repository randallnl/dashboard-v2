<script lang="ts">
	import type { ProjectEventRecord } from '$lib/types/domain';

	type ProjectRailKind = 'ongoing' | 'priority';

	let {
		projects,
		kind
	}: {
		projects: ProjectEventRecord[];
		kind: ProjectRailKind;
	} = $props();

	const labels = $derived(
		kind === 'ongoing'
			? {
					eyebrow: 'Programs and partners',
					title: 'Ongoing',
					description: 'Recurring work, programs, and partner meetings.',
					empty: 'No projects are currently marked “Ongoing.”',
					cardLabel: 'Ongoing'
				}
			: {
					eyebrow: 'Needs attention',
					title: 'High priority',
					description: 'Projects that need focused attention.',
					empty: 'No projects are currently marked high priority.',
					cardLabel: 'High priority'
				}
	);

	function field(project: ProjectEventRecord, key: string): string {
		const value = project.record[key];
		return typeof value === 'string' ? value : '';
	}

	function dateLabel(value: string): string {
		if (!value) return 'Date not set';
		const parsed = new Date(`${value}T12:00:00Z`);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					timeZone: 'UTC'
				}).format(parsed);
	}
</script>

<aside
	class:priority-rail={kind === 'priority'}
	class="project-rail"
	aria-labelledby={`${kind}-projects-title`}
>
	<div class="project-rail-heading">
		<div>
			<p class="eyebrow">{labels.eyebrow}</p>
			<h2 id={`${kind}-projects-title`}>{labels.title}</h2>
			<p>{labels.description}</p>
		</div>
		<span class="project-rail-count">{projects.length}</span>
	</div>

	{#if projects.length}
		<div class="project-rail-stack">
			{#each projects as project (`${project.source}:${project.id}`)}
				<article class="project-rail-card">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={`/items/${project.source}/${project.id}`}>
						<div class="project-rail-card-topline">
							<span class:priority={kind === 'priority'} class="project-rail-label"
								>{labels.cardLabel}</span
							>
							{#if kind === 'ongoing' && field(project, 'priority')}
								<span class="project-rail-priority">{field(project, 'priority')} priority</span>
							{:else if kind === 'priority' && project.status}
								<span class="project-rail-priority">{project.status}</span>
							{/if}
						</div>
						<h3>{project.title}</h3>
						<dl>
							<div>
								<dt>Owner</dt>
								<dd>{project.owner || 'Not assigned'}</dd>
							</div>
							<div>
								<dt>Timeline</dt>
								<dd>{dateLabel(project.dateValue)}</dd>
							</div>
						</dl>
						<span class="project-rail-open">Open project <span aria-hidden="true">→</span></span>
					</a>
				</article>
			{/each}
		</div>
	{:else}
		<p class="project-rail-empty">{labels.empty}</p>
	{/if}
</aside>
