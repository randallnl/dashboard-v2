<script lang="ts">
	import { displayColabDate } from '$lib/public/colab-updates';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	const EMBED_PARENT_ORIGINS = new Set([
		'https://queerlective.com',
		'https://www.queerlective.com'
	]);

	let { data }: { data: PageData } = $props();

	const weekLabel = $derived(
		`${displayColabDate(data.week.from)} – ${displayColabDate(data.week.through)}`
	);

	function embedParentOrigin(): string {
		if (window.parent === window || !document.referrer) return '';
		try {
			const origin = new URL(document.referrer).origin;
			return EMBED_PARENT_ORIGINS.has(origin) ? origin : '';
		} catch {
			return '';
		}
	}

	onMount(() => {
		const targetOrigin = embedParentOrigin();
		if (!targetOrigin) return;

		const publishHeight = () => {
			const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
			window.parent.postMessage(
				{ source: 'queerlective-colab-updates', type: 'resize', height },
				targetOrigin
			);
		};

		const observer = new ResizeObserver(publishHeight);
		observer.observe(document.documentElement);
		observer.observe(document.body);
		const initialFrame = requestAnimationFrame(publishHeight);
		window.addEventListener('load', publishHeight);
		window.addEventListener('resize', publishHeight);

		return () => {
			cancelAnimationFrame(initialFrame);
			observer.disconnect();
			window.removeEventListener('load', publishHeight);
			window.removeEventListener('resize', publishHeight);
		};
	});
</script>

<svelte:head>
	<title>CoLab updates · Queerlective</title>
	<meta
		name="description"
		content="Public updates, staffed open hours, and useful CoLab links from Queerlective."
	/>
</svelte:head>

