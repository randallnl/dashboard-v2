<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import type { Shift } from '$lib/types/domain';
	import { onMount } from 'svelte';

	let { isAdmin }: { isAdmin: boolean } = $props();

	let shifts = $state<Shift[]>([]);
	let loading = $state(true);
	let syncing = $state(false);
	let claimingId = $state('');
	let message = $state('');
	let failed = $state(false);

	async function loadShifts() {
		loading = true;
		failed = false;
		try {
			const response = await fetch('/api/shifts');
			const result = (await response.json()) as {
				available?: Shift[];
				message?: string;
			};
			if (!response.ok) throw new Error(result.message || 'Could not load shifts.');
			shifts = result.available ?? [];
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not load shifts.';
		} finally {
			loading = false;
		}
	}

	async function syncShifts() {
		syncing = true;
		message = '';
		try {
			const response = await fetch('/api/admin/sync/shifts', { method: 'POST' });
			const result = (await response.json()) as { count?: number; message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not synchronize shifts.');
			message = `${result.count ?? 0} shifts synchronized from Monday.`;
			await loadShifts();
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not synchronize shifts.';
		} finally {
			syncing = false;
		}
	}

	async function claim(shift: Shift) {
		claimingId = shift.id;
		message = '';
		try {
			const response = await fetch('/api/shifts/signup', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ shiftId: shift.id })
			});
			const result = (await response.json()) as { shift?: Shift; message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not claim this shift.');
			shifts = shifts.filter((candidate) => candidate.id !== shift.id);
			message = `You’re covering ${shift.title} on ${shift.dateLabel || shift.dateValue}.`;
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not claim this shift.';
			await loadShifts();
		} finally {
			claimingId = '';
		}
	}

	onMount(loadShifts);
</script>

<section class="shift-panel" aria-labelledby="available-shifts-title">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Studio coverage</p>
			<h2 id="available-shifts-title">Available shifts</h2>
		</div>
		{#if isAdmin}
			<button class="secondary-button" type="button" onclick={syncShifts} disabled={syncing}>
				{syncing ? 'Syncing…' : 'Sync from Monday'}
			</button>
		{/if}
	</div>

	{#if message}
		<p class="shift-message" class:error={failed} role={failed ? 'alert' : 'status'}>{message}</p>
	{/if}

	{#if loading}
		<ContentState
			kind="loading"
			title="Loading shifts"
			message="Checking current studio coverage."
		/>
	{:else if failed && shifts.length === 0}
		<ContentState kind="error" title="Shifts unavailable" {message} />
	{:else if shifts.length === 0}
		<ContentState
			kind="empty"
			title="No open shifts"
			message={isAdmin
				? 'Everything is covered, or synchronize Monday to refresh the list.'
				: 'Everything currently listed is covered. Check back soon.'}
		/>
	{:else}
		<div class="shift-list">
			{#each shifts as shift (shift.id)}
				<article>
					<div class="shift-date">
						<strong>{shift.dateLabel || shift.dateValue}</strong>
						<span>{shift.timeLabel}</span>
					</div>
					<div class="shift-description">
						<h3>{shift.title}</h3>
						<p>{shift.month}</p>
					</div>
					<button
						type="button"
						onclick={() => claim(shift)}
						disabled={Boolean(claimingId)}
						aria-label={`Claim ${shift.title} on ${shift.dateLabel || shift.dateValue}`}
					>
						{claimingId === shift.id ? 'Claiming…' : 'Claim shift'}
					</button>
				</article>
			{/each}
		</div>
	{/if}
</section>
