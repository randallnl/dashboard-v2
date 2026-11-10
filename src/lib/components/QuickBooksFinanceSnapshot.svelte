<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import { onMount } from 'svelte';

	type SnapshotAccount = {
		qboAccountId: string;
		name: string;
		accountType: string;
		accountSubType: string;
		currentBalance: number;
		position: number;
	};

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
		sourceUpdatedAt: string;
		accounts: SnapshotAccount[];
	};

	type Connection = {
		companyName: string;
		connectedAt: string;
		lastSyncedAt: string;
		lastSyncStatus: 'pending' | 'complete' | 'failed';
		lastSyncError: string;
	};

	type SnapshotResponse = {
		configured: boolean;
		connection: Connection | null;
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

	let configured = $state(false);
	let connection = $state<Connection | null>(null);
	let snapshot = $state<Snapshot | null>(null);
	let loading = $state(true);
	let refreshing = $state(false);
	let message = $state('');
	let failed = $state(false);

	async function load() {
		loading = true;
		try {
			const response = await fetch('/api/admin/finance/snapshot');
			const result = (await response.json()) as SnapshotResponse;
			if (!response.ok)
				throw new Error(result.message || 'Could not load the QuickBooks snapshot.');
			configured = result.configured;
			connection = result.connection;
			snapshot = result.snapshot;
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not load the QuickBooks snapshot.';
		} finally {
			loading = false;
		}
	}

	async function refresh() {
		refreshing = true;
		message = '';
		try {
			const response = await fetch('/api/admin/finance/snapshot', { method: 'POST' });
			const result = (await response.json()) as SnapshotResponse;
			if (!response.ok)
				throw new Error(result.message || 'QuickBooks could not refresh the snapshot.');
			configured = result.configured;
			connection = result.connection;
			snapshot = result.snapshot;
			message = result.message || 'QuickBooks account snapshot refreshed.';
			failed = false;
		} catch (cause) {
			failed = true;
			message =
				cause instanceof Error ? cause.message : 'QuickBooks could not refresh the snapshot.';
		} finally {
			refreshing = false;
		}
	}

	onMount(() => {
		void load();
	});
</script>

<section class="quickbooks-snapshot" aria-labelledby="quickbooks-snapshot-title">
	<div class="quickbooks-snapshot-heading">
		<div>
			<p class="eyebrow">QuickBooks</p>
			<h2 id="quickbooks-snapshot-title">Account snapshot</h2>
			<p>Read-only balances and month-to-date financials from QuickBooks Online.</p>
		</div>
		{#if snapshot}
			<div class="quickbooks-freshness">
				<span>As of {dateLabel(snapshot.asOfDate)}</span>
				<small>Synced {dateLabel(snapshot.sourceUpdatedAt, true)}</small>
			</div>
		{/if}
	</div>

	{#if message}
		<p class="finance-message" class:error={failed} role={failed ? 'alert' : 'status'}>{message}</p>
	{/if}

	{#if loading}
		<ContentState
			kind="loading"
			title="Loading QuickBooks"
			message="Checking the saved account snapshot."
		/>
	{:else if failed && !snapshot}
		<ContentState kind="error" title="QuickBooks unavailable" {message} onretry={load} />
	{:else if !configured}
		<div class="quickbooks-empty">
			<div>
				<strong>QuickBooks connection is ready to configure.</strong>
				<p>
					Once the Intuit app credentials are added, an administrator can connect Queerlective in
					one step.
				</p>
			</div>
			<span>OAuth credentials needed</span>
		</div>
	{:else if !connection}
		<div class="quickbooks-empty">
			<div>
				<strong>Connect the Queerlective QuickBooks company.</strong>
				<p>Authorize read-only accounting access to begin saving an account snapshot here.</p>
			</div>
			<a class="quickbooks-connect-button" href="/api/admin/finance/quickbooks/connect"
				>Connect QuickBooks</a
			>
		</div>
	{:else if !snapshot}
		<div class="quickbooks-empty">
			<div>
				<strong>{connection.companyName} is connected.</strong>
				<p>Refresh once to save the first account snapshot.</p>
			</div>
			<button
				type="button"
				class="quickbooks-connect-button"
				onclick={() => void refresh()}
				disabled={refreshing}
			>
				{refreshing ? 'Refreshing…' : 'Refresh snapshot'}
			</button>
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

		<div class="quickbooks-account-heading">
			<div>
				<h3>Linked accounts</h3>
				<p>{connection.companyName} · read-only snapshot</p>
			</div>
			<button
				type="button"
				class="quickbooks-refresh-button"
				onclick={() => void refresh()}
				disabled={refreshing}
			>
				{refreshing ? 'Refreshing…' : 'Refresh now'}
			</button>
		</div>
		<div class="quickbooks-account-grid">
			{#each snapshot.accounts as account (account.qboAccountId)}
				<article class:credit-card={account.accountType === 'Credit Card'}>
					<span>{account.accountType === 'Credit Card' ? 'Credit card' : 'Cash account'}</span>
					<strong>{account.name}</strong>
					<em>{formatMoney(account.currentBalance)}</em>
				</article>
			{/each}
		</div>
	{/if}
</section>
