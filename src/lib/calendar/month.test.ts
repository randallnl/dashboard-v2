import { describe, expect, it } from 'vitest';
import { datesInRange, monthBounds } from './month';

describe('monthBounds', () => {
	it('handles leap years and rejects invalid months', () => {
		expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', through: '2028-02-29' });
		expect(monthBounds('2026-13')).toBeNull();
	});
});

describe('datesInRange', () => {
	it('expands multi-day events across month boundaries', () => {
		expect(datesInRange('2026-07-31', '2026-08-02')).toEqual([
			'2026-07-31',
			'2026-08-01',
			'2026-08-02'
		]);
	});
});
