<script lang="ts">
	import { resolve } from '$app/paths';
	import ItemComments from '$lib/components/ItemComments.svelte';
	import MemberPredictivePicker from '$lib/components/MemberPredictivePicker.svelte';
	import ProjectDashboardHeader from '$lib/components/ProjectDashboardHeader.svelte';
	import type { EventAttachment } from '$lib/types/domain';
	import { onMount } from 'svelte';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	type MemberOption = { id: string; label: string };

	let host = $state(untrack(() => data.host));
	let hostSelection = $state<MemberOption | null>(null);
	let savingHost = $state(false);
	let hostMessage = $state('');
	let attendeeSelection = $state<MemberOption | null>(null);
	let attendees = $state(untrack(() => data.attendees));
	let savingAttendee = $state(false);
	let attendeeMessage = $state('');
	let attendeePickerKey = $state(0);
	let editTitle = $state(untrack(() => data.record.title));
	let editDate = $state(untrack(() => data.record.dateValue));
	let editEndDate = $state(untrack(() => data.record.endDateValue));
	let editStatus = $state(untrack(() => data.record.status));
	let editLocation = $state(untrack(() => data.record.location));
	let editDescription = $state(
		untrack(() =>
			typeof data.record.record.description === 'string' ? data.record.record.description : ''
		)
	);
	let savingDetails = $state(false);
	let editMessage = $state('');
	let editingDetails = $state(false);
	type WorkspaceTab = 'overview' | 'people' | 'schedule' | 'files' | 'comments' | 'activity';
	let activeTab = $state<WorkspaceTab>('overview');
	let pinnedUrls = $state<string[]>([]);
	const tabs: Array<{ id: WorkspaceTab; label: string }> = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'people', label: 'People' },
		{ id: 'schedule', label: 'Schedule' },
		{ id: 'files', label: 'Files & links' },
		{ id: 'comments', label: 'Comments' },
		{ id: 'activity', label: 'Activity' }
	];

	const entries = $derived(
		Object.entries(data.record.record).filter(
			([key, value]) =>
				!['attendees', 'goal', 'category', 'strategicGoal', 'priority'].includes(key) &&
				typeof value === 'string' &&
				value
		) as Array<[string, string]>
	);
	const attachments = $derived(
		Array.isArray(data.record.record.attachments)
			? (data.record.record.attachments as EventAttachment[])
			: []
	);
	const heroImage = $derived(
		data.record.source === 'project'
			? (attachments.find((attachment) => attachment.isImage && safeUrl(attachment.url))?.url ?? '')
			: ''
	);
	const milestone = $derived.by(() => {
		const candidates = [
			{ label: 'Next milestone', value: field('nextMilestone'), explicit: true },
			{ label: 'Deadline', value: field('deadline'), explicit: true },
			{ label: 'Project start', value: data.record.dateValue, explicit: false },
			{ label: 'Project end', value: data.record.endDateValue, explicit: false }
		].filter((entry) => Boolean(entry.value));
		const today = new Date().toISOString().slice(0, 10);
		return candidates.find(({ value }) => value >= today) ?? candidates.at(-1) ?? null;
	});
	const activity = $derived(
		[
			...data.recentComments.map((comment) => ({
				id: `comment-${comment.id}`,
				label: `${comment.authorLabel} commented`,
				detail: comment.body,
				at: comment.createdAt
			})),
			...(host?.updatedAt
				? [
						{
							id: 'host',
							label: 'Host assignment updated',
							detail: host.hostLabel,
							at: host.updatedAt
						}
					]
				: []),
			{
				id: 'sync',
				label: 'Project data synchronized',
				detail: 'Latest changes imported from Monday.',
				at: data.record.syncedAt
			}
		]
			.filter((item) => item.at)
			.sort((left, right) => right.at.localeCompare(left.at))
			.slice(0, 8)
	);

	onMount(() => {
		const stored = localStorage.getItem(`project-pins:${data.record.source}:${data.record.id}`);
		if (stored) {
			try {
				const parsed: unknown = JSON.parse(stored);
				if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) {
					pinnedUrls = parsed;
				}
			} catch {
				// Ignore invalid legacy browser storage.
			}
		}
	});

	function togglePin(url: string) {
		pinnedUrls = pinnedUrls.includes(url)
			? pinnedUrls.filter((candidate) => candidate !== url)
			: [...pinnedUrls, url];
		localStorage.setItem(
			`project-pins:${data.record.source}:${data.record.id}`,
			JSON.stringify(pinnedUrls)
		);
	}

	function confirmMonday(action: string): boolean {
		return window.confirm(`${action} This will update the connected Monday record. Continue?`);
	}

	function label(key: string): string {
		return key
			.replace(/Url$/u, '')
			.replace(/([a-z])([A-Z])/gu, '$1 $2')
			.replace(/^./u, (character) => character.toUpperCase());
	}

	function field(key: string): string {
		const value = data.record.record[key];
		return typeof value === 'string' ? value : '';
	}

	function safeUrl(value: unknown): string {
		if (typeof value !== 'string') return '';
		try {
			const url = new URL(value);
			return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
		} catch {
			return '';
		}
	}

	function imageUrl(value: unknown): string {
		const url = safeUrl(value);
		return url && /\.(?:avif|gif|jpe?g|png|webp)(?:\?.*)?$/iu.test(url) ? url : '';
	}

	function dateTimeLabel(value: string): string {
		if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
			const [year, month, day] = value.split('-').map(Number);
			const localDate = new Date(year, month - 1, day);
			return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(localDate);
		}
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					dateStyle: 'medium',
					timeStyle: 'short'
				}).format(parsed);
	}

	async function addAttendee() {
		if (!attendeeSelection) {
			attendeeMessage = 'Type and choose a member from the suggestions.';
			return;
		}
		if (!confirmMonday(`Add ${attendeeSelection.label} as an attendee?`)) return;
		const member = attendeeSelection;
		savingAttendee = true;
		attendeeMessage = '';
		try {
			const response = await fetch('/api/admin/events/attendees', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ eventId: data.record.id, memberId: member.id })
			});
			const result = (await response.json()) as {
				attendees?: string[];
				message?: string;
			};
			if (!response.ok) throw new Error(result.message || 'Could not add attendee.');
			attendeeSelection = null;
			attendeePickerKey += 1;
			attendeeMessage = result.message || 'Attendee added.';
			window.location.reload();
		} catch (cause) {
			attendeeMessage = cause instanceof Error ? cause.message : 'Could not add attendee.';
		} finally {
			savingAttendee = false;
		}
	}

	async function saveHost() {
		if (!hostSelection) {
			hostMessage = 'Type and choose a member from the suggestions.';
			return;
		}
		if (!confirmMonday(`Assign ${hostSelection.label} as host?`)) return;
		const member = hostSelection;
		savingHost = true;
		const response = await fetch('/api/admin/events/host', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				source: data.record.source,
				eventId: data.record.id,
				memberId: member.id
			})
		});
		const result = (await response.json()) as { host?: typeof host; message?: string };
		if (response.ok && result.host) {
			host = result.host;
			hostMessage = result.message || `Host changed to ${result.host.hostLabel}.`;
		} else {
			hostMessage = result.message || 'Could not change host.';
		}
		savingHost = false;
	}

	async function saveDetails() {
		if (!confirmMonday('Save these project details?')) return;
		savingDetails = true;
		editMessage = '';
		try {
			const response = await fetch('/api/admin/events/update', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					source: data.record.source,
					eventId: data.record.id,
					title: editTitle,
					dateValue: editDate,
					endDateValue: editEndDate,
					status: editStatus,
					location: editLocation,
					description: editDescription
				})
			});
			const result = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not save changes.');
			editMessage = result.message || 'Changes saved.';
			editingDetails = false;
			window.location.reload();
		} catch (cause) {
			editMessage = cause instanceof Error ? cause.message : 'Could not save changes.';
			savingDetails = false;
		}
	}
