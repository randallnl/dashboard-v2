<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>CoLab links</title>
	<meta name="description" content="Explore CoLab projects and opportunities." />
</svelte:head>

<main class="quick-links-page" id="main-content">
	<section class="quick-links-shell" aria-labelledby="quick-links-title">
		<header>
			<span class="quick-links-mark" aria-hidden="true">Q</span>
			<p class="eyebrow">CoLab</p>
			<h1 id="quick-links-title">Worth a closer look.</h1>
			<p class="quick-links-intro">
				Projects, opportunities, and good things happening in our community.
			</p>
		</header>

		{#if data.links.length}
			<nav class="quick-links-list" aria-label="Featured projects">
				{#each data.links as link (link.id)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={link.url} target="_blank" rel="noreferrer">
						{#if link.image}<img src={link.image} alt="" />{:else}<span
								class="quick-links-image"
								aria-hidden="true">↗</span
							>{/if}
						<span
							><strong>{link.title}</strong>{#if link.description}<small>{link.description}</small
								>{/if}</span
						>
						<span class="quick-links-arrow" aria-hidden="true">↗</span>
					</a>
				{/each}
			</nav>
		{:else}
			<p class="quick-links-empty">New links are on their way.</p>
		{/if}
	</section>
</main>
