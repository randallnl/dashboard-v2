<svelte:head>
	<title>CoLab Member Portal</title>
	<meta
		name="description"
		content="Queerlective CoLab member portal and studio operations dashboard."
	/>
</svelte:head>

<main>
	<section class="splash" aria-labelledby="page-title">
		<div class="brand">
			<span class="brand-mark" aria-hidden="true">Q</span>
			<span>Queerlective</span>
		</div>

		<div class="intro">
			<p class="eyebrow">CoLab member portal</p>
			<h1 id="page-title">Your studio,<br />all in one place.</h1>
			<p class="lede">Manage shifts, community decisions, events, and your CoLab membership.</p>
		</div>

		<div class="status-card">
			<div>
				<span class="status-dot" aria-hidden="true"></span>
				<span>Phase 0 foundation</span>
			</div>
			<p>The portal framework is ready. Secure member login comes next.</p>
		</div>
	</section>

	<aside class="studio-panel" aria-label="CoLab project status">
		<div class="panel-top">
			<p>Community studio</p>
			<span>Boston, MA</span>
		</div>
		<div class="panel-content">
			<p class="panel-kicker">Built for making together</p>
			<h2>A shared home for artists, creators, and organizers.</h2>
			<div class="pill-row" aria-label="Portal areas">
				<span>Shifts</span>
				<span>Calendar</span>
				<span>Votes</span>
				<span>Resources</span>
			</div>
		</div>
		<p class="panel-footer">Queerlective CoLab</p>
	</aside>
</main>
