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
		favoriteIds: string[];
		recentlyViewedIds: string[];
		canCurate: boolean;
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
	let favoriteOnly = $state(false);
	const favoriteIds = new SvelteSet<string>();
	let recentlyViewedIds = $state<string[]>([]);
	let personalizationMessage = $state('');
	let canCurate = $state(false);
	let categoryFilter = $state('');
	let annotationCategory = $state('');
	let annotationSummary = $state('');
	let annotationKeywords = $state('');
	let annotationFeatured = $state(false);
	let annotationSaving = $state(false);
	let annotationMessage = $state('');
	const categoryOptions = [
		'Policies',
		'Operations',
		'Finance',
		'Marketing',
		'Programs',
		'Templates',
		'Member resources',
		'Other'
	];

	async function loadDocuments() {
		loading = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/documents');
			if (!response.ok) throw new Error('The document library could not be loaded.');
			const payload = (await response.json()) as DocumentsResponse;
			documents = payload.documents;
			sync = payload.sync;
			favoriteIds.clear();
			for (const id of payload.favoriteIds) favoriteIds.add(id);
			recentlyViewedIds = payload.recentlyViewedIds;
			canCurate = payload.canCurate;
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
	const recentlyViewed = $derived(
		recentlyViewedIds
			.map((id) => files.find((document) => document.id === id))
			.filter((document): document is DriveDocument => Boolean(document))
			.slice(0, 4)
	);
	const featuredDocuments = $derived(files.filter((document) => document.isFeatured).slice(0, 6));
	const availableCategories = $derived(
		[...new SvelteSet(files.map((document) => document.category).filter(Boolean))].sort()
	);
	const visibleDocuments = $derived.by(() => {
		const query = search.trim().toLocaleLowerCase('en-US');
		const candidates = query
			? documents.filter((item) =>
					`${item.name} ${item.category} ${item.summary} ${item.keywords} ${pathLabel(item)}`
						.toLocaleLowerCase('en-US')
						.includes(query)
				)
			: favoriteOnly
				? files
				: documents.filter((item) => item.parentId === currentFolderId);
		return candidates
			.filter((item) => !favoriteOnly || favoriteIds.has(item.id))
			.filter((item) => !categoryFilter || item.isFolder || item.category === categoryFilter)
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

	async function saveInteraction(body: Record<string, unknown>) {
		const response = await fetch('/api/documents', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!response.ok) throw new Error('Your document preferences could not be saved.');
	}

	async function toggleFavorite(document: DriveDocument) {
		const favorite = !favoriteIds.has(document.id);
		if (favorite) favoriteIds.add(document.id);
		else favoriteIds.delete(document.id);
		personalizationMessage = favorite ? 'Added to favorites.' : 'Removed from favorites.';
		try {
			await saveInteraction({ action: 'favorite', documentId: document.id, favorite });
		} catch (cause) {
			if (favorite) favoriteIds.delete(document.id);
			else favoriteIds.add(document.id);
			personalizationMessage = cause instanceof Error ? cause.message : 'Preference not saved.';
		}
	}

	function openDocument(document: DriveDocument) {
		selected = document;
		annotationCategory = document.category;
		annotationSummary = document.summary;
		annotationKeywords = document.keywords;
		annotationFeatured = document.isFeatured;
		annotationMessage = '';
		recentlyViewedIds = [
			document.id,
			...recentlyViewedIds.filter((id) => id !== document.id)
		].slice(0, 8);
		void saveInteraction({ action: 'view', documentId: document.id }).catch(() => undefined);
	}

	async function saveAnnotation() {
		if (!selected) return;
		annotationSaving = true;
		annotationMessage = '';
		try {
			await saveInteraction({
				action: 'annotate',
				documentId: selected.id,
				category: annotationCategory,
				summary: annotationSummary,
				keywords: annotationKeywords,
				featured: annotationFeatured
			});
			selected.category = annotationCategory.trim();
			selected.summary = annotationSummary.trim();
			selected.keywords = annotationKeywords.trim();
			selected.isFeatured = annotationFeatured;
			annotationMessage = 'Document details saved.';
		} catch (cause) {
			annotationMessage = cause instanceof Error ? cause.message : 'Document details not saved.';
		} finally {
			annotationSaving = false;
		}
	}
</script>

<section class="document-library" id="documents" aria-labelledby="documents-title">
	<header class="workspace-page-heading">
		<div>
			<p class="eyebrow">Shared knowledge</p>
			<h1 id="documents-title">CoLab documents</h1>
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
			<label class="document-filter"
				><span>Category</span><select bind:value={categoryFilter}
					><option value="">All categories</option
					>{#each availableCategories as category (category)}<option value={category}
							>{category}</option
						>{/each}</select
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
			<button
				type="button"
				class="document-favorites-filter"
				class:active={favoriteOnly}
				aria-pressed={favoriteOnly}
				onclick={() => (favoriteOnly = !favoriteOnly)}
				>★ Favorites {favoriteIds.size ? `(${favoriteIds.size})` : ''}</button
			>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				href="https://drive.google.com/drive/folders/1wEEDbh0PmGiPkdS6S_LfLZeIcQtOSIEm"
				target="_blank"
				rel="noreferrer">Open Drive ↗</a
			>
		</div>
		<p class="sr-only" aria-live="polite">{personalizationMessage}</p>
		{#if availableCategories.length}
			<div class="document-category-shortcuts" aria-label="Browse document categories">
				<button type="button" class:active={!categoryFilter} onclick={() => (categoryFilter = '')}
					>All</button
				>
				{#each availableCategories as category (category)}
					<button
						type="button"
						class:active={categoryFilter === category}
						onclick={() => (categoryFilter = category)}>{category}</button
					>
				{/each}
			</div>
		{/if}

		{#if !search && !favoriteOnly && currentFolderId === rootFolderId && featuredDocuments.length}
			<section class="document-featured" aria-labelledby="featured-documents-title">
				<div class="document-section-heading">
					<div>
						<p class="eyebrow">Start here</p>
						<h2 id="featured-documents-title">Featured documents</h2>
					</div>
					<span>Important resources selected by the CoLab team</span>
				</div>
				<div class="document-featured-grid">
					{#each featuredDocuments as document (document.id)}
						<button type="button" onclick={() => openDocument(document)}>
							<span class={`document-icon type-${fileCategory(document)}`} aria-hidden="true"
								>{icon(document)}</span
							>
							<span>
								{#if document.category}<small class="document-category-pill"
										>{document.category}</small
									>{/if}
								<strong>{document.name}</strong>
								{#if document.summary}<p>{document.summary}</p>{:else}<small
										>{typeLabel(document)}</small
									>{/if}
							</span>
						</button>
					{/each}
				</div>
			</section>
		{/if}

		{#if !search && !favoriteOnly && currentFolderId === rootFolderId && (recentlyViewed.length || recentDocuments.length)}
			<section class="document-recent" aria-labelledby="recent-documents-title">
				<div class="document-section-heading">
					<div>
						<p class="eyebrow">Quick access</p>
						<h2 id="recent-documents-title">
							{recentlyViewed.length ? 'Recently viewed' : 'Recently updated'}
						</h2>
					</div>
					<span
						>{recentlyViewed.length
							? 'Pick up where you left off'
							: 'The latest changes from Drive'}</span
					>
				</div>
				<div class="document-recent-row">
					{#each recentlyViewed.length ? recentlyViewed : recentDocuments as document (document.id)}
						<button type="button" onclick={() => openDocument(document)}
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

		{#if !search && !favoriteOnly}
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
			<h2>
				{favoriteOnly
					? 'Favorite documents'
					: search
						? 'Search results'
						: breadcrumbs.at(-1)?.name || 'Browse all documents'}
			</h2>
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
							>{:else}<div class="document-card">
								<button type="button" onclick={() => openDocument(document)}
									><span class={`document-icon type-${fileCategory(document)}`} aria-hidden="true"
										>{icon(document)}</span
									><span
										><strong>{document.name}</strong><small
											>{typeLabel(document)}{document.modifiedAt
												? ` · Updated ${formatDate(document.modifiedAt)}`
												: ''}</small
										>{#if document.category}<small class="document-card-category"
												>{document.category}</small
											>{/if}
										{#if document.summary}<small class="document-card-summary"
												>{document.summary}</small
											>{/if}
										{#if search}<small class="document-path">{pathLabel(document)}</small
											>{/if}</span
									><span class="document-open">Preview</span></button
								><button
									class="document-favorite-action"
									class:active={favoriteIds.has(document.id)}
									type="button"
									aria-label={favoriteIds.has(document.id)
										? `Remove ${document.name} from favorites`
										: `Add ${document.name} to favorites`}
									aria-pressed={favoriteIds.has(document.id)}
									onclick={() => toggleFavorite(document)}>★</button
								>
							</div>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<ContentState
				kind="empty"
				title={search ? 'No matching documents' : 'No documents found'}
				message={search
					? 'Try another name, folder, or file-type filter.'
					: favoriteOnly
						? 'Use the star on a document to keep it handy here.'
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
				{#if selected.category || selected.summary || selected.isFeatured}
					<div class="document-curated-details">
						<div>
							{#if selected.isFeatured}<span class="document-featured-pill">Featured</span>{/if}
							{#if selected.category}<span class="document-category-pill">{selected.category}</span
								>{/if}
						</div>
						{#if selected.summary}<p>{selected.summary}</p>{/if}
					</div>
				{/if}
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
				<button
					type="button"
					class:active={favoriteIds.has(selected.id)}
					onclick={() => selected && toggleFavorite(selected)}
					>{favoriteIds.has(selected.id) ? '★ Favorited' : '☆ Add to favorites'}</button
				>
			</div>
			{#if canCurate}
				<details class="document-curation-editor">
					<summary>Curate document details</summary>
					<div class="document-curation-fields">
						<label
							>Category<select bind:value={annotationCategory}
								><option value="">No category</option
								>{#each categoryOptions as category (category)}<option value={category}
										>{category}</option
									>{/each}</select
							></label
						>
						<label
							>Plain-language summary<textarea
								bind:value={annotationSummary}
								maxlength="500"
								rows="3"
								placeholder="Explain what this document is and when members should use it."
							></textarea></label
						>
						<label
							>Search keywords and aliases<input
								bind:value={annotationKeywords}
								maxlength="300"
								placeholder="Examples: lockbox, closing checklist, reimbursement"
							/></label
						>
						<label class="document-featured-toggle"
							><input type="checkbox" bind:checked={annotationFeatured} /> Feature this document at the
							top of the library</label
						>
						<div>
							<button type="button" disabled={annotationSaving} onclick={saveAnnotation}
								>{annotationSaving ? 'Saving…' : 'Save details'}</button
							><span aria-live="polite">{annotationMessage}</span>
						</div>
					</div>
				</details>
			{/if}
		</div>
	</div>
{/if}
