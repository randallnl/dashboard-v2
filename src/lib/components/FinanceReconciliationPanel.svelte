<script lang="ts">
	import ContentState from '$lib/components/ContentState.svelte';
	import { onMount } from 'svelte';

	type FinanceTask = {
		month: string;
		accountKey: string;
		accountLabel: string;
		status: 'outstanding' | 'complete';
		statementFileId: string;
		statementFileName: string;
		statementUploadedAt: string;
		statementUploadedBy: string;
		quickbooksForwardedAt: string;
		completedAt: string;
		completedBy: string;
	};

	type FinanceResponse = {
		month: string;
		tasks: FinanceTask[];
		quickBooksConfigured: boolean;
		message?: string;
		quickBooksMessage?: string;
	};

	const financeFolderUrl =
		'https://drive.google.com/drive/folders/1msdCi_bCx9jPRjLxezB2rtbcQFCTfJ3g';
	const statementAccept = '.pdf,application/pdf';

	function currentMonth(): string {
		return new Date().toISOString().slice(0, 7);
	}

	function monthLabel(value: string): string {
		const parsed = new Date(`${value}-01T12:00:00Z`);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					month: 'long',
					year: 'numeric',
					timeZone: 'UTC'
				}).format(parsed);
	}

	function timestampLabel(value: string): string {
		if (!value) return '';
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					hour: 'numeric',
					minute: '2-digit'
				}).format(parsed);
	}

	let month = $state(currentMonth());
	let tasks = $state<FinanceTask[]>([]);
	let loading = $state(true);
	let submitting = $state('');
	let message = $state('');
	let failed = $state(false);
	let quickBooksConfigured = $state(false);

	const outstandingCount = $derived(tasks.filter((task) => task.status === 'outstanding').length);

	function messageFrom(result: FinanceResponse & { message?: string }): string {
		return result.quickBooksMessage || result.message || '';
	}

	async function load() {
		loading = true;
		message = '';
		try {
			const response = await fetch(
				`/api/admin/finance/reconciliation?month=${encodeURIComponent(month)}`
			);
			const result = (await response.json()) as FinanceResponse & { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not load reconciliation tasks.');
			tasks = result.tasks;
			quickBooksConfigured = result.quickBooksConfigured;
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not load reconciliation tasks.';
		} finally {
			loading = false;
		}
	}

	async function upload(task: FinanceTask, statement: File) {
		submitting = `upload:${task.accountKey}`;
		message = '';
		const form = new FormData();
		form.set('month', month);
		form.set('accountKey', task.accountKey);
		form.set('statement', statement, statement.name);
		try {
			const response = await fetch('/api/admin/finance/statements', { method: 'POST', body: form });
			const result = (await response.json()) as FinanceResponse & { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not upload the statement.');
			tasks = result.tasks;
			quickBooksConfigured = result.quickBooksConfigured;
			message = messageFrom(result);
			failed = false;
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Could not upload the statement.';
		} finally {
			submitting = '';
		}
	}

	async function updateCompletion(task: FinanceTask) {
		const action = task.status === 'complete' ? 'reopen' : 'complete';
		submitting = `${action}:${task.accountKey}`;
		message = '';
		try {
			const response = await fetch('/api/admin/finance/reconciliation', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, month, accountKey: task.accountKey })
			});
			const result = (await response.json()) as FinanceResponse & { message?: string };
			if (!response.ok)
				throw new Error(result.message || 'Could not update this reconciliation task.');
			tasks = result.tasks;
			quickBooksConfigured = result.quickBooksConfigured;
			message =
				action === 'complete'
					? `${task.accountLabel} marked complete.`
					: `${task.accountLabel} reopened.`;
			failed = false;
		} catch (cause) {
			failed = true;
			message =
				cause instanceof Error ? cause.message : 'Could not update this reconciliation task.';
		} finally {
			submitting = '';
		}
	}

	onMount(() => {
		void load();
	});
</script>

