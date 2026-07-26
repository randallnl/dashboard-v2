<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import ItemComments from '$lib/components/ItemComments.svelte';
	import type { ProjectEventRecord } from '$lib/types/domain';
	import { onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	type Page = {
		records: ProjectEventRecord[];
		total: number;
		page: number;
		pageSize: number;
		statuses: string[];
	};

	let records = $state<ProjectEventRecord[]>([]);
	let statuses = $state<string[]>([]);
	let selected = $state<ProjectEventRecord | null>(null);
	let search = $state('');
	let source = $state('');
	let status = $state('');
	let from = $state(new Date().toISOString().slice(0, 10));
	let through = $state('');
	let page = $state(1);
	let pageSize = $state(24);
	let total = $state(0);
	let loading = $state(false);
	let message = $state('');
	let failed = $state(false);
	let brokenPosters = $state<Record<string, boolean>>({});

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	function field(record: ProjectEventRecord, key: string): string {
		const value = record.record[key];
		return typeof value === 'string' ? value : '';
	}

	function fieldLabel(key: string): string {
		return key
			.replace(/Url$/u, '')
			.replace(/([a-z])([A-Z])/gu, '$1 $2')
			.replace(/^./u, (character) => character.toUpperCase());
	}

	function posterKey(record: ProjectEventRecord): string {
		return `${record.source}:${record.id}`;
	}

	function validUrl(value: string): string {
		try {
			const url = new URL(value);
			return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
		} catch {
			return '';
		}
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

	async function load(nextPage = page) {
		loading = true;
		message = '';
		const params = new SvelteURLSearchParams({ page: String(nextPage) });
		if (search.trim()) params.set('search', search.trim());
		if (source) params.set('source', source);
		if (status) params.set('status', status);
		if (from) params.set('from', from);
		if (through) params.set('through', through);
		try {
			const response = await fetch(`/api/admin/projects?${params}`);
			const result = (await response.json()) as Page & { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not load projects.');
			records = result.records;
			statuses = result.statuses;
			total = result.total;
			page = result.page;
			pageSize = result.pageSize;
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not load projects.';
		} finally {
			loading = false;
		}
	}

	async function openDetail(record: ProjectEventRecord) {
		loading = true;
		message = '';
		try {
			const params = new SvelteURLSearchParams({ source: record.source, id: record.id });
			const response = await fetch(`/api/admin/projects/detail?${params}`);
			const result = (await response.json()) as {
				record?: ProjectEventRecord;
				message?: string;
			};
			if (!response.ok || !result.record) {
				throw new Error(result.message || 'Could not load project details.');
			}
			selected = result.record;
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not load project details.';
		} finally {
			loading = false;
		}
	}

	function applyFilters(event: SubmitEvent) {
		event.preventDefault();
		void load(1);
	}

	onMount(() => {
		void load(1);
	});
</script>

<section class="admin-projects" id="admin" aria-labelledby="admin-projects-title">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Administrator workspace</p>
			<h2 id="admin-projects-title">Projects and events</h2>
		</div>
		<p class="automatic-sync-note">Updates automatically from Monday every 15 minutes.</p>
	</div>

	<form class="admin-filters" onsubmit={applyFilters}>
		<label
			><span>Search</span><input
				bind:value={search}
				type="search"
				placeholder="Title, owner, location"
			/></label
		>
		<label>
			<span>Source</span>
			<select bind:value={source}>
				<option value="">All sources</option>
				<option value="project">Project management</option>
				<option value="community">Community submissions</option>
			</select>
		</label>
		<label>
			<span>Status</span>
			<select bind:value={status}>
				<option value="">All statuses</option>
				{#each statuses as option (option)}<option value={option}>{option}</option>{/each}
			</select>
		</label>
		<label><span>From</span><input bind:value={from} type="date" /></label>
		<label><span>Through</span><input bind:value={through} type="date" /></label>
		<button type="submit" disabled={loading}>Apply filters</button>
	</form>

	{#if message}
		<p class="admin-message" class:error={failed} role={failed ? 'alert' : 'status'}>{message}</p>
	{/if}

	{#if loading && !records.length}
		<ContentState kind="loading" title="Loading projects" message="Reading filtered D1 records." />
	{:else if failed && !records.length}
		<ContentState kind="error" title="Projects unavailable" {message} />
	{:else if !records.length}
		<ContentState
			kind="empty"
			title="No matching projects"
			message="Adjust the filters. Monday records refresh automatically every 15 minutes."
		/>
	{:else}
		<p class="result-count">{total} matching record{total === 1 ? '' : 's'}</p>
		<div class="admin-project-grid">
			{#each records as record (`${record.source}:${record.id}`)}
				<button class="project-tile" type="button" onclick={() => openDetail(record)}>
					<div class="poster-frame">
						{#if validUrl(field(record, 'posterUrl')) && !brokenPosters[posterKey(record)]}
							<img
								src={validUrl(field(record, 'posterUrl'))}
								alt=""
								onerror={() => (brokenPosters[posterKey(record)] = true)}
							/>
						{:else}
							<span aria-hidden="true">{record.source === 'project' ? 'P' : 'C'}</span>
						{/if}
					</div>
					<div class="project-tile-body">
						<div class="project-pills">
							<span class="source-pill">{record.source}</span>
							{#if record.status}<span class="status-pill">{record.status}</span>{/if}
							{#if field(record, 'category')}<span>{field(record, 'category')}</span>{/if}
							{#if field(record, 'priority')}<span>{field(record, 'priority')}</span>{/if}
						</div>
						<h3>{record.title}</h3>
						<p>{dateLabel(record.dateValue)} · {record.location || 'Location not set'}</p>
						<small>Synced {dateLabel(record.syncedAt.slice(0, 10))}</small>
					</div>
				</button>
			{/each}
		</div>
		<div class="pagination" aria-label="Project pages">
			<button type="button" onclick={() => load(page - 1)} disabled={loading || page <= 1}
				>Previous</button
			>
			<span>Page {page} of {totalPages}</span>
			<button type="button" onclick={() => load(page + 1)} disabled={loading || page >= totalPages}
				>Next</button
			>
		</div>
	{/if}

	{#if selected}
		<div class="project-detail">
			<div class="card-heading">
				<div>
					<p class="eyebrow">{selected.source} record</p>
					<h3>{selected.title}</h3>
				</div>
				<button type="button" class="text-button" onclick={() => (selected = null)}>Close</button>
			</div>
			<dl>
				<div>
					<dt>Status</dt>
					<dd>{selected.status || 'Not set'}</dd>
				</div>
				<div>
					<dt>Date</dt>
					<dd>{dateLabel(selected.dateValue)}</dd>
				</div>
				<div>
					<dt>Location</dt>
					<dd>{selected.location || 'Not set'}</dd>
				</div>
				<div>
					<dt>Owner</dt>
					<dd>{selected.owner || 'Not set'}</dd>
				</div>
			</dl>
			{#if field(selected, 'description')}<p class="detail-description">
					{field(selected, 'description')}
				</p>{/if}
			<dl class="event-extra-fields">
				{#each Object.entries(selected.record).filter(([key, value]) => key !== 'description' && typeof value === 'string' && value && !validUrl(value)) as entry (entry[0])}
					<div>
						<dt>{fieldLabel(entry[0])}</dt>
						<dd>{String(entry[1])}</dd>
					</div>
				{/each}
			</dl>
			<div class="detail-links">
				{#each [['Files', field(selected, 'fileUrl')], ['Registration', field(selected, 'registrationUrl')], ['Survey', field(selected, 'surveyUrl')], ['Calendar', field(selected, 'calendarUrl')], ['Event link', field(selected, 'link')], ['Canva', field(selected, 'canvaUrl')], ['Monday', field(selected, 'mondayUrl')]] as link (link[0])}
					{#if validUrl(link[1])}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={validUrl(link[1])} target="_blank" rel="noreferrer">{link[0]} ↗</a>
					{/if}
				{/each}
			</div>
			<p class="last-synced">Last synchronized {selected.syncedAt}</p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="project-dashboard-link" href={`/items/${selected.source}/${selected.id}`}>
				Open project dashboard →
			</a>
			<ItemComments source={selected.source} eventId={selected.id} />
		</div>
	{/if}
</section>
