import { describe, expect, it } from 'vitest';
import { mapActivity, parseActivityMemberId, summarizeActivity } from './activity';

describe('activity mapping', () => {
	it('extracts the exact member ID from the Person field', () => {
		expect(parseActivityMemberId('Randall N. | Member ID: 12069306477')).toBe('12069306477');
		expect(parseActivityMemberId('Someone without an identifier')).toBe('');
	});

	it('maps records and groups their types', () => {
		const activity = mapActivity({
			id: '1',
			name: 'Fallback description',
			column_values: [
				{ id: 'single_selectis1ajb9', text: 'Volunteer Shift', value: null },
				{ id: 'date_mm2mqnq2', text: '2026-07-20', value: null },
				{ id: 'long_text3mhw34i5', text: 'Covered the studio', value: null },
				{
					id: 'text_mm34jrzj',
					text: 'Randall N. | Member ID: 12069306477',
					value: null
				}
			]
		});
		expect(activity.memberId).toBe('12069306477');
		expect(summarizeActivity([activity, { ...activity, id: '2' }])).toEqual([
			{ type: 'Volunteer Shift', count: 2 }
		]);
	});
});