<main class="updates-page" id="main-content">
	<section class="updates-hero" aria-labelledby="updates-title">
		<div class="hero-photo" aria-hidden="true"></div>
		<div class="hero-overlay"></div>
		<div class="hero-content">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				class="wordmark"
				href="https://queerlective.com"
				target="_parent"
				aria-label="Queerlective home"
			>
				<span aria-hidden="true">✦</span> Queerlective
			</a>
			<p class="eyebrow">CoLab community bulletin</p>
			<h1 id="updates-title">What’s happening at CoLab.</h1>
			<p class="hero-copy">Open hours, studio notes, and the helpful links members use most.</p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="dashboard-link" href={data.dashboardUrl} target="_parent">
				Open the member dashboard <span aria-hidden="true">↗</span>
			</a>
		</div>
	</section>

	<section class="updates-grid" aria-label="CoLab updates">
		<article class="panel announcement-panel">
			<div class="panel-heading">
				<p class="eyebrow">Latest news</p>
				<h2>Announcements</h2>
			</div>
			<div class="announcement-empty">
				<span class="announcement-spark" aria-hidden="true">✦</span>
				<div>
					<h3>No announcements right now.</h3>
					<p>Keep an eye here for opportunities, studio updates, and community notes.</p>
				</div>
			</div>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				class="text-link"
				href="https://forms.monday.com/forms/ddce8c6fe8b66ee69ab375ec8e68f09e?r=use1"
				target="_parent"
			>
				Have an update to share? <span aria-hidden="true">→</span>
			</a>
		</article>

		<article class="panel hours-panel">
			<div class="panel-heading heading-row">
				<div>
					<p class="eyebrow">This week</p>
					<h2>Staffed open hours</h2>
				</div>
				<p class="date-range">{weekLabel}</p>
			</div>

			{#if data.staffedHours.length}
				<ul class="hours-list">
					{#each data.staffedHours as shift (shift.id)}
						<li>
							<p class="date-chip">{displayColabDate(shift.date)}</p>
							<div>
								<h3>{shift.title}</h3>
								<p>{shift.time}</p>
							</div>
							<span class="staffed-pill"><span aria-hidden="true"></span> Staffed</span>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="hours-empty">
					<span aria-hidden="true">◌</span>
					<p>
						No staffed open hours are listed for this week. Check the dashboard for the most current
						schedule.
					</p>
				</div>
			{/if}

			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="secondary-button" href={`${data.dashboardUrl}?view=calendar`} target="_parent">
				View the full schedule <span aria-hidden="true">↗</span>
			</a>
		</article>

		<article class="panel links-panel">
			<div class="panel-heading">
				<p class="eyebrow">Make the most of the studio</p>
				<h2>Quick access</h2>
			</div>
			<ul class="quick-links">
				{#each data.quickLinks as link (link.href)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={link.href} target="_parent">
							<span>
								<strong>{link.label}</strong>
								<small>{link.description}</small>
							</span>
							<span class="arrow" aria-hidden="true">↗</span>
						</a>
					</li>
				{/each}
			</ul>
		</article>
	</section>

	<section class="care-note" aria-labelledby="care-title">
		<p class="eyebrow">Shared space, shared care</p>
		<h2 id="care-title">Leave CoLab ready for the next person.</h2>
		<ul>
			<li>Clean up after yourself</li>
			<li>Return tools to their place</li>
			<li>Report low stock or broken equipment</li>
			<li>Share what you know</li>
		</ul>
	</section>

	<footer>
		<p>Made for the Queerlective CoLab community.</p>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={data.dashboardUrl} target="_parent"
			>Member dashboard <span aria-hidden="true">↗</span></a
		>
	</footer>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		background: #fff8ed;
	}

	.updates-page {
		--ink: #1e1c26;
		--plum: #462143;
		--violet: #8f4be6;
		--pink: #ff5cad;
		--cream: #fff8ed;
		--gold: #ffd85c;
		--leaf: #46683f;
		min-height: 100vh;
		padding: clamp(0.8rem, 2.5vw, 2rem);
		background:
			radial-gradient(circle at 2% 18%, rgb(255 216 92 / 38%), transparent 22rem),
			radial-gradient(circle at 96% 56%, rgb(255 92 173 / 14%), transparent 28rem), #fff8ed;
		color: var(--ink);
		font-family: 'DM Sans', system-ui, sans-serif;
	}

	.updates-hero {
		position: relative;
		display: grid;
		min-height: clamp(27rem, 50vw, 34rem);
		overflow: hidden;
		border: 1px solid rgb(31 23 37 / 14%);
		border-radius: clamp(1.2rem, 3vw, 2.4rem);
		background: var(--plum);
		isolation: isolate;
	}

	.hero-photo,
	.hero-overlay {
		position: absolute;
		inset: 0;
	}

	.hero-photo {
		background-image: url('/images/colab-studio-hero.jpg');
		background-position: center;
		background-size: cover;
		filter: saturate(1.16) contrast(1.04);
	}

	.hero-overlay {
		background:
			linear-gradient(
				90deg,
				rgb(27 15 34 / 95%) 0%,
				rgb(44 17 52 / 84%) 44%,
				rgb(43 18 44 / 24%) 100%
			),
			linear-gradient(0deg, rgb(24 12 31 / 50%), transparent 52%);
	}

	.hero-content {
		z-index: 1;
		display: flex;
		max-width: 43rem;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		padding: clamp(2rem, 6vw, 5rem);
		color: #fffdf7;
	}

	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: auto;
		color: #fffdf7;
		font-weight: 800;
		letter-spacing: -0.04em;
		text-decoration: none;
	}

	.wordmark span,
	.announcement-spark {
		color: var(--gold);
	}

	.eyebrow {
		margin: 0 0 0.45rem;
		color: #6d385e;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.13em;
		line-height: 1.25;
		text-transform: uppercase;
	}

	.hero-content .eyebrow {
		margin-top: clamp(4rem, 11vw, 8rem);
		color: var(--gold);
	}

	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}

	h1,
	h2,
	h3 {
		font-family: Manrope, 'DM Sans', system-ui, sans-serif;
	}

	h1 {
		max-width: 11ch;
		margin-bottom: 0.85rem;
		font-size: clamp(2.7rem, 8vw, 5.9rem);
		letter-spacing: -0.08em;
		line-height: 0.94;
	}

	.hero-copy {
		max-width: 30rem;
		margin-bottom: 1.6rem;
		color: rgb(255 253 247 / 85%);
		font-size: clamp(1rem, 2vw, 1.17rem);
		line-height: 1.55;
	}

	.dashboard-link,
	.secondary-button {
		display: inline-flex;
		align-items: center;
		gap: 0.8rem;
		border-radius: 999px;
		font-size: 0.9rem;
		font-weight: 800;
		text-decoration: none;
		transition:
			transform 160ms ease,
			background 160ms ease;
	}

	.dashboard-link {
		padding: 0.85rem 1.1rem;
		background: var(--gold);
		color: #2b1533;
	}

	.dashboard-link:hover,
	.secondary-button:hover {
		transform: translateY(-2px);
	}

	.updates-grid {
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.2fr);
		gap: clamp(0.8rem, 2vw, 1.25rem);
		max-width: 80rem;
		margin: clamp(0.8rem, 2vw, 1.25rem) auto 0;
	}

	.panel {
		border: 1px solid rgb(47 23 57 / 12%);
		border-radius: 1.35rem;
		background: rgb(255 253 248 / 82%);
		box-shadow: 0 1rem 3rem rgb(77 30 61 / 7%);
	}

	.announcement-panel,
	.links-panel {
		padding: clamp(1.35rem, 3vw, 2rem);
	}

	.announcement-panel {
		background: linear-gradient(147deg, #fff1ba, #fffaf0 59%);
	}

	.panel-heading h2,
	.care-note h2 {
		margin-bottom: 0;
		font-size: clamp(1.5rem, 3vw, 2rem);
		letter-spacing: -0.06em;
		line-height: 1.05;
	}

	.announcement-empty {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
		margin: 2rem 0 1.6rem;
	}

	.announcement-spark {
		font-size: 1.5rem;
	}

	.announcement-empty h3 {
		margin-bottom: 0.45rem;
		font-size: 1.05rem;
		letter-spacing: -0.035em;
	}

	.announcement-empty p,
	.hours-empty p {
		margin-bottom: 0;
		color: #614e5b;
		font-size: 0.92rem;
		line-height: 1.55;
	}

	.text-link {
		color: #5a244b;
		font-size: 0.86rem;
		font-weight: 800;
		text-underline-offset: 0.2em;
	}

	.hours-panel {
		padding: clamp(1.35rem, 3vw, 2rem);
		background: #281831;
		color: #fffaf2;
	}

	.hours-panel .eyebrow {
		color: #f3b5d7;
	}

	.heading-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.date-range {
		max-width: 10rem;
		margin: 0;
		color: #d9cbd8;
		font-size: 0.73rem;
		line-height: 1.3;
		text-align: right;
	}

	.hours-list,
	.quick-links,
	.care-note ul {
		padding: 0;
		list-style: none;
	}

	.hours-list {
		display: grid;
		gap: 0.65rem;
		margin: 1.5rem 0;
	}

	.hours-list li {
		display: grid;
		grid-template-columns: minmax(5.6rem, 0.8fr) minmax(0, 1.3fr) auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.8rem;
		border: 1px solid rgb(255 255 255 / 11%);
		border-radius: 0.8rem;
		background: rgb(255 255 255 / 7%);
	}

	.date-chip {
		margin: 0;
		color: #f3b5d7;
		font-size: 0.72rem;
		font-weight: 800;
		line-height: 1.25;
	}

	.hours-list h3 {
		margin-bottom: 0.15rem;
		font-size: 0.92rem;
		letter-spacing: -0.025em;
	}

	.hours-list div p {
		margin-bottom: 0;
		color: #e1d8e2;
		font-size: 0.78rem;
	}

	.staffed-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: #e1ffd5;
		font-size: 0.68rem;
		font-weight: 800;
		white-space: nowrap;
	}

	.staffed-pill span {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: #a6ef81;
		box-shadow: 0 0 0 0.18rem rgb(166 239 129 / 12%);
	}

	.hours-empty {
		display: flex;
		gap: 0.85rem;
		align-items: flex-start;
		min-height: 9.4rem;
		padding: 1.2rem 0;
	}

	.hours-empty > span {
		color: var(--gold);
		font-size: 1.8rem;
		line-height: 1;
	}

	.hours-empty p {
		color: #ded3df;
	}

	.secondary-button {
		padding: 0.75rem 0.95rem;
		background: #fbf6ed;
		color: #34213b;
	}

	.links-panel {
		grid-column: 1 / -1;
	}

	.quick-links {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.7rem;
		margin: 1.35rem 0 0;
	}

	.quick-links li a {
		display: flex;
		min-height: 8.4rem;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 1rem;
		border: 1px solid #ebdfe4;
		border-radius: 0.9rem;
		background: #fffdf9;
		color: var(--ink);
		text-decoration: none;
		transition:
			border-color 160ms ease,
			transform 160ms ease,
			box-shadow 160ms ease;
	}

	.quick-links li a:hover {
		transform: translateY(-3px);
		border-color: #c990e8;
		box-shadow: 0 0.65rem 1.4rem rgb(75 25 70 / 10%);
	}

	.quick-links strong,
	.quick-links small {
		display: block;
	}

	.quick-links strong {
		margin-bottom: 0.5rem;
		font-family: Manrope, 'DM Sans', system-ui, sans-serif;
		font-size: 0.92rem;
		letter-spacing: -0.035em;
	}

	.quick-links small {
		color: #625762;
		font-size: 0.72rem;
		line-height: 1.45;
	}

	.arrow {
		color: var(--violet);
		font-size: 1.15rem;
	}

	.care-note {
		max-width: 80rem;
		margin: clamp(0.8rem, 2vw, 1.25rem) auto 0;
		padding: clamp(1.5rem, 4vw, 2.6rem);
		border-radius: 1.3rem;
		background: var(--leaf);
		color: #fffcf7;
	}

	.care-note .eyebrow {
		color: #e0ea8b;
	}

	.care-note ul {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.6rem;
		margin: 1.5rem 0 0;
	}

	.care-note li {
		padding: 0.75rem 0.85rem;
		border: 1px solid rgb(255 255 255 / 19%);
		border-radius: 0.7rem;
		background: rgb(255 255 255 / 9%);
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.35;
	}

	footer {
		display: flex;
		max-width: 80rem;
		justify-content: space-between;
		gap: 1rem;
		margin: 1.25rem auto 0;
		padding: 0.4rem 0.2rem;
		color: #685b65;
		font-size: 0.74rem;
	}

	footer p {
		margin: 0;
	}

	footer a {
		color: #57264d;
		font-weight: 800;
	}

	@media (max-width: 700px) {
		.updates-page {
			padding: 0.6rem;
		}

		.updates-grid {
			grid-template-columns: 1fr;
		}

		.links-panel {
			grid-column: auto;
		}

		.quick-links,
		.care-note ul {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.quick-links li a {
			min-height: 7.6rem;
		}
	}

	@media (max-width: 440px) {
		.hero-content {
			padding: 1.6rem;
		}

		.hero-content .eyebrow {
			margin-top: 6rem;
		}

		.hours-list li {
			grid-template-columns: 1fr auto;
		}

		.date-chip {
			grid-column: 1 / -1;
		}

		.quick-links,
		.care-note ul {
			grid-template-columns: 1fr;
		}

		footer {
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dashboard-link,
		.secondary-button,
		.quick-links li a {
			transition: none;
		}
	}
</style>
