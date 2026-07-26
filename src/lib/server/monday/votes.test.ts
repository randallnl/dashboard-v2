import { describe, expect, it } from 'vitest';
import { consentDeadline, hasDuplicateVote, mapMotion } from './votes';

describe('vote motion mapping', () => {
	it('maps eligible vote types and calculates a timezone-safe 48-day deadline', () => {
		const vote = mapMotion({
			id: 'vote-1',
			name: 'Fund the print studio',
			column_values: [
				{ id: 'single_selectis1ajb9', text: 'Consent Vote', value: null },
				{ id: 'date_mm2mqnq2', text: '2026-07-26', value: null },
				{ id: 'long_text3mhw34i5', text: 'Motion details', value: null }
			]
		});
		expect(vote).toMatchObject({ id: 'vote-1', type: 'Consent Vote' });
		expect(vote?.deadline).toBe(consentDeadline('2026-07-26'));
	});

	it('ignores non-vote activity records', () => {
		expect(
			mapMotion({
				id: 'activity-1',
				name: 'Studio visit',
				column_values: [{ id: 'single_selectis1ajb9', text: 'Studio Activity', value: null }]
			})
		).toBeNull();
	});
});

describe('duplicate vote checks', () => {
	const vote = {
		id: 'vote-1',
		type: 'Simple Majority Vote' as const,
		question: 'Fund the print studio',
		details: '',
		submittedAt: '',
		deadline: ''
	};

	it('uses vote ID first and falls back to normalized question text', () => {
		expect(
			hasDuplicateVote(
				[{ id: '1', memberId: 'member-1', voteId: 'vote-1', question: '', response: 'Approve' }],
				'member-1',
				vote
			)
		).toBe(true);
		expect(
			hasDuplicateVote(
				[
					{
						id: '2',
						memberId: 'member-1',
						voteId: '',
						question: '  FUND   the print studio ',
						response: 'Approve'
					}
				],
				'member-1',
				vote
			)
		).toBe(true);
	});
});
