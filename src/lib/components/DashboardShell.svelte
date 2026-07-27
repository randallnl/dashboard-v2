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
	import type {
		Member,
		MemberCapabilities,
		Shift,
		UpcomingProjectAssignment
	} from '$lib/types/domain';
	import { resolve } from '$app/paths';

	let {
		viewer,
		member,
		capabilities,
		viewerCapabilities,
		isViewingAs,
		initialAvailableShifts,
		upcomingMemberShifts,
		upcomingProjects
	}: {
		viewer: Member;
		member: Member;
		capabilities: MemberCapabilities;
		viewerCapabilities: MemberCapabilities;
		isViewingAs: boolean;
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

	function safeExternalUrl(value: string): string {
		if (!value) return '';
		try {
			const url = new URL(value.startsWith('www.') ? `https://${value}` : value);
			return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
		} catch {
			return '';
		}
	}
</script>

<div class="dashboard-shell">
	<header class="dashboard-header">
		<a class="brand" href={resolve('/')} aria-label="CoLab dashboard home">
			<span class="brand-mark" aria-hidden="true">Q</span>
			<span>CoLab</span>
		</a>
		<nav aria-label="Member navigation">
			<a class="nav-active" href="#overview">Overview</a>
			{#if capabilities.canViewShifts}<a href="#portal-areas">Shifts</a>{/if}
			{#if capabilities.canViewCalendar}<a href="#calendar">Calendar</a>{/if}
			{#if capabilities.canVote}<a href="#votes">Votes</a>{/if}
			<a href="#history">History</a>
			<a href="#resources">Resources</a>
			{#if viewerCapabilities.canViewAdminTools && !isViewingAs}<a href="#admin">Admin</a>{/if}
		</nav>
		<div class="dashboard-header-actions">
			<NotificationCenter
				shifts={upcomingMemberShifts}
				projects={upcomingProjects}
				availableShifts={initialAvailableShifts}
				canVote={capabilities.canVote}
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
		<section class="welcome-card" id="overview">
			<div>
				<p class="eyebrow">Member overview</p>
				<h1>Hi, {firstName}.</h1>
				<p>Your CoLab membership, studio tools, and community resources live here.</p>
			</div>
			<span class="membership-pill">{member.membershipType || 'CoLab Member'}</span>
		</section>

		<UpcomingMemberPanel
			shifts={upcomingMemberShifts}
			projects={upcomingProjects}
			availableShifts={initialAvailableShifts}
		/>

		<article class="resources-card dashboard-top-resources" id="resources">
			<p class="eyebrow">Quick links</p>
			<h2>Resources</h2>
			<div class="resource-links">
				{#if capabilities.canSubmitCommunityEvents}
					<a href="https://wkf.ms/4aSHDGu" target="_blank" rel="noreferrer">
						<span>Submit a community-led event</span><span aria-hidden="true">↗</span>
					</a>
				{/if}
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

		<section class="portal-section" id="portal-areas" aria-labelledby="portal-title">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Your portal</p>
					<h2 id="portal-title">Member tools</h2>
				</div>
				<p>Features will become active as each data workflow is connected.</p>
			</div>

			<div class="foundation-grid">
				{#if capabilities.canViewShifts}
					<article>
						<span class="card-number">01</span>
						<h3>Available shifts</h3>
						<p>Browse and claim upcoming studio coverage times.</p>
						<span class="coming-soon">Next milestone</span>
					</article>
				{/if}
				<article>
					<span class="card-number">02</span>
					<h3>Studio calendar</h3>
					<p>See shifts, member events, and community programming.</p>
					<span class="coming-soon">Coming soon</span>
				</article>
				{#if capabilities.canVote}
					<article>
						<span class="card-number">03</span>
						<h3>Community votes</h3>
						<p>Review active motions and participate in decisions.</p>
						<span class="coming-soon">Coming soon</span>
					</article>
				{/if}
				{#if capabilities.isRetailOnly}
					<article class="access-note">
						<span class="card-number">Retail membership</span>
						<h3>Your focused portal</h3>
						<p>Shift signup, open orders, and event submissions are not part of this membership.</p>
						<span class="coming-soon">Access applied</span>
					</article>
				{/if}
			</div>
		</section>

		{#if capabilities.canViewShifts}
			<ShiftPanel
				isAdmin={viewerCapabilities.isAdmin && !isViewingAs}
				readOnly={isViewingAs}
				{initialAvailableShifts}
			/>
		{/if}

		{#if capabilities.canViewCalendar}
			<CalendarPanel isAdmin={viewerCapabilities.isAdmin && !isViewingAs} readOnly={isViewingAs} />
		{/if}

		{#if capabilities.canVote}
			<VotePanel readOnly={isViewingAs} />
		{/if}

		<MemberHistoryPanel canViewOrders={capabilities.canViewOpenOrders} />

		<section class="member-details-grid profile-only" aria-label="Member identity">
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
		</section>

		{#if viewerCapabilities.canViewAdminTools && !isViewingAs}
			<AdminProjectsPanel />
		{/if}
	</main>

	<nav class="mobile-nav" aria-label="Mobile member navigation">
		<a href="#overview">Overview</a>
		<a href="#portal-areas">Tools</a>
		<a href="#calendar">Calendar</a>
		<a href="#history">History</a>
		<a href="#resources">Resources</a>
		{#if viewerCapabilities.canViewAdminTools && !isViewingAs}<a href="#admin">Admin</a>{/if}
	</nav>
</div>
