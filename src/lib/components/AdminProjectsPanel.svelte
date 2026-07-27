<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
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
	let search = $state('');
	let source = $state('');
	let status = $state('');
	let sort = $state('upcoming');
	let from = $state(new Date().toISOString().slice(0, 10));
	let through = $state('');
	let page = $state(1);
	let pageSize = $state(24);
	let total = $state(0);
	let loading = $state(false);
	let message = $state('');
	let failed = $state(false);
	let brokenPosters = $state<Record<string, boolean>>({});
	let syncing = $state(false);
	let syncMessage = $state('');
	let syncFailed = $state(false);

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	function field(record: ProjectEventRecord, key: string): string {
		const value = record.record[key];
		return typeof value === 'string' ? value : '';
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
		params.set('sort', sort);
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

	function applyFilters(event: SubmitEvent) {
		event.preventDefault();
		void load(1);
	}

	async function syncNow() {
		syncing = true;
		syncMessage = '';
		syncFailed = false;
		try {
			const response = await fetch('/api/admin/sync/all', { method: 'POST' });
			const result = (await response.json()) as {
				ok?: boolean;
				message?: string;
				failures?: string[];
				results?: Record<
					string,
					{ count?: number; failed?: number; removed?: number; error?: string }
				>;
			};
			if (!response.ok) throw new Error(result.message || 'Could not synchronize D1.');
			syncFailed = result.ok === false;
			const counts = Object.entries(result.results ?? {})
				.filter(([, value]) => typeof value.count === 'number')
				.map(
					([name, value]) =>
						`${name} ${value.count}${value.failed ? ` (${value.failed} failed)` : ''}`
				)
				.join(' · ');
			syncMessage = `${result.message || 'D1 sync completed.'}${counts ? ` ${counts}.` : ''}`;
			await load(1);
		} catch (cause) {
			syncFailed = true;
			syncMessage = cause instanceof Error ? cause.message : 'Could not synchronize D1.';
		} finally {
			syncing = false;
		}
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
		<div class="admin-sync-controls">
			<p class="automatic-sync-note">Updates automatically every 15 minutes.</p>
			<button type="button" class="secondary-button" onclick={syncNow} disabled={syncing}>
				{syncing ? 'Syncing D1…' : 'Sync D1 now'}
			</button>
		</div>
	</div>

	{#if syncMessage}
		<p class="admin-message" class:error={syncFailed} role={syncFailed ? 'alert' : 'status'}>
			{syncMessage}
		</p>
	{/if}

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
		<label>
			<span>Sort</span>
			<select bind:value={sort}>
				<option value="upcoming">Upcoming first</option>
				<option value="date-desc">Newest date</option>
				<option value="date-asc">Oldest date</option>
				<option value="title">Title A–Z</option>
				<option value="status">Status</option>
				<option value="priority">Priority</option>
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
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a class="project-tile" href={`/items/${record.source}/${record.id}`}>
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
						<div class="project-row-heading">
							<div>
								<span class="source-pill">{record.source}</span>
								<h3>{record.title}</h3>
							</div>
							<p>{dateLabel(record.dateValue)}</p>
						</div>
						<div class="project-pills">
							{#if record.status}
								<span class="project-pill pill-status">Status · {record.status}</span>
							{/if}
							{#if field(record, 'goal') || field(record, 'category')}
								<span class="project-pill pill-goal">
									Goal · {field(record, 'goal') || field(record, 'category')}
								</span>
							{/if}
							{#if record.location}
								<span class="project-pill pill-location">Location · {record.location}</span>
							{/if}
							{#if field(record, 'strategicGoal')}
								<span class="project-pill pill-strategic">
									Strategic goal · {field(record, 'strategicGoal')}
								</span>
							{/if}
							{#if field(record, 'priority')}
								<span class="project-pill pill-priority">
									Priority · {field(record, 'priority')}
								</span>
							{/if}
						</div>
						<small
							>{record.owner || 'Owner not set'} · Synced {dateLabel(
								record.syncedAt.slice(0, 10)
							)}</small
						>
						<span class="card-primary-action">Manage →</span>
					</div>
				</a>
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
</section>
