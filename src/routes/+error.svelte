<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>{page.status} · CoLab Member Portal</title>
</svelte:head>

<main class="error-page" id="main-content">
	<a class="brand" href={resolve('/')} aria-label="Return to CoLab dashboard">
		<span class="brand-mark" aria-hidden="true">Q</span>
		<span>CoLab</span>
	</a>
	<div>
		<p class="eyebrow">Error {page.status}</p>
		<h1>{page.status === 404 ? 'We couldn’t find that page.' : 'We hit a snag.'}</h1>
		<p>{page.error?.message || 'Please return to the dashboard and try again.'}</p>
		{#if page.error?.requestId}
			<p class="request-id">Support reference: <code>{page.error.requestId}</code></p>
		{/if}
		<a class="error-action" href={resolve('/')}>Return to dashboard</a>
	</div>
</main>
