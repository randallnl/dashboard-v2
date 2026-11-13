<script lang="ts">
	import type { DashboardActivity } from '$lib/types/domain';

	let { activities }: { activities: DashboardActivity[] } = $props();

	function label(activity: DashboardActivity): string {
		return {
			project_created: 'New project',
			project_changed: 'Project change',
			comment: 'Comment',
			monday_update: 'Monday update'
		}[activity.kind];
	}

	function relativeTime(value: string): string {
		const timestamp = new Date(value).getTime();
		if (!value || Number.isNaN(timestamp)) return 'Recently';
		const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 14) return `${days}d ago`;
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
			new Date(value)
		);
	}
</script>

<section class="admin-activity-feed" aria-labelledby="admin-activity-feed-title">
	<div class="section-heading compact">
		<div>
			<p class="eyebrow">Admin only</p>
			<h2 id="admin-activity-feed-title">Recent activity</h2>
		</div>
		<p>New projects, meaningful project changes, and conversations across the workspace.</p>
	</div>

	{#if activities.length}
		<ol>
			{#each activities as activity (activity.id)}
				<li class:comment={activity.kind === 'comment' || activity.kind === 'monday_update'}>
					<span class="admin-activity-kind">{label(activity)}</span>
					<div>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={`/items/${activity.source}/${activity.eventId}`}>{activity.title}</a>
						<p>{activity.summary}</p>
						<small>
							{activity.authorLabel ? `${activity.authorLabel} · ` : ''}{relativeTime(
								activity.createdAt
							)}
						</small>
					</div>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="admin-activity-empty">
			No recent project activity yet. New projects, edits, and comments will appear here as they
			happen.
		</p>
	{/if}
</section>