</script>

<svelte:head><title>{data.record.title} · CoLab</title></svelte:head>

<ProjectDashboardHeader
	member={data.member}
	capabilities={data.capabilities}
	source={data.record.source}
	title={data.record.title}
/>

<main class="item-dashboard" id="main-content">
	<a href={resolve('/#calendar')}>← Back to dashboard</a>
	<header
		class:has-hero-image={Boolean(heroImage)}
		style:background-image={heroImage
			? `linear-gradient(90deg, rgba(18, 30, 25, 0.88) 0%, rgba(18, 30, 25, 0.7) 52%, rgba(18, 30, 25, 0.3) 100%), url("${safeUrl(heroImage)}")`
			: undefined}
	>
		<div>
			<p class="eyebrow">{data.record.source} dashboard</p>
			<h1>{data.record.title}</h1>
			<p>{data.record.dateValue}</p>
			<div class="project-pills item-dashboard-pills" aria-label="Project attributes">
				{#if data.record.status}
					<span class="project-pill pill-status">Status · {data.record.status}</span>
				{/if}
				{#if field('goal') || field('category')}
					<span class="project-pill pill-goal">
						Goal · {field('goal') || field('category')}
					</span>
				{/if}
				{#if data.record.location}
					<span class="project-pill pill-location">Location · {data.record.location}</span>
				{/if}
				{#if field('strategicGoal')}
					<span class="project-pill pill-strategic">
						Strategic goal · {field('strategicGoal')}
					</span>
				{/if}
				{#if field('priority')}
					<span class="project-pill pill-priority">Priority · {field('priority')}</span>
				{/if}
			</div>
		</div>
	</header>

	{#if milestone}
		<section class="next-milestone" aria-labelledby="next-milestone-title">
			<div>
				<p class="eyebrow">{milestone.explicit ? 'Next milestone' : 'Next project date'}</p>
				<h2 id="next-milestone-title">{milestone.label}</h2>
			</div>
			<strong>{dateTimeLabel(milestone.value)}</strong>
		</section>
	{/if}

	<nav class="workspace-tabs" aria-label="Project workspace">
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				class:active={activeTab === tab.id}
				aria-current={activeTab === tab.id ? 'page' : undefined}
				onclick={() => (activeTab = tab.id)}>{tab.label}</button
			>
		{/each}
	</nav>

	{#if activeTab === 'overview'}
		<section class="item-dashboard-grid workspace-panel">
			<article class:editing={editingDetails} class="inline-project-details">
				<div class="inline-editor-heading">
					<div>
						<p class="eyebrow">Project details</p>
						<h2>Overview</h2>
					</div>
					{#if data.canEdit}
						<button type="button" onclick={() => (editingDetails = !editingDetails)}>
							{editingDetails ? 'Cancel' : 'Edit'}
						</button>
					{/if}
				</div>
				{#if editingDetails}
					<form
						class="inline-project-form"
						onsubmit={(event) => {
							event.preventDefault();
							void saveDetails();
						}}
					>
						<label
							><span>Title</span><input bind:value={editTitle} maxlength="255" required /></label
						>
						<div>
							<label
								><span>Start date</span><input bind:value={editDate} type="date" required /></label
							>
							{#if data.record.source === 'project'}
								<label><span>End date</span><input bind:value={editEndDate} type="date" /></label>
							{/if}
						</div>
						<div>
							<label><span>Status</span><input bind:value={editStatus} /></label>
							{#if data.record.source === 'project'}
								<label><span>Location</span><input bind:value={editLocation} /></label>
							{/if}
						</div>
						<label>
							<span>Description</span>
							<textarea bind:value={editDescription} rows="5" maxlength="10000"></textarea>
						</label>
						<div class="inline-editor-actions">
							<button type="submit" disabled={savingDetails}>
								{savingDetails ? 'Saving to Monday…' : 'Save changes'}
							</button>
							<button type="button" onclick={() => (editingDetails = false)}>Cancel</button>
						</div>
					</form>
				{:else}
					<dl class="event-extra-fields">
						<div>
							<dt>Host</dt>
							<dd>{host?.hostLabel || data.record.owner || 'Not assigned'}</dd>
						</div>
						{#each entries as [key, value] (key)}
							{#if !safeUrl(value)}
								<div>
									<dt>{label(key)}</dt>
									<dd>{String(value)}</dd>
								</div>
							{/if}
						{/each}
					</dl>
				{/if}
				{#if editMessage}<p role="status">{editMessage}</p>{/if}
			</article>
			<article>
				<h2>At a glance</h2>
				<dl class="event-extra-fields">
					<div>
						<dt>Starts</dt>
						<dd>{dateTimeLabel(data.record.dateValue)}</dd>
					</div>
					{#if data.record.endDateValue}
						<div>
							<dt>Ends</dt>
							<dd>{dateTimeLabel(data.record.endDateValue)}</dd>
						</div>
					{/if}
					<div>
						<dt>People</dt>
						<dd>{attendees.length} attendees or volunteers</dd>
					</div>
					<div>
						<dt>Files</dt>
						<dd>{attachments.length} attachments</dd>
					</div>
				</dl>
			</article>
		</section>
	{/if}

	{#if activeTab === 'files'}
		<section class="workspace-panel workspace-card">
			<div class="card-heading">
				<div>
					<p class="eyebrow">Shared resources</p>
					<h2>Files and links</h2>
				</div>
				<span class="status-pill">{pinnedUrls.length} pinned</span>
			</div>
			<div class="item-previews">
				{#each attachments as attachment (`${attachment.name}-${attachment.url}`)}
					<div class:pinned-resource={pinnedUrls.includes(attachment.url)} class="resource-tile">
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={safeUrl(attachment.url)} target="_blank" rel="noreferrer">
							{#if attachment.isImage}<img
									src={safeUrl(attachment.url)}
									alt={attachment.name}
								/>{/if}
							<strong>{attachment.name}</strong>
							<span>{new URL(safeUrl(attachment.url)).hostname} ↗</span>
						</a>
						<button type="button" onclick={() => togglePin(attachment.url)}>
							{pinnedUrls.includes(attachment.url) ? 'Unpin' : 'Pin'}
						</button>
					</div>
				{/each}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				{#each entries.filter(([, value]) => safeUrl(value)) as [key, value] (key)}
					<div class:pinned-resource={pinnedUrls.includes(value)} class="resource-tile">
						<a href={safeUrl(value)} target="_blank" rel="noreferrer">
							{#if imageUrl(value)}<img src={imageUrl(value)} alt="" />{/if}
							<strong>{label(key)}</strong>
							<span>{new URL(safeUrl(value)).hostname} ↗</span>
						</a>
						<button type="button" onclick={() => togglePin(value)}>
							{pinnedUrls.includes(value) ? 'Unpin' : 'Pin'}
						</button>
					</div>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		</section>
	{/if}

	{#if activeTab === 'schedule'}
		<section class="workspace-panel workspace-card">
			<p class="eyebrow">Schedule</p>
			<h2>Project timeline</h2>
			<ol class="project-timeline">
				<li><span>Start</span><strong>{dateTimeLabel(data.record.dateValue)}</strong></li>
				{#if field('deadline')}<li>
						<span>Deadline</span><strong>{dateTimeLabel(field('deadline'))}</strong>
					</li>{/if}
				{#if data.record.endDateValue}<li>
						<span>End</span><strong>{dateTimeLabel(data.record.endDateValue)}</strong>
					</li>{/if}
			</ol>
			{#if field('calendarUrl')}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					class="workspace-action"
					href={safeUrl(field('calendarUrl'))}
					target="_blank"
					rel="noreferrer">Open shared calendar ↗</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</section>
	{/if}

	{#if activeTab === 'people' && data.isAdmin && typeof data.record.record.campaignId === 'string' && data.record.record.campaignId}
		<section class="signup-roster">
			<div class="card-heading">
				<div>
					<p class="eyebrow">Givebutter campaign {data.record.record.campaignId}</p>
					<h2>Signups</h2>
				</div>
				<span class="status-pill">{data.signups.length} registered</span>
			</div>
			{#if data.signups.length}
				<div class="signup-table-wrap">
					<table>
						<thead>
							<tr>
								<th scope="col">Donor</th>
								<th scope="col">Email</th>
								<th scope="col">Event</th>
								<th scope="col">Transaction date</th>
							</tr>
						</thead>
						<tbody>
							{#each data.signups as signup (signup.id)}
								<tr>
									<td>{signup.donorName || 'Name not provided'}</td>
									<td><a href={`mailto:${signup.donorEmail}`}>{signup.donorEmail}</a></td>
									<td>{signup.eventTitle || data.record.title}</td>
									<td>
										<time datetime={signup.transactionDate}>
											{dateTimeLabel(signup.transactionDate)}
										</time>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p>No Givebutter signups have synchronized for this campaign yet.</p>
			{/if}
		</section>
	{/if}

	{#if activeTab === 'people'}
		<div class:people-editor-grid={data.record.source === 'project'}>
			<section class="host-editor">
				<div class="people-editor-heading">
					<div>
						<p class="eyebrow">Host</p>
						<h2>{host?.hostLabel || data.record.owner || 'Not assigned'}</h2>
					</div>
					{#if data.hostContact}
						<div class="host-contact-actions">
							{#if data.hostContact.email}<a href={`mailto:${data.hostContact.email}`}>Email</a
								>{/if}
							{#if data.hostContact.phone}<a href={`tel:${data.hostContact.phone}`}>Call</a>{/if}
						</div>
					{/if}
				</div>
				{#if data.canEdit}<div>
						<MemberPredictivePicker
							id="event-host-member"
							placeholder="Type @ to change host"
							includeSelf={true}
							bind:selection={hostSelection}
							disabled={savingHost}
						/>
						<button type="button" onclick={saveHost} disabled={savingHost}>
							{savingHost ? 'Saving…' : 'Assign'}
						</button>
					</div>{/if}
				{#if hostMessage}<p role="status">{hostMessage}</p>{/if}
			</section>

			{#if data.record.source === 'project'}
				<section class="attendee-editor">
					<div class="people-editor-heading">
						<div>
							<p class="eyebrow">Attendees and volunteers</p>
							<h2>{attendees.length} assigned</h2>
						</div>
						{#if attendees.length}
							<div class="attendee-list" aria-label="Current attendees">
								{#each attendees as attendee (attendee.email)}
									<span title={attendee.email}>{attendee.name}</span>
								{/each}
							</div>
						{/if}
					</div>
					{#if data.canEdit}<div>
							{#key attendeePickerKey}
								<MemberPredictivePicker
									id="event-attendee-member"
									placeholder="Type @ to add someone"
									includeSelf={true}
									bind:selection={attendeeSelection}
									disabled={savingAttendee}
								/>
							{/key}
							<button type="button" onclick={addAttendee} disabled={savingAttendee}>
								{savingAttendee ? 'Adding…' : 'Add'}
							</button>
						</div>{/if}
					{#if attendeeMessage}<p role="status">{attendeeMessage}</p>{/if}
				</section>
			{/if}
		</div>
	{/if}

	{#if activeTab === 'comments'}
		<section class="workspace-panel">
			<ItemComments source={data.record.source} eventId={data.record.id} readOnly={data.readOnly} />
		</section>
	{/if}

	{#if activeTab === 'activity'}
		<section class="workspace-panel workspace-card">
			<p class="eyebrow">Recent changes</p>
			<h2>Activity</h2>
			<ol class="project-activity">
				{#each activity as item (item.id)}
					<li>
						<div>
							<strong>{item.label}</strong>
							<p>{item.detail}</p>
						</div>
						<time datetime={item.at}>{dateTimeLabel(item.at)}</time>
					</li>
				{/each}
			</ol>
		</section>
	{/if}
</main>
