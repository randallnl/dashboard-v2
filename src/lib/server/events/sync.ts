import { ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EventDirectory } from '$lib/server/monday/events';
import type { ProjectEventRecord } from '$lib/types/domain';

type Source = { list(): Promise<ProjectEventRecord[]> };
type Store = { upsert(event: ProjectEventRecord): Promise<void> };

export async function syncEvents(source: Source, store: Store) {
	const events = await source.list();
	for (const event of events) await store.upsert(event);
	return {
		count: events.length,
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
