import type { Member, Shift } from '$lib/types/domain';
import { describe, expect, it, vi } from 'vitest';
import { resolveShiftCoverage, syncShifts } from './sync';

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
			failed: 0,
			syncedAt: shift.syncedAt
		});
		expect(store.upsert).toHaveBeenCalledTimes(2);
		expect(store.upsert).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ ...shift, coveredBy: '' })
		);
	});

	it('backs up a missing person value with the member ID directory', async () => {
		const covered = {
			...shift,
			isCovered: true,
			memberId: 'member-1',
			person: '',
			coveredBy: ''
		};
		const member = {
			id: 'member-1',
			preferredName: 'Alex Morgan'
		} as Member;
		const store = { upsert: vi.fn().mockResolvedValue(undefined) };

		await syncShifts({ list: vi.fn().mockResolvedValue([covered]) }, store, [member]);

		expect(store.upsert).toHaveBeenCalledWith(expect.objectContaining({ coveredBy: 'Alex M.' }));
	});

	it('prefers Monday Person while storing a privacy-safe display label', () => {
		expect(
			resolveShiftCoverage(
				{ ...shift, isCovered: true, memberId: 'member-1', person: 'Rae Johnson | member-1' },
				new Map()
			).coveredBy
		).toBe('Rae J.');
	});

	it('returns a valid timestamp when Monday has no shifts', async () => {
		const result = await syncShifts({ list: vi.fn().mockResolvedValue([]) }, { upsert: vi.fn() });

		expect(result.count).toBe(0);
		expect(result.failed).toBe(0);
		expect(Number.isNaN(Date.parse(result.syncedAt))).toBe(false);
	});

	it('continues after an individual shift fails to persist', async () => {
		const source = { list: vi.fn().mockResolvedValue([shift, { ...shift, id: 'shift-2' }]) };
		const store = {
			upsert: vi.fn().mockRejectedValueOnce(new Error('bad row')).mockResolvedValueOnce(undefined)
		};

		await expect(syncShifts(source, store)).resolves.toMatchObject({ count: 1, failed: 1 });
		expect(store.upsert).toHaveBeenCalledTimes(2);
	});
});
