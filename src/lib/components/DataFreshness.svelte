<script lang="ts">
	import { onMount } from 'svelte';

	let { syncedAt, syncing = false }: { syncedAt: string; syncing?: boolean } = $props();
	let now = $state(Date.now());

	onMount(() => {
		const timer = window.setInterval(() => (now = Date.now()), 30_000);
		return () => window.clearInterval(timer);
	});

	const label = $derived.by(() => {
		if (syncing) return 'Syncing in background…';
		const timestamp = new Date(syncedAt).getTime();
		if (!syncedAt || Number.isNaN(timestamp)) return 'Waiting for first sync';
		const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
		if (minutes < 1) return 'Updated just now';
		if (minutes === 1) return 'Updated 1 minute ago';
		if (minutes < 60) return `Updated ${minutes} minutes ago`;
		const hours = Math.floor(minutes / 60);
		return `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
	});
</script>

<span class="data-freshness" class:syncing>
	<span aria-hidden="true"></span>{label}
</span>
