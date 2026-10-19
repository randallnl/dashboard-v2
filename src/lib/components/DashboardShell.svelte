<script lang="ts">
	import CalendarPanel from '$lib/components/CalendarPanel.svelte';
	import AdminProjectsPanel from '$lib/components/AdminProjectsPanel.svelte';
	import ContentState from '$lib/components/ContentState.svelte';
	import MemberHistoryPanel from '$lib/components/MemberHistoryPanel.svelte';
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
		if (requested === 'shifts' && !capabilities.canViewShifts) return 'overview';
		if (requested === 'calendar' && !capabilities.canViewCalendar) return 'overview';
		if (requested === 'votes' && !capabilities.canVote) return 'overview';
		if (requested === 'admin' && (!viewerCapabilities.canManageProjects || isViewingAs)) {
			return 'overview';
		}
		return requested as DashboardView;
	});
	let moreMenuOpen = $state(false);
	function dashboardHref(view: DashboardView): string {
		return view === 'overview' ? resolve('/') : `${resolve('/')}?view=${view}`;
	}

	function safeExternalUrl(value: string): string {
		if (!value) return '';
		try {
			const url = new URL(value.startsWith('www.') ? `https://${value}` : value);
			return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
		} catch {
			return '';
		}
	}

	function closeMobileMenu() {
		moreMenuOpen = false;
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

<svelte:window onkeydown={(event) => event.key === 'Escape' && closeMobileMenu()} />

<div class="dashboard-shell">
	<header class="dashboard-header">
		<a class="brand" href={resolve('/')} aria-label="CoLab dashboard home">
			<span class="brand-mark" aria-hidden="true">Q</span>
			<span>CoLab</span>
		</a>
		<!-- dashboardHref resolves the root route before adding the selected view query -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<nav aria-label="Member navigation">
			<a class:nav-active={activeSection === 'overview'} href={dashboardHref('overview')}
				>Overview</a
			>
			{#if capabilities.canViewShifts}
				<a class:nav-active={activeSection === 'shifts'} href={dashboardHref('shifts')}>Shifts</a>
			{/if}
			{#if capabilities.canViewCalendar}
				<a class:nav-active={activeSection === 'calendar'} href={dashboardHref('calendar')}
					>Calendar</a
				>
			{/if}
			{#if capabilities.canVote}
				<a class:nav-active={activeSection === 'votes'} href={dashboardHref('votes')}>Votes</a>
			{/if}
			<a class:nav-active={activeSection === 'work-trade'} href={dashboardHref('work-trade')}
				>Work trade</a
			>
			<a class:nav-active={activeSection === 'history'} href={dashboardHref('history')}>History</a>
			<a class:nav-active={activeSection === 'resources'} href={dashboardHref('resources')}
				>Resources</a
			>
			<a class:nav-active={activeSection === 'profile'} href={dashboardHref('profile')}>Profile</a>
			{#if viewerCapabilities.canManageProjects && !isViewingAs}
				<a class:nav-active={activeSection === 'admin'} href={dashboardHref('admin')}>
					{viewerCapabilities.isAdmin ? 'Admin' : 'Projects'}
				</a>
				<a href={resolve('/social')}>Social</a>
			{/if}
		</nav>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
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

		{#if activeSection === 'admin' && viewerCapabilities.canManageProjects && !isViewingAs}
			<AdminProjectsPanel isAdmin={viewerCapabilities.isAdmin} />
		{/if}
	</main>

	<!-- dashboardHref resolves the root route before adding the selected view query -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<nav class="mobile-nav dashboard-mobile-nav" aria-label="Mobile member navigation">
		<a class:active={activeSection === 'overview'} href={dashboardHref('overview')}>Overview</a>
		{#if capabilities.canViewCalendar}
			<a class:active={activeSection === 'calendar'} href={dashboardHref('calendar')}>Calendar</a>
		{:else if capabilities.canViewShifts}
			<a class:active={activeSection === 'shifts'} href={dashboardHref('shifts')}>Shifts</a>
		{:else}
			<a class:active={activeSection === 'history'} href={dashboardHref('history')}>History</a>
		{/if}
		<a class:active={activeSection === 'resources'} href={dashboardHref('resources')}>Resources</a>
		<button
			type="button"
			class:active={moreMenuOpen ||
				['votes', 'work-trade', 'history', 'profile', 'admin'].includes(activeSection)}
			aria-expanded={moreMenuOpen}
			aria-controls="mobile-more-menu"
			onclick={() => (moreMenuOpen = !moreMenuOpen)}
		>
			More
		</button>
	</nav>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	{#if moreMenuOpen}
		<button
			class="mobile-more-backdrop"
			type="button"
			aria-label="Close more navigation"
			onclick={closeMobileMenu}
		></button>
		<div class="mobile-more-menu" id="mobile-more-menu">
			<div>
				<p class="eyebrow">Navigate</p>
				<h2>More</h2>
				<button type="button" class="text-button" onclick={closeMobileMenu}>Close</button>
			</div>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<nav aria-label="More dashboard sections">
				{#if capabilities.canViewShifts}<a href={dashboardHref('shifts')} onclick={closeMobileMenu}
						>Shifts</a
					>{/if}
				{#if capabilities.canVote}<a href={dashboardHref('votes')} onclick={closeMobileMenu}
						>Community votes</a
					>{/if}
				<a href={dashboardHref('work-trade')} onclick={closeMobileMenu}>Work-trade discount</a>
				<a href={dashboardHref('history')} onclick={closeMobileMenu}>History and payments</a>
				<a href={dashboardHref('resources')} onclick={closeMobileMenu}>Resources</a>
				<a href={dashboardHref('profile')} onclick={closeMobileMenu}>Profile</a>
				{#if viewerCapabilities.canManageProjects && !isViewingAs}
					<a href={dashboardHref('admin')} onclick={closeMobileMenu}>Project management</a>
					<a href={resolve('/social')} onclick={closeMobileMenu}>Social content</a>
				{/if}
			</nav>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	{/if}
</div>
