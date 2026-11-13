<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminProjectsPanel from '$lib/components/AdminProjectsPanel.svelte';
	import MemberPortalNavigation from '$lib/components/MemberPortalNavigation.svelte';
	import ProjectRail from '$lib/components/WorkingOnItProjects.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const projectCreationFormUrl =
		'https://forms.monday.com/forms/149614b6ad962b636bea5cb12b764e54?r=use1';
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
		<MemberPortalNavigation
			active="projects"
			capabilities={data.capabilities}
			viewerCapabilities={data.viewerCapabilities}
		/>
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
		<div class="projects-page-rails">
			<ProjectRail kind="ongoing" projects={data.ongoingProjects} />

			<div class="projects-primary-rail">
				<section class="workspace-page-heading" aria-labelledby="projects-page-title">
					<div>
						<p class="eyebrow">Project workspace</p>
						<h1 id="projects-page-title">Projects</h1>
					</div>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a
						class="workspace-page-action"
						href={projectCreationFormUrl}
						target="_blank"
						rel="noreferrer">Open project form ↗</a
					>
				</section>

				<AdminProjectsPanel showStatusSummary />
			</div>

			<ProjectRail kind="priority" projects={data.highPriorityProjects} />
		</div>
	</main>
</div>
