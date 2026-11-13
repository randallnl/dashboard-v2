<script lang="ts">
	import { linkify } from '$lib/linkify';

	let { text }: { text: string } = $props();
</script>

{#each linkify(text) as part, index (index)}
	{#if part.type === 'link'}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="inline-rendered-link" href={part.href} target="_blank" rel="noreferrer"
			>{part.text}<span aria-hidden="true"> ↗</span></a
		>
	{:else}
		{part.text}
	{/if}
{/each}
