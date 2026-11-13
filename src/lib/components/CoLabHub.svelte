<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import RetailPanel from '$lib/components/RetailPanel.svelte';
	import CalendarPanel from '$lib/components/CalendarPanel.svelte';
	import CoLabUpcomingEventsRail from '$lib/components/CoLabUpcomingEventsRail.svelte';
	import ContentState from '$lib/components/ContentState.svelte';
	import DocumentLibrary from '$lib/components/DocumentLibrary.svelte';
	import ShiftPanel from '$lib/components/ShiftPanel.svelte';
	import VotePanel from '$lib/components/VotePanel.svelte';
	import WorkTradePanel from '$lib/components/WorkTradePanel.svelte';
	import type { MemberCapabilities, ProjectEventRecord, Shift } from '$lib/types/domain';

	type CoLabSubpage = 'schedule' | 'resources' | 'documents' | 'retail';

	let {
		capabilities,
		viewerCapabilities,
		isViewingAs,
		lockboxCode,
		websiteUrl,
		creativeGroundUrl,
		initialAvailableShifts,
		upcomingCoLabEvents
	}: {
		capabilities: MemberCapabilities;
		viewerCapabilities: MemberCapabilities;
		isViewingAs: boolean;
		lockboxCode: string;
		websiteUrl: string;
		creativeGroundUrl: string;
		initialAvailableShifts: Shift[];
		upcomingCoLabEvents: ProjectEventRecord[];
	} = $props();

	const activeSubpage = $derived.by<CoLabSubpage>(() => {
		const requestedTab = page.url.searchParams.get('tab');
		if (requestedTab === 'retail') return 'retail';
		if (requestedTab === 'resources') return 'resources';
		if (requestedTab === 'documents') return 'documents';

		const legacyView = page.url.searchParams.get('view');
		if (legacyView === 'documents') return 'documents';
		if (['resources', 'votes', 'work-trade'].includes(legacyView ?? '')) {
			return 'resources';
		}

		return 'schedule';
	});
</script>

<section class="colab-hub" id="colab" aria-labelledby="colab-title">
	<header class="workspace-page-heading">
		<div>
			<p class="eyebrow">Shared member workspace</p>
			<h1 id="colab-title">CoLab</h1>
		</div>
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<nav class="colab-subnav" aria-label="CoLab sections">
			<a class:active={activeSubpage === 'retail'} href={`${resolve('/')}?view=colab&tab=retail`}
				>Retail</a
			>
			<a
				class:active={activeSubpage === 'schedule'}
				href={`${resolve('/')}?view=colab&tab=schedule`}>Schedule &amp; sign-ups</a
			>
			<a
				class:active={activeSubpage === 'resources'}
				href={`${resolve('/')}?view=colab&tab=resources`}>Resources &amp; tools</a
			>
			<a
				class:active={activeSubpage === 'documents'}
				href={`${resolve('/')}?view=colab&tab=documents`}>Documents</a
			>
		</nav>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</header>

	{#if activeSubpage === 'schedule'}
		<div class="colab-schedule-layout">
			{#if capabilities.canViewCalendar}
				<CoLabUpcomingEventsRail events={upcomingCoLabEvents} />
			{/if}
			<div class="colab-hub-content colab-schedule-content">
				{#if capabilities.canViewCalendar}
					<CalendarPanel
						isAdmin={viewerCapabilities.isAdmin && !isViewingAs}
						readOnly={isViewingAs}
					/>
				{/if}
				{#if capabilities.canViewShifts}
					<ShiftPanel
						isAdmin={viewerCapabilities.isAdmin && !isViewingAs}
						readOnly={isViewingAs}
						{initialAvailableShifts}
					/>
				{/if}
				{#if !capabilities.canViewCalendar && !capabilities.canViewShifts}
					<ContentState
						kind="empty"
						title="Schedule access is not available"
						message="Your membership does not currently include the CoLab schedule or studio shift sign-ups."
					/>
				{/if}
			</div>
		</div>
	{:else if activeSubpage === 'retail'}
		<RetailPanel canManage={viewerCapabilities.isAdmin && !isViewingAs} />
	{:else if activeSubpage === 'resources'}
		<div class="colab-hub-content colab-resources-content">
			<article class="resources-card dashboard-top-resources" id="resources">
				<p class="eyebrow">Quick links</p>
				<h2>Resources</h2>
				<div class="resource-links">
					{#if lockboxCode}
						<div class="resource-detail">
							<span>Studio lock-box code</span>
							<code>{lockboxCode}</code>
						</div>
					{/if}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href="https://portal.queerlective.com/login" target="_blank" rel="noreferrer">
						<span>Manage CoLab member retail</span><span aria-hidden="true">↗</span>
					</a>
					{#if capabilities.canSubmitCommunityEvents}
						<a href="https://wkf.ms/4aSHDGu" target="_blank" rel="noreferrer">
							<span>Submit a community-led event</span><span aria-hidden="true">↗</span>
						</a>
					{/if}
					<a href="https://wkf.ms/4sNxnqk" target="_blank" rel="noreferrer">
						<span>Request materials or equipment</span><span aria-hidden="true">↗</span>
					</a>
					<a href="mailto:Randall@queerlective.com">
						<span>Contact CoLab support</span><span aria-hidden="true">→</span>
					</a>
					{#if websiteUrl}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={websiteUrl} target="_blank" rel="noreferrer">
							<span>Your website</span><span aria-hidden="true">↗</span>
						</a>
					{/if}
					{#if creativeGroundUrl}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={creativeGroundUrl} target="_blank" rel="noreferrer">
							<span>Your CreativeGround profile</span><span aria-hidden="true">↗</span>
						</a>
					{/if}
				</div>
			</article>

			{#if capabilities.canVote}
				<VotePanel isAdmin={viewerCapabilities.isAdmin && !isViewingAs} readOnly={isViewingAs} />
			{/if}
			<WorkTradePanel isAdmin={viewerCapabilities.isAdmin && !isViewingAs} readOnly={isViewingAs} />
		</div>
	{:else}
		<div class="colab-hub-content colab-documents-content">
			<DocumentLibrary />
		</div>
	{/if}
</section>
