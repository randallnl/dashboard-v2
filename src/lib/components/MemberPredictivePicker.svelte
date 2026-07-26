<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	type MemberOption = { id: string; label: string };

	let {
		id,
		placeholder,
		includeSelf = false,
		disabled = false,
		selection = $bindable<MemberOption | null>(null)
	}: {
		id: string;
		placeholder: string;
		includeSelf?: boolean;
		disabled?: boolean;
		selection?: MemberOption | null;
	} = $props();

	let query = $state('');
	let suggestions = $state<MemberOption[]>([]);
	let requestNumber = 0;
	let suggestionTimer: ReturnType<typeof setTimeout> | undefined;

	function search() {
		if (selection && query === `@${selection.label}`) return;
		selection = null;
		const memberQuery = query.replace(/^@/u, '').trim();
		const currentRequest = ++requestNumber;
		if (!memberQuery) {
			suggestions = [];
			return;
		}
		if (suggestionTimer) clearTimeout(suggestionTimer);
		suggestionTimer = setTimeout(async () => {
			const params = new SvelteURLSearchParams({ q: memberQuery });
			if (includeSelf) params.set('includeSelf', '1');
			const response = await fetch(`/api/members/mentions?${params}`);
			if (!response.ok || currentRequest !== requestNumber) return;
			const result = (await response.json()) as { members?: MemberOption[] };
			suggestions = result.members ?? [];
		}, 180);
	}

	function select(member: MemberOption) {
		selection = member;
		query = `@${member.label}`;
		suggestions = [];
	}

	function clear() {
		selection = null;
		query = '';
		suggestions = [];
	}

	onDestroy(() => {
		if (suggestionTimer) clearTimeout(suggestionTimer);
	});
</script>

<div class="member-predictive-picker">
	<div class="member-picker-input">
		<input
			{id}
			bind:value={query}
			oninput={search}
			onfocus={search}
			{placeholder}
			{disabled}
			autocomplete="off"
			aria-autocomplete="list"
			aria-controls={`${id}-suggestions`}
		/>
		{#if selection}
			<button type="button" class="member-picker-clear" onclick={clear} aria-label="Clear member">
				×
			</button>
		{/if}
	</div>
	{#if suggestions.length}
		<div
			class="inline-mention-suggestions member-picker-suggestions"
			id={`${id}-suggestions`}
			role="listbox"
			aria-label="Matching members"
		>
			{#each suggestions as member (member.id)}
				<button
					type="button"
					role="option"
					aria-selected={selection?.id === member.id}
					onclick={() => select(member)}
				>
					@{member.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
