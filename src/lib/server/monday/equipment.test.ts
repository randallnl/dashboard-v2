import { describe, expect, it, vi } from 'vitest';
import type { MondayClient } from './client';
import {
	EQUIPMENT_REQUEST_BOARD_ID,
	EquipmentRequestDirectory,
	mapEquipmentRequest
} from './equipment';

describe('equipment request mapping', () => {
	it('maps the configured request fields and item creation time', () => {
		expect(
			mapEquipmentRequest(
				{
					id: 'request-1',
					name: 'Button maker',
					created_at: '2026-07-29T13:15:00Z',
					column_values: [
						{ id: 'text_mkq1xed9', text: 'Alex Member', value: null },
						{ id: 'numeric_mkq1qgzs', text: '125.50', value: null },
						{
							id: 'link_mkq1xj22',
							text: 'Product',
							value: JSON.stringify({ url: 'https://example.com/button-maker' })
						},
						{ id: 'long_text_mkq1s3es', text: 'For member workshops', value: null },
						{ id: 'long_text_mkq11mtr', text: 'Includes starter parts', value: null }
					]
				},
				'2026-07-29T14:00:00Z'
			)
		).toEqual({
			id: 'request-1',
			title: 'Button maker',
			requestor: 'Alex Member',
			estimatedCost: '125.50',
			productUrl: 'https://example.com/button-maker',
			explanation: 'For member workshops',
			additionalInfo: 'Includes starter parts',
			submittedAt: '2026-07-29T13:15:00Z',
			syncedAt: '2026-07-29T14:00:00Z'
		});
	});

	it('loads requests from the configured Monday board', async () => {
		const request = vi.fn().mockResolvedValue({
			boards: [
				{
					items_page: {
						cursor: null,
						items: [
							{
								id: 'request-1',
								name: 'Kiln shelf',
								created_at: '2026-07-29T13:15:00Z',
								column_values: []
							}
						]
					}
				}
			]
		});

		const requests = await new EquipmentRequestDirectory({
			request
		} as unknown as MondayClient).list();

		expect(requests.map((item) => item.id)).toEqual(['request-1']);
		expect(request).toHaveBeenCalledWith(
			expect.stringContaining('EquipmentRequests'),
			expect.objectContaining({ boardId: EQUIPMENT_REQUEST_BOARD_ID })
		);
	});
});
