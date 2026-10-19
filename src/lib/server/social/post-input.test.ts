import { describe, expect, it } from 'vitest';
import { parseLibraryAssetIds, parseSocialPostInput, parseSocialPostReview } from './post-input';

describe('parseSocialPostInput', () => {
	it('keeps shared copy by default and applies selected channel versions', () => {
		const input = parseSocialPostInput({
			title: 'Open studio reminder',
			copy: 'Join us for open studio this Friday.',
			status: 'draft',
			scheduledAt: '',
			publishedAt: '',
			publishedUrl: '',
			platforms: ['instagram', 'bluesky'],
			channelCopies: { bluesky: 'Open studio this Friday.' }
		});

		expect(input.channels).toEqual([
			expect.objectContaining({
				platform: 'instagram',
				copy: 'Join us for open studio this Friday.'
			}),
			expect.objectContaining({ platform: 'bluesky', copy: 'Open studio this Friday.' })
		]);
	});
});

describe('parseSocialPostReview', () => {
	it('accepts an approval without requiring a note', () => {
		expect(parseSocialPostReview({ action: 'approved', note: '' })).toEqual({
			action: 'approved',
			note: ''
		});
	});
});

describe('parseLibraryAssetIds', () => {
	it('deduplicates selected library assets before a post is created', () => {
		expect(parseLibraryAssetIds(['asset-one', 'asset-one', 'asset-two'])).toEqual([
			'asset-one',
			'asset-two'
		]);
	});
});
