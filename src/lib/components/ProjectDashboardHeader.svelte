<script lang="ts">
	import { resolve } from '$app/paths';
	import MemberPortalNavigation from '$lib/components/MemberPortalNavigation.svelte';
	import type { Member, MemberCapabilities, ProjectEventSource } from '$lib/types/domain';

	let {
		member,
		capabilities,
		viewerCapabilities,
		isViewingAs,
		source,
		title
	}: {
		member: Member;
		capabilities: MemberCapabilities;
		viewerCapabilities: MemberCapabilities;
		isViewingAs: boolean;
		source: ProjectEventSource;
		title: string;
	} = $props();
</script>

<header class="dashboard-header project-page-header">
	<a class="brand" href={resolve('/')} aria-label="CoLab dashboard home">
		<span class="brand-mark" aria-hidden="true">Q</span>
		<span>CoLab</span>
	</a>
	<MemberPortalNavigation active="project" {capabilities} {viewerCapabilities} {isViewingAs} />
	<div class="member-menu">
		<div>
			<strong>{member.preferredName}</strong>
			<span>{member.membershipType}</span>
		</div>
		<form method="POST" action={resolve('/api/auth/logout')}>
			<button type="submit" class="text-button">Sign out</button>
		</form>
	</div>
</header>

<nav class="item-breadcrumbs" aria-label="Breadcrumb">
	<a href={resolve('/')}>Dashboard</a>
	<span aria-hidden="true">›</span>
	<a href={resolve('/#calendar')}>{source === 'project' ? 'Projects' : 'Events'}</a>
	<span aria-hidden="true">›</span>
	<strong aria-current="page">{title}</strong>
</nav>
