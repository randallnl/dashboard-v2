<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import { onMount } from 'svelte';

	type Sale = {
		id: number;
		saleDate: string;
		totalSales: number;
		cashSales: number;
		cardSales: number;
		otherSales: number;
		projectSource: string;
		projectId: string;
		projectTitle: string;
		cashDepositedAt: string;
		sourceSubject: string;
		sourceReceivedAt: string;
	};
	type Project = { source: string; id: string; title: string; dateValue: string };
	type SalesResponse = { inbox: string; sales: Sale[]; projects: Project[]; message?: string };

	const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
	function dateLabel(value: string): string {
		const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					timeZone: 'UTC'
				}).format(parsed);
	}
	function projectKey(sale: Sale): string {
		return sale.projectId ? `${sale.projectSource}:${sale.projectId}` : '';
	}

	let inbox = $state('shopify-sales@nhsolidarityecosystem.com');
	let sales = $state<Sale[]>([]);
	let projects = $state<Project[]>([]);
	let loading = $state(true);
	let saving = $state('');
	let message = $state('');
	let failed = $state(false);
	const pendingCash = $derived(sales.filter((sale) => sale.cashSales > 0 && !sale.cashDepositedAt));
	const pendingCashTotal = $derived(pendingCash.reduce((sum, sale) => sum + sale.cashSales, 0));
	const unlinked = $derived(sales.filter((sale) => !sale.projectId).length);

	async function load() {
		loading = true;
		try {
			const response = await fetch('/api/admin/finance/market-sales');
			const result = (await response.json()) as SalesResponse;
			if (!response.ok) throw new Error(result.message || 'Could not load market sales.');
			inbox = result.inbox;
			sales = result.sales;
			projects = result.projects;
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not load market sales.';
		} finally {
			loading = false;
		}
	}
	async function update(body: Record<string, unknown>, key: string) {
		saving = key;
		message = '';
		try {
			const response = await fetch('/api/admin/finance/market-sales', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const result = (await response.json()) as SalesResponse;
			if (!response.ok) throw new Error(result.message || 'Could not update market sales.');
			sales = result.sales;
			projects = result.projects;
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not update market sales.';
		} finally {
			saving = '';
		}
	}
	function changeProject(sale: Sale, selection: string) {
		const [projectSource = '', projectId = ''] = selection.split(':', 2);
		void update(
			{ action: 'assign-project', id: sale.id, projectSource, projectId },
			`project:${sale.id}`
		);
	}
	onMount(() => {
		void load();
	});
</script>

<section class="market-sales" aria-labelledby="market-sales-title">
	<div class="market-sales-heading">
		<div>
			<p class="eyebrow">Market sales</p>
			<h2 id="market-sales-title">Daily Shopify sales</h2>
			<p>
				The seven most recent daily reports stay visible, including zero-sales days. You can
				optionally connect any report to a project or event. Cash stays visible until it is deposited.
			</p>
		</div>
		<div class="market-sales-inbox"><span>Shopify report inbox</span><code>{inbox}</code></div>
	</div>
	{#if message}<p class="finance-message" class:error={failed} role={failed ? 'alert' : 'status'}>
			{message}
		</p>{/if}
	{#if loading}
		<ContentState
			kind="loading"
			title="Loading market sales"
			message="Checking daily Shopify reports."
		/>
	{:else if failed && !sales.length}
		<ContentState kind="error" title="Market sales unavailable" {message} onretry={load} />
	{:else}
		<div class="market-sales-summary">
			<div><strong>{money.format(pendingCashTotal)}</strong><span>cash awaiting deposit</span></div>
			<div><strong>{unlinked}</strong><span>not linked (optional)</span></div>
			<div><strong>{pendingCash.length}</strong><span>open cash deposits</span></div>
		</div>
		{#if !sales.length}
			<div class="quickbooks-empty scheduled-report-empty">
				<div>
					<strong>Awaiting the first Shopify daily sales email.</strong>
					<p>
						Set Shopify to send its daily sales report to <code>{inbox}</code>. The seven most recent
						reports will appear here for optional project/event matching and cash tracking.
					</p>
				</div>
			</div>
		{:else}
			<div class="market-sales-table-wrap">
				<table class="market-sales-table">
					<thead
						><tr><th>Date</th><th>Sales by tender</th><th>Project / event</th><th>Cash deposit</th></tr
						></thead
					><tbody>
						{#each sales as sale (sale.id)}<tr
								><td
									><strong>{dateLabel(sale.saleDate)}</strong><small>{sale.sourceSubject}</small
									></td
								><td
									><div class="market-tenders">
										<span>Total <strong>{money.format(sale.totalSales)}</strong></span><span
											>Cash <strong>{money.format(sale.cashSales)}</strong></span
										><span>Card <strong>{money.format(sale.cardSales)}</strong></span
										>{#if sale.otherSales > 0}<span
												>Other <strong>{money.format(sale.otherSales)}</strong></span
											>{/if}
									</div></td
								><td
									><label class="sr-only" for={`project-${sale.id}`}
										>Project or event for {dateLabel(sale.saleDate)}</label
									><select
										id={`project-${sale.id}`}
										value={projectKey(sale)}
										disabled={Boolean(saving)}
										onchange={(event) => changeProject(sale, event.currentTarget.value)}
										><option value="">No project or event</option
										>{#each projects as project (`${project.source}:${project.id}`)}<option
												value={`${project.source}:${project.id}`}
												>{project.title}{project.dateValue
													? ` · ${dateLabel(project.dateValue)}`
													: ''}</option
											>{/each}</select
									></td
								><td
									>{#if sale.cashSales <= 0}<span class="market-deposit-muted"
											>No cash reported</span
										>{:else}<button
											type="button"
											class:complete={Boolean(sale.cashDepositedAt)}
											class="market-deposit-button"
											disabled={Boolean(saving)}
											onclick={() =>
												void update(
													{
														action: 'set-deposited',
														id: sale.id,
														deposited: !sale.cashDepositedAt
													},
													`deposit:${sale.id}`
												)}
											>{saving === `deposit:${sale.id}`
												? 'Saving…'
												: sale.cashDepositedAt
													? 'Deposited ✓'
													: 'Mark deposited'}</button
										>{/if}</td
								></tr
							>{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</section>
