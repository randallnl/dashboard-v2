import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectEventRecord } from '$lib/types/domain';
import {
	publishShopifyEventPost,
	shopifyEventPostContent,
	ShopifyEventPostError
} from './event-posts';

function event(overrides: Partial<ProjectEventRecord> = {}): ProjectEventRecord {
	return {
		id: 'project-1',
		source: 'project',
		title: 'Community craft night',
		dateValue: '2026-12-04',
		endDateValue: '',
		status: 'Working on it',
		location: 'Queerlective CoLab',
		owner: '',
		adminOnly: false,
		record: {
			description: 'Make art together.\nBring a friend.',
			registrationUrl: 'https://example.com/register',
			posterUrl: 'https://images.example.com/craft-night.jpg'
		},
		syncedAt: '2026-11-19T18:00:00.000Z',
		...overrides
	};
}

afterEach(() => vi.unstubAllGlobals());

describe('Shopify event posts', () => {
	it('builds safe, public event content from the project details', () => {
		const content = shopifyEventPostContent(
			event({
				title: 'Craft <night>',
				record: {
					description: 'Make <art> & connect.\nBring a friend.',
					registrationUrl: 'https://example.com/register?source=dashboard&event=1',
					posterUrl: 'https://images.example.com/craft-night.jpg'
				}
			})
		);

		expect(content).toEqual({
			title: 'Craft <night>',
			body:
				'<p><strong>Date</strong><br>Friday, December 4, 2026</p>\n' +
				'<p><strong>Location</strong><br>Queerlective CoLab</p>\n' +
				'<p>Make &lt;art&gt; &amp; connect.<br>Bring a friend.</p>\n' +
				'<p><a href="https://example.com/register?source=dashboard&amp;event=1">Register or learn more</a></p>',
			summary: 'Make <art> & connect. Bring a friend.',
			image: {
				altText: 'Poster for Craft <night>',
				url: 'https://images.example.com/craft-night.jpg'
			}
		});
	});

	it('requires an event date before allowing a public post', () => {
		expect(() => shopifyEventPostContent(event({ dateValue: '' }))).toThrow(
			ShopifyEventPostError
		);
	});

	it('creates a tracked, published Shopify article in the events blog', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ data: { blogs: { nodes: [{ id: 'gid://shopify/Blog/1', handle: 'upcoming-events' }] } } }),
					{ status: 200 }
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: {
							articleCreate: {
								article: { id: 'gid://shopify/Article/4', handle: 'community-craft-night' },
								userErrors: []
							}
						}
					}),
					{ status: 200 }
				)
			);
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			publishShopifyEventPost({
				env: { SHOPIFY_ADMIN_ACCESS_TOKEN: 'shopify-token' },
				event: event(),
				existing: null,
				memberId: 'member-1',
				now: '2026-11-19T18:00:00.000Z'
			})
		).resolves.toEqual({
			projectId: 'project-1',
			articleId: 'gid://shopify/Article/4',
			articleHandle: 'community-craft-night',
			blogHandle: 'upcoming-events',
			publicUrl: 'https://queerlective.com/blogs/upcoming-events/community-craft-night',
			createdByMemberId: 'member-1',
			createdAt: '2026-11-19T18:00:00.000Z',
			updatedAt: '2026-11-19T18:00:00.000Z'
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenLastCalledWith(
			'https://queerlective.myshopify.com/admin/api/2026-10/graphql.json',
			expect.objectContaining({
				headers: expect.objectContaining({ 'X-Shopify-Access-Token': 'shopify-token' })
			})
		);
		const secondRequest = fetchMock.mock.calls[1][1] as RequestInit;
		expect(secondRequest.body).toContain('CreateEventArticle');
		expect(secondRequest.body).toContain('gid://shopify/Blog/1');
		expect(secondRequest.body).toContain('Queerlective');
	});
});
