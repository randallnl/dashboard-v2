import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
	it('renders HTTP(S) and www URLs as safe links', () => {
		expect(linkify('Read https://example.com/report and www.queerlective.com.')).toEqual([
			{ type: 'text', text: 'Read ' },
			{ type: 'link', text: 'https://example.com/report', href: 'https://example.com/report' },
			{ type: 'text', text: ' and ' },
			{ type: 'link', text: 'www.queerlective.com', href: 'https://www.queerlective.com/' },
			{ type: 'text', text: '.' }
		]);
	});

	it('keeps punctuation outside a link and preserves valid parentheses in URLs', () => {
		expect(linkify('See (https://example.com/a_(draft)).')).toEqual([
			{ type: 'text', text: 'See (' },
			{ type: 'link', text: 'https://example.com/a_(draft)', href: 'https://example.com/a_(draft)' },
			{ type: 'text', text: ').' }
		]);
	});
});
