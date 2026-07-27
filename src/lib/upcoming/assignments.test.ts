import type { ProjectEventRecord } from '$lib/types/domain';
import { describe, expect, it } from 'vitest';
import { upcomingAssignments } from './assignments';

const record = (id: string, attendees = '') =>
	({
		id,
		source: 'project',
		title: `Event ${id}`,
		dateValue: '2026-08-01',
		endDateValue: '',
		status: 'Scheduled',
		location: 'CoLab',
		owner: '',
		adminOnly: false,
		syncedAt: '2026-07-26T12:00:00Z',
		record: { attendees }
	}) satisfies ProjectEventRecord;

describe('upcomingAssignments', () => {
	it('matches synchronized attendee emails across member aliases', () => {
		const result = upcomingAssignments(
			[record('event-1', 'other@example.com, ALT@Example.com')],
			['member@example.com', 'alt@example.com'],
			new Set(),
			new Set()
		);

		expect(result[0]?.roles).toEqual(['Attendee']);
	});

	it('labels hosts once even when they also have a volunteer signup', () => {
		const key = 'project:event-1';
		const result = upcomingAssignments(
			[record('event-1')],
			['member@example.com'],
			new Set([key]),
			new Set([key])
		);

		expect(result[0]?.roles).toEqual(['Host']);
	});
});
