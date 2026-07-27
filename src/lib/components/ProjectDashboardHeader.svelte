<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Member, MemberCapabilities, ProjectEventSource } from '$lib/types/domain';

	let {
		member,
		capabilities,
		source,
		title
	}: {
		member: Member;
		capabilities: MemberCapabilities;
		source: ProjectEventSource;
		title: string;
	} = $props();
</script>

<header class="dashboard-header project-page-header">
	<a class="brand" href={resolve('/')} aria-label="CoLab dashboard home">
		<span class="brand-mark" aria-hidden="true">Q</span>
		<span>CoLab</span>
	</a>
	<nav aria-label="Project dashboard navigation">
		<a href={resolve('/#overview')}>Dashboard</a>
		{#if capabilities.canViewCalendar}<a href={resolve('/#calendar')}>Calendar</a>{/if}
		<a class="nav-active" href="#main-content">Project</a>
		<a href={resolve('/#resources')}>Resources</a>
		{#if capabilities.canViewAdminTools}<a href={resolve('/#admin')}>Admin</a>{/if}
	</nav>
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

<nav class="mobile-nav project-mobile-nav" aria-label="Mobile project navigation">
	<a href={resolve('/#overview')}>Dashboard</a>
	{#if capabilities.canViewCalendar}<a href={resolve('/#calendar')}>Calendar</a>{/if}
	<a href="#main-content">Project</a>
	<a href={resolve('/#resources')}>Resources</a>
</nav>
