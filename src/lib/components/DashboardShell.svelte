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
	import { onMount } from 'svelte';

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
	let activeSection = $state('overview');
	let moreMenuOpen = $state(false);

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
		const sectionIds = ['overview', 'resources', 'shifts', 'calendar', 'votes', 'history', 'admin'];
		const sections = sectionIds
			.map((id) => document.getElementById(id))
			.filter((section): section is HTMLElement => Boolean(section));
		let frame = 0;
		const updateActiveSection = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const offset = 130;
				const current =
					[...sections]
						.reverse()
						.find((section) => section.getBoundingClientRect().top <= offset) ?? sections[0];
				if (current) activeSection = current.id;
			});
		};
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
		window.addEventListener('scroll', updateActiveSection, { passive: true });
		document.addEventListener('click', rememberDetailPosition);
		updateActiveSection();
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', updateActiveSection);
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
		<nav aria-label="Member navigation">
			<a class:nav-active={activeSection === 'overview'} href="#overview">Overview</a>
			{#if capabilities.canViewShifts}
				<a class:nav-active={activeSection === 'shifts'} href="#shifts">Shifts</a>
			{/if}
			{#if capabilities.canViewCalendar}
				<a class:nav-active={activeSection === 'calendar'} href="#calendar">Calendar</a>
			{/if}
			{#if capabilities.canVote}
				<a class:nav-active={activeSection === 'votes'} href="#votes">Votes</a>
			{/if}
			<a class:nav-active={activeSection === 'history'} href="#history">History</a>
			<a class:nav-active={activeSection === 'resources'} href="#resources">Resources</a>
			{#if viewerCapabilities.canManageProjects && !isViewingAs}
				<a class:nav-active={activeSection === 'admin'} href="#admin">
					{viewerCapabilities.isAdmin ? 'Admin' : 'Projects'}
				</a>
			{/if}
		</nav>
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
			readOnly={isViewingAs}
		/>

		<article class="resources-card dashboard-top-resources" id="resources">
			<p class="eyebrow">Quick links</p>
			<h2>Resources</h2>
			<div class="resource-links">
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

		<section class="member-details-grid profile-only" id="profile" aria-label="Member identity">
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

		{#if viewerCapabilities.canManageProjects && !isViewingAs}
			<AdminProjectsPanel isAdmin={viewerCapabilities.isAdmin} />
		{/if}
	</main>

	<nav class="mobile-nav dashboard-mobile-nav" aria-label="Mobile member navigation">
		<a class:active={activeSection === 'overview'} href="#overview">Overview</a>
		{#if capabilities.canViewCalendar}
			<a class:active={activeSection === 'calendar'} href="#calendar">Calendar</a>
		{:else if capabilities.canViewShifts}
			<a class:active={activeSection === 'shifts'} href="#shifts">Shifts</a>
		{:else}
			<a class:active={activeSection === 'history'} href="#history">History</a>
		{/if}
		<a class:active={activeSection === 'resources'} href="#resources">Resources</a>
		<button
			type="button"
			class:active={moreMenuOpen}
			aria-expanded={moreMenuOpen}
			aria-controls="mobile-more-menu"
			onclick={() => (moreMenuOpen = !moreMenuOpen)}
		>
			More
		</button>
	</nav>

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
			<nav aria-label="More dashboard sections">
				{#if capabilities.canViewShifts}<a href="#shifts" onclick={closeMobileMenu}>Shifts</a>{/if}
				{#if capabilities.canVote}<a href="#votes" onclick={closeMobileMenu}>Community votes</a
					>{/if}
				<a href="#history" onclick={closeMobileMenu}>History and payments</a>
				<a href="#resources" onclick={closeMobileMenu}>Resources</a>
				<a href="#profile" onclick={closeMobileMenu}>Profile</a>
				{#if viewerCapabilities.canManageProjects && !isViewingAs}
					<a href="#admin" onclick={closeMobileMenu}>Project management</a>
				{/if}
			</nav>
		</div>
	{/if}
</div>
