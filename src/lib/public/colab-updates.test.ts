import { describe, expect, it } from 'vitest';
import { publicStaffedHours, weekBounds } from './colab-updates';
import type { Shift } from '$lib/types/domain';

const shift = (overrides: Partial<Shift>): Shift => ({
	id: 'shift-1',
	boardId: 'board-1',
	parentId: '',
	month: '',
	title: 'Studio host',
	dateLabel: '2026-11-03',
	dateValue: '2026-11-03',
	timeLabel: '6pm-8pm',
	memberId: '',
	person: '',
	coveredBy: '',
	coverageStatus: 'Open',
	isCovered: false,
	tags: [],
	syncedAt: '2026-11-03T12:00:00.000Z',
	...overrides
});

describe('weekBounds', () => {
	it('returns Monday through Sunday for a weekday', () => {
		expect(weekBounds('2026-11-03')).toEqual({ from: '2026-11-02', through: '2026-11-08' });
	});

	it('uses the preceding Monday when the input is Sunday', () => {
		expect(weekBounds('2026-11-08')).toEqual({ from: '2026-11-02', through: '2026-11-08' });
	});
});

describe('publicStaffedHours', () => {
	it('only returns confirmed hours and never exposes member assignment fields', () => {
		const staffed = publicStaffedHours([
			shift({ id: 'covered', isCovered: true, person: 'Rae Member', coveredBy: 'Rae M.' }),
			shift({ id: 'open', isCovered: false })
		]);

		expect(staffed).toEqual([
			{ id: 'covered', title: 'Studio host', date: '2026-11-03', time: '6pm-8pm' }
		]);
	});
});
