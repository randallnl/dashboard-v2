<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { RETAIL_STEPS, type RetailOrder } from '$lib/retail/orders';
	let { canManage }: { canManage: boolean } = $props();
	let orders = $state<RetailOrder[]>([]);
	let inbox = $state('');
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');
	let title = $state('');
	let orderNumber = $state('');
	let notes = $state('');
	let showCompleted = $state(false);
	const completed = (order: RetailOrder) => RETAIL_STEPS.every((step) => order.steps[step.id]);
	const visible = $derived(orders.filter((order) => showCompleted || !completed(order)));
	async function request(body?: Record<string, unknown>) {
		error = '';
		busy = true;
		try {
			const response = await fetch(
				resolve('/api/admin/retail'),
				body
					? {
							method: 'POST',
							headers: { 'content-type': 'application/json' },
							body: JSON.stringify(body)
						}
					: {}
			);
			const data = (await response.json()) as {
				orders: RetailOrder[];
				inbox: string;
				message?: string;
			};
			if (!response.ok) throw new Error(data.message || 'Unable to load retail orders.');
			orders = data.orders;
			inbox = data.inbox;
			return true;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to save changes. Try again.';
			return false;
		} finally {
			busy = false;
			loading = false;
		}
	}
	onMount(() => {
		if (canManage) void request();
	});
	async function create(event: SubmitEvent) {
		event.preventDefault();
		if (await request({ action: 'create', title, orderNumber, notes })) {
			title = '';
			orderNumber = '';
			notes = '';
		}
	}
</script>

<div class="retail-panel">
	<header>
		<p class="eyebrow">CoLab retail</p>
		<h2>From order to shelf</h2>
		<p>Track Faire wholesale orders and the steps that get products ready to sell.</p>
		<a href="https://portal.queerlective.com/login" target="_blank" rel="noreferrer"
			>Manage member retail ↗</a
		>
	</header>
	{#if canManage}
		{#if error}<p role="alert" class="retail-error">
				{error} <button onclick={() => request()} disabled={busy}>Retry loading</button>
			</p>{/if}
		<div class="retail-tools">
			<details class="retail-card">
				<summary>Add a Faire order</summary>
				<form onsubmit={create}>
					<label
						>Brand / order title<input
							bind:value={title}
							maxlength="200"
							required
							placeholder="Brand name · November restock"
						/></label
					>
					<label
						>Faire order number<input
							bind:value={orderNumber}
							maxlength="80"
							pattern="[A-Za-z0-9-]+"
							required
						/></label
					>
					<label
						>Products, quantities, or receiving notes<textarea
							bind:value={notes}
							maxlength="20000"
							rows="4"></textarea></label
					>
					<button disabled={busy}>Create order &amp; checklist</button>
					<small>An existing Faire order number keeps its original record and progress.</small>
				</form>
			</details>
			<details class="retail-card">
				<summary>Forward Faire emails</summary>
				<p>
					Forward one order confirmation per email to create its checklist. Keep this address
					private.
				</p>
				{#if inbox}
					<label
						>Private forwarding address<input
							readonly
							value={inbox}
							onclick={(event) => event.currentTarget.select()}
						/></label
					>
				{:else}
					<button disabled={busy || loading} onclick={() => request({ action: 'inbox' })}
						>Generate forwarding address</button
					>
				{/if}
				<p class="muted">
					Setup required: route this address to the dashboard email receiver in Cloudflare.
					Generating an address does not activate delivery.
				</p>
				<small
					>Email text is saved for reference; attachments are not imported. Inventory updates remain
					manual checklist steps.</small
				>
			</details>
		</div>
		<div class="retail-list-heading">
			<h3>
				Wholesale orders <span>({orders.filter((order) => !completed(order)).length} open)</span>
			</h3>
			<label class="check"
				><input type="checkbox" bind:checked={showCompleted} /> Show completed</label
			>
		</div>
		{#if loading}<p role="status">Loading wholesale orders…</p>
		{:else if !visible.length && !error}<div class="retail-card">
				<h3>
					{orders.length
						? 'All orders are ready for the shelf'
						: 'Your wholesale orders start here'}
				</h3>
				<p>Add a Faire order to create the receiving and inventory checklist.</p>
			</div>{/if}
		{#each visible as order (order.id)}
			<article class="retail-card">
				<div class="retail-list-heading">
					<h3>{order.title}</h3>
					<span
						>{RETAIL_STEPS.filter((step) => order.steps[step.id]).length} / {RETAIL_STEPS.length} complete</span
					>
				</div>
				<p class="muted">
					{order.order_number
						? `Faire #${order.order_number}`
						: 'Review email: order number not detected'} · Added {new Date(
						order.created_at
					).toLocaleDateString()}
				</p>
				<div class="steps">
					{#each RETAIL_STEPS as step (step.id)}
						<label class="check"
							><input
								type="checkbox"
								checked={Boolean(order.steps[step.id])}
								disabled={busy}
								onchange={(event) => {
									const complete = event.currentTarget.checked;
									event.currentTarget.checked = Boolean(order.steps[step.id]);
									void request({ action: 'step', id: order.id, step: step.id, complete });
								}}
							/><span>{step.label}</span>{#if order.steps[step.id]}<small
									>{new Date(order.steps[step.id]).toLocaleDateString()}</small
								>{/if}</label
						>
					{/each}
				</div>
				{#if order.notes}<details>
						<summary>Order notes / original email</summary>
						<pre>{order.notes}</pre>
					</details>{/if}
			</article>
		{/each}
	{:else}
		<div class="retail-card">
			<p>
				Wholesale order management is available to administrators in their own account view. Use the
				member retail portal above to manage your artist retail.
			</p>
		</div>
	{/if}
</div>

<style>
	.retail-panel {
		display: grid;
		gap: 1.25rem;
	}
	.retail-panel header p {
		margin-block: 0.5rem;
	}
	.retail-tools {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		align-items: start;
	}
	.retail-card {
		padding: 1.25rem;
		border: 1px solid #d9ddd5;
		border-radius: 16px;
		background: #fff;
	}
	summary {
		cursor: pointer;
		font-weight: 650;
	}
	form,
	.steps {
		display: grid;
		gap: 0.85rem;
		margin-block: 1rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
	}
	input:not([type='checkbox']),
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.65rem;
		border: 1px solid #aeb8ab;
		border-radius: 7px;
	}
	.check {
		display: flex;
		gap: 0.65rem;
		align-items: center;
	}
	.check input {
		flex-shrink: 0;
	}
	.check small {
		margin-left: auto;
	}
	.retail-list-heading {
		display: flex;
		gap: 1rem;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
	}
	h3 {
		margin: 0;
	}
	h3 span,
	.muted,
	small {
		color: #596351;
	}
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font: inherit;
		max-height: 24rem;
		overflow-y: auto;
	}
	.retail-error {
		color: #9a2020;
	}
	@media (max-width: 700px) {
		.retail-tools {
			grid-template-columns: 1fr;
		}
	}
</style>
