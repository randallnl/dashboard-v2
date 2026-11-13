<script lang="ts">
	import { resolve } from '$app/paths';
	import type { DriveDocument } from '$lib/types/drive';
	import type { ProjectEventRecord } from '$lib/types/domain';

	let {
		today,
		meetings,
		documents
	}: {
		today: string;
		meetings: ProjectEventRecord[];
		documents: DriveDocument[];
	} = $props();

	const upcomingMeetings = $derived(
		meetings
			.filter((meeting) => meeting.dateValue && meeting.dateValue >= today)
			.sort((first, second) => first.dateValue.localeCompare(second.dateValue))
			.slice(0, 4)
	);
	const recentMeetings = $derived(
		meetings
			.filter((meeting) => meeting.dateValue && meeting.dateValue < today)
			.sort((first, second) => second.dateValue.localeCompare(first.dateValue))
			.slice(0, 3)
	);
	const nextMeeting = $derived(upcomingMeetings[0] ?? null);

	function dateLabel(value: string): string {
		if (!value) return 'Date not set';
		const parsed = new Date(`${value}T12:00:00Z`);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					timeZone: 'UTC'
				}).format(parsed);
	}

	function documentType(document: DriveDocument): string {
		if (document.mimeType.endsWith('.document')) return 'Google Doc';
		if (document.mimeType.endsWith('.spreadsheet')) return 'Google Sheet';
		if (document.mimeType.endsWith('.presentation')) return 'Google Slides';
		if (document.mimeType === 'application/pdf') return 'PDF';
		return 'File';
	}
</script>

