import { describe, expect, it } from 'vitest';
import {
	consentDeadline,
	hasDuplicateVote,
	mapMotion,
	mapVoteLog,
	voteLogForMember,
	voteLogsForMotion
} from './votes';

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
				[
					{
						id: '1',
						voterLabel: 'Alex M.',
						memberId: 'member-1',
						voteId: 'vote-1',
						question: '',
						response: 'Approve',
						comment: ''
					}
				],
				'member-1',
				vote
			)
		).toBe(true);
		expect(
			hasDuplicateVote(
				[
					{
						id: '2',
						voterLabel: 'Alex M.',
						memberId: 'member-1',
						voteId: '',
						question: '  FUND   the print studio ',
						response: 'Approve',
						comment: ''
					}
				],
				'member-1',
				vote
			)
		).toBe(true);
	});

	it('returns the recorded response and comment for the member', () => {
		const entry = mapVoteLog({
			id: 'log-1',
			name: 'Alex M.',
			column_values: [
				{ id: 'text_mm4vff42', text: 'member-1', value: null },
				{ id: 'text_mm4ve8bt', text: 'vote-1', value: null },
				{ id: 'color_mm4vbrwr', text: "Don't Approve(With Comment)", value: null },
				{ id: 'long_texta8lzlxn7', text: 'Please revise the budget.', value: null }
			]
		});

		expect(voteLogForMember([entry], 'member-1', vote)).toMatchObject({
			response: "Don't Approve(With Comment)",
			comment: 'Please revise the budget.'
		});
		expect(voteLogsForMotion([entry], vote)).toEqual([entry]);
	});
});
