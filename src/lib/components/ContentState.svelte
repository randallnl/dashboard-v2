<script lang="ts">
	type StateKind = 'loading' | 'empty' | 'error';

	let {
		kind,
		title,
		message,
		onretry
	}: {
		kind: StateKind;
		title: string;
		message: string;
		onretry?: () => void;
	} = $props();
</script>

<div
	class="content-state"
	class:state-error={kind === 'error'}
	role={kind === 'error' ? 'alert' : 'status'}
	aria-live={kind === 'error' ? 'assertive' : 'polite'}
	aria-busy={kind === 'loading'}
>
	{#if kind === 'loading'}
		<div class="state-skeleton" aria-hidden="true">
			<span></span><span></span><span></span>
		</div>
	{:else}
		<span class="state-symbol" aria-hidden="true">{kind === 'error' ? '!' : '—'}</span>
	{/if}
	<div>
		<strong>{title}</strong>
		<p>{message}</p>
		{#if kind === 'error' && onretry}
			<button type="button" onclick={onretry}>Try again</button>
		{/if}
	</div>
</div>
