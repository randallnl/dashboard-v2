<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Member, ProjectEventSource } from '$lib/types/domain';

	let {
		member,
		canManageProjects,
		canViewCalendar,
		isAdmin,
		source,
		title
	}: {
		member: Member;
		canManageProjects: boolean;
		canViewCalendar: boolean;
		isAdmin: boolean;
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
		<a href={resolve('/')}>Dashboard</a>
		{#if canViewCalendar}<a href={resolve('/?view=calendar')}>Calendar</a>{/if}
		<a class="nav-active" href="#main-content">Project</a>
		<a href={resolve('/?view=resources')}>Resources</a>
		{#if canManageProjects}
			<a href={resolve('/projects')}>Projects</a>
			{#if isAdmin}<a href={resolve('/?view=admin')}>Admin</a>{/if}
			<a href={resolve('/social')}>Social</a>
		{/if}
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
	<a href={resolve('/')}>Dashboard</a>
	{#if canViewCalendar}<a href={resolve('/?view=calendar')}>Calendar</a>{/if}
	<a href="#main-content">Project</a>
	<a href={resolve('/?view=resources')}>Resources</a>
</nav>
