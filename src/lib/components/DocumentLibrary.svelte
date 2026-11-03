<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import DataFreshness from '$lib/components/DataFreshness.svelte';
	import type { DriveDocument, DriveSyncState } from '$lib/types/drive';
	import { onMount } from 'svelte';

	type DocumentsResponse = {
		rootFolderId: string;
		documents: DriveDocument[];
		sync: DriveSyncState;
	};

	let loading = $state(true);
	let errorMessage = $state('');
	let documents = $state<DriveDocument[]>([]);
	let sync = $state<DriveSyncState | null>(null);
	let rootFolderId = $state('');
	let currentFolderId = $state('');
	let search = $state('');

	async function loadDocuments() {
		loading = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/documents');
			if (!response.ok) throw new Error('The document library could not be loaded.');
			const payload = (await response.json()) as DocumentsResponse;
			documents = payload.documents;
			sync = payload.sync;
			rootFolderId = payload.rootFolderId;
			if (!currentFolderId) currentFolderId = payload.rootFolderId;
		} catch (cause) {
			errorMessage =
				cause instanceof Error ? cause.message : 'The document library could not be loaded.';
		} finally {
			loading = false;
		}
	}

	onMount(() => void loadDocuments());

	const foldersById = $derived(
		new Map(
			documents.filter((document) => document.isFolder).map((document) => [document.id, document])
		)
	);
	const breadcrumbs = $derived.by(() => {
		const parts: DriveDocument[] = [];
		let cursor = currentFolderId;
		while (cursor && cursor !== rootFolderId) {
			const folder = foldersById.get(cursor);
			if (!folder) break;
			parts.unshift(folder);
			cursor = folder.parentId;
		}
		return parts;
	});
	const visibleDocuments = $derived.by(() => {
		const query = search.trim().toLocaleLowerCase('en-US');
		const candidates = query
			? documents.filter((document) => document.name.toLocaleLowerCase('en-US').includes(query))
			: documents.filter((document) => document.parentId === currentFolderId);
		return [...candidates].sort((left, right) => {
			if (left.isFolder !== right.isFolder) return left.isFolder ? -1 : 1;
			return left.name.localeCompare(right.name);
		});
	});

	function typeLabel(document: DriveDocument): string {
		if (document.isFolder) return 'Folder';
		if (document.isShortcut) return 'Shortcut';
		if (document.mimeType.endsWith('.document')) return 'Google Doc';
		if (document.mimeType.endsWith('.spreadsheet')) return 'Google Sheet';
		if (document.mimeType.endsWith('.presentation')) return 'Google Slides';
		if (document.mimeType === 'application/pdf') return 'PDF';
		return 'File';
	}

	function icon(document: DriveDocument): string {
		if (document.isFolder) return '▰';
		if (document.mimeType.endsWith('.spreadsheet')) return '▦';
		if (document.mimeType.endsWith('.presentation')) return '▤';
		if (document.mimeType === 'application/pdf') return 'PDF';
		return '▧';
	}

	function formatDate(value: string): string {
		if (!value) return '';
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
	}
</script>

<section class="document-library" id="documents" aria-labelledby="documents-title">
	<header class="document-library-hero">
		<div>
			<p class="eyebrow">Shared knowledge</p>
			<h1 id="documents-title">CoLab documents</h1>
			<p>Browse the latest guides, operating documents, templates, and shared resources.</p>
		</div>
		{#if sync}<DataFreshness syncedAt={sync.completedAt} syncing={sync.status === 'running'} />{/if}
	</header>

	{#if loading}
		<ContentState
			kind="loading"
			title="Loading documents"
			message="Reading the synchronized Drive index."
		/>
	{:else if errorMessage}
		<ContentState
			kind="error"
			title="Documents unavailable"
			message={errorMessage}
			onretry={loadDocuments}
		/>
	{:else if sync?.status === 'pending'}
		<ContentState
			kind="empty"
			title="Waiting for the first Drive sync"
			message="The document library will appear after the synchronization Worker runs."
		/>
	{:else}
		<div class="document-library-toolbar">
			<label>
				<span>Search documents</span>
				<input bind:value={search} type="search" placeholder="Search by file or folder name" />
			</label>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				href="https://drive.google.com/drive/folders/1wEEDbh0PmGiPkdS6S_LfLZeIcQtOSIEm"
				target="_blank"
				rel="noreferrer">Open Google Drive ↗</a
			>
		</div>

		{#if !search}
			<nav class="document-breadcrumbs" aria-label="Document folder breadcrumbs">
				<button
					type="button"
					aria-current={currentFolderId === rootFolderId ? 'page' : undefined}
					onclick={() => (currentFolderId = rootFolderId)}>Documents</button
				>
				{#each breadcrumbs as folder (folder.id)}
					<span aria-hidden="true">/</span>
					<button
						type="button"
						aria-current={currentFolderId === folder.id ? 'page' : undefined}
						onclick={() => (currentFolderId = folder.id)}>{folder.name}</button
					>
				{/each}
			</nav>
		{/if}

		{#if visibleDocuments.length}
			<ul class="document-grid" aria-label={search ? 'Document search results' : 'Folder contents'}>
				{#each visibleDocuments as document (document.id)}
					<li>
						{#if document.isFolder}
							<button
								type="button"
								onclick={() => {
									currentFolderId = document.id;
									search = '';
								}}
							>
								<span class="document-icon" aria-hidden="true">{icon(document)}</span>
								<span><strong>{document.name}</strong><small>{typeLabel(document)}</small></span>
							</button>
						{:else}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={document.webViewUrl} target="_blank" rel="noreferrer">
								<span class="document-icon" aria-hidden="true">{icon(document)}</span>
								<span>
									<strong>{document.name}</strong>
									<small
										>{typeLabel(document)}{document.modifiedAt
											? ` · Updated ${formatDate(document.modifiedAt)}`
											: ''}</small
									>
								</span>
								<span class="document-open" aria-hidden="true">↗</span>
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<ContentState
				kind="empty"
				title={search ? 'No matching documents' : 'This folder is empty'}
				message={search
					? 'Try a different filename or folder name.'
					: 'Files added in Google Drive will appear after the next sync.'}
			/>
		{/if}
	{/if}
</section>
