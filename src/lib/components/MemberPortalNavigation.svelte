<script lang="ts">
	import { resolve } from '$app/paths';
	import type { MemberCapabilities } from '$lib/types/domain';

	export type MemberPortalView =
		| 'overview'
		| 'colab'
		| 'history'
		| 'profile'
		| 'admin'
		| 'projects'
		| 'project'
		| 'social'
		| 'operations';

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
		active === 'overview' || active === 'colab' || active === 'history'
	);

	function dashboardHref(
		view: Exclude<MemberPortalView, 'projects' | 'project' | 'social' | 'operations'>
	): string {
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
	<a class:nav-active={active === 'colab'} href={dashboardHref('colab')}>CoLab</a>
	<a class:nav-active={active === 'history'} href={dashboardHref('history')}>History</a>
	<a class:nav-active={active === 'profile'} href={dashboardHref('profile')}>Profile</a>
	{#if viewerCapabilities.canManageProjects && !isViewingAs}
		<a class:nav-active={projectsActive} href={resolve('/projects')}>Projects</a>
		{#if viewerCapabilities.isAdmin}
			<a class:nav-active={active === 'operations'} href={resolve('/operations')}>Operations</a>
			<a class:nav-active={active === 'admin'} href={dashboardHref('admin')}>Admin</a>
		{/if}
		<a class:nav-active={active === 'social'} href={resolve('/social')}>Social</a>
	{/if}
</nav>

<nav class="mobile-nav dashboard-mobile-nav" aria-label="Mobile member navigation">
	<a class:active={active === 'overview'} href={dashboardHref('overview')}>Overview</a>
	<a class:active={active === 'colab'} href={dashboardHref('colab')}>CoLab</a>
	<a class:active={active === 'history'} href={dashboardHref('history')}>History</a>
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
			<a href={dashboardHref('profile')} onclick={closeMobileMenu}>Profile</a>
			{#if viewerCapabilities.canManageProjects && !isViewingAs}
				<a href={resolve('/projects')} onclick={closeMobileMenu}>Projects</a>
				{#if viewerCapabilities.isAdmin}
					<a href={resolve('/operations')} onclick={closeMobileMenu}>Operations</a>
					<a href={dashboardHref('admin')} onclick={closeMobileMenu}>Admin</a>
				{/if}
				<a href={resolve('/social')} onclick={closeMobileMenu}>Social content</a>
			{/if}
		</nav>
	</div>
{/if}
<!-- eslint-enable svelte/no-navigation-without-resolve -->
