<script lang="ts">
	import type { Member } from '$lib/types/domain';
	import { onMount } from 'svelte';

	type MemberOption = Pick<Member, 'id' | 'preferredName' | 'membershipType'>;
	let {
		viewer,
		member,
		isViewingAs
	}: {
		viewer: Member;
		member: Member;
		isViewingAs: boolean;
	} = $props();

	let members = $state<MemberOption[]>([]);
	let memberId = $state('');
	let loading = $state(false);
	let message = $state('');

	async function loadMembers() {
		try {
			const response = await fetch('/api/admin/view-as/members');
			const result = (await response.json()) as { members?: MemberOption[]; message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not load members.');
			members = result.members ?? [];
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not load members.';
		}
	}

	async function start() {
		if (!memberId) return;
		loading = true;
		message = '';
		try {
			const response = await fetch('/api/admin/view-as', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ memberId })
			});
			const result = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not start member view.');
			window.location.reload();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not start member view.';
			loading = false;
		}
	}

	async function exit() {
		loading = true;
		message = '';
		try {
			const response = await fetch('/api/admin/view-as', { method: 'DELETE' });
			const result = (await response.json()) as { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not exit member view.');
			window.location.reload();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not exit member view.';
			loading = false;
		}
	}

	onMount(loadMembers);
</script>

{#if isViewingAs}
	<aside class="view-as-banner" aria-label="Administrator member view">
		<div>
			<strong>Viewing as {member.preferredName}</strong>
			<span>Signed in as {viewer.preferredName}. This view is read-only.</span>
		</div>
		<button type="button" onclick={exit} disabled={loading}>
			{loading ? 'Exiting…' : 'Exit member view'}
		</button>
	</aside>
{:else}
	<div class="view-as-control">
		<label for="view-as-member">View dashboard as member</label>
		<select id="view-as-member" bind:value={memberId}>
			<option value="">Choose a member…</option>
			{#each members as option (option.id)}
				<option value={option.id}>{option.preferredName} · {option.membershipType}</option>
			{/each}
		</select>
		<button type="button" onclick={start} disabled={!memberId || loading}>
			{loading ? 'Opening…' : 'View as member'}
		</button>
		{#if message}<span role="alert">{message}</span>{/if}
	</div>
{/if}
