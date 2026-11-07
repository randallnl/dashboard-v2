<script lang="ts">
	import CalendarPanel from '$lib/components/CalendarPanel.svelte';
	import CalendarCampaignModeration from '$lib/components/CalendarCampaignModeration.svelte';
	import AdminProjectsPanel from '$lib/components/AdminProjectsPanel.svelte';
	import ContentState from '$lib/components/ContentState.svelte';
	import DocumentLibrary from '$lib/components/DocumentLibrary.svelte';
	import MemberHistoryPanel from '$lib/components/MemberHistoryPanel.svelte';
	import MemberPortalNavigation from '$lib/components/MemberPortalNavigation.svelte';
	import NotificationCenter from '$lib/components/NotificationCenter.svelte';
	import ShiftPanel from '$lib/components/ShiftPanel.svelte';
	import UpcomingMemberPanel from '$lib/components/UpcomingMemberPanel.svelte';
	import ViewAsControl from '$lib/components/ViewAsControl.svelte';
	import VotePanel from '$lib/components/VotePanel.svelte';
	import WorkTradePanel from '$lib/components/WorkTradePanel.svelte';
	import type {
		Member,
		MemberCapabilities,
		Shift,
		UpcomingProjectAssignment
	} from '$lib/types/domain';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let {
		viewer,
		member,
		capabilities,
		viewerCapabilities,
		isViewingAs,
		lockboxCode,
		initialAvailableShifts,
		upcomingMemberShifts,
		upcomingProjects
	}: {
		viewer: Member;
		member: Member;
		capabilities: MemberCapabilities;
		viewerCapabilities: MemberCapabilities;
		isViewingAs: boolean;
		lockboxCode: string;
		initialAvailableShifts: Shift[];
		upcomingMemberShifts: Shift[];
		upcomingProjects: UpcomingProjectAssignment[];
	} = $props();

	const firstName = $derived(member.preferredName.split(/\s+/u)[0] || member.preferredName);
	const hasProfileDetails = $derived(
		Boolean(
			member.businessName ||
			member.phone ||
			member.website ||
			member.socialMedia ||
			member.creativeGroundUrl ||
			member.artistDescription
		)
	);
	const websiteUrl = $derived(safeExternalUrl(member.website));
	const creativeGroundUrl = $derived(safeExternalUrl(member.creativeGroundUrl));
	type DashboardView =
		| 'overview'
		| 'resources'
		| 'documents'
		| 'shifts'
		| 'calendar'
		| 'votes'
		| 'work-trade'
		| 'history'
		| 'profile'
		| 'admin';
	const dashboardViews: DashboardView[] = [
		'overview',
		'resources',
		'documents',
		'shifts',
		'calendar',
		'votes',
		'work-trade',
		'history',
		'profile',
		'admin'
	];
	const activeSection = $derived.by(() => {
		const requested = page.url.searchParams.get('view');
		if (!dashboardViews.includes(requested as DashboardView)) return 'overview';
		if (requested === 'shifts' && capabilities.canViewCalendar && capabilities.canViewShifts) {
			return 'calendar';
		}
		if (requested === 'shifts' && !capabilities.canViewShifts) return 'overview';
		if (requested === 'calendar' && !capabilities.canViewCalendar) return 'overview';
		if (requested === 'votes' && !capabilities.canVote) return 'overview';
		if (requested === 'admin' && (!viewerCapabilities.isAdmin || isViewingAs)) {
			return 'overview';
		}
		return requested as DashboardView;
	});
	function safeExternalUrl(value: string): string {
		if (!value) return '';
		try {
			const url = new URL(value.startsWith('www.') ? `https://${value}` : value);
			return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
		} catch {
			return '';
		}
	}

	onMount(() => {
		const rememberDetailPosition = (event: MouseEvent) => {
			const target = event.target instanceof Element ? event.target.closest('a') : null;
			if (target?.getAttribute('href')?.startsWith('/items/')) {
				sessionStorage.setItem('colab-dashboard-scroll', String(window.scrollY));
			}
		};
		const savedPosition = sessionStorage.getItem('colab-dashboard-scroll');
		if (savedPosition) {
			sessionStorage.removeItem('colab-dashboard-scroll');
			requestAnimationFrame(() =>
				requestAnimationFrame(() =>
					window.scrollTo({ top: Number(savedPosition), behavior: 'instant' })
				)
			);
		}
		document.addEventListener('click', rememberDetailPosition);
		return () => {
			document.removeEventListener('click', rememberDetailPosition);
		};
	});
</script>

