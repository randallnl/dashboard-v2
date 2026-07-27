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

		expect(result[0]?.roles).toEqual(['Host', 'Volunteer']);
	});

	it('matches a member tagged in the synchronized Monday person column', () => {
		const tagged = { ...record('event-1'), owner: 'Alex Member' };
		const result = upcomingAssignments([tagged], ['alex@example.com'], new Set(), new Set(), [
			'Alex Member'
		]);

		expect(result[0]?.roles).toEqual(['Host']);
	});

	it('includes community events matched by organizer email or additional organizer name', () => {
		const community = {
			...record('event-1'),
			source: 'community' as const,
			record: {
				organizerEmail: 'other@example.com',
				additionalOrganizers: 'Alex Member'
			}
		};
		const result = upcomingAssignments([community], ['alex@example.com'], new Set(), new Set(), [
			'Alex Member'
		]);

		expect(result[0]?.roles).toEqual(['Host']);
	});
});
