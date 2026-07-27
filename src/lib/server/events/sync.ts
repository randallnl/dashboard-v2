import { CommentRepository, ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EventDirectory, type MondayItemUpdate } from '$lib/server/monday/events';
import type { ProjectEventRecord, ProjectEventSource } from '$lib/types/domain';

type Source = { list(): Promise<ProjectEventRecord[]> };
type Store = { upsert(event: ProjectEventRecord): Promise<void> };
type CommentStore = {
	upsertMondayUpdate(input: {
		updateId: string;
		source: ProjectEventSource;
		eventId: string;
		creatorId: string;
		creatorName: string;
		body: string;
		createdAt: string;
	}): Promise<boolean>;
};

function updatesFrom(record: Record<string, unknown>): MondayItemUpdate[] {
	const updates = record._mondayUpdates;
	if (!Array.isArray(updates)) return [];
	return updates.filter(
		(update): update is MondayItemUpdate =>
			typeof update === 'object' &&
			update !== null &&
			typeof update.id === 'string' &&
			typeof update.textBody === 'string' &&
			typeof update.createdAt === 'string' &&
			typeof update.creatorId === 'string' &&
			typeof update.creatorName === 'string'
	);
}

export async function syncEvents(source: Source, store: Store, comments?: CommentStore) {
	const events = await source.list();
	let count = 0;
	let failed = 0;
	let commentCount = 0;
	for (const event of events) {
		try {
			const sourceRecord = event.record ?? {};
			const updates = updatesFrom(sourceRecord);
			const record = { ...sourceRecord };
			delete record._mondayUpdates;
			await store.upsert({ ...event, record });
			if (comments) {
				for (const update of updates) {
					if (
						await comments.upsertMondayUpdate({
							updateId: update.id,
							source: event.source,
							eventId: event.id,
							creatorId: update.creatorId,
							creatorName: update.creatorName,
							body: update.textBody,
							createdAt: update.createdAt
						})
					) {
						commentCount += 1;
					}
				}
			}
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
		comments: commentCount,
		syncedAt: events[0]?.syncedAt ?? new Date().toISOString()
	};
}

export async function syncEventsFromMonday(env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>) {
	const token = await mondayToken(env.MONDAY_API_TOKEN);
	return syncEvents(
		new EventDirectory(new MondayClient(token)),
		new ProjectEventRepository(env.DB),
		new CommentRepository(env.DB)
	);
}