<div class="dashboard-shell">
	<header class="dashboard-header">
		<a class="brand" href={resolve('/')} aria-label="CoLab dashboard home">
			<span class="brand-mark" aria-hidden="true">Q</span>
			<span>CoLab</span>
		</a>
		<MemberPortalNavigation active={activeSection} {capabilities} {viewerCapabilities} {isViewingAs} />
		<div class="dashboard-header-actions">
			<NotificationCenter
				shifts={upcomingMemberShifts}
				projects={upcomingProjects}
				availableShifts={initialAvailableShifts}
				canVote={capabilities.canVote}
				readOnly={isViewingAs}
			/>
			<div class="member-menu">
				<div>
					<strong>{member.preferredName}</strong>
					<span>{member.membershipType}</span>
				</div>
				<form method="POST" action={resolve('/api/auth/logout')}>
					<button type="submit" class="text-button">Sign out</button>
				</form>
			</div>
		</div>
	</header>

	{#if viewerCapabilities.isAdmin}
		<ViewAsControl {viewer} {member} {isViewingAs} />
	{/if}

	<main class="dashboard-main" id="main-content">
		{#if activeSection === 'overview'}
			<section class="welcome-card" id="overview">
				<div>
					<p class="eyebrow">Member overview</p>
					<h1>Hi, {firstName}.</h1>
					<p>Here’s what’s coming up for you at the CoLab.</p>
				</div>
				<span class="membership-pill">{member.membershipType || 'CoLab Member'}</span>
			</section>

			<UpcomingMemberPanel
				shifts={upcomingMemberShifts}
				projects={upcomingProjects}
				availableShifts={initialAvailableShifts}
				readOnly={isViewingAs}
			/>
		{/if}

		{#if activeSection === 'resources'}<article
				class="resources-card dashboard-top-resources"
				id="resources"
			>
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
			</article>{/if}

		{#if activeSection === 'shifts' && capabilities.canViewShifts}
			<ShiftPanel
				isAdmin={viewerCapabilities.isAdmin && !isViewingAs}
				readOnly={isViewingAs}
				{initialAvailableShifts}
			/>
		{/if}

		{#if activeSection === 'calendar' && capabilities.canViewCalendar}
			{#if capabilities.canViewShifts}
				<ShiftPanel
					isAdmin={viewerCapabilities.isAdmin && !isViewingAs}
					readOnly={isViewingAs}
					{initialAvailableShifts}
				/>
			{/if}
			<CalendarPanel isAdmin={viewerCapabilities.isAdmin && !isViewingAs} readOnly={isViewingAs} />
		{/if}

		{#if activeSection === 'votes' && capabilities.canVote}
			<VotePanel isAdmin={viewerCapabilities.isAdmin && !isViewingAs} readOnly={isViewingAs} />
		{/if}

		{#if activeSection === 'work-trade'}
			<WorkTradePanel isAdmin={viewerCapabilities.isAdmin && !isViewingAs} readOnly={isViewingAs} />
		{/if}

		{#if activeSection === 'history'}
			<MemberHistoryPanel canViewOrders={capabilities.canViewOpenOrders} />
		{/if}

		{#if activeSection === 'documents'}
			<DocumentLibrary />
		{/if}

		{#if activeSection === 'profile'}<section
				class="member-details-grid profile-only"
				id="profile"
				aria-label="Member identity"
			>
				<article class="profile-card">
					<div class="section-heading compact">
						<div>
							<p class="eyebrow">Member identity</p>
							<h2>Profile</h2>
						</div>
						<span class="member-id">ID {member.id}</span>
					</div>
					<dl class="profile-list">
						<div>
							<dt>Preferred name</dt>
							<dd>{member.preferredName}</dd>
						</div>
						<div>
							<dt>Email</dt>
							<dd>{member.email}</dd>
						</div>
						{#if member.businessName}<div>
								<dt>Business</dt>
								<dd>{member.businessName}</dd>
							</div>{/if}
						{#if member.phone}<div>
								<dt>Phone</dt>
								<dd>{member.phone}</dd>
							</div>{/if}
						{#if member.signUpDate}<div>
								<dt>Member since</dt>
								<dd>{member.signUpDate}</dd>
							</div>{/if}
					</dl>
					{#if !hasProfileDetails}
						<ContentState
							kind="empty"
							title="Your basic membership is connected"
							message="Additional profile details can be added through the CoLab team."
						/>
					{/if}
				</article>
			</section>{/if}

		{#if activeSection === 'admin' && viewerCapabilities.isAdmin && !isViewingAs}
			<AdminProjectsPanel isAdmin />
			<CalendarCampaignModeration />
		{/if}
	</main>

</div>
