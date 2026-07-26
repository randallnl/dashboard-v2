<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import type { Shift } from '$lib/types/domain';
	import { onMount, untrack } from 'svelte';

	let {
		isAdmin,
		readOnly = false,
		initialAvailableShifts = []
	}: {
		isAdmin: boolean;
		readOnly?: boolean;
		initialAvailableShifts?: Shift[];
	} = $props();

	let shifts = $state<Shift[]>(untrack(() => initialAvailableShifts));
	let loading = $state(false);
	let claimingId = $state('');
	let message = $state('');
	let failed = $state(false);
	let showShiftPicker = $state(false);
	let selectedShiftId = $state('');
	const visibleShifts = $derived(shifts.slice(0, 3));

	async function loadShifts() {
		loading = true;
		failed = false;
		try {
			const response = await fetch('/api/shifts');
			const result = (await response.json()) as {
				available?: Shift[];
				covered?: Shift[];
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
			selectedShiftId = '';
			if (shifts.length === 0) showShiftPicker = false;
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
		{#if isAdmin}<p class="automatic-sync-note">Updates automatically every 15 minutes.</p>{/if}
	</div>

	{#if message}
		<p class="shift-message" class:error={failed} role={failed ? 'alert' : 'status'}>{message}</p>
	{/if}
	{#if readOnly}
		<p class="shift-message">Shift signup is disabled in administrator member view.</p>
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
				? 'Everything is covered. Monday refreshes automatically every 15 minutes.'
				: 'Everything currently listed is covered. Check back soon.'}
		/>
	{:else}
		<div class="shift-list">
			{#each visibleShifts as shift (shift.id)}
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
						disabled={Boolean(claimingId) || readOnly}
						aria-label={`Claim ${shift.title} on ${shift.dateLabel || shift.dateValue}`}
					>
						{claimingId === shift.id ? 'Claiming…' : readOnly ? 'View only' : 'Claim shift'}
					</button>
				</article>
			{/each}
		</div>
		{#if shifts.length > 3}
			<button class="show-more-button" type="button" onclick={() => (showShiftPicker = true)}>
				See all {shifts.length} open shifts
			</button>
		{/if}
	{/if}

	{#if showShiftPicker}
		<div class="event-dialog-backdrop" role="presentation">
			<div
				class="event-dialog shift-picker-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="shift-picker-title"
			>
				<div class="card-heading">
					<div>
						<p class="eyebrow">Upcoming coverage</p>
						<h3 id="shift-picker-title">Choose an open CoLab shift</h3>
					</div>
					<button
						type="button"
						class="text-button"
						onclick={() => {
							showShiftPicker = false;
							selectedShiftId = '';
						}}
					>
						Close
					</button>
				</div>
				<div class="shift-picker-list">
					{#each shifts as shift (shift.id)}
						<article class:expanded={selectedShiftId === shift.id}>
							<div class="shift-picker-row-main">
								<div>
									<strong>{shift.dateLabel || shift.dateValue} · {shift.timeLabel}</strong>
									<span>{shift.title}{shift.month ? ` · ${shift.month}` : ''}</span>
								</div>
								<button
									type="button"
									onclick={() => (selectedShiftId = shift.id)}
									disabled={Boolean(claimingId) || readOnly}
									aria-expanded={selectedShiftId === shift.id}
								>
									{readOnly ? 'View only' : 'Sign Up'}
								</button>
							</div>
							{#if selectedShiftId === shift.id}
								<div class="shift-signup-confirmation">
									<h4>Confirm shift signup</h4>
									<dl>
										<div>
											<dt>Shift</dt>
											<dd>{shift.title}</dd>
										</div>
										<div>
											<dt>Date</dt>
											<dd>{shift.dateLabel || shift.dateValue}</dd>
										</div>
										<div>
											<dt>Time</dt>
											<dd>{shift.timeLabel}</dd>
										</div>
										{#if shift.month}
											<div>
												<dt>Schedule</dt>
												<dd>{shift.month}</dd>
											</div>
										{/if}
									</dl>
									<p>
										By confirming, your name will be added as the person covering this CoLab shift.
									</p>
									<div class="shift-confirm-actions">
										<button
											type="button"
											onclick={() => claim(shift)}
											disabled={Boolean(claimingId)}
										>
											{claimingId === shift.id ? 'Signing up…' : 'Confirm signup'}
										</button>
										<button
											type="button"
											class="text-button"
											onclick={() => (selectedShiftId = '')}
											disabled={Boolean(claimingId)}
										>
											Cancel
										</button>
									</div>
								</div>
							{/if}
						</article>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</section>
