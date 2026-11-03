<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminProjectsPanel from '$lib/components/AdminProjectsPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Projects · CoLab</title>
	<meta
		name="description"
		content="CoLab's shared workspace for managing projects and their details."
	/>
</svelte:head>

<div class="projects-workspace">
	<header class="dashboard-header projects-header">
		<a class="brand" href={resolve('/')} aria-label="CoLab dashboard home">
			<span class="brand-mark" aria-hidden="true">Q</span><span>CoLab</span>
		</a>
		<nav aria-label="Project workspace navigation">
			<a href={resolve('/')}>Dashboard</a>
			<a class="nav-active" href={resolve('/projects')}>Projects</a>
			{#if data.viewerCapabilities.isAdmin}
				<a href={resolve('/?view=admin')}>Admin</a>
			{/if}
			<a href={resolve('/social')}>Social content</a>
		</nav>
		<div class="member-menu">
			<div>
				<strong>{data.member.preferredName}</strong><span>{data.member.membershipType}</span>
			</div>
			<form method="POST" action={resolve('/api/auth/logout')}>
				<button type="submit" class="text-button">Sign out</button>
			</form>
		</div>
	</header>

	<main class="projects-main" id="main-content">
		<section class="projects-hero" aria-labelledby="projects-page-title">
			<div>
				<p class="eyebrow">Project workspace</p>
				<h1 id="projects-page-title">Projects, all in one place.</h1>
				<p>Find a project, review its status, and open its workspace to keep the work moving.</p>
			</div>
			<a class="projects-dashboard-link" href={resolve('/')}>Return to dashboard</a>
		</section>

		<AdminProjectsPanel />
	</main>

	<nav class="mobile-nav projects-mobile-nav" aria-label="Mobile project workspace navigation">
		<a href={resolve('/')}>Dashboard</a>
		<a class="active" href={resolve('/projects')}>Projects</a>
		{#if data.viewerCapabilities.isAdmin}
			<a href={resolve('/?view=admin')}>Admin</a>
		{/if}
		<a href={resolve('/social')}>Social</a>
	</nav>
</div>
