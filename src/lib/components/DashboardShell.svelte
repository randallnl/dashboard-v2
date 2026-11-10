<script lang="ts">
	import CalendarCampaignModeration from '$lib/components/CalendarCampaignModeration.svelte';
	import CoLabHub from '$lib/components/CoLabHub.svelte';
	import ContentState from '$lib/components/ContentState.svelte';
	import MemberHistoryPanel from '$lib/components/MemberHistoryPanel.svelte';
	import MemberPortalNavigation from '$lib/components/MemberPortalNavigation.svelte';
	import NotificationCenter from '$lib/components/NotificationCenter.svelte';
	import UpcomingMemberPanel from '$lib/components/UpcomingMemberPanel.svelte';
	import ViewAsControl from '$lib/components/ViewAsControl.svelte';
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
		| 'colab'
		| 'history'
		| 'profile'
		| 'admin';
	const dashboardViews: DashboardView[] = ['overview', 'colab', 'history', 'profile', 'admin'];
	const activeSection = $derived.by(() => {
		const requested = page.url.searchParams.get('view');
		if (
			['resources', 'documents', 'shifts', 'calendar', 'votes', 'work-trade'].includes(
				requested ?? ''
			)
		) {
			return 'colab';
		}
		if (!dashboardViews.includes(requested as DashboardView)) return 'overview';
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

		{#if activeSection === 'colab'}
			<CoLabHub
				{capabilities}
				{viewerCapabilities}
				{isViewingAs}
				{lockboxCode}
				{websiteUrl}
				{creativeGroundUrl}
				{initialAvailableShifts}
			/>
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

		{#if activeSection === 'admin' && viewerCapabilities.isAdmin && !isViewingAs}
			<CalendarCampaignModeration />
		{/if}
	</main>

</div>
