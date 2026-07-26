import type { Shift } from '$lib/types/domain';
import { describe, expect, it, vi } from 'vitest';
import { syncShifts } from './sync';

const shift = {
	id: 'shift-1',
	syncedAt: '2026-07-26T16:00:00.000Z'
} as Shift;

describe('syncShifts', () => {
	it('upserts every normalized shift and reports the sync timestamp', async () => {
		const source = { list: vi.fn().mockResolvedValue([shift, { ...shift, id: 'shift-2' }]) };
		const store = { upsert: vi.fn().mockResolvedValue(undefined) };

		await expect(syncShifts(source, store)).resolves.toEqual({
			count: 2,
			syncedAt: shift.syncedAt
		});
		expect(store.upsert).toHaveBeenCalledTimes(2);
		expect(store.upsert).toHaveBeenNthCalledWith(1, shift);
	});

	it('returns a valid timestamp when Monday has no shifts', async () => {
		const result = await syncShifts({ list: vi.fn().mockResolvedValue([]) }, { upsert: vi.fn() });

		expect(result.count).toBe(0);
		expect(Number.isNaN(Date.parse(result.syncedAt))).toBe(false);
	});
});
