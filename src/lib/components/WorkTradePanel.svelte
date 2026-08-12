<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import { onMount } from 'svelte';

	type WorkActivity = {
		id: string;
		submitDate: string;
		type: string;
		description: string;
		reason: string;
		needsReview: boolean;
		discountAmount: number;
		discountOverridden: boolean;
	};
	type Discount = {
		memberId: string;
		memberName: string;
		month: string;
		membershipType: string;
		membershipPrice: number;
		activityCount: number;
		activities: WorkActivity[];
		eligibleDiscount: number;
		approvedDiscount: number;
		status: 'pending_review' | 'approved' | 'opted_in' | 'declined' | 'shopify_updated';
	};
	let { isAdmin, readOnly }: { isAdmin: boolean; readOnly: boolean } = $props();
	const now = new Date();
	let month = $state(
		new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
	);
	let discount = $state<Discount | null>(null);
	let queue = $state<Discount[]>([]);
	let loading = $state(true);
	let working = $state('');
	let message = $state('');
	let errorMessage = $state('');
	let activityAmounts = $state<Record<string, number>>({});
	const activityLedger = $derived(
		queue.flatMap((item) =>
			item.activities.map((activity) => ({
				...activity,
				memberId: item.memberId,
				memberName: item.memberName || item.memberId,
				membershipType: item.membershipType,
				status: item.status
			}))
		)
	);
	const money = (value: number) =>
		new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	const monthLabel = (value: string) =>
		new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
			new Date(`${value}-01T12:00:00Z`)
		);
	const statusLabel = (status: Discount['status']) =>
		({
			pending_review: 'Awaiting admin review',
			approved: 'Approved—opt in available',
			opted_in: 'Opted in—Shopify update needed',
			declined: 'Closed—no discount',
			shopify_updated: 'Applied in Shopify'
		})[status];

	async function parse<T>(response: Response): Promise<T> {
		const result = (await response.json()) as T & { message?: string };
		if (!response.ok) throw new Error(result.message || 'Could not load work-trade details.');
		return result;
	}

	async function load(clearMessage = true) {
		loading = true;
		errorMessage = '';
		if (clearMessage) message = '';
		try {
			const memberRequest = fetch(`/api/work-trade?month=${month}`);
			const adminRequest = isAdmin ? fetch(`/api/admin/work-trade?month=${month}`) : null;
			const memberResult = await parse<{ discount: Discount | null }>(await memberRequest);
			discount = memberResult.discount;
			if (adminRequest)
				queue = (await parse<{ discounts: Discount[] }>(await adminRequest)).discounts;
			activityAmounts = Object.fromEntries(
				queue.flatMap((item) =>
					item.activities.map((activity) => [
						`${item.memberId}:${activity.id}`,
						activity.discountAmount
					])
				)
			);
		} catch (cause) {
			errorMessage = cause instanceof Error ? cause.message : 'Could not load work-trade details.';
		} finally {
			loading = false;
		}
	}

	async function optIn() {
		if (
			!discount ||
			!window.confirm(
				`Use the approved ${money(discount.approvedDiscount)} discount for ${monthLabel(month)}? An admin will still need to update Shopify.`
			)
		)
			return;
		working = 'opt-in';
		message = '';
		try {
			const result = await parse<{ discount: Discount; message: string }>(
				await fetch('/api/work-trade', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ month })
				})
			);
			discount = result.discount;
			message = result.message;
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not opt in.';
		} finally {
			working = '';
		}
	}

	async function adminAction(
		action: 'generate' | 'approve' | 'decline' | 'shopify_updated',
		memberId = ''
	) {
		const key = `${action}:${memberId}`;
		working = key;
		message = '';
		try {
			const result = await parse<{ discounts: Discount[]; message: string }>(
				await fetch('/api/admin/work-trade', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ action, memberId, month })
				})
			);
			queue = result.discounts;
			message = result.message;
			await load(false);
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not update work-trade status.';
		} finally {
			working = '';
		}
	}

	async function saveActivityDiscount(item: Discount, activity: WorkActivity) {
		const key = `${item.memberId}:${activity.id}`;
		working = `activity:${key}`;
		message = '';
		try {
			await parse(
				await fetch('/api/admin/work-trade', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						action: 'set_activity_discount',
						memberId: item.memberId,
						activityId: activity.id,
						amount: activityAmounts[key],
						month
					})
				})
			);
			message = 'Activity discount updated. The monthly total was recalculated.';
			await load(false);
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not update activity discount.';
		} finally {
			working = '';
		}
	}

	function closeWithoutDiscount(item: Discount) {
		if (
			window.confirm(
				`Close ${item.memberName || item.memberId}’s ${monthLabel(month)} work-trade month without a discount? They will not receive an opt-in action.`
			)
		) {
			void adminAction('decline', item.memberId);
		}
	}

	onMount(load);
</script>

