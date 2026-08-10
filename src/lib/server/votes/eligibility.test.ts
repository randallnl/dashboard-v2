import type { EquipmentRequest, ProjectEventRecord } from '$lib/types/domain';
import { describe, expect, it } from 'vitest';
import { communityConsentVotes, equipmentConsentVotes } from './eligibility';

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
	it('includes new pending submissions for any requested space', () => {
		expect(communityConsentVotes([submission()], new Date('2026-07-26T12:00:00Z'))).toHaveLength(1);
		expect(
			communityConsentVotes(
				[submission({ location: 'Community Room' })],
				new Date('2026-07-26T12:00:00Z')
			)
		).toHaveLength(1);
	});

	it('uses the first synchronization time when Monday has no creation log', () => {
		const votes = communityConsentVotes(
			[submission({ record: { creationLog: '', description: 'Open print night' } })],
			new Date('2026-07-26T12:00:00Z')
		);

		expect(votes).toMatchObject([
			{
				submittedAt: '2026-07-26',
				type: 'Consent Vote',
				titleUrl: '/items/community/event-1'
			}
		]);
	});

	it('links the motion title using the associated community item ID', () => {
		const [vote] = communityConsentVotes(
			[submission({ record: { itemId: 'associated-item-2', creationLog: '2026-07-25' } })],
			new Date('2026-07-26T12:00:00Z')
		);

		expect(vote.titleUrl).toBe('/items/community/associated-item-2');
	});

	it('excludes submissions once resolved or after the consent deadline', () => {
		expect(
			communityConsentVotes(
				[
					submission({ record: { creationLog: '2026-07-01' } }),
					submission({ id: 'event-2', status: 'Approved' }),
					submission({ id: 'event-3', status: 'Rejected' })
				],
				new Date('2026-09-01T12:00:00Z')
			)
		).toHaveLength(0);
	});
});

describe('equipmentConsentVotes', () => {
	const request: EquipmentRequest = {
		id: 'request-1',
		title: 'Button maker',
		requestor: 'Alex Member',
		estimatedCost: '125.50',
		productUrl: 'https://example.com/button-maker',
		explanation: 'For member workshops',
		additionalInfo: 'Includes starter parts',
		submittedAt: '2026-07-29T13:15:00Z',
		syncedAt: '2026-07-29T14:00:00Z'
	};

	it('creates a detailed consent vote with a stable request id', () => {
		expect(equipmentConsentVotes([request], new Date('2026-07-30T12:00:00Z'))).toEqual([
			expect.objectContaining({
				id: 'equipment:request-1',
				type: 'Consent Vote',
				question: 'Material/equipment request: Button maker',
				submittedAt: '2026-07-29',
				linkUrl: 'https://example.com/button-maker',
				linkLabel: 'View requested item',
				details:
					'Requested by: Alex Member\nEstimated cost: $125.50\nNeed: For member workshops\nAdditional information: Includes starter parts'
			})
		]);
	});

	it('excludes requests after their consent deadline', () => {
		expect(equipmentConsentVotes([request], new Date('2026-10-01T12:00:00Z'))).toEqual([]);
	});
});
