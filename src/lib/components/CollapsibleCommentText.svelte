<script lang="ts">
	import LinkifiedText from '$lib/components/LinkifiedText.svelte';
	import { onMount } from 'svelte';

	let { text }: { text: string } = $props();
	let content = $state<HTMLParagraphElement>();
	let expanded = $state(false);
	let hasOverflow = $state(false);

	function measureOverflow() {
		if (!content || expanded) return;
		hasOverflow = content.scrollHeight > content.clientHeight + 1;
	}

	onMount(() => {
		const frame = requestAnimationFrame(measureOverflow);
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureOverflow);
		if (content && observer) observer.observe(content);
		return () => {
			cancelAnimationFrame(frame);
			observer?.disconnect();
		};
	});
</script>

<div class="collapsible-comment">
	<p
		bind:this={content}
		class:expanded={expanded}
		class:truncated={hasOverflow && !expanded}
		class="comment-preview"
	>
		<LinkifiedText {text} />
	</p>
	{#if hasOverflow}
		<button
			class="comment-preview-toggle"
			type="button"
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
		>
			{expanded ? 'Show less' : 'Show full comment'}
		</button>
	{/if}
</div>
