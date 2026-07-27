import type { ProjectEventRecord } from '$lib/types/domain';
import { describe, expect, it, vi } from 'vitest';
import { syncEvents } from './sync';

const event = {
	id: 'project-1',
	source: 'project',
	syncedAt: '2026-07-26T17:00:00.000Z'
} as ProjectEventRecord;

describe('syncEvents', () => {
	it('continues after an individual record fails to persist', async () => {
		const source = { list: vi.fn().mockResolvedValue([event, { ...event, id: 'project-2' }]) };
		const store = {
			upsert: vi
				.fn()
				.mockRejectedValueOnce(new Error('Malformed record'))
				.mockResolvedValueOnce(undefined)
		};

		await expect(syncEvents(source, store)).resolves.toEqual({
			count: 1,
			failed: 1,
			comments: 0,
			syncedAt: event.syncedAt
		});
		expect(store.upsert).toHaveBeenCalledTimes(2);
	});

	it('imports Monday updates as comments and removes sync metadata from the project record', async () => {
		const source = {
			list: vi.fn().mockResolvedValue([
				{
					...event,
					record: {
						description: 'Project details',
						_mondayUpdates: [
							{
								id: 'update-1',
								textBody: 'Setup begins at 5.',
								createdAt: '2026-07-27T12:00:00.000Z',
								creatorId: 'monday-user-1',
								creatorName: 'Alex Morgan'
							}
						]
					}
				}
			])
		};
		const store = { upsert: vi.fn().mockResolvedValue(undefined) };
		const comments = { upsertMondayUpdate: vi.fn().mockResolvedValue(true) };

		await expect(syncEvents(source, store, comments)).resolves.toMatchObject({
			count: 1,
			failed: 0,
			comments: 1
		});
		expect(store.upsert).toHaveBeenCalledWith(
			expect.objectContaining({ record: { description: 'Project details' } })
		);
		expect(comments.upsertMondayUpdate).toHaveBeenCalledWith({
			updateId: 'update-1',
			source: 'project',
			eventId: 'project-1',
			creatorId: 'monday-user-1',
			creatorName: 'Alex Morgan',
			body: 'Setup begins at 5.',
			createdAt: '2026-07-27T12:00:00.000Z'
		});
	});
});
