<script lang="ts">
	import { resolve } from '$app/paths';
	import ItemComments from '$lib/components/ItemComments.svelte';
	import MemberPredictivePicker from '$lib/components/MemberPredictivePicker.svelte';
	import ProjectDashboardHeader from '$lib/components/ProjectDashboardHeader.svelte';
	import type { EventAttachment } from '$lib/types/domain';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	type MemberOption = { id: string; label: string };

	let host = $state(untrack(() => data.host));
	let hostSelection = $state<MemberOption | null>(null);
	let savingHost = $state(false);
	let hostMessage = $state('');
	let attendeeSelection = $state<MemberOption | null>(null);
	let attendees = $state(
		untrack(() => {
			const value = data.record.record.attendees;
			return typeof value === 'string'
				? value
						.split(/[,;\n]+/u)
						.map((email) => email.trim())
						.filter(Boolean)
				: [];
		})
	);
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

	const entries = $derived(
		Object.entries(data.record.record).filter(
			([key, value]) =>
				!['attendees', 'goal', 'category', 'strategicGoal', 'priority'].includes(key) &&
				typeof value === 'string' &&
				value
		)
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
			attendees = result.attendees ?? attendees;
			attendeeSelection = null;
			attendeePickerKey += 1;
			attendeeMessage = result.message || 'Attendee added.';
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

	<section class="item-dashboard-grid">
		<article>
			<h2>Details</h2>
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
		</article>

		<article>
			<h2>Attachments and links</h2>
			<div class="item-previews">
				{#each attachments as attachment (`${attachment.name}-${attachment.url}`)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={safeUrl(attachment.url)} target="_blank" rel="noreferrer">
						{#if attachment.isImage}
							<img src={safeUrl(attachment.url)} alt={attachment.name} />
						{/if}
						<strong>{attachment.name}</strong>
						<span>{new URL(safeUrl(attachment.url)).hostname} ↗</span>
					</a>
				{/each}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				{#each entries.filter(([, value]) => safeUrl(value)) as [key, value] (key)}
					<a
						href={safeUrl(value)}
						target="_blank"
						rel="noreferrer"
						class:link-calendar={key === 'calendarUrl'}
						class:link-monday={key === 'mondayUrl'}
					>
						{#if imageUrl(value)}<img src={imageUrl(value)} alt="" />{/if}
						<strong>{label(key)}</strong>
						<span>{new URL(safeUrl(value)).hostname} ↗</span>
					</a>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		</article>
	</section>

	{#if data.isAdmin && typeof data.record.record.campaignId === 'string' && data.record.record.campaignId}
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

	{#if data.isAdmin}
		<details class="event-editor">
			<summary>
				<span>Edit project or event</span>
				<span aria-hidden="true">＋</span>
			</summary>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void saveDetails();
				}}
			>
				<label><span>Title</span><input bind:value={editTitle} maxlength="255" required /></label>
				<div>
					<label><span>Start date</span><input bind:value={editDate} type="date" required /></label>
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
					<textarea bind:value={editDescription} rows="6" maxlength="10000"></textarea>
				</label>
				<button type="submit" disabled={savingDetails}>
					{savingDetails ? 'Saving to Monday…' : 'Save changes'}
				</button>
			</form>
			{#if editMessage}<p role="status">{editMessage}</p>{/if}
		</details>

		<div class:people-editor-grid={data.record.source === 'project'}>
			<section class="host-editor">
				<div class="people-editor-heading">
					<div>
						<p class="eyebrow">Host</p>
						<h2>{host?.hostLabel || data.record.owner || 'Not assigned'}</h2>
					</div>
				</div>
				<div>
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
				</div>
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
								{#each attendees as email (email)}<span>{email}</span>{/each}
							</div>
						{/if}
					</div>
					<div>
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
					</div>
					{#if attendeeMessage}<p role="status">{attendeeMessage}</p>{/if}
				</section>
			{/if}
		</div>
	{/if}

	<ItemComments source={data.record.source} eventId={data.record.id} readOnly={data.readOnly} />
</main>