<section class="finance-reconciliation" aria-labelledby="finance-reconciliation-title">
	<div class="finance-reconciliation-heading">
		<div>
			<p class="eyebrow">Monthly close</p>
			<h2 id="finance-reconciliation-title">Reconcile the month</h2>
			<p>
				Save each source statement to the shared Finance folder, forward it to QuickBooks, then
				close the item.
			</p>
		</div>
		<label class="finance-month-picker">
			<span>Reconciliation month</span>
			<input type="month" bind:value={month} onchange={() => void load()} />
		</label>
	</div>

	<div class="finance-summary" aria-live="polite">
		<div>
			<strong>{outstandingCount}</strong><span>outstanding this month</span>
		</div>
		<a href={financeFolderUrl} target="_blank" rel="noreferrer">Open Finance folder ↗</a>
	</div>

	{#if !quickBooksConfigured}
		<aside class="finance-setup-notice">
			<strong>QuickBooks forwarding needs setup.</strong>
			<span
				>Statements can be stored in Drive now, but their reconciliation items will stay outstanding
				until the QuickBooks receipt inbox is connected.</span
			>
		</aside>
	{/if}

	{#if message}
		<p class="finance-message" class:error={failed} role={failed ? 'alert' : 'status'}>{message}</p>
	{/if}

	{#if loading}
		<ContentState
			kind="loading"
			title="Loading finance tasks"
			message="Preparing this month's reconciliation checklist."
		/>
	{:else if failed && !tasks.length}
		<ContentState kind="error" title="Finance tasks unavailable" {message} onretry={load} />
	{:else}
		<div class="finance-task-grid">
			{#each tasks as task (task.accountKey)}
				<article class:complete={task.status === 'complete'} class="finance-task">
					<header>
						<div>
							<p>{monthLabel(task.month)}</p>
							<h3>{task.accountLabel}</h3>
						</div>
						<span class:complete={task.status === 'complete'} class="finance-status">
							{task.status === 'complete' ? 'Complete' : 'Outstanding'}
						</span>
					</header>

					<div class="finance-step-list">
						<div class:done={Boolean(task.statementFileId)}>
							<span aria-hidden="true">{task.statementFileId ? '✓' : '1'}</span>
							<div>
								<strong>Statement in Finance folder</strong>
								{#if task.statementFileId}
									<a
										href={`https://drive.google.com/open?id=${task.statementFileId}`}
										target="_blank"
										rel="noreferrer">{task.statementFileName} ↗</a
									>
									<small>Saved {timestampLabel(task.statementUploadedAt)}</small>
								{:else}
									<small>Upload the bank or account statement.</small>
								{/if}
							</div>
						</div>
						<div class:done={Boolean(task.quickbooksForwardedAt)}>
							<span aria-hidden="true">{task.quickbooksForwardedAt ? '✓' : '2'}</span>
							<div>
								<strong>Forwarded to QuickBooks</strong>
								<small>
									{task.quickbooksForwardedAt
										? `Forwarded ${timestampLabel(task.quickbooksForwardedAt)}`
										: quickBooksConfigured
											? 'Ready to send when a statement is uploaded.'
											: 'Receipt forwarding is not configured.'}
								</small>
							</div>
						</div>
						<div class:done={task.status === 'complete'}>
							<span aria-hidden="true">{task.status === 'complete' ? '✓' : '3'}</span>
							<div>
								<strong>Reconciliation complete</strong>
								<small>
									{task.status === 'complete'
										? `Completed ${timestampLabel(task.completedAt)}`
										: 'Mark complete after both records are in place.'}
								</small>
							</div>
						</div>
					</div>

					<div class="finance-task-actions">
						<label
							class="finance-upload-button"
							class:busy={submitting === `upload:${task.accountKey}`}
						>
							<input
								type="file"
								accept={statementAccept}
								disabled={Boolean(submitting)}
								onchange={(event) => {
									const input = event.currentTarget;
									const statement = input.files?.[0];
									input.value = '';
									if (statement) void upload(task, statement);
								}}
							/>
							{submitting === `upload:${task.accountKey}` ? 'Saving…' : 'Upload statement'}
						</label>
						<button
							type="button"
							class="finance-complete-button"
							disabled={Boolean(submitting) ||
								(task.status === 'outstanding' &&
									(!task.statementFileId || !task.quickbooksForwardedAt))}
							onclick={() => void updateCompletion(task)}
						>
							{task.status === 'complete'
								? submitting === `reopen:${task.accountKey}`
									? 'Reopening…'
									: 'Reopen'
								: submitting === `complete:${task.accountKey}`
									? 'Completing…'
									: 'Mark complete'}
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>
