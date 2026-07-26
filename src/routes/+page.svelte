<script lang="ts">
	import DashboardShell from '$lib/components/DashboardShell.svelte';
	import LoginSplash from '$lib/components/LoginSplash.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.authenticated ? 'Dashboard' : 'Sign in'} · CoLab Member Portal</title>
	<meta
		name="description"
		content="Queerlective CoLab member portal and studio operations dashboard."
	/>
</svelte:head>

{#if data.authenticated}
	<DashboardShell
		viewer={data.viewer}
		member={data.member}
		capabilities={data.capabilities}
		viewerCapabilities={data.viewerCapabilities}
		isViewingAs={data.isViewingAs}
	/>
{:else}
	<LoginSplash authStatus={data.authStatus} />
{/if}
