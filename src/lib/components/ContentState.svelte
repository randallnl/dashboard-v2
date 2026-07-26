<script lang="ts">
	type StateKind = 'loading' | 'empty' | 'error';

	let {
		kind,
		title,
		message
	}: {
		kind: StateKind;
		title: string;
		message: string;
	} = $props();
</script>

<div
	class="content-state"
	class:state-error={kind === 'error'}
	role={kind === 'error' ? 'alert' : 'status'}
>
	{#if kind === 'loading'}
		<span class="state-spinner" aria-hidden="true"></span>
	{:else}
		<span class="state-symbol" aria-hidden="true">{kind === 'error' ? '!' : '—'}</span>
	{/if}
	<div>
		<strong>{title}</strong>
		<p>{message}</p>
	</div>
</div>
