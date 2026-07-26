<script lang="ts">
	import { resolve } from '$app/paths';
	import ItemComments from '$lib/components/ItemComments.svelte';
	import type { EventAttachment } from '$lib/types/domain';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let host = $state(untrack(() => data.host));
	let members = $state<Array<{ id: string; label: string }>>([]);
	let hostSelection = $state('');
	let savingHost = $state(false);
	let hostMessage = $state('');
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
		Object.entries(data.record.record).filter(([, value]) => typeof value === 'string' && value)
	);
	const attachments = $derived(
		Array.isArray(data.record.record.attachments)
			? (data.record.record.attachments as EventAttachment[])
			: []
	);

	function label(key: string): string {
		return key
			.replace(/Url$/u, '')
			.replace(/([a-z])([A-Z])/gu, '$1 $2')
			.replace(/^./u, (character) => character.toUpperCase());
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

	async function loadMembers() {
		if (members.length) return;
		const response = await fetch('/api/members/mentions');
		if (response.ok) {
			const result = (await response.json()) as {
				members?: Array<{ id: string; label: string }>;
			};
			members = result.members ?? [];
		}
	}

	async function saveHost() {
		const member = members.find(
			(option) =>
				option.label.toLocaleLowerCase('en-US') === hostSelection.trim().toLocaleLowerCase('en-US')
		);
		if (!member) {
			hostMessage = 'Type and choose a member from the suggestions.';
			return;
		}
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
			hostMessage = `Host changed to ${result.host.hostLabel}.`;
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

<main class="item-dashboard" id="main-content">
	<a href={resolve('/#calendar')}>← Back to dashboard</a>
	<header>
		<div>
			<p class="eyebrow">{data.record.source} dashboard</p>
			<h1>{data.record.title}</h1>
			<p>{data.record.dateValue}{data.record.location ? ` · ${data.record.location}` : ''}</p>
		</div>
		<span class="status-pill">{data.record.status || 'Status not set'}</span>
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
				{#each entries.filter(([, value]) => safeUrl(value)) as [key, value] (key)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={safeUrl(value)} target="_blank" rel="noreferrer">
						{#if imageUrl(value)}<img src={imageUrl(value)} alt="" />{/if}
						<strong>{label(key)}</strong>
						<span>{new URL(safeUrl(value)).hostname} ↗</span>
					</a>
				{/each}
			</div>
		</article>
	</section>

	{#if data.isAdmin}
		<section class="event-editor">
			<h2>Edit project or event</h2>
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
		</section>

		<section class="host-editor">
			<h2>Change host</h2>
			<div>
				<input
					list="event-host-members"
					bind:value={hostSelection}
					onfocus={loadMembers}
					placeholder="Type a member’s name"
				/>
				<button type="button" onclick={saveHost} disabled={savingHost}>
					{savingHost ? 'Saving…' : 'Assign host'}
				</button>
			</div>
			<datalist id="event-host-members">
				{#each members as member (member.id)}<option value={member.label}></option>{/each}
			</datalist>
			{#if hostMessage}<p role="status">{hostMessage}</p>{/if}
		</section>
	{/if}

	<ItemComments source={data.record.source} eventId={data.record.id} readOnly={data.readOnly} />
</main>
