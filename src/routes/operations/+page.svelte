<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DocumentLibrary from '$lib/components/DocumentLibrary.svelte';
	import FinanceReconciliationPanel from '$lib/components/FinanceReconciliationPanel.svelte';
	import FinanceReportSnapshot from '$lib/components/FinanceReportSnapshot.svelte';
	import GovernanceWorkspace from '$lib/components/GovernanceWorkspace.svelte';
	import ShopifyMarketSalesPanel from '$lib/components/ShopifyMarketSalesPanel.svelte';
	import MemberPortalNavigation from '$lib/components/MemberPortalNavigation.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const activeTab = $derived(page.url.searchParams.get('tab') ?? 'finance');
	const documentsActive = $derived(activeTab === 'documents');
	const governanceActive = $derived(activeTab === 'governance');
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
				class:active={activeTab === 'finance'}
				aria-current={activeTab === 'finance' ? 'page' : undefined}
				href={resolve('/operations')}>Finance</a
			>
			<a
				class:active={governanceActive}
				aria-current={governanceActive ? 'page' : undefined}
				href={resolve('/operations?tab=governance')}>Governance</a
			>
			<a
				class:active={documentsActive}
				aria-current={documentsActive ? 'page' : undefined}
				href={resolve('/operations?tab=documents')}>Documents</a
			>
		</nav>

		{#if documentsActive}
			<DocumentLibrary library="operations" title="Operations documents" />
		{:else if governanceActive}
			<GovernanceWorkspace
				today={data.dashboardDate}
				meetings={data.governanceMeetings}
				documents={data.governanceDocuments}
			/>
		{:else}
			<div class="operations-finance-layout">
				<aside class="operations-finance-rail" aria-labelledby="receipt-workflow-title">
					<section>
						<p class="eyebrow">Quick reference</p>
						<h2 id="receipt-workflow-title">Receipt intake</h2>
						<p>
							Send a receipt as an attachment to this inbox. It is saved to Drive, sent to
							QuickBooks, then confirmed by email.
						</p>
						<dl>
							<div>
								<dt>Receipt inbox</dt>
								<dd>
									<a href="mailto:receipts@nhsolidarityecosystem.com"
										>receipts@nhsolidarityecosystem.com</a
									>
								</dd>
							</div>
							<div>
								<dt>QuickBooks</dt>
								<dd>Queerlective expenses</dd>
							</div>
						</dl>
						<a
							class="operations-finance-rail-link"
							href="https://drive.google.com/drive/folders/16BxD6rkncQp0yX5Di7ITtIXrholsj114"
							target="_blank"
							rel="noreferrer">Open Receipts folder ↗</a
						>
					</section>
				</aside>
				<div class="operations-finance-content">
					<FinanceReportSnapshot />
					<ShopifyMarketSalesPanel />
					<FinanceReconciliationPanel />
				</div>
			</div>
		{/if}
	</main>
</div>
