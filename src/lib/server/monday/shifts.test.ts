import { describe, expect, it } from 'vitest';
import { coveredByLabel, mapMondayShift, shiftTime } from './shifts';

describe('shiftTime', () => {
	it('uses Sunday and weekday coverage hours', () => {
		expect(shiftTime('2026-07-26')).toBe('2pm-4pm');
		expect(shiftTime('2026-07-27')).toBe('6pm-8pm');
	});
});

describe('coveredByLabel', () => {
	it('shows only a first name and last initial', () => {
		expect(coveredByLabel('Alex Morgan | member-1')).toBe('Alex M.');
		expect(coveredByLabel('Rae')).toBe('Rae');
		expect(coveredByLabel('')).toBe('A member');
	});
});

describe('mapMondayShift', () => {
	it('normalizes an open Monday subitem', () => {
		const shift = mapMondayShift(
			{
				id: 'shift-1',
				name: 'Front desk',
				board: { id: 'subitem-board' },
				parent_item: { id: 'month-1', name: 'July 2026' },
				column_values: [
					{ id: 'date0', text: 'Jul 27', value: '{"date":"2026-07-27"}' },
					{ id: 'text_mm35f0vb', text: '', value: null },
					{ id: 'text_mm4vxh9t', text: '', value: null },
					{ id: 'color_mkw122gj', text: 'Open', value: null }
				]
			},
			'2026-07-26T12:00:00.000Z'
		);

		expect(shift).toMatchObject({
			id: 'shift-1',
			boardId: 'subitem-board',
			parentId: 'month-1',
			dateValue: '2026-07-27',
			timeLabel: '6pm-8pm',
			isCovered: false
		});
	});

	it('treats assigned shifts as covered', () => {
		const shift = mapMondayShift(
			{
				id: 'shift-2',
				name: 'Sunday coverage',
				board: { id: 'subitem-board' },
				parent_item: { id: 'month-1', name: 'July 2026' },
				column_values: [
					{ id: 'date0', text: 'Jul 26', value: '{"date":"2026-07-26"}' },
					{ id: 'text_mm35f0vb', text: 'member-1', value: null },
					{ id: 'text_mm4vxh9t', text: 'Alex M. | member-1', value: null },
					{ id: 'color_mkw122gj', text: 'Covered', value: null }
				]
			},
			'2026-07-26T12:00:00.000Z'
		);

		expect(shift.isCovered).toBe(true);
		expect(shift.timeLabel).toBe('2pm-4pm');
	});
});
