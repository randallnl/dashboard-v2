<script lang="ts">
	import { onMount } from 'svelte';

	onMount(async () => {
		const [{ default: Alpine }, htmxModule] = await Promise.all([
			import('alpinejs'),
			import('htmx.org')
		]);
		const alpineWindow = window as typeof window & {
			Alpine?: typeof Alpine;
			__alpineStarted?: boolean;
		};
		if (!alpineWindow.__alpineStarted) {
			Alpine.data('memberTagger', () => ({
				selected: [] as Array<{ id: string; label: string }>,
				addMember(id: string, label: string) {
					if (!this.selected.some((member) => member.id === id)) {
						this.selected.push({ id, label });
					}
				},
				removeMember(id: string) {
					this.selected = this.selected.filter((member) => member.id !== id);
				}
			}));
			alpineWindow.Alpine = Alpine;
			Alpine.start();
			alpineWindow.__alpineStarted = true;
		}
		const htmx = htmxModule.default;
		htmx.process(document.body);
	});
</script>
