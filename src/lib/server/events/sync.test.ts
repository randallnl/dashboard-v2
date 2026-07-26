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
			syncedAt: event.syncedAt
		});
		expect(store.upsert).toHaveBeenCalledTimes(2);
	});
});
