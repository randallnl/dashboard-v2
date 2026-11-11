<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DocumentLibrary from '$lib/components/DocumentLibrary.svelte';
	import FinanceReconciliationPanel from '$lib/components/FinanceReconciliationPanel.svelte';
	import FinanceReportSnapshot from '$lib/components/FinanceReportSnapshot.svelte';
	import ShopifyMarketSalesPanel from '$lib/components/ShopifyMarketSalesPanel.svelte';
	import MemberPortalNavigation from '$lib/components/MemberPortalNavigation.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const documentsActive = $derived(page.url.searchParams.get('tab') === 'documents');
</script>

<svelte:head>
	<title>Operations · CoLab</title>
	<meta
		name="description"
		content="CoLab operations tools, financial reconciliation, and shared documents."
	/>
</svelte:head>

<div class="operations-workspace">
	<header class="dashboard-header operations-header">
		<a class="brand" href={resolve('/')} aria-label="CoLab dashboard home">
			<span class="brand-mark" aria-hidden="true">Q</span><span>CoLab</span>
		</a>
		<MemberPortalNavigation
			active="operations"
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

	<main class="operations-main" id="main-content">
		<section class="workspace-page-heading" aria-labelledby="operations-page-title">
			<div>
				<p class="eyebrow">Operations workspace</p>
				<h1 id="operations-page-title">Operations</h1>
			</div>
			<a class="workspace-page-action" href={resolve('/')}>Dashboard</a>
		</section>

		<nav class="operations-subnav" aria-label="Operations sections">
			<a
				class:active={!documentsActive}
				aria-current={!documentsActive ? 'page' : undefined}
				href={resolve('/operations')}>Finance</a
			>
			<a
				class:active={documentsActive}
				aria-current={documentsActive ? 'page' : undefined}
				href={resolve('/operations?tab=documents')}>Documents</a
			>
		</nav>

		{#if documentsActive}
			<DocumentLibrary library="operations" title="Operations documents" />
		{:else}
			<FinanceReportSnapshot />
			<ShopifyMarketSalesPanel />
			<FinanceReconciliationPanel />
		{/if}
	</main>
</div>