<section class="work-trade-panel" id="work-trade" aria-labelledby="work-trade-title">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Monthly work credit</p>
			<h2 id="work-trade-title">Work-trade discount</h2>
		</div>
		<label
			><span>Month</span><input type="month" bind:value={month} onchange={() => load()} /></label
		>
	</div>
	<p>
		Logged work can reduce your monthly fee, but everyone pays at least $10. Discounts require admin
		approval and your opt-in before Shopify is updated.
	</p>
	{#if loading}<ContentState
			kind="loading"
			title="Loading work summary"
			message="Checking your monthly work and review status."
		/>
	{:else if errorMessage}<ContentState
			kind="error"
			title="Work summary unavailable"
			message={errorMessage}
			onretry={load}
		/>
	{:else if discount}
		<article class="work-trade-summary">
			<div class="work-trade-totals">
				<div><span>Logged work</span><strong>{discount.activityCount}</strong></div>
				<div><span>Eligible discount</span><strong>{money(discount.eligibleDiscount)}</strong></div>
				<div>
					<span>Minimum payment</span><strong
						>{money(discount.membershipPrice - discount.eligibleDiscount)}</strong
					>
				</div>
			</div>
			<span class="status-pill">{statusLabel(discount.status)}</span>
			{#if discount.activities.length}<details>
					<summary>Review logged work</summary>
					<ul class="history-list">
						{#each discount.activities as activity (activity.id)}<li>
								<div>
									<strong>{activity.type}</strong><span
										>{activity.reason}{activity.needsReview ? ' · Needs review' : ''}</span
									>
								</div>
								<div class="work-activity-credit">
									<strong>{money(activity.discountAmount)}</strong>
									<time datetime={activity.submitDate}>{activity.submitDate}</time>
								</div>
							</li>{/each}
					</ul>
				</details>{/if}
			{#if discount.status === 'approved' && !readOnly}<button
					class="work-trade-primary-action"
					type="button"
					onclick={optIn}
					disabled={Boolean(working)}>Opt in to {money(discount.approvedDiscount)} discount</button
				>{/if}
		</article>
	{:else}<ContentState
			kind="empty"
			title="No work-trade summary yet"
			message={`An admin has not generated a ${monthLabel(month)} summary yet.`}
		/>{/if}
	{#if message}<p role="status">{message}</p>{/if}

	{#if isAdmin}
		<div class="work-trade-admin">
			<div class="card-heading">
				<div>
					<p class="eyebrow">Admin review</p>
					<h3>Discount queue</h3>
				</div>
				<button
					class="work-trade-primary-action"
					type="button"
					onclick={() => adminAction('generate')}
					disabled={Boolean(working)}
					>{working.startsWith('generate') ? 'Reading Monday…' : 'Generate summaries'}</button
				>
			</div>
			{#if queue.length}<div class="work-trade-queue">
					{#each queue as item (`${item.memberId}:${item.month}`)}<article>
							<div>
								<strong>{item.memberName || item.memberId}</strong><span
									>{item.membershipType} · {item.activityCount} activities</span
								>
							</div>
							<div>
								<strong>{money(item.eligibleDiscount)}</strong><span class="status-pill"
									>{statusLabel(item.status)}</span
								>
							</div>
							<div class="work-trade-actions">
								{#if item.status === 'pending_review'}<button
										class="work-trade-primary-action"
										type="button"
										onclick={() => adminAction('approve', item.memberId)}
										disabled={Boolean(working)}>Approve</button
									><button
										type="button"
										class="secondary-button"
										onclick={() => closeWithoutDiscount(item)}
										disabled={Boolean(working)}>Close without discount</button
									>{:else if item.status === 'opted_in'}<a
										class="work-trade-secondary-action"
										href="https://admin.shopify.com/store/queerlective"
										target="_blank"
										rel="noreferrer">Open Shopify ↗</a
									><button
										class="work-trade-primary-action"
										type="button"
										onclick={() => adminAction('shopify_updated', item.memberId)}
										disabled={Boolean(working)}>Mark Shopify updated</button
									>{/if}
							</div>
							<details class="work-trade-review-detail">
								<summary>Review logged work</summary>
								<ul class="history-list">
									{#each item.activities as activity (activity.id)}
										<li>
											<div>
												<strong>{activity.type}</strong>
												<span>{activity.reason}{activity.needsReview ? ' · Needs review' : ''}</span
												>
											</div>
											<div class="activity-discount-editor">
												<label>
													<span>Discount</span>
													<input
														type="number"
														min="0"
														max={item.membershipPrice - 10}
														step="0.01"
														bind:value={activityAmounts[`${item.memberId}:${activity.id}`]}
														disabled={item.status !== 'pending_review'}
													/>
												</label>
												{#if item.status === 'pending_review'}
													<button
														class="work-trade-save-action"
														type="button"
														onclick={() => saveActivityDiscount(item, activity)}
														disabled={Boolean(working)}>Save</button
													>
												{/if}
												<time datetime={activity.submitDate}>{activity.submitDate}</time>
											</div>
										</li>
									{/each}
								</ul>
							</details>
						</article>{/each}
				</div>
			{:else}<p>
					No summaries for this month. Generate them after the month’s work is logged in Monday.
				</p>{/if}
			<div class="work-activity-ledger">
				<div class="card-heading">
					<div>
						<p class="eyebrow">All available activity</p>
						<h3>Activity discount ledger</h3>
					</div>
					<span>{activityLedger.length} records</span>
				</div>
				{#if activityLedger.length}
					<div class="work-activity-table-wrap">
						<table>
							<thead
								><tr
									><th>Member</th><th>Activity</th><th>Date</th><th>Applied discount</th><th
										>Status</th
									></tr
								></thead
							>
							<tbody>
								{#each activityLedger as activity (`${activity.memberId}:${activity.id}`)}
									<tr>
										<td>{activity.memberName}<small>{activity.membershipType}</small></td>
										<td><strong>{activity.type}</strong><small>{activity.reason}</small></td>
										<td>{activity.submitDate}</td>
										<td
											><strong>{money(activity.discountAmount)}</strong
											>{#if activity.discountOverridden}<small>Admin override</small>{/if}</td
										>
										<td><span class="status-pill">{statusLabel(activity.status)}</span></td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}<p>
						Generate summaries to review all logged activities and their applied discounts.
					</p>{/if}
			</div>
		</div>
	{/if}
</section>
