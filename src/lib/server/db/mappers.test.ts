import { describe, expect, it } from 'vitest';
import { mapProjectEventRow, mapShiftRow } from './mappers';

describe('D1 row mappers', () => {
	it('maps a normalized shift and safely parses its tags', () => {
		const result = mapShiftRow({
			id: 'shift-1',
			board_id: '8374554428',
			parent_id: 'month-1',
			month: 'July',
			title: 'Studio shift',
			date_label: 'Jul 28',
			date_value: '2026-07-28',
			time_label: '6pm-8pm',
			member_id: '',
			person: '',
			covered_by: '',
			coverage_status: 'Open',
			is_covered: 0,
			tags_json: '["weekday"]',
			synced_at: '2026-07-24T12:00:00.000Z'
		});

		expect(result.isCovered).toBe(false);
		expect(result.tags).toEqual(['weekday']);
	});

	it('falls back safely when stored JSON is malformed', () => {
		const result = mapProjectEventRow({
			id: 'event-1',
			source: 'project',
			title: 'Open studio',
			date_value: '2026-08-01',
			end_date_value: '',
			status: 'Scheduled',
			location: 'CoLab',
			owner: 'Queerlective',
			admin_only: 0,
			record_json: '{broken',
			synced_at: '2026-07-24T12:00:00.000Z'
		});

		expect(result.record).toEqual({});
		expect(result.adminOnly).toBe(false);
	});
});
