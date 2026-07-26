<script lang="ts">
	import ClientEnhancements from '$lib/components/ClientEnhancements.svelte';
	import '../styles/global.css';

	let { children } = $props();
</script>

<ClientEnhancements />

<a class="skip-link" href="#main-content">Skip to main content</a>
{@render children()}
