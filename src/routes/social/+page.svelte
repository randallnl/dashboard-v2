<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		SocialLibraryAsset,
		SocialPlatform,
		SocialPost,
		SocialPostAsset,
		SocialPostReviewAction,
		SocialPostStatus
	} from '$lib/types/domain';
	import { onMount, untrack } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const platforms: Array<{ value: SocialPlatform; label: string }> = [
		{ value: 'facebook', label: 'Facebook' },
		{ value: 'instagram', label: 'Instagram' },
		{ value: 'tiktok', label: 'TikTok' },
		{ value: 'bluesky', label: 'Bluesky' },
		{ value: 'threads', label: 'Threads' },
		{ value: 'youtube', label: 'YouTube' }
	];
	const channelGuides: Record<SocialPlatform, string> = {
		facebook: 'Lead with the update, then make the next step clear.',
		instagram: 'Make the first line do the work before the “more” break.',
		tiktok: 'Keep the caption punchy and let the video carry the story.',
		bluesky: 'Use a compact version that makes sense on its own.',
		threads: 'Start a conversation with a clear point of view or question.',
		youtube: 'Use a descriptive title or description that sets up the video.'
	};

	type ContentTemplate = {
		label: string;
		body: (subject: string) => string;
	};
	const contentTemplates: ContentTemplate[] = [
		{
			label: 'Announcement',
			body: (subject) => `${subject} is coming up.\n\n[Why it matters]\n\n[What to do next]`
		},
		{
			label: 'Reminder',
			body: (subject) => `A quick reminder about ${subject}.\n\n[Key detail]\n\n[Call to action]`
		},
		{
			label: 'Day-of',
			body: (subject) =>
				`Today is the day: ${subject}.\n\n[Timing or location]\n\n[What to bring or expect]`
		},
		{
			label: 'Thank-you',
			body: (subject) =>
				`Thank you to everyone who made ${subject} happen.\n\n[Specific appreciation]\n\n[What comes next]`
		},
		{
			label: 'Volunteer call',
			body: (subject) =>
				`Want to help bring ${subject} to life?\n\n[What help is needed]\n\n[How to sign up]`
		}
	];

	type ProjectGraphic = { sourceUrl: string; filename: string };
	type ProjectReference = {
		source: 'project' | 'community';
		id: string;
		title: string;
		description?: string;
		details?: Array<{ label: string; value: string }>;
		assets?: ProjectGraphic[];
	};

	let posts = $state<SocialPost[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let saving = $state(false);
	let message = $state('');
	let failed = $state(false);
	let selectedId = $state('');
	let title = $state(untrack(() => data.starter?.title ?? 'New social post'));
	let copy = $state(untrack(() => data.starter?.body ?? ''));
	let status = $state<SocialPostStatus>('draft');
	let scheduledAt = $state('');
	let publishedAt = $state('');
	let publishedUrl = $state('');
	let selectedPlatforms = $state<SocialPlatform[]>(['instagram', 'facebook']);
	let channelCopies = $state<Partial<Record<SocialPlatform, string>>>({});
	let project = $state<ProjectReference | null>(untrack(() => data.starter?.project ?? null));
	let selectedProjectAssetUrls = $state<string[]>(
		untrack(() => data.starter?.project.assets.map((asset) => asset.sourceUrl) ?? [])
	);
	let projectPicker = $state('');
	let mediaFiles = $state<File[]>([]);
	let mediaInput = $state<HTMLInputElement>();
	let libraryAssets = $state<SocialLibraryAsset[]>(untrack(() => data.libraryAssets));
	let selectedLibraryAssetIds = $state<string[]>([]);
	let librarySearch = $state('');
	let libraryFile = $state<File | null>(null);
	let libraryFileInput = $state<HTMLInputElement>();
	let libraryAltText = $state('');
	let libraryTags = $state('');
	let libraryCredit = $state('');
	let librarySaving = $state(false);
	let reviewNote = $state('');
	let reviewSaving = $state(false);
	let calendarWeekOffset = $state(0);

	const selectedPost = $derived(posts.find((post) => post.id === selectedId) ?? null);
	const formHeading = $derived(selectedPost ? 'Edit content' : 'New content');
	const formLabel = $derived(selectedPost ? 'Save changes' : 'Save draft');
	const projectGraphics = $derived(project?.assets ?? []);
	const selectedProjectGraphicCount = $derived(selectedProjectAssetUrls.length);
	const selectedVisualCount = $derived(
		(selectedPost?.assets.length ?? 0) +
			mediaFiles.length +
			(selectedPost ? 0 : selectedProjectAssetUrls.length + selectedLibraryAssetIds.length)
	);
	const visibleLibraryAssets = $derived(
		libraryAssets.filter((asset) => {
			const query = librarySearch.trim().toLocaleLowerCase();
			if (!query) return true;
			return [asset.filename, asset.altText, asset.credit, ...asset.tags]
				.join(' ')
				.toLocaleLowerCase()
				.includes(query);
		})
	);
	const calendarDays = $derived.by(() => {
		const start = startOfWeek(calendarWeekOffset);
		return Array.from({ length: 7 }, (_, index) => {
			const date = new SvelteDate(start);
			date.setDate(start.getDate() + index);
			const key = calendarDateKey(date);
			return {
				date,
				key,
				posts: posts.filter(
					(post) => post.status === 'scheduled' && calendarDateKey(post.scheduledAt) === key
				)
			};
		});
	});
	const calendarRange = $derived(
		calendarDays.length
			? `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(calendarDays[0].date)} – ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(calendarDays.at(-1)!.date)}`
			: ''
	);

	function localDateTime(value: string): string {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		const pad = (part: number) => String(part).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
			date.getHours()
		)}:${pad(date.getMinutes())}`;
	}

	function toIso(value: string): string {
		if (!value) return '';
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '' : date.toISOString();
	}

	function dateLabel(value: string): string {
		if (!value) return 'No date set';
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					dateStyle: 'medium',
					timeStyle: 'short'
				}).format(date);
	}

	function calendarDateKey(value: Date | string): string {
		const date = typeof value === 'string' ? new Date(value) : value;
		if (Number.isNaN(date.getTime())) return '';
		const pad = (part: number) => String(part).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function startOfWeek(offset: number): Date {
		const date = new SvelteDate();
		date.setHours(0, 0, 0, 0);
		date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset * 7);
		return date;
	}

	function timeLabel(value: string): string {
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? ''
			: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
	}

	function assetUrl(asset: SocialPostAsset): string {
		return asset.storage === 'source' ? asset.sourceUrl : `/api/social/assets/${asset.id}`;
	}

	function isVideo(asset: SocialPostAsset): boolean {
		return asset.contentType.startsWith('video/') || /\.(mp4|mov)$/iu.test(asset.filename);
	}

	function libraryAssetUrl(asset: SocialLibraryAsset): string {
		return `/api/social/library/${asset.id}`;
	}

	function isLibraryVideo(asset: SocialLibraryAsset): boolean {
		return asset.contentType.startsWith('video/') || /\.(mp4|mov)$/iu.test(asset.filename);
	}

	function isPlatformSelected(platform: SocialPlatform): boolean {
		return selectedPlatforms.includes(platform);
	}

	function platformLabel(platform: SocialPlatform): string {
		return platforms.find((candidate) => candidate.value === platform)?.label ?? platform;
	}

	function togglePlatform(platform: SocialPlatform) {
		if (isPlatformSelected(platform)) {
			selectedPlatforms = selectedPlatforms.filter((candidate) => candidate !== platform);
			const { [platform]: removedCopy, ...remainingCopies } = channelCopies;
			void removedCopy;
			channelCopies = remainingCopies;
			return;
		}
		selectedPlatforms = [...selectedPlatforms, platform];
	}

	function channelCopy(platform: SocialPlatform): string {
		return channelCopies[platform] ?? copy;
	}

	function channelUsesSharedCopy(platform: SocialPlatform): boolean {
		return channelCopies[platform] === undefined;
	}

	function setChannelCopy(platform: SocialPlatform, value: string) {
		channelCopies = { ...channelCopies, [platform]: value };
	}

	function resetChannelCopy(platform: SocialPlatform) {
		const { [platform]: removedCopy, ...remainingCopies } = channelCopies;
		void removedCopy;
		channelCopies = remainingCopies;
	}

	function channelPreflight(platform: SocialPlatform): string[] {
		const checks: string[] = [];
		const channelText = channelCopy(platform).trim();
		if (!channelText) checks.push('Add copy for this channel.');
		if (channelText.length > 1000)
			checks.push('This is a long caption. Consider a shorter channel version.');
		if (!selectedVisualCount) checks.push('No visual is attached yet.');
		if (
			platform === 'youtube' &&
			!mediaFiles.some(isFileVideo) &&
			!selectedPost?.assets.some(isVideo)
		) {
			checks.push('Add a video, or use this version as a YouTube community update.');
		}
		return checks.length ? checks : ['Copy and visual reference are ready for review.'];
	}

	function isFileVideo(file: File): boolean {
		return file.type.startsWith('video/') || /\.(mp4|mov)$/iu.test(file.name);
	}

	function applyTemplate(template: ContentTemplate) {
		const templateBody = template.body(project?.title || '[Project name]');
		copy = copy.trim() ? `${copy.trim()}\n\n${templateBody}` : templateBody;
		channelCopies = {};
		message = `${template.label} outline added. Tailor the bracketed prompts before review.`;
		failed = false;
	}

	function reviewActionLabel(action: SocialPostReviewAction): string {
		return {
			submitted: 'Submitted for review',
			approved: 'Approved',
			changes_requested: 'Changes requested',
			commented: 'Commented'
		}[action];
	}

	function postStatusLabel(post: SocialPost): string {
		if (post.status !== 'review') return post.status;
		const decision = post.reviews.find(
			(review) => review.action === 'approved' || review.action === 'changes_requested'
		);
		if (decision?.action === 'approved') return 'Approved';
		if (decision?.action === 'changes_requested') return 'Changes';
		return 'Review';
	}

	function projectGraphicSelected(graphic: ProjectGraphic): boolean {
		return selectedProjectAssetUrls.includes(graphic.sourceUrl);
	}

	function toggleProjectGraphic(graphic: ProjectGraphic) {
		selectedProjectAssetUrls = projectGraphicSelected(graphic)
			? selectedProjectAssetUrls.filter((url) => url !== graphic.sourceUrl)
			: [...selectedProjectAssetUrls, graphic.sourceUrl];
	}

	function libraryAssetSelected(asset: SocialLibraryAsset): boolean {
		return selectedLibraryAssetIds.includes(asset.id);
	}

	function syncLibrarySelection(post: SocialPost) {
		const postKeys = new Set(
			post.assets.filter((asset) => asset.storage === 'r2').map((asset) => asset.objectKey)
		);
		selectedLibraryAssetIds = libraryAssets
			.filter((asset) => postKeys.has(asset.objectKey))
			.map((asset) => asset.id);
	}

	function resetEditor() {
		selectedId = '';
		title = 'New social post';
		copy = '';
		status = 'draft';
		scheduledAt = '';
		publishedAt = '';
		publishedUrl = '';
		selectedPlatforms = ['instagram', 'facebook'];
		channelCopies = {};
		project = null;
		selectedProjectAssetUrls = [];
		mediaFiles = [];
		selectedLibraryAssetIds = [];
		projectPicker = '';
		if (mediaInput) mediaInput.value = '';
		reviewNote = '';
		message = '';
		failed = false;
	}

	function openPost(post: SocialPost) {
		selectedId = post.id;
		title = post.title;
		copy = post.copy;
		status = post.status;
		scheduledAt = localDateTime(post.scheduledAt);
		publishedAt = localDateTime(post.publishedAt);
		publishedUrl = post.publishedUrl;
		selectedPlatforms = post.channels.map((channel) => channel.platform);
		channelCopies = Object.fromEntries(
			post.channels
				.filter((channel) => channel.copy !== post.copy)
				.map((channel) => [channel.platform, channel.copy])
		);
		project = post.projectSource
			? {
					source: post.projectSource,
					id: post.projectId,
					title: 'Linked project item',
					assets: post.assets
						.filter((asset) => asset.storage === 'source')
						.map((asset) => ({ sourceUrl: asset.sourceUrl, filename: asset.filename }))
				}
			: null;
		selectedProjectAssetUrls = post.assets
			.filter((asset) => asset.storage === 'source')
			.map((asset) => asset.sourceUrl);
		syncLibrarySelection(post);
		mediaFiles = [];
		if (mediaInput) mediaInput.value = '';
		reviewNote = '';
		message = '';
		failed = false;
	}

	function selectMedia(event: Event) {
		mediaFiles = Array.from((event.currentTarget as HTMLInputElement).files ?? []).slice(0, 6);
	}

	function selectLibraryFile(event: Event) {
		libraryFile = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
	}

	function startFromProject() {
		if (!projectPicker) return;
		window.location.assign(
			`${resolve('/social')}?source=project&id=${encodeURIComponent(projectPicker)}`
		);
	}

	async function loadPosts() {
		loading = true;
		loadError = '';
		try {
			const response = await fetch('/api/social/posts');
			const result = (await response.json()) as { posts?: SocialPost[]; message?: string };
			if (!response.ok || !result.posts)
				throw new Error(result.message || 'Could not load social content.');
			posts = result.posts;
		} catch (cause) {
			loadError = cause instanceof Error ? cause.message : 'Could not load social content.';
		} finally {
			loading = false;
		}
	}

	async function uploadMedia(post: SocialPost) {
		for (const file of mediaFiles) {
			const form = new FormData();
			form.append('asset', file, file.name);
			const response = await fetch(`/api/social/posts/${post.id}/assets`, {
				method: 'POST',
				body: form
			});
			const result = (await response.json()) as { post?: SocialPost; message?: string };
			if (!response.ok || !result.post)
				throw new Error(result.message || `Could not upload ${file.name}.`);
			post = result.post;
		}
		return post;
	}

	async function uploadLibraryAsset() {
		if (!libraryFile) return;
		librarySaving = true;
		failed = false;
		message = '';
		try {
			const form = new FormData();
			form.append('asset', libraryFile, libraryFile.name);
			form.append('altText', libraryAltText);
			form.append('tags', libraryTags);
			form.append('credit', libraryCredit);
			const response = await fetch('/api/social/library', { method: 'POST', body: form });
			const result = (await response.json()) as { asset?: SocialLibraryAsset; message?: string };
			if (!response.ok || !result.asset) {
				throw new Error(result.message || 'Could not add this asset to the library.');
			}
			libraryAssets = [result.asset, ...libraryAssets];
			libraryFile = null;
			libraryAltText = '';
			libraryTags = '';
			libraryCredit = '';
			if (libraryFileInput) libraryFileInput.value = '';
			message = result.message || 'Asset added to the shared library.';
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not add this asset to the library.';
		} finally {
			librarySaving = false;
		}
	}

	async function addLibraryAsset(asset: SocialLibraryAsset) {
		if (libraryAssetSelected(asset)) return;
		if (!selectedId) {
			selectedLibraryAssetIds = [...selectedLibraryAssetIds, asset.id];
			message = 'Library asset selected. It will be added when you save this draft.';
			failed = false;
			return;
		}
		failed = false;
		message = '';
		try {
			const response = await fetch(`/api/social/posts/${selectedId}/library-assets`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ assetIds: [asset.id] })
			});
			const result = (await response.json()) as { post?: SocialPost; message?: string };
			if (!response.ok || !result.post) {
				throw new Error(result.message || 'Could not add this library asset to the post.');
			}
			posts = [result.post, ...posts.filter((post) => post.id !== result.post!.id)];
			syncLibrarySelection(result.post);
			message = result.message || 'Library media added to this post.';
		} catch (cause) {
			failed = true;
			message =
				cause instanceof Error ? cause.message : 'Could not add this library asset to the post.';
		}
	}

	async function savePost() {
		if (!title.trim() || !copy.trim()) {
			failed = true;
			message = 'Add a title and post copy before saving.';
			return;
		}
		if (!selectedPlatforms.length) {
			failed = true;
			message = 'Choose at least one platform.';
			return;
		}
		saving = true;
		failed = false;
		message = '';
		try {
			const hasNewMedia = mediaFiles.length > 0;
			const payload = {
				title,
				copy,
				status,
				scheduledAt: toIso(scheduledAt),
				publishedAt: toIso(publishedAt),
				publishedUrl,
				platforms: selectedPlatforms,
				channelCopies: Object.fromEntries(
					selectedPlatforms.flatMap((platform) => {
						const channelVersion = channelCopies[platform]?.trim();
						return channelVersion && channelVersion !== copy.trim()
							? [[platform, channelVersion]]
							: [];
					})
				),
				...(selectedId
					? {}
					: {
							project: project ? { source: project.source, id: project.id } : null,
							projectAssetUrls: project ? selectedProjectAssetUrls : null,
							libraryAssetIds: selectedLibraryAssetIds
						})
			};
			const response = await fetch(
				selectedId ? `/api/social/posts/${selectedId}` : '/api/social/posts',
				{
					method: selectedId ? 'PATCH' : 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload)
				}
			);
			const result = (await response.json()) as { post?: SocialPost; message?: string };
			if (!response.ok || !result.post)
				throw new Error(result.message || 'Could not save this post.');
			const saved = await uploadMedia(result.post);
			posts = [saved, ...posts.filter((post) => post.id !== saved.id)];
			selectedId = saved.id;
			mediaFiles = [];
			if (mediaInput) mediaInput.value = '';
			message = hasNewMedia ? 'Post saved and media uploaded.' : result.message || 'Post saved.';
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not save this post.';
		} finally {
			saving = false;
		}
	}

	async function saveReview(action: SocialPostReviewAction) {
		if (!selectedId) {
			failed = true;
			message = 'Save the draft before adding review activity.';
			return;
		}
		if ((action === 'changes_requested' || action === 'commented') && !reviewNote.trim()) {
			failed = true;
			message = 'Add a note before sending this review action.';
			return;
		}
		reviewSaving = true;
		failed = false;
		message = '';
		try {
			const response = await fetch(`/api/social/posts/${selectedId}/reviews`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, note: reviewNote })
			});
			const result = (await response.json()) as { post?: SocialPost; message?: string };
			if (!response.ok || !result.post) {
				throw new Error(result.message || 'Could not save review activity.');
			}
			posts = [result.post, ...posts.filter((post) => post.id !== result.post!.id)];
			status = result.post.status;
			reviewNote = '';
			message = result.message || 'Review activity saved.';
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not save review activity.';
		} finally {
			reviewSaving = false;
		}
	}

	async function requestReview() {
		status = 'review';
		await savePost();
	}

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(copy);
			message = 'Copy is ready to paste into a social platform.';
			failed = false;
		} catch {
			failed = true;
			message = 'Your browser did not allow copying. Select the copy and paste it manually.';
		}
	}

	onMount(() => {
		void loadPosts();
	});
</script>

<svelte:head>
	<title>Social content · CoLab</title>
	<meta
		name="description"
		content="A shared social media drafting and scheduling workspace for CoLab."
	/>
</svelte:head>

<div class="social-workspace">
	<header class="dashboard-header social-header">
		<a class="brand" href={resolve('/')} aria-label="CoLab dashboard home">
			<span class="brand-mark" aria-hidden="true">Q</span><span>CoLab</span>
		</a>
		<nav aria-label="Workspace navigation">
			<a href={resolve('/#overview')}>Dashboard</a>
			<a href={resolve('/#admin')}>Projects</a>
			<a class="nav-active" href={resolve('/social')}>Social content</a>
		</nav>
		<div class="member-menu">
			<div>
				<strong>{data.member.preferredName}</strong><span>{data.member.membershipType}</span>
			</div>
			<form method="POST" action={resolve('/api/auth/logout')}>
				<button type="submit" class="text-button">Sign out</button>
			</form>
		</div>
	</header>

	<main class="social-main" id="main-content">
		<section class="social-hero">
			<div>
				<p class="eyebrow">Team content studio</p>
				<h1>Make the next post feel easy.</h1>
				<p>
					Draft once, shape it for the channels that matter, and keep every planned post in one
					shared place.
				</p>
			</div>
			<button type="button" onclick={resetEditor}>+ New post</button>
		</section>

		<section class="social-start-card" aria-labelledby="start-project-title">
			<div>
				<p class="eyebrow">Project shortcut</p>
				<h2 id="start-project-title">Start with a project</h2>
				<p>
					Pull a project’s name, date, description, and existing visual assets into a new draft.
				</p>
			</div>
			<div class="social-start-controls">
				<label>
					<span class="sr-only">Choose a project</span>
					<select bind:value={projectPicker}>
						<option value="">Choose a project item</option>
						{#each data.projectItems as item (item.id)}
							<option value={item.id}
								>{item.title}{item.dateValue ? ` · ${item.dateValue}` : ''}</option
							>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="secondary-action"
					onclick={startFromProject}
					disabled={!projectPicker}>Generate draft</button
				>
			</div>
		</section>

		<section class="social-calendar" aria-labelledby="social-calendar-title">
			<div class="social-calendar-heading">
				<div>
					<p class="eyebrow">Plan ahead</p>
					<h2 id="social-calendar-title">Weekly content calendar</h2>
					<p>{calendarRange}</p>
				</div>
				<div class="social-calendar-controls" aria-label="Calendar week controls">
					<button
						type="button"
						class="secondary-action"
						onclick={() => (calendarWeekOffset -= 1)}
						aria-label="Previous week">←</button
					>
					<button type="button" class="secondary-action" onclick={() => (calendarWeekOffset = 0)}
						>This week</button
					>
					<button
						type="button"
						class="secondary-action"
						onclick={() => (calendarWeekOffset += 1)}
						aria-label="Next week">→</button
					>
				</div>
			</div>
			<div class="social-calendar-grid">
				{#each calendarDays as day (day.key)}
					<section
						class:today={day.key === calendarDateKey(new Date())}
						class="social-calendar-day"
					>
						<header>
							<time datetime={day.key}>
								<span
									>{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day.date)}</span
								>
								<strong>{day.date.getDate()}</strong>
							</time>
						</header>
						{#if day.posts.length}
							<div class="social-calendar-posts">
								{#each day.posts as post (post.id)}
									<button
										type="button"
										class:selected={post.id === selectedId}
										class="social-calendar-post"
										onclick={() => openPost(post)}
									>
										<span>{timeLabel(post.scheduledAt)}</span><strong>{post.title}</strong>
									</button>
								{/each}
							</div>
						{:else}
							<p>No posts scheduled</p>
						{/if}
					</section>
				{/each}
			</div>
		</section>

		<section class="social-layout">
			<form
				class="social-editor"
				onsubmit={(event) => {
					event.preventDefault();
					void savePost();
				}}
			>
				<div class="social-editor-heading">
					<div>
						<p class="eyebrow">{selectedPost ? 'Working draft' : 'Create independently'}</p>
						<h2>{formHeading}</h2>
					</div>
					{#if selectedPost}
						<button type="button" class="text-button" onclick={resetEditor}>Create another</button>
					{/if}
				</div>

				{#if project}
					<p class="social-project-link">
						<span>From project</span><a
							href={resolve('/items/[source]/[id]', { source: project.source, id: project.id })}
							>{project.title}</a
						>
					</p>
					{#if !selectedPost}
						<section class="social-project-reference" aria-labelledby="project-reference-title">
							<div class="social-reference-heading">
								<div>
									<p class="eyebrow">Project reference</p>
									<h3 id="project-reference-title">{project.title}</h3>
								</div>
								{#if projectGraphics.length}
									<span
										>{selectedProjectGraphicCount}/{projectGraphics.length} graphics selected</span
									>
								{/if}
							</div>
							{#if project.details?.length}
								<dl class="social-reference-details">
									{#each project.details as detail (detail.label)}
										<div>
											<dt>{detail.label}</dt>
											<dd>{detail.value}</dd>
										</div>
									{/each}
								</dl>
							{/if}
							{#if project.description}
								<p class="social-reference-description">{project.description}</p>
							{/if}
							{#if projectGraphics.length}
								<fieldset class="social-project-graphic-picker">
									<legend>Use project graphics in this post</legend>
									<div>
										{#each projectGraphics as graphic (graphic.sourceUrl)}
											<label class:selected={projectGraphicSelected(graphic)}>
												<input
													type="checkbox"
													checked={projectGraphicSelected(graphic)}
													onchange={() => toggleProjectGraphic(graphic)}
												/>
												<img src={graphic.sourceUrl} alt="" />
												<span>{graphic.filename}</span>
											</label>
										{/each}
									</div>
								</fieldset>
							{:else}
								<p class="social-reference-empty">This project has no image attachments yet.</p>
							{/if}
						</section>
					{/if}
				{/if}

				<label class="social-title-field"
					><span>Working title</span><input bind:value={title} maxlength="160" required /></label
				>
				<label class="social-copy-field">
					<span>Post copy</span>
					<textarea
						bind:value={copy}
						rows="9"
						maxlength="10000"
						placeholder="Write the post…"
						required></textarea>
					<small>{copy.length}/10,000 characters</small>
				</label>

				<fieldset class="social-template-picker">
					<legend>Quick-start templates</legend>
					<p>Insert a reusable outline, then replace the bracketed prompts with the specifics.</p>
					<div>
						{#each contentTemplates as template (template.label)}
							<button type="button" onclick={() => applyTemplate(template)}>{template.label}</button
							>
						{/each}
					</div>
				</fieldset>

				<fieldset class="social-platform-picker">
					<legend>Where should this post go?</legend>
					<div>
						{#each platforms as platform (platform.value)}
							<label class:chosen={isPlatformSelected(platform.value)}>
								<input
									type="checkbox"
									checked={isPlatformSelected(platform.value)}
									onchange={() => togglePlatform(platform.value)}
								/>
								<span>{platform.label}</span>
							</label>
						{/each}
					</div>
				</fieldset>

				{#if selectedPlatforms.length}
					<fieldset class="social-channel-versions">
						<legend>Channel versions &amp; preflight</legend>
						<p>Keep the shared copy, or tailor a channel without creating a separate post.</p>
						<div>
							{#each selectedPlatforms as platform (platform)}
								<section class="social-channel-version">
									<header>
										<div>
											<strong>{platformLabel(platform)}</strong>
											<span
												>{channelUsesSharedCopy(platform)
													? 'Using shared copy'
													: 'Custom version'}</span
											>
										</div>
										<span>{channelCopy(platform).length} characters</span>
									</header>
									<textarea
										value={channelCopy(platform)}
										rows="4"
										maxlength="10000"
										oninput={(event) =>
											setChannelCopy(platform, (event.currentTarget as HTMLTextAreaElement).value)}
									></textarea>
									<div class="social-channel-version-footer">
										<ul>
											<li class="social-channel-version-guide">{channelGuides[platform]}</li>
											{#each channelPreflight(platform) as check (check)}
												<li>{check}</li>
											{/each}
										</ul>
										{#if !channelUsesSharedCopy(platform)}
											<button type="button" onclick={() => resetChannelCopy(platform)}
												>Use shared copy</button
											>
										{/if}
									</div>
								</section>
							{/each}
						</div>
					</fieldset>
				{/if}

				<div class="social-schedule-grid">
					<label>
						<span>Workflow</span>
						<select bind:value={status}>
							<option value="draft">Draft</option>
							<option value="review">Ready for review</option>
							<option value="scheduled">Scheduled</option>
							<option value="published">Published manually</option>
						</select>
					</label>
					{#if status === 'scheduled'}
						<label
							><span>Publish time</span><input
								bind:value={scheduledAt}
								type="datetime-local"
								required
							/></label
						>
					{:else if status === 'published'}
						<label
							><span>Published time</span><input
								bind:value={publishedAt}
								type="datetime-local"
								required
							/></label
						>
					{/if}
				</div>
				{#if status === 'published'}
					<label
						><span>Live post link (optional)</span><input
							bind:value={publishedUrl}
							type="url"
							placeholder="https://…"
						/></label
					>
				{/if}

				<label class="social-media-input">
					<span>Visuals</span>
					<input
						bind:this={mediaInput}
						type="file"
						accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
						multiple
						onchange={selectMedia}
					/>
					<small>JPG, PNG, GIF, WebP, MP4, or MOV · up to 20 MB per file</small>
					{#if mediaFiles.length}<strong
							>{mediaFiles.length} file{mediaFiles.length === 1 ? '' : 's'} ready to upload</strong
						>{/if}
				</label>

				{#if selectedPost}
					<section class="social-review-workflow" aria-labelledby="review-workflow-title">
						<div class="social-review-heading">
							<div>
								<p class="eyebrow">Team review</p>
								<h3 id="review-workflow-title">Approval trail</h3>
							</div>
							<span class={`social-status ${selectedPost.status}`}
								>{postStatusLabel(selectedPost)}</span
							>
						</div>
						<p>
							Keep feedback and decisions beside the draft so the next person knows exactly what is
							ready to schedule.
						</p>
						<label>
							<span>Review note</span>
							<textarea
								bind:value={reviewNote}
								rows="3"
								maxlength="2000"
								placeholder="Share feedback, context, or an approval note…"></textarea>
						</label>
						<div class="social-review-actions">
							{#if selectedPost.status !== 'review'}
								<button
									type="button"
									onclick={() => void requestReview()}
									disabled={saving || reviewSaving}>Request review</button
								>
							{:else}
								<button
									type="button"
									class="approve-action"
									onclick={() => void saveReview('approved')}
									disabled={reviewSaving}>Approve</button
								>
								<button
									type="button"
									class="secondary-action"
									onclick={() => void saveReview('changes_requested')}
									disabled={reviewSaving}>Request changes</button
								>
							{/if}
							<button
								type="button"
								class="secondary-action"
								onclick={() => void saveReview('commented')}
								disabled={reviewSaving || !reviewNote.trim()}>Add comment</button
							>
						</div>
						{#if selectedPost.reviews.length}
							<ol class="social-review-history">
								{#each selectedPost.reviews as review (review.id)}
									<li>
										<div>
											<strong>{review.memberName}</strong>
											<span>{reviewActionLabel(review.action)}</span>
											<time datetime={review.createdAt}>{dateLabel(review.createdAt)}</time>
										</div>
										{#if review.note}<p>{review.note}</p>{/if}
									</li>
								{/each}
							</ol>
						{:else}
							<p class="social-review-empty">No review activity yet.</p>
						{/if}
					</section>
				{/if}

				<div class="social-editor-actions">
					<button type="submit" disabled={saving}>{saving ? 'Saving…' : formLabel}</button>
					<button
						type="button"
						class="secondary-action"
						onclick={copyToClipboard}
						disabled={!copy.trim()}>Copy text</button
					>
				</div>
				{#if message}<p
						class:form-error={failed}
						class="social-message"
						role={failed ? 'alert' : 'status'}
					>
						{message}
					</p>{/if}
				<p class="social-integration-note">
					Scheduled posts stay in this shared queue. Direct publishing will become available after
					each social account is connected.
				</p>
			</form>

			<aside class="social-posts" aria-labelledby="social-posts-title">
				<div class="social-list-heading">
					<div>
						<p class="eyebrow">Shared queue</p>
						<h2 id="social-posts-title">Content calendar</h2>
					</div>
					<span>{posts.length}</span>
				</div>
				{#if loading}
					<p class="social-empty">Loading the team’s drafts…</p>
				{:else if loadError}
					<div class="social-empty">
						<p>{loadError}</p>
						<button type="button" onclick={loadPosts}>Try again</button>
					</div>
				{:else if !posts.length}
					<p class="social-empty">
						No social posts yet. Create a draft from scratch or start with a project.
					</p>
				{:else}
					<div class="social-post-list">
						{#each posts as post (post.id)}
							<button
								type="button"
								class:selected={post.id === selectedId}
								class="social-post-card"
								onclick={() => openPost(post)}
							>
								<div class="social-card-media">
									{#if post.assets[0]}
										{#if isVideo(post.assets[0])}
											<span aria-label="Video attachment">▶</span>
										{:else}
											<img src={assetUrl(post.assets[0])} alt="" />
										{/if}
									{:else}<span aria-hidden="true">✦</span>{/if}
								</div>
								<div>
									<div class="social-card-title">
										<strong>{post.title}</strong><span class={`social-status ${post.status}`}
											>{postStatusLabel(post)}</span
										>
									</div>
									<p>{post.copy}</p>
									<div class="social-card-meta">
										<span
											>{post.channels
												.map(
													(channel) =>
														platforms.find((platform) => platform.value === channel.platform)?.label
												)
												.join(' · ')}</span
										>
										{#if post.scheduledAt}<time datetime={post.scheduledAt}
												>{dateLabel(post.scheduledAt)}</time
											>{/if}
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</aside>
		</section>

		<section class="social-asset-library" aria-labelledby="asset-library-title">
			<header class="social-library-heading">
				<div>
					<p class="eyebrow">Shared resources</p>
					<h2 id="asset-library-title">Asset library</h2>
					<p>Keep approved graphics and video in one private place, ready for the next draft.</p>
				</div>
				<span>{libraryAssets.length}</span>
			</header>
			<div class="social-library-layout">
				<form
					class="social-library-upload"
					onsubmit={(event) => {
						event.preventDefault();
						void uploadLibraryAsset();
					}}
				>
					<h3>Add an asset</h3>
					<p>Upload it once, then reuse it across drafts without creating another copy.</p>
					<label>
						<span>File</span>
						<input
							bind:this={libraryFileInput}
							type="file"
							accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
							onchange={selectLibraryFile}
						/>
						<small>JPG, PNG, GIF, WebP, MP4, or MOV · up to 20 MB</small>
					</label>
					<label>
						<span>Alt text</span>
						<textarea
							bind:value={libraryAltText}
							rows="3"
							maxlength="1000"
							placeholder="Describe the visual for teammates and accessibility"></textarea>
					</label>
					<label>
						<span>Tags</span>
						<input
							bind:value={libraryTags}
							maxlength="1000"
							placeholder="event, volunteers, pride"
						/>
					</label>
					<label>
						<span>Credit or usage note</span>
						<input
							bind:value={libraryCredit}
							maxlength="500"
							placeholder="Photo by… or usage reminder"
						/>
					</label>
					<button type="submit" disabled={librarySaving || !libraryFile}
						>{librarySaving ? 'Adding…' : 'Add to library'}</button
					>
				</form>

				<div class="social-library-browser">
					<label class="social-library-search">
						<span>Find an asset</span>
						<input bind:value={librarySearch} placeholder="Search filenames, tags, or notes" />
					</label>
					{#if visibleLibraryAssets.length}
						<div class="social-library-grid">
							{#each visibleLibraryAssets as asset (asset.id)}
								<article class:selected={libraryAssetSelected(asset)} class="social-library-card">
									<div class="social-library-media">
										{#if isLibraryVideo(asset)}
											<span aria-label="Video asset">▶</span>
										{:else}
											<img src={libraryAssetUrl(asset)} alt={asset.altText} />
										{/if}
									</div>
									<div class="social-library-card-body">
										<strong title={asset.filename}>{asset.filename}</strong>
										{#if asset.tags.length}
											<p class="social-library-tags">{asset.tags.join(' · ')}</p>
										{/if}
										{#if asset.credit}<p class="social-library-credit">{asset.credit}</p>{/if}
										{#if libraryAssetSelected(asset)}
											<span class="social-library-selected"
												>{selectedId ? 'Already on post' : 'Selected for draft'}</span
											>
										{:else}
											<button type="button" onclick={() => void addLibraryAsset(asset)}
												>{selectedId ? 'Add to post' : 'Select for draft'}</button
											>
										{/if}
									</div>
								</article>
							{/each}
						</div>
					{:else}
						<p class="social-library-empty">
							{librarySearch.trim()
								? 'No shared assets match that search.'
								: 'No shared assets yet. Add the first visual for the team.'}
						</p>
					{/if}
				</div>
			</div>
		</section>
	</main>
</div>
