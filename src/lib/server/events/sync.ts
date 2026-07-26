import { ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EventDirectory } from '$lib/server/monday/events';
import type { ProjectEventRecord } from '$lib/types/domain';

type Source = { list(): Promise<ProjectEventRecord[]> };
type Store = { upsert(event: ProjectEventRecord): Promise<void> };

export async function syncEvents(source: Source, store: Store) {
	const events = await source.list();
	let count = 0;
	let failed = 0;
	for (const event of events) {
		try {
			await store.upsert(event);
			count += 1;
		} catch (cause) {
			failed += 1;
			console.error(
				JSON.stringify({
					event: 'project_event_upsert_failed',
					source: event.source,
					itemId: event.id,
					message: cause instanceof Error ? cause.message : 'Unknown error'
				})
			);
		}
	}
	return {
		count,
		failed,
		syncedAt: events[0]?.syncedAt ?? new Date().toISOString()
	};
}

export async function syncEventsFromMonday(env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>) {
	const token = await mondayToken(env.MONDAY_API_TOKEN);
	return syncEvents(
		new EventDirectory(new MondayClient(token)),
		new ProjectEventRepository(env.DB)
	);
}
