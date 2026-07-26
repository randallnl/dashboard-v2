import { describe, expect, it } from 'vitest';
import { mapMondayMember, normalizeEmail, parseOtherEmails } from './members';

describe('member normalization', () => {
	it('normalizes email casing and whitespace', () => {
		expect(normalizeEmail('  Member@Example.COM ')).toBe('member@example.com');
	});

	it('extracts and deduplicates alternate email addresses', () => {
		expect(
			parseOtherEmails('Work: Artist@example.com; personal artist@example.com, alt@test.org')
		).toEqual(['artist@example.com', 'alt@test.org']);
	});

	it('maps the primary raw email value and member fields', () => {
		const member = mapMondayMember({
			id: 'item-1',
			name: 'Fallback Name',
			column_values: [
				{
					id: 'email_mkmvg87g',
					text: 'Email label',
					value: '{"email":"Member@Example.com","text":"Email label"}'
				},
				{ id: 'text_mm35brvq', text: 'Alex', value: null },
				{ id: 'color_mkw1xfh2', text: 'Admin', value: null },
				{ id: 'pulse_id_mm34sv67', text: 'member-42', value: null },
				{
					id: 'text_mm358g6e',
					text: 'member@example.com, alternate@example.com',
					value: null
				}
			]
		});

		expect(member).toMatchObject({
			id: 'member-42',
			preferredName: 'Alex',
			membershipType: 'Admin',
			email: 'member@example.com',
			otherEmails: ['alternate@example.com']
		});
	});
});
