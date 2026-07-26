import { describe, expect, it, vi } from 'vitest';
import type { MondayClient } from './client';
import {
	GIVEBUTTER_TRANSACTION_BOARD_ID,
	GivebutterDirectory,
	mapGivebutterSignup
} from './givebutter';

describe('Givebutter transaction mapping', () => {
	it('maps the configured signup fields and normalizes donor email', () => {
		expect(
			mapGivebutterSignup(
				{
					id: 'signup-1',
					name: 'Fallback donor',
					column_values: [
						{ id: 'text_mm2fapmz', text: 'Alex Member', value: null },
						{ id: 'text_mm2f5770', text: ' ALEX@Example.com ', value: null },
						{ id: 'text_mm2fnp7s', text: 'campaign-42', value: null },
						{ id: 'text_mm2fb4c7', text: 'Open Studio', value: null },
						{ id: 'text_mm35qyja', text: '2026-08-04T14:30:00Z', value: null }
					]
				},
				'2026-08-04T15:00:00Z'
			)
		).toEqual({
			id: 'signup-1',
			donorName: 'Alex Member',
			donorEmail: 'alex@example.com',
			campaignId: 'campaign-42',
			eventTitle: 'Open Studio',
			transactionDate: '2026-08-04T14:30:00Z',
			syncedAt: '2026-08-04T15:00:00Z'
		});
	});

	it('loads the Givebutter board and excludes transactions without a campaign id', async () => {
		const request = vi.fn().mockResolvedValue({
			boards: [
				{
					items_page: {
						cursor: null,
						items: [
							{
								id: 'matched',
								name: 'Matched',
								column_values: [{ id: 'text_mm2fnp7s', text: 'campaign-42', value: null }]
							},
							{ id: 'unmatched', name: 'Unmatched', column_values: [] }
						]
					}
				}
			]
		});

		const signups = await new GivebutterDirectory({
			request
		} as unknown as MondayClient).list();

		expect(signups.map((signup) => signup.id)).toEqual(['matched']);
		expect(request).toHaveBeenCalledWith(
			expect.stringContaining('GivebutterTransactions'),
			expect.objectContaining({ boardId: GIVEBUTTER_TRANSACTION_BOARD_ID })
		);
	});
});
