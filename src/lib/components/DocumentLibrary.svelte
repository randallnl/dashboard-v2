<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import DataFreshness from '$lib/components/DataFreshness.svelte';
	import type { DriveDocument, DriveSyncState } from '$lib/types/drive';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	type DocumentsResponse = {
		rootFolderId: string;
		documents: DriveDocument[];
		sync: DriveSyncState;
	};
	type DocumentFilter = 'all' | 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'image';

	let loading = $state(true);
	let errorMessage = $state('');
	let documents = $state<DriveDocument[]>([]);
	let sync = $state<DriveSyncState | null>(null);
	let rootFolderId = $state('');
	let currentFolderId = $state('');
	let search = $state('');
	let filter = $state<DocumentFilter>('all');
	let listView = $state(false);
	let selected = $state<DriveDocument | null>(null);

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

	onMount(() => {
		void loadDocuments();
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') selected = null;
		};
		window.addEventListener('keydown', closeOnEscape);
		return () => window.removeEventListener('keydown', closeOnEscape);
	});

	const foldersById = $derived(
		new Map(documents.filter((item) => item.isFolder).map((item) => [item.id, item]))
	);
	const files = $derived(documents.filter((item) => !item.isFolder));
	const breadcrumbs = $derived.by(() => folderTrail(currentFolderId));
	const recentDocuments = $derived(
		[...files]
			.filter((item) => item.modifiedAt)
			.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
			.slice(0, 4)
	);
	const visibleDocuments = $derived.by(() => {
		const query = search.trim().toLocaleLowerCase('en-US');
		const candidates = query
			? documents.filter((item) =>
					`${item.name} ${pathLabel(item)}`.toLocaleLowerCase('en-US').includes(query)
				)
			: documents.filter((item) => item.parentId === currentFolderId);
		return candidates
			.filter((item) => item.isFolder || filter === 'all' || fileCategory(item) === filter)
			.sort((a, b) =>
				a.isFolder !== b.isFolder ? (a.isFolder ? -1 : 1) : a.name.localeCompare(b.name)
			);
	});

	function folderTrail(folderId: string): DriveDocument[] {
		const parts: DriveDocument[] = [];
		const seen = new SvelteSet<string>();
		let cursor = folderId;
		while (cursor && cursor !== rootFolderId && !seen.has(cursor)) {
			seen.add(cursor);
			const folder = foldersById.get(cursor);
			if (!folder) break;
			parts.unshift(folder);
			cursor = folder.parentId;
		}
		return parts;
	}

	function pathLabel(document: DriveDocument): string {
		return ['Documents', ...folderTrail(document.parentId).map((folder) => folder.name)].join(
			' / '
		);
	}

	function fileCategory(document: DriveDocument): Exclude<DocumentFilter, 'all'> | 'file' {
		if (document.mimeType.endsWith('.document')) return 'document';
		if (document.mimeType.endsWith('.spreadsheet')) return 'spreadsheet';
		if (document.mimeType.endsWith('.presentation')) return 'presentation';
		if (document.mimeType === 'application/pdf') return 'pdf';
		if (document.mimeType.startsWith('image/')) return 'image';
		return 'file';
	}

	function typeLabel(document: DriveDocument): string {
		if (document.isFolder) return 'Folder';
		if (document.isShortcut) return 'Shortcut';
		return {
			document: 'Google Doc',
			spreadsheet: 'Google Sheet',
			presentation: 'Google Slides',
			pdf: 'PDF',
			image: 'Image',
			file: 'File'
		}[fileCategory(document)];
	}

	function icon(document: DriveDocument): string {
		if (document.isFolder) return '▰';
		return {
			document: 'DOC',
			spreadsheet: '▦',
			presentation: '▤',
			pdf: 'PDF',
			image: 'IMG',
			file: '▧'
		}[fileCategory(document)];
	}

	function previewUrl(document: DriveDocument): string {
		const category = fileCategory(document);
		if (category === 'document') return `https://docs.google.com/document/d/${document.id}/preview`;
		if (category === 'spreadsheet')
			return `https://docs.google.com/spreadsheets/d/${document.id}/preview`;
		if (category === 'presentation')
			return `https://docs.google.com/presentation/d/${document.id}/preview`;
		if (category === 'pdf' || category === 'image')
			return `https://drive.google.com/file/d/${document.id}/preview`;
		return '';
	}

	function formatDate(value: string): string {
		return value
			? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
			: 'Not available';
	}

	function formatSize(bytes: number): string {
		if (!bytes) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function openFolder(folder: DriveDocument) {
		currentFolderId = folder.id;
		search = '';
		filter = 'all';
	}
</script>

<section class="document-library" id="documents" aria-labelledby="documents-title">
	<header class="document-library-hero">
		<div>
			<p class="eyebrow">Shared knowledge</p>
			<h1 id="documents-title">CoLab documents</h1>
			<p>Find policies, guides, templates, and shared resources without digging through Drive.</p>
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
		<div class="document-library-summary" aria-label="Document library summary">
			<div><strong>{files.length}</strong><span>files available</span></div>
			<div><strong>{documents.length - files.length}</strong><span>folders</span></div>
			<div>
				<strong>{recentDocuments.length ? formatDate(recentDocuments[0].modifiedAt) : '—'}</strong
				><span>latest update</span>
			</div>
		</div>

		<div class="document-library-toolbar">
			<label
				><span>Search the library</span><input
					bind:value={search}
					type="search"
					placeholder="Search names and folder paths"
				/></label
			>
			<label class="document-filter"
				><span>File type</span><select bind:value={filter}
					><option value="all">All types</option><option value="document">Google Docs</option
					><option value="spreadsheet">Google Sheets</option><option value="presentation"
						>Google Slides</option
					><option value="pdf">PDFs</option><option value="image">Images</option></select
				></label
			>
			<div class="document-view-toggle" aria-label="Document display">
				<button
					type="button"
					class:active={!listView}
					aria-pressed={!listView}
					onclick={() => (listView = false)}>Grid</button
				><button
					type="button"
					class:active={listView}
					aria-pressed={listView}
					onclick={() => (listView = true)}>List</button
				>
			</div>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				href="https://drive.google.com/drive/folders/1wEEDbh0PmGiPkdS6S_LfLZeIcQtOSIEm"
				target="_blank"
				rel="noreferrer">Open Drive ↗</a
			>
		</div>

		{#if !search && currentFolderId === rootFolderId && recentDocuments.length}
			<section class="document-recent" aria-labelledby="recent-documents-title">
				<div class="document-section-heading">
					<div>
						<p class="eyebrow">Quick access</p>
						<h2 id="recent-documents-title">Recently updated</h2>
					</div>
					<span>The latest changes from Drive</span>
				</div>
				<div class="document-recent-row">
					{#each recentDocuments as document (document.id)}
						<button type="button" onclick={() => (selected = document)}
							><span class={`document-icon type-${fileCategory(document)}`} aria-hidden="true"
								>{icon(document)}</span
							><span
								><strong>{document.name}</strong><small
									>{typeLabel(document)} · {formatDate(document.modifiedAt)}</small
								></span
							></button
						>
					{/each}
				</div>
			</section>
		{/if}

		{#if !search}
			<nav class="document-breadcrumbs" aria-label="Document folder breadcrumbs">
				<button
					type="button"
					aria-current={currentFolderId === rootFolderId ? 'page' : undefined}
					onclick={() => {
						currentFolderId = rootFolderId;
						filter = 'all';
					}}>Documents</button
				>
				{#each breadcrumbs as folder (folder.id)}<span aria-hidden="true">/</span><button
						type="button"
						aria-current={currentFolderId === folder.id ? 'page' : undefined}
						onclick={() => (currentFolderId = folder.id)}>{folder.name}</button
					>{/each}
			</nav>
		{/if}

		<div class="document-results-heading">
			<h2>{search ? 'Search results' : breadcrumbs.at(-1)?.name || 'Browse all documents'}</h2>
			<span>{visibleDocuments.length} {visibleDocuments.length === 1 ? 'item' : 'items'}</span>
		</div>
		{#if visibleDocuments.length}
			<ul
				class:list-view={listView}
				class="document-grid"
				aria-label={search ? 'Document search results' : 'Folder contents'}
			>
				{#each visibleDocuments as document (document.id)}
					<li>
						{#if document.isFolder}<button type="button" onclick={() => openFolder(document)}
								><span class="document-icon type-folder" aria-hidden="true">{icon(document)}</span
								><span><strong>{document.name}</strong><small>Folder · Open to browse</small></span
								><span class="document-open" aria-hidden="true">→</span></button
							>{:else}<button type="button" onclick={() => (selected = document)}
								><span class={`document-icon type-${fileCategory(document)}`} aria-hidden="true"
									>{icon(document)}</span
								><span
									><strong>{document.name}</strong><small
										>{typeLabel(document)}{document.modifiedAt
											? ` · Updated ${formatDate(document.modifiedAt)}`
											: ''}</small
									>{#if search}<small class="document-path">{pathLabel(document)}</small>{/if}</span
								><span class="document-open">Preview</span></button
							>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<ContentState
				kind="empty"
				title={search ? 'No matching documents' : 'No documents found'}
				message={search
					? 'Try another name, folder, or file-type filter.'
					: filter === 'all'
						? 'Files added in Google Drive will appear after the next sync.'
						: 'Try selecting another file type.'}
			/>
		{/if}
	{/if}
</section>

{#if selected}
	<div class="event-dialog-backdrop" role="presentation">
		<div
			class="document-detail-dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="document-detail-title"
		>
			<header>
				<div>
					<span class={`document-icon type-${fileCategory(selected)}`} aria-hidden="true"
						>{icon(selected)}</span
					>
					<div>
						<p class="eyebrow">{typeLabel(selected)}</p>
						<h2 id="document-detail-title">{selected.name}</h2>
					</div>
				</div>
				<button type="button" class="text-button" onclick={() => (selected = null)}>Close</button>
			</header>
			{#if previewUrl(selected)}<div class="document-preview-frame">
					<iframe src={previewUrl(selected)} title={`Preview of ${selected.name}`} allow="autoplay"
					></iframe>
				</div>{:else}<div class="document-preview-unavailable">
					<span class="document-icon" aria-hidden="true">{icon(selected)}</span><strong
						>Preview unavailable</strong
					>
					<p>Open this file in Google Drive to view it.</p>
				</div>{/if}
			<dl class="document-detail-meta">
				<div>
					<dt>Location</dt>
					<dd>{pathLabel(selected)}</dd>
				</div>
				<div>
					<dt>Updated</dt>
					<dd>{formatDate(selected.modifiedAt)}</dd>
				</div>
				{#if selected.byteSize}<div>
						<dt>Size</dt>
						<dd>{formatSize(selected.byteSize)}</dd>
					</div>{/if}
				<div>
					<dt>Access</dt>
					<dd class="document-access-pill">
						{selected.visibility === 'colab' ? 'CoLab members' : selected.visibility}
					</dd>
				</div>
			</dl>
			<div class="document-detail-actions">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
					href={selected.webViewUrl}
					target="_blank"
					rel="noreferrer">Open in Google Drive ↗</a
				><button
					type="button"
					onclick={() => navigator.clipboard.writeText(selected?.webViewUrl || '')}
					>Copy link</button
				>
			</div>
		</div>
	</div>
{/if}
