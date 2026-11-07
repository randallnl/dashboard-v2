<script lang="ts">
	import { resolve } from '$app/paths';
	import type { MemberCapabilities } from '$lib/types/domain';

	export type MemberPortalView =
		| 'overview'
		| 'resources'
		| 'documents'
		| 'shifts'
		| 'calendar'
		| 'votes'
		| 'work-trade'
		| 'history'
		| 'profile'
		| 'admin'
		| 'projects'
		| 'project'
		| 'social';

	let {
		active,
		capabilities,
		viewerCapabilities,
		isViewingAs = false
	}: {
		active: MemberPortalView;
		capabilities: MemberCapabilities;
		viewerCapabilities: MemberCapabilities;
		isViewingAs?: boolean;
	} = $props();

	let moreMenuOpen = $state(false);
	const projectsActive = $derived(active === 'projects' || active === 'project');
	const primaryMobileView = $derived(
		active === 'overview' ||
		active === 'resources' ||
		active === 'calendar' ||
		active === 'shifts' ||
		(!capabilities.canViewCalendar && !capabilities.canViewShifts && active === 'history')
	);

	function dashboardHref(view: Exclude<MemberPortalView, 'projects' | 'project' | 'social'>): string {
		return view === 'overview' ? resolve('/') : `${resolve('/')}?view=${view}`;
	}

	function closeMobileMenu() {
		moreMenuOpen = false;
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && closeMobileMenu()} />

<!-- dashboardHref resolves the root route before adding the selected view query -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<nav aria-label="Member navigation">
	<a class:nav-active={active === 'overview'} href={dashboardHref('overview')}>Overview</a>
	{#if capabilities.canViewShifts && !capabilities.canViewCalendar}
		<a class:nav-active={active === 'shifts'} href={dashboardHref('shifts')}>Shifts</a>
	{/if}
	{#if capabilities.canViewCalendar}
		<a class:nav-active={active === 'calendar'} href={dashboardHref('calendar')}>Schedule</a>
	{/if}
	{#if capabilities.canVote}
		<a class:nav-active={active === 'votes'} href={dashboardHref('votes')}>Votes</a>
	{/if}
	<a class:nav-active={active === 'work-trade'} href={dashboardHref('work-trade')}>Work trade</a>
	<a class:nav-active={active === 'history'} href={dashboardHref('history')}>History</a>
	<a class:nav-active={active === 'resources'} href={dashboardHref('resources')}>Resources</a>
	<a class:nav-active={active === 'documents'} href={dashboardHref('documents')}>Documents</a>
	<a class:nav-active={active === 'profile'} href={dashboardHref('profile')}>Profile</a>
	{#if viewerCapabilities.canManageProjects && !isViewingAs}
		<a class:nav-active={projectsActive} href={resolve('/projects')}>Projects</a>
		{#if viewerCapabilities.isAdmin}
			<a class:nav-active={active === 'admin'} href={dashboardHref('admin')}>Admin</a>
		{/if}
		<a class:nav-active={active === 'social'} href={resolve('/social')}>Social</a>
	{/if}
</nav>

<nav class="mobile-nav dashboard-mobile-nav" aria-label="Mobile member navigation">
	<a class:active={active === 'overview'} href={dashboardHref('overview')}>Overview</a>
	{#if capabilities.canViewCalendar}
		<a class:active={active === 'calendar'} href={dashboardHref('calendar')}>Schedule</a>
	{:else if capabilities.canViewShifts}
		<a class:active={active === 'shifts'} href={dashboardHref('shifts')}>Shifts</a>
	{:else}
		<a class:active={active === 'history'} href={dashboardHref('history')}>History</a>
	{/if}
	<a class:active={active === 'resources'} href={dashboardHref('resources')}>Resources</a>
	<button
		type="button"
		class:active={moreMenuOpen || !primaryMobileView}
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
			{#if capabilities.canViewShifts && !capabilities.canViewCalendar}
				<a href={dashboardHref('shifts')} onclick={closeMobileMenu}>Shifts</a>
			{/if}
			{#if capabilities.canVote}
				<a href={dashboardHref('votes')} onclick={closeMobileMenu}>Community votes</a>
			{/if}
			<a href={dashboardHref('work-trade')} onclick={closeMobileMenu}>Work-trade discount</a>
			<a href={dashboardHref('history')} onclick={closeMobileMenu}>History and payments</a>
			<a href={dashboardHref('resources')} onclick={closeMobileMenu}>Resources</a>
			<a href={dashboardHref('documents')} onclick={closeMobileMenu}>CoLab documents</a>
			<a href={dashboardHref('profile')} onclick={closeMobileMenu}>Profile</a>
			{#if viewerCapabilities.canManageProjects && !isViewingAs}
				<a href={resolve('/projects')} onclick={closeMobileMenu}>Projects</a>
				{#if viewerCapabilities.isAdmin}
					<a href={dashboardHref('admin')} onclick={closeMobileMenu}>Admin</a>
				{/if}
				<a href={resolve('/social')} onclick={closeMobileMenu}>Social content</a>
			{/if}
		</nav>
	</div>
{/if}
<!-- eslint-enable svelte/no-navigation-without-resolve -->
