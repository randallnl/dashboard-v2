<script lang="ts">
	import type { ProjectEventRecord } from '$lib/types/domain';

	let { events }: { events: ProjectEventRecord[] } = $props();

	function dateLabel(value: string): string {
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

	function description(event: ProjectEventRecord): string {
		const value = event.record.description;
		return typeof value === 'string' ? value.trim() : '';
	}
</script>

<aside class="colab-events-rail" aria-labelledby="colab-upcoming-events-title">
	<div class="colab-events-rail-heading">
		<div>
			<p class="eyebrow">At the CoLab</p>
			<h2 id="colab-upcoming-events-title">Upcoming events</h2>
			<p>Events happening at, or specifically connected to, the CoLab.</p>
		</div>
		<span class="colab-events-rail-count">{events.length}</span>
	</div>

	{#if events.length}
		<div class="colab-events-rail-stack">
			{#each events as event (`${event.source}:${event.id}`)}
				<article class="colab-events-rail-card">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={`/items/${event.source}/${event.id}`}>
						<span class="colab-events-rail-date">{dateLabel(event.dateValue)}</span>
						<h3>{event.title}</h3>
						{#if event.location}<p class="colab-events-rail-location">{event.location}</p>{/if}
						{#if description(event)}
							<p class="colab-events-rail-details">{description(event)}</p>
						{/if}
						<span class="colab-events-rail-open">View event <span aria-hidden="true">→</span></span>
					</a>
				</article>
			{/each}
		</div>
	{:else}
		<p class="colab-events-rail-empty">No upcoming events match the CoLab yet.</p>
	{/if}
</aside>
