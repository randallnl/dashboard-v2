import type { ProjectEventRecord } from '$lib/types/domain';
import { describe, expect, it } from 'vitest';
import { communityConsentVotes } from './eligibility';

function submission(overrides: Partial<ProjectEventRecord> = {}): ProjectEventRecord {
	return {
		id: 'event-1',
		source: 'community',
		title: 'Print night',
		dateValue: '2026-08-01',
		endDateValue: '',
		status: 'Pending',
		location: "Queerlective's CoLab Space",
		owner: 'Alex',
		adminOnly: false,
		record: { creationLog: '2026-07-25', description: 'Open print night' },
		syncedAt: '2026-07-26T12:00:00.000Z',
		...overrides
	};
}

describe('communityConsentVotes', () => {
	it('includes recent submissions requesting the CoLab space', () => {
		expect(communityConsentVotes([submission()], new Date('2026-07-26T12:00:00Z'))).toHaveLength(1);
	});

	it('excludes old submissions and other spaces', () => {
		expect(
			communityConsentVotes(
				[
					submission({ record: { creationLog: '2026-07-01' } }),
					submission({ id: 'event-2', location: 'Community Room' })
				],
				new Date('2026-07-26T12:00:00Z')
			)
		).toHaveLength(0);
	});
});
