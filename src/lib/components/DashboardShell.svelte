<script lang="ts">
	import CalendarCampaignModeration from '$lib/components/CalendarCampaignModeration.svelte';
	import AdminActivityFeed from '$lib/components/AdminActivityFeed.svelte';
	import CoLabHub from '$lib/components/CoLabHub.svelte';
	import ContentState from '$lib/components/ContentState.svelte';
	import MemberHistoryPanel from '$lib/components/MemberHistoryPanel.svelte';
	import MemberPortalNavigation from '$lib/components/MemberPortalNavigation.svelte';
	import NotificationCenter from '$lib/components/NotificationCenter.svelte';
	import UpcomingMemberPanel from '$lib/components/UpcomingMemberPanel.svelte';
	import ViewAsControl from '$lib/components/ViewAsControl.svelte';
	import type {
		DashboardActivity,
		Member,
		MemberCapabilities,
		ProjectEventRecord,
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
		dashboardDate,
		lockboxCode,
		initialAvailableShifts,
		upcomingMemberShifts,
		upcomingProjects,
		upcomingCoLabEvents,
		adminOverview,
		adminActivity
	}: {
		viewer: Member;
		member: Member;
		capabilities: MemberCapabilities;
		viewerCapabilities: MemberCapabilities;
		isViewingAs: boolean;
		dashboardDate: string;
		lockboxCode: string;
		initialAvailableShifts: Shift[];
		upcomingMemberShifts: Shift[];
		upcomingProjects: UpcomingProjectAssignment[];
		upcomingCoLabEvents: ProjectEventRecord[];
		adminOverview: {
			activeProjects: number;
			highPriorityProjects: number;
			upcomingEvents: number;
			openShifts: number;
			outstandingReconciliations: number;
			financeSnapshotUpdatedAt: string;
		} | null;
		adminActivity: DashboardActivity[];
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
	const colabScheduleHref = `${resolve('/')}?view=colab&tab=schedule`;
	const colabResourcesHref = `${resolve('/')}?view=colab&tab=resources`;
	const colabDocumentsHref = `${resolve('/')}?view=colab&tab=documents`;
	type OverviewItem = { title: string; date: string; kind: 'shift' | 'project'; href: string };
	const overviewItems = $derived.by<OverviewItem[]>(() =>
		[
			...upcomingMemberShifts
				.filter((shift) => Boolean(shift.dateValue))
				.map((shift) => ({
					title: shift.title,
					date: shift.dateValue,
					kind: 'shift' as const,
					href: colabScheduleHref
				})),
			...upcomingProjects
				.filter((assignment) => Boolean(assignment.record.dateValue))
				.map((assignment) => ({
					title: assignment.record.title,
					date: assignment.record.dateValue,
					kind: 'project' as const,
					href: `/items/${assignment.record.source}/${assignment.record.id}`
				}))
		].sort((first, second) => first.date.localeCompare(second.date))
	);
	const nextItem = $derived(overviewItems[0] ?? null);
	const weekThroughDate = $derived(addDays(dashboardDate, 6));
	const thisWeekItems = $derived(overviewItems.filter((item) => item.date <= weekThroughDate));
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

	function dateLabel(value: string): string {
		const parsed = new Date(`${value}T12:00:00Z`);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
					timeZone: 'UTC'
				}).format(parsed);
	}

	function addDays(value: string, days: number): string {
		const parsed = new Date(`${value}T12:00:00Z`);
		if (Number.isNaN(parsed.getTime())) return value;
		parsed.setUTCDate(parsed.getUTCDate() + days);
		return parsed.toISOString().slice(0, 10);
	}

	function timestampLabel(value: string): string {
		if (!value) return 'No snapshot received';
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				}).format(parsed);
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

			<section class="overview-focus" aria-labelledby="overview-focus-title">
				<div class="section-heading compact">
					<div>
						<p class="eyebrow">Your dashboard</p>
						<h2 id="overview-focus-title">Today and this week</h2>
					</div>
					<p>Start with the things that need your attention, then jump into the CoLab.</p>
				</div>
				<div class="overview-focus-grid">
					<article class="overview-focus-card overview-next-card">
						<p class="eyebrow">Next up</p>
						{#if nextItem}
							<span class="overview-focus-date">{dateLabel(nextItem.date)}</span>
							<h3>{nextItem.title}</h3>
							<a href={nextItem.href}>Open {nextItem.kind === 'shift' ? 'schedule' : 'project'} →</a>
						{:else}
							<h3>Your calendar is clear</h3>
							<p>See the schedule for upcoming ways to connect.</p>
							<a href={colabScheduleHref}>Open schedule →</a>
						{/if}
					</article>
					<article class="overview-focus-card">
						<p class="eyebrow">Your commitments</p>
						<strong>{thisWeekItems.length}</strong>
						<h3>Commitments this week</h3>
						<a href={colabScheduleHref}>See your schedule →</a>
					</article>
					<article class="overview-focus-card">
						<p class="eyebrow">Ways to help</p>
						<strong>{initialAvailableShifts.length}</strong>
						<h3>Open CoLab shifts</h3>
						<a href={colabScheduleHref}>View and sign up →</a>
					</article>
				</div>
				<div class="overview-shortcuts" aria-label="CoLab shortcuts">
					<a href={colabScheduleHref}>Schedule</a>
					<a href={colabResourcesHref}>Resources &amp; tools</a>
					<a href={colabDocumentsHref}>Documents</a>
					{#if capabilities.canVote}<a href={colabResourcesHref}>Votes &amp; work-trade</a>{/if}
				</div>
			</section>

			{#if adminOverview && viewerCapabilities.isAdmin && !isViewingAs}
				<section class="admin-operations-pulse" aria-labelledby="admin-operations-pulse-title">
					<div class="section-heading compact">
						<div>
							<p class="eyebrow">Admin only</p>
							<h2 id="admin-operations-pulse-title">Operations pulse</h2>
						</div>
						<a href={resolve('/operations')}>Open Operations →</a>
					</div>
					<div class="admin-operations-grid">
						<a class="admin-operations-card" href={resolve('/projects')}>
							<strong>{adminOverview.highPriorityProjects}</strong>
							<span>high-priority projects</span>
							<small>{adminOverview.activeProjects} active projects total</small>
						</a>
						<a class="admin-operations-card" href={colabScheduleHref}>
							<strong>{adminOverview.openShifts}</strong>
							<span>open future shifts</span>
							<small>{adminOverview.upcomingEvents} upcoming community events</small>
						</a>
						<a class="admin-operations-card" href={resolve('/operations')}>
							<strong>{adminOverview.outstandingReconciliations}</strong>
							<span>finance tasks outstanding</span>
							<small>Snapshot: {timestampLabel(adminOverview.financeSnapshotUpdatedAt)}</small>
						</a>
					</div>
					<div class="admin-operations-actions">
						<a href={resolve('/projects')}>Manage projects</a>
						<a href={resolve('/operations')}>Reconcile finance</a>
						<a href={resolve('/social')}>Create social content</a>
					</div>
				</section>
				<AdminActivityFeed activities={adminActivity} />
			{/if}

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
				{upcomingCoLabEvents}
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
