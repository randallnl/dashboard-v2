import { describe, expect, it } from 'vitest';
import { magicLinkEmailContent } from './email';

describe('magic-link email', () => {
	it('includes matching HTML and plain-text login information', () => {
		const content = magicLinkEmailContent({
			to: 'member@example.com',
			loginUrl: 'https://example.com/api/auth/verify?token=abc123',
			expiresInMinutes: 15
		});

		expect(content.subject).toContain('CoLab');
		expect(content.text).toContain('https://example.com/api/auth/verify?token=abc123');
		expect(content.text).toContain('15 minutes');
		expect(content.html).toContain('Sign in to CoLab');
	});

	it('escapes a URL before placing it in HTML', () => {
		const content = magicLinkEmailContent({
			to: 'member@example.com',
			loginUrl: 'https://example.com/?one=1&two="bad"',
			expiresInMinutes: 15
		});

		expect(content.html).toContain('one=1&amp;two=&quot;bad&quot;');
		expect(content.html).not.toContain('one=1&two="bad"');
	});
});