<section class="governance-workspace" aria-labelledby="governance-title">
	<header class="governance-hero">
		<div>
			<p class="eyebrow">Board and organizational care</p>
			<h1 id="governance-title">Governance</h1>
			<p>
				Keep board meetings, governance records, and the follow-through between meetings in one calm
				place.
			</p>
		</div>
		<div class="governance-hero-actions">
			<a class="governance-primary-action" href={resolve('/projects')}>View project board</a>
			<a class="governance-secondary-action" href={resolve('/operations?tab=documents')}
				>Open governance documents</a
			>
		</div>
	</header>

	<div class="governance-layout">
		<aside class="governance-rail" aria-labelledby="board-rhythm-title">
			<section>
				<p class="eyebrow">Meeting rhythm</p>
				<h2 id="board-rhythm-title">Next board meeting</h2>
				{#if nextMeeting}
					<strong>{dateLabel(nextMeeting.dateValue)}</strong>
					<p>{nextMeeting.title}</p>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={`/items/${nextMeeting.source}/${nextMeeting.id}`}>Open meeting →</a>
				{:else}
					<strong>No upcoming meeting</strong>
					<p>Add the next meeting to the project board so it is visible here.</p>
				{/if}
			</section>
			<section class="governance-rail-note">
				<p class="eyebrow">Simple convention</p>
				<p>
					Title recurring records with <strong>Board</strong>, <strong>Governance</strong>,
					<strong>Committee</strong>, or <strong>Director</strong>. This tab will pick them up on
					the next project sync.
				</p>
			</section>
		</aside>

		<div class="governance-content">
			<section class="governance-section" aria-labelledby="upcoming-governance-title">
				<div class="governance-section-heading">
					<div>
						<p class="eyebrow">Board calendar</p>
						<h2 id="upcoming-governance-title">Upcoming meetings</h2>
					</div>
					<span>{upcomingMeetings.length} scheduled</span>
				</div>
				{#if upcomingMeetings.length}
					<div class="governance-meeting-grid">
						{#each upcomingMeetings as meeting (`${meeting.source}:${meeting.id}`)}
							<article class="governance-meeting-card">
								<div>
									<time datetime={meeting.dateValue}>{dateLabel(meeting.dateValue)}</time>
									<span>{meeting.status || 'Planned'}</span>
								</div>
								<h3>{meeting.title}</h3>
								<p>{meeting.owner || 'Owner not set'}</p>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={`/items/${meeting.source}/${meeting.id}`}>Open record →</a>
							</article>
						{/each}
					</div>
				{:else}
					<div class="governance-empty">
						<strong>No governance meetings are scheduled yet.</strong>
						<p>
							Create the recurring board meeting in Monday’s project board and include one of the
							governance terms in its title or details. Its project record will appear here after
							the normal sync.
						</p>
					</div>
				{/if}
			</section>

			<section class="governance-section" aria-labelledby="meeting-flow-title">
				<div class="governance-section-heading">
					<div>
						<p class="eyebrow">Repeatable meeting flow</p>
						<h2 id="meeting-flow-title">From agenda to follow-through</h2>
					</div>
					<p>Use the same rhythm each month so decisions do not disappear between meetings.</p>
				</div>
				<ol class="governance-flow">
					<li>
						<span>10 days before</span>
						<strong>Build the agenda</strong>
						<p>Collect decisions, reports, and proposed actions into one board packet.</p>
					</li>
					<li>
						<span>3 days before</span>
						<strong>Confirm the room</strong>
						<p>Send the packet, confirm attendance, and flag anything requiring a vote or quorum.</p>
					</li>
					<li>
						<span>Within 72 hours</span>
						<strong>Close the loop</strong>
						<p>File minutes, record decisions, and turn each owner’s follow-up into a project task.</p>
					</li>
				</ol>
			</section>

			<div class="governance-lower-grid">
				<section class="governance-section governance-documents" aria-labelledby="governance-documents-title">
					<div class="governance-section-heading">
						<div>
							<p class="eyebrow">Shared record</p>
							<h2 id="governance-documents-title">Governance documents</h2>
						</div>
						<a href={resolve('/operations?tab=documents')}>All documents →</a>
					</div>
					{#if documents.length}
						<ul class="governance-document-list">
							{#each documents as document (document.id)}
								<li>
									<a href={document.webViewUrl} target="_blank" rel="noreferrer">
										<span>{documentType(document)}</span>
										<strong>{document.name}</strong>
										<small>{document.modifiedAt ? `Updated ${dateLabel(document.modifiedAt.slice(0, 10))}` : 'Open document'}</small>
									</a>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="governance-section-empty">
							No matching files yet. Name or tag agendas, minutes, policies, and board packets with a
							governance term in the Operations Drive.
						</p>
					{/if}
				</section>

				<section class="governance-section governance-recommendations" aria-labelledby="governance-automation-title">
					<div class="governance-section-heading">
						<div>
							<p class="eyebrow">Recommended next</p>
							<h2 id="governance-automation-title">Automations to consider</h2>
						</div>
						<span>Not enabled</span>
					</div>
					<ul class="governance-recommendation-list">
						<li>
							<strong>Board packet reminder</strong>
							<span>Seven days before each board meeting, send the agenda and packet link to the board list.</span>
						</li>
						<li>
							<strong>Quorum check-in</strong>
							<span>Twenty-four hours ahead, prompt attendees to confirm attendance and flag a quorum risk.</span>
						</li>
						<li>
							<strong>Minutes follow-up</strong>
							<span>Two days after, ask the secretary to file minutes and create follow-up tasks for each owner.</span>
						</li>
						<li>
							<strong>Annual obligations calendar</strong>
							<span>Track recurring filings, insurance renewals, board terms, and policy reviews in the same view.</span>
						</li>
					</ul>
				</section>
			</div>

			{#if recentMeetings.length}
				<section class="governance-section governance-recent" aria-labelledby="recent-governance-title">
					<div class="governance-section-heading">
						<div>
							<p class="eyebrow">Reference</p>
							<h2 id="recent-governance-title">Recent meetings</h2>
						</div>
					</div>
					<div class="governance-recent-list">
						{#each recentMeetings as meeting (`${meeting.source}:${meeting.id}`)}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={`/items/${meeting.source}/${meeting.id}`}>
								<span>{dateLabel(meeting.dateValue)}</span><strong>{meeting.title}</strong><small>{meeting.status || 'View record'}</small>
							</a>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</div>
</section>
