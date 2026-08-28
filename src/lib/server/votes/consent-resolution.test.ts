import type { ProjectEventRecord } from '$lib/types/domain';
import { describe, expect, it } from 'vitest';
import type { VoteLogEntry } from '$lib/server/monday/votes';
import { communityConsentResolution } from './consent-resolution';

const record: ProjectEventRecord = {
	id: 'event-1',
	source: 'community',
	title: 'Community showcase',
	dateValue: '2026-09-12',
	endDateValue: '',
	status: 'Pending',
	location: 'CoLab',
	owner: 'Alex Member',
	adminOnly: false,
	record: { creationLog: '2026-08-20T14:30:00.000Z', description: 'A showcase.' },
	syncedAt: '2026-08-20T14:31:00.000Z'
};

function log(response: string): VoteLogEntry {
	return {
		id: crypto.randomUUID(),
		voterLabel: 'Member',
		memberId: 'member-1',
		voteId: 'community:event-1',
		question: 'Community showcase',
		response,
		comment: ''
	};
}

describe('community consent resolution', () => {
	it('automatically approves after 48 hours when there are no objections', () => {
		const deadline = new Date('2026-08-22T14:30:00.000Z');
		expect(communityConsentResolution(record, [], deadline)).toBe('approve');
		expect(communityConsentResolution(record, [log('Approve'), log('Abstain')], deadline)).toBe(
			'approve'
		);
	});

	it('does not auto-approve when any member selects Don’t Approve', () => {
		expect(
			communityConsentResolution(
				record,
				[log('Approve'), log("Don't Approve(With Comment)")],
				new Date('2026-08-22T14:30:00.000Z')
			)
		).toBe('objected');
	});

	it('keeps the motion active until the full 48 hours have elapsed', () => {
		expect(communityConsentResolution(record, [], new Date('2026-08-22T14:29:59.999Z'))).toBe(
			'active'
		);
	});
});
