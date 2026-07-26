import { describe, expect, it } from 'vitest';
import { isPlausibleEmail } from './service';

describe('auth input validation', () => {
	it('accepts ordinary member email addresses', () => {
		expect(isPlausibleEmail('member@example.com')).toBe(true);
	});

	it('rejects malformed and unreasonably long addresses', () => {
		expect(isPlausibleEmail('not-an-email')).toBe(false);
		expect(isPlausibleEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
	});
});
