import { describe, expect, it } from 'vitest';
import { mapCommunityEvent, mapProjectEvent } from './events';

describe('Monday event mapping', () => {
	it('marks project events outside member locations as admin-only', () => {
		const event = mapProjectEvent(
			{
				id: 'event-1',
				name: 'Internal planning',
				column_values: [
					{ id: 'date_mkns6cak', text: 'Jul 30', value: '{"date":"2026-07-30"}' },
					{ id: 'dropdown_mknqezw8', text: 'Staff Office', value: null }
				]
			},
			'2026-07-26T16:00:00.000Z'
		);
		expect(event.adminOnly).toBe(true);
	});

	it('allows approved CoLab locations and preserves multi-day dates', () => {
		const event = mapProjectEvent(
			{
				id: 'event-2',
				name: 'Open studio',
				column_values: [
					{ id: 'date_mkns6cak', text: '', value: '{"date":"2026-07-30"}' },
					{ id: 'date_mm171v9p', text: '', value: '{"date":"2026-08-02"}' },
					{ id: 'dropdown_mknqezw8', text: 'Community Room', value: null }
				]
			},
			'2026-07-26T16:00:00.000Z'
		);
		expect(event).toMatchObject({
			adminOnly: false,
			dateValue: '2026-07-30',
			endDateValue: '2026-08-02',
			record: { mondayUrl: 'https://queerlective.monday.com/boards/8390893779/pulses/event-2' }
		});
	});

	it('prefers the original public asset URL over Monday’s small thumbnail', () => {
		const event = mapProjectEvent(
			{
				id: 'event-poster',
				name: 'Poster event',
				column_values: [
					{ id: 'date_mkns6cak', text: '', value: '{"date":"2026-08-01"}' },
					{ id: 'dropdown_mknqezw8', text: 'CoLab', value: null },
					{
						id: 'file_mknscbex',
						text: 'poster.jpg',
						value: null,
						files: [
							{
								asset: {
									public_url: 'https://cdn.monday.com/original/poster.jpg',
									url_thumbnail: 'https://cdn.monday.com/thumbnail/poster.jpg'
								}
							}
						]
					}
				]
			},
			'2026-07-26T16:00:00.000Z'
		);

		expect(event.record.posterUrl).toBe('https://cdn.monday.com/original/poster.jpg');
	});

	it('defaults community submissions to pending and member-visible', () => {
		const event = mapCommunityEvent(
			{
				id: 'community-1',
				name: 'Print night',
				column_values: [{ id: 'date_Mjj7b71V', text: '', value: '{"date":"2026-08-04"}' }]
			},
			'2026-07-26T16:00:00.000Z'
		);
		expect(event).toMatchObject({
			source: 'community',
			status: 'Pending',
			adminOnly: false,
			record: {
				itemId: 'community-1',
				mondayUrl: 'https://queerlective.monday.com/boards/8052311890/pulses/community-1'
			}
		});
	});
});
