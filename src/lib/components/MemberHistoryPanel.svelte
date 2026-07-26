<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import type { Activity, Order, Payment } from '$lib/types/domain';
	import { onMount } from 'svelte';

	type Summary = { type: string; count: number };
	let { canViewOrders }: { canViewOrders: boolean } = $props();

	let summary = $state<Summary[]>([]);
	let activities = $state<Activity[]>([]);
	let payments = $state<Payment[]>([]);
	let orders = $state<Order[]>([]);
	let shopifyAdminUrl = $state('');
	let loading = $state(true);
	let errorMessage = $state('');

	function dateLabel(value: string): string {
		if (!value) return 'Date unavailable';
		const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00Z`);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					timeZone: 'UTC'
				}).format(parsed);
	}

	function money(value: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}

	async function responseJson<T>(response: Response): Promise<T> {
		const result = (await response.json()) as T & { message?: string };
		if (!response.ok) throw new Error(result.message || 'Could not load member history.');
		return result;
	}

	async function load() {
		loading = true;
		errorMessage = '';
		try {
			const requests: Promise<Response>[] = [fetch('/api/activity'), fetch('/api/payments')];
			if (canViewOrders) requests.push(fetch('/api/orders'));
			const responses = await Promise.all(requests);
			const activityResult = await responseJson<{ summary: Summary[]; activities: Activity[] }>(
				responses[0]
			);
			const paymentResult = await responseJson<{ payments: Payment[] }>(responses[1]);
			summary = activityResult.summary;
			activities = activityResult.activities;
			payments = paymentResult.payments;
			if (canViewOrders && responses[2]) {
				const orderResult = await responseJson<{
					orders: Order[];
					shopifyAdminUrl: string;
				}>(responses[2]);
				orders = orderResult.orders;
				shopifyAdminUrl = orderResult.shopifyAdminUrl;
			}
		} catch (cause) {
			errorMessage = cause instanceof Error ? cause.message : 'Could not load member history.';
		} finally {
			loading = false;
		}
	}

	onMount(load);
</script>

<section class="history-panel" id="history" aria-labelledby="history-title">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Your history</p>
			<h2 id="history-title">Activity and payments</h2>
		</div>
		<p>A private overview matched to your member ID and membership email addresses.</p>
	</div>

	{#if loading}
		<ContentState
			kind="loading"
			title="Loading your history"
			message="Checking activity and transaction records."
		/>
	{:else if errorMessage}
		<ContentState kind="error" title="History unavailable" message={errorMessage} />
	{:else}
		<div class="history-grid">
			<article class="history-card activity-card">
				<h3>Member activity</h3>
				{#if summary.length}
					<div class="activity-summary" aria-label="Activity totals">
						{#each summary as item (item.type)}
							<div><strong>{item.count}</strong><span>{item.type}</span></div>
						{/each}
					</div>
				{/if}
				{#if activities.length}
					<ul class="history-list">
						{#each activities.slice(0, 12) as activity (activity.id)}
							<li>
								<div><strong>{activity.type}</strong><span>{activity.description}</span></div>
								<time datetime={activity.submitDate}>{dateLabel(activity.submitDate)}</time>
							</li>
						{/each}
					</ul>
				{:else}
					<ContentState
						kind="empty"
						title="No activity recorded yet"
						message="Your participation history will appear here as records are added."
					/>
				{/if}
			</article>

			<article class="history-card">
				<h3>Membership payments</h3>
				{#if payments.length}
					<ul class="history-list">
						{#each payments as payment (payment.id)}
							<li>
								<div><strong>{money(payment.amount)}</strong><span>{payment.details}</span></div>
								<time datetime={payment.orderDate}>{dateLabel(payment.orderDate)}</time>
							</li>
						{/each}
					</ul>
				{:else}
					<ContentState
						kind="empty"
						title="No subscription payments found"
						message="Only CoLab membership subscription transactions appear here."
					/>
				{/if}
			</article>

			{#if canViewOrders}
				<article class="history-card">
					<div class="card-heading">
						<h3>Community fulfillment queue</h3>
						{#if shopifyAdminUrl}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={shopifyAdminUrl} target="_blank" rel="noreferrer">Shopify admin ↗</a>
						{/if}
					</div>
					{#if orders.length}
						<ul class="history-list">
							{#each orders as order (order.id)}
								<li>
									<div><strong>{order.name}</strong><span>{order.details}</span></div>
									<div class="order-meta">
										<span class="status-pill">{order.fulfillmentStatus}</span>
										<time datetime={order.orderDate}>{dateLabel(order.orderDate)}</time>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<ContentState
							kind="empty"
							title="No open orders"
							message="There are no unfulfilled non-subscription orders."
						/>
					{/if}
				</article>
			{/if}
		</div>
	{/if}
</section>
