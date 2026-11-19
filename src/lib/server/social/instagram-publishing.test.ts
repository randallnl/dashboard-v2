import { describe, expect, it } from 'vitest';
import type { SocialPostAsset } from '$lib/types/domain';
import {
	createInstagramMediaUrl,
	isInstagramPublishableImage,
	verifyInstagramMediaUrl
} from './instagram-publishing';
import type { InstagramConnectionEnv } from './instagram-connection';

const now = Date.UTC(2026, 10, 16, 18, 0, 0);

function publishingEnv(): InstagramConnectionEnv {
	return {
		DB: {} as D1Database,
		DASHBOARD_URL: 'https://dashboard.queerlective.com',
		SOCIAL_TOKEN_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
	};
}

function asset(overrides: Partial<SocialPostAsset> = {}): SocialPostAsset {
	return {
		id: 'asset-1',
		postId: 'post-1',
		storage: 'r2',
		objectKey: 'social/post-1/asset-1.jpg',
		sourceUrl: '',
		filename: 'event-photo.jpg',
		contentType: 'image/jpeg',
		byteSize: 1000,
		createdAt: '2026-11-16T18:00:00.000Z',
		...overrides
	};
}

describe('Instagram publishing media access', () => {
	it('creates a short-lived, tamper-resistant URL for Meta to fetch a post asset', async () => {
		const url = new URL(await createInstagramMediaUrl(publishingEnv(), 'asset-1', now));
		expect(url.origin + url.pathname).toBe(
			'https://dashboard.queerlective.com/api/social/instagram/media/asset-1'
		);
		expect(
			await verifyInstagramMediaUrl(
				publishingEnv(),
				'asset-1',
				url.searchParams.get('expires'),
				url.searchParams.get('signature'),
				now
			)
		).toBe(true);
		expect(
			await verifyInstagramMediaUrl(
				publishingEnv(),
				'other-asset',
				url.searchParams.get('expires'),
				url.searchParams.get('signature'),
				now
			)
		).toBe(false);
	});

	it('limits the first publishing flow to a post-owned JPG image', () => {
		expect(isInstagramPublishableImage(asset())).toBe(true);
		expect(isInstagramPublishableImage(asset({ contentType: 'image/png', filename: 'art.png' }))).toBe(
			false
		);
		expect(isInstagramPublishableImage(asset({ storage: 'source' }))).toBe(false);
	});
});
