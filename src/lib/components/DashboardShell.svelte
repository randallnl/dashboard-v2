<script lang="ts">
	import type { Member } from '$lib/types/domain';
	import { resolve } from '$app/paths';

	let { member }: { member: Member } = $props();

	const firstName = $derived(member.preferredName.split(/\s+/u)[0] || member.preferredName);
</script>

<div class="dashboard-shell">
	<header class="dashboard-header">
		<a class="brand" href={resolve('/')} aria-label="CoLab dashboard home">
			<span class="brand-mark" aria-hidden="true">Q</span>
			<span>CoLab</span>
		</a>
		<nav aria-label="Member navigation">
			<span class="nav-active">Overview</span>
			<span>Calendar</span>
			<span>Resources</span>
		</nav>
		<div class="member-menu">
			<div>
				<strong>{member.preferredName}</strong>
				<span>{member.membershipType}</span>
			</div>
			<form method="POST" action={resolve('/api/auth/logout')}>
				<button type="submit" class="text-button">Sign out</button>
			</form>
		</div>
	</header>

	<main class="dashboard-main">
		<section class="welcome-card">
			<div>
				<p class="eyebrow">Member overview</p>
				<h1>Hi, {firstName}.</h1>
				<p>Your secure CoLab dashboard is ready. Member tools are coming in the next phase.</p>
			</div>
			<span class="membership-pill">{member.membershipType || 'CoLab Member'}</span>
		</section>

		<section class="foundation-grid" aria-label="Upcoming dashboard areas">
			<article>
				<span class="card-number">01</span>
				<h2>Available shifts</h2>
				<p>Browse and claim upcoming studio coverage times.</p>
				<span class="coming-soon">Next milestone</span>
			</article>
			<article>
				<span class="card-number">02</span>
				<h2>Studio calendar</h2>
				<p>See shifts, member events, and community programming.</p>
				<span class="coming-soon">Coming soon</span>
			</article>
			<article>
				<span class="card-number">03</span>
				<h2>Community votes</h2>
				<p>Review active motions and participate in decisions.</p>
				<span class="coming-soon">Coming soon</span>
			</article>
		</section>
	</main>
</div>
