import { describe, expect, it } from 'vitest';
import { currentWeekBounds, openHoursDiscordMessage } from './open-hours';
import type { Shift } from '$lib/types/domain';

const openShift: Shift = {
	id: 'shift-1',
	boardId: 'board-1',
	parentId: 'parent-1',
	month: 'November',
	title: 'CoLab Open Hours',
	dateLabel: 'Nov 3, 2026',
	dateValue: '2026-11-03',
	timeLabel: '6pm-8pm',
	memberId: '',
	person: '',
	coveredBy: '',
	coverageStatus: 'Open',
	isCovered: false,
	tags: ['weekday'],
	syncedAt: '2026-11-02T12:00:00.000Z'
};

describe('CoLab Discord open hours', () => {
	it('uses the current Monday–Sunday week in Eastern time', () => {
		// This is Saturday evening in New York, even though it is Sunday in UTC.
		const week = currentWeekBounds(new Date('2026-11-08T02:00:00.000Z'));

		expect(week).toMatchObject({ from: '2026-11-02', through: '2026-11-08' });
		expect(week.label).toBe('Mon, Nov 2–Sun, Nov 8');
	});

	it('lists only staffed shifts and does not include unstaffed shift titles', () => {
		const message = openHoursDiscordMessage(
			[
				{ ...openShift, id: 'shift-2', isCovered: true, title: 'CoLab Open Hours' },
				{ ...openShift, title: '@here needs coverage' }
			],
			{ from: '2026-11-02', through: '2026-11-08', label: 'Mon, Nov 2–Sun, Nov 8' },
			'https://dashboard.queerlective.com/'
		);

		expect(message).toContain('Tue, Nov 3 · 6pm–8pm — CoLab Open Hours');
		expect(message).not.toContain('@here needs coverage');
		expect(message).toContain('https://dashboard.queerlective.com/#shifts');
	});

	it('explains when no CoLab hours are staffed', () => {
		const message = openHoursDiscordMessage(
			[openShift],
			{ from: '2026-11-02', through: '2026-11-08', label: 'Mon, Nov 2–Sun, Nov 8' },
			'https://dashboard.queerlective.com'
		);

		expect(message).toContain('No CoLab open hours are staffed this week yet.');
	});
});
