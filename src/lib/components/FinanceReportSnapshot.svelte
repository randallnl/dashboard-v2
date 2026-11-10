<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import { onMount } from 'svelte';

	type Snapshot = {
		asOfDate: string;
		periodStartDate: string;
		cashTotal: number;
		accountsReceivable: number;
		accountsPayable: number;
		totalAssets: number;
		totalLiabilities: number;
		totalEquity: number;
		monthIncome: number;
		monthExpenses: number;
		monthNetIncome: number;
		bankAccounts: Array<{ name: string; balance: number }>;
		balanceSheetReceivedAt: string;
		profitLossReceivedAt: string;
		balanceSheetFilename: string;
		profitLossFilename: string;
		sourceUpdatedAt: string;
	};

	type ReportResponse = {
		inbox: string;
		snapshot: Snapshot | null;
		message?: string;
	};

	const money = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	});

	function formatMoney(value: number): string {
		return money.format(value);
	}

	function dateLabel(value: string, withTime = false): string {
		if (!value) return '';
		const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00Z`);
		if (Number.isNaN(parsed.getTime())) return value;
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			...(withTime ? { hour: 'numeric', minute: '2-digit' } : {})
		}).format(parsed);
	}

	let inbox = $state('finance-reports@nhsolidarityecosystem.com');
	let snapshot = $state<Snapshot | null>(null);
	let loading = $state(true);
	let message = $state('');
	let failed = $state(false);

	async function load() {
		loading = true;
		try {
			const response = await fetch('/api/admin/finance/reports');
			const result = (await response.json()) as ReportResponse;
			if (!response.ok) throw new Error(result.message || 'Could not load the financial snapshot.');
			inbox = result.inbox;
			snapshot = result.snapshot;
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not load the financial snapshot.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load();
	});
</script>

<section
	class="quickbooks-snapshot scheduled-report-snapshot"
	aria-labelledby="finance-report-snapshot-title"
>
	<div class="quickbooks-snapshot-heading">
		<div>
			<p class="eyebrow">QuickBooks reports</p>
			<h2 id="finance-report-snapshot-title">Financial snapshot</h2>
			<p>Read-only balances and month-to-date financials from scheduled QuickBooks reports.</p>
		</div>
		{#if snapshot}
			<div class="quickbooks-freshness">
				<span>As of {dateLabel(snapshot.asOfDate)}</span>
				<small>Last report {dateLabel(snapshot.sourceUpdatedAt, true)}</small>
			</div>
		{/if}
	</div>

	{#if loading}
		<ContentState
			kind="loading"
			title="Loading financial snapshot"
			message="Checking scheduled QuickBooks reports."
		/>
	{:else if failed}
		<ContentState kind="error" title="Financial snapshot unavailable" {message} onretry={load} />
	{:else if !snapshot}
		<div class="quickbooks-empty scheduled-report-empty">
			<div>
				<strong>Set up scheduled QuickBooks reports.</strong>
				<ol>
					<li>Save a Balance Sheet and a month-to-date Profit and Loss report in QuickBooks.</li>
					<li>Schedule both reports to send as Excel attachments.</li>
					<li>Email them to <code>{inbox}</code>.</li>
				</ol>
			</div>
			<span>Awaiting reports</span>
		</div>
	{:else}
		<div class="quickbooks-metric-grid">
			<div><span>Cash accounts</span><strong>{formatMoney(snapshot.cashTotal)}</strong></div>
			<div>
				<span>Accounts receivable</span><strong>{formatMoney(snapshot.accountsReceivable)}</strong>
			</div>
			<div>
				<span>Accounts payable</span><strong>{formatMoney(snapshot.accountsPayable)}</strong>
			</div>
			<div class:negative={snapshot.monthNetIncome < 0}>
				<span>Month-to-date net</span><strong>{formatMoney(snapshot.monthNetIncome)}</strong>
			</div>
		</div>

		{#if snapshot.bankAccounts.length}
			<section class="finance-bank-account-balances" aria-labelledby="finance-bank-accounts-title">
				<div class="quickbooks-account-heading">
					<div>
						<h3 id="finance-bank-accounts-title">Bank account balances</h3>
						<p>From the latest Statement of Financial Position.</p>
					</div>
				</div>
				<div class="finance-bank-account-grid">
					{#each snapshot.bankAccounts as account}
						<article class:negative={account.balance < 0}>
							<span>{account.name}</span>
							<strong>{formatMoney(account.balance)}</strong>
						</article>
					{/each}
				</div>
			</section>
		{/if}

		<div class="quickbooks-account-heading">
			<div>
				<h3>Report delivery</h3>
				<p>QuickBooks sends scheduled Excel reports to {inbox}.</p>
			</div>
		</div>
		<div class="finance-report-delivery-grid">
			<article class:complete={Boolean(snapshot.balanceSheetReceivedAt)}>
				<span>Balance Sheet</span>
				<strong>{snapshot.balanceSheetReceivedAt ? 'Received' : 'Awaiting report'}</strong>
				<small>
					{snapshot.balanceSheetReceivedAt
						? `${snapshot.balanceSheetFilename} · ${dateLabel(snapshot.balanceSheetReceivedAt, true)}`
						: 'Schedule an Excel attachment in QuickBooks.'}
				</small>
			</article>
			<article class:complete={Boolean(snapshot.profitLossReceivedAt)}>
				<span>Profit &amp; Loss</span>
				<strong>{snapshot.profitLossReceivedAt ? 'Received' : 'Awaiting report'}</strong>
				<small>
					{snapshot.profitLossReceivedAt
						? `${snapshot.profitLossFilename} · ${dateLabel(snapshot.profitLossReceivedAt, true)}`
						: 'Schedule an Excel attachment in QuickBooks.'}
				</small>
			</article>
		</div>
	{/if}
</section>
