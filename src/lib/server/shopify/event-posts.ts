import type { ProjectEventRecord } from '$lib/types/domain';
import type { ShopifyEventPost } from '$lib/server/db/shopify-event-post-repository';

const SHOPIFY_API_VERSION = '2026-10';
const DEFAULT_STORE_DOMAIN = 'queerlective.myshopify.com';
const DEFAULT_BLOG_HANDLE = 'upcoming-events';
const DEFAULT_STOREFRONT_URL = 'https://queerlective.com';
const DEFAULT_AUTHOR = 'Queerlective';
const REQUEST_TIMEOUT_MS = 15_000;

type SecretBinding = string | { get(): Promise<string> } | undefined;

export type ShopifyEventPostEnv = {
	SHOPIFY_ADMIN_ACCESS_TOKEN?: SecretBinding;
	SHOPIFY_STORE_DOMAIN?: string;
	SHOPIFY_EVENTS_BLOG_HANDLE?: string;
	SHOPIFY_STOREFRONT_URL?: string;
	SHOPIFY_EVENT_POST_AUTHOR?: string;
};

type ShopifyGraphQLError = { message?: string };
type ShopifyGraphQLResponse<T> = { data?: T; errors?: ShopifyGraphQLError[] };

type ShopifyArticle = { id: string; handle: string };
type ShopifyArticlePayload = {
	articleCreate?: { article?: ShopifyArticle | null; userErrors?: ShopifyGraphQLError[] };
	articleUpdate?: { article?: ShopifyArticle | null; userErrors?: ShopifyGraphQLError[] };
};

export class ShopifyEventPostError extends Error {}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function dateLabel(value: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return '';
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(date);
}

function eventDateLabel(event: ProjectEventRecord): string {
	const start = dateLabel(event.dateValue);
	const end = dateLabel(event.endDateValue);
	if (!start) return '';
	return end && end !== start ? `${start} – ${end}` : start;
}

function validHttpUrl(value: unknown): string {
	const candidate = text(value);
	try {
		const url = new URL(candidate);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
	} catch {
		return '';
	}
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>'"]/gu, (character) => {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]!;
	});
}

function descriptionHtml(value: string): string {
	const paragraphs = value
		.trim()
		.split(/\r?\n\s*\r?\n/gu)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
	return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`).join('');
}

function plainDescription(value: string, maxLength = 220): string {
	const normalized = value.replace(/\s+/gu, ' ').trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizedStoreDomain(value: string): string {
	const candidate = text(value).toLocaleLowerCase('en-US').replace(/^https?:\/\//u, '').replace(/\/$/u, '');
	if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/u.test(candidate)) {
		throw new ShopifyEventPostError('SHOPIFY_STORE_DOMAIN must be a valid .myshopify.com domain.');
	}
	return candidate;
}

function normalizedBlogHandle(value: string): string {
	const handle = text(value).toLocaleLowerCase('en-US');
	if (!/^[a-z0-9][a-z0-9-]*$/u.test(handle)) {
		throw new ShopifyEventPostError('SHOPIFY_EVENTS_BLOG_HANDLE must be a valid Shopify blog handle.');
	}
	return handle;
}

function storefrontOrigin(value: string): string {
	const candidate = validHttpUrl(value);
	if (!candidate) throw new ShopifyEventPostError('SHOPIFY_STOREFRONT_URL must be a valid public URL.');
	return candidate.replace(/\/$/u, '');
}

async function accessToken(binding: SecretBinding): Promise<string> {
	if (typeof binding === 'string') return binding.trim();
	if (binding && typeof binding.get === 'function') return (await binding.get()).trim();
	return '';
}

export function shopifyEventPostContent(event: ProjectEventRecord): {
	title: string;
	body: string;
	summary: string;
	image?: { altText: string; url: string };
} {
	const title = event.title.trim();
	const date = eventDateLabel(event);
	if (!title) throw new ShopifyEventPostError('Add an event title before publishing to Shopify.');
	if (!date) throw new ShopifyEventPostError('Add a valid event date before publishing to Shopify.');

	const description = text(event.record.description);
	const location = event.location.trim();
	const registrationUrl = validHttpUrl(event.record.registrationUrl);
	const posterUrl = validHttpUrl(event.record.posterUrl);
	const sections = [`<p><strong>Date</strong><br>${escapeHtml(date)}</p>`];
	if (location) sections.push(`<p><strong>Location</strong><br>${escapeHtml(location)}</p>`);
	if (description) sections.push(descriptionHtml(description));
	if (registrationUrl) {
		sections.push(
			`<p><a href="${escapeHtml(registrationUrl)}">Register or learn more</a></p>`
		);
	}

	return {
		title,
		body: sections.join('\n'),
		summary: plainDescription(description) || `${date}${location ? ` · ${location}` : ''}`,
		...(posterUrl ? { image: { altText: `Poster for ${title}`, url: posterUrl } } : {})
	};
}

async function shopifyRequest<T>(input: {
	storeDomain: string;
	accessToken: string;
	query: string;
	variables: Record<string, unknown>;
}): Promise<T> {
	const response = await fetch(
		`https://${input.storeDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
		{
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'X-Shopify-Access-Token': input.accessToken
			},
			body: JSON.stringify({ query: input.query, variables: input.variables }),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		}
	);
	const payload = (await response.json().catch(() => null)) as ShopifyGraphQLResponse<T> | null;
	if (!response.ok) {
		throw new ShopifyEventPostError(
			payload?.errors?.[0]?.message || `Shopify returned HTTP ${response.status}.`
		);
	}
	if (payload?.errors?.[0]?.message) throw new ShopifyEventPostError(payload.errors[0].message);
	if (!payload?.data) throw new ShopifyEventPostError('Shopify returned no data.');
	return payload.data;
}

async function eventsBlogId(input: {
	storeDomain: string;
	accessToken: string;
	blogHandle: string;
}): Promise<string> {
	const data = await shopifyRequest<{ blogs: { nodes: Array<{ id: string; handle: string }> } }>({
		...input,
		query: `query FindEventBlog { blogs(first: 50) { nodes { id handle } } }`,
		variables: {}
	});
	const blog = data.blogs.nodes.find((candidate) => candidate.handle === input.blogHandle);
	if (!blog) {
		throw new ShopifyEventPostError(
			`Could not find the Shopify blog “${input.blogHandle}”. Check SHOPIFY_EVENTS_BLOG_HANDLE.`
		);
	}
	return blog.id;
}

function mutationError(payload: ShopifyArticlePayload): string {
	return (
		payload.articleCreate?.userErrors?.[0]?.message ||
		payload.articleUpdate?.userErrors?.[0]?.message ||
		'Shopify could not save the event post.'
	);
}

function publishedUrl(storefrontUrl: string, blogHandle: string, articleHandle: string): string {
	return `${storefrontUrl}/blogs/${encodeURIComponent(blogHandle)}/${encodeURIComponent(articleHandle)}`;
}

export async function publishShopifyEventPost(input: {
	env: ShopifyEventPostEnv;
	event: ProjectEventRecord;
	existing: ShopifyEventPost | null;
	memberId: string;
	now?: string;
}): Promise<ShopifyEventPost> {
	const token = await accessToken(input.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
	if (!token) {
		throw new ShopifyEventPostError(
			'Shopify event publishing is not configured. Add SHOPIFY_ADMIN_ACCESS_TOKEN first.'
		);
	}
	const storeDomain = normalizedStoreDomain(input.env.SHOPIFY_STORE_DOMAIN || DEFAULT_STORE_DOMAIN);
	const blogHandle = normalizedBlogHandle(input.env.SHOPIFY_EVENTS_BLOG_HANDLE || DEFAULT_BLOG_HANDLE);
	const storefrontUrl = storefrontOrigin(input.env.SHOPIFY_STOREFRONT_URL || DEFAULT_STOREFRONT_URL);
	const author = text(input.env.SHOPIFY_EVENT_POST_AUTHOR) || DEFAULT_AUTHOR;
	const content = shopifyEventPostContent(input.event);
	const now = input.now || new Date().toISOString();
	const articleInput = {
		title: content.title,
		body: content.body,
		summary: content.summary,
		tags: ['Event'],
		isPublished: true,
		...(content.image ? { image: content.image } : {})
	};

	let article: ShopifyArticle | null | undefined;
	if (input.existing) {
		const data = await shopifyRequest<ShopifyArticlePayload>({
			storeDomain,
			accessToken: token,
			query: `mutation UpdateEventArticle($id: ID!, $article: ArticleUpdateInput!) {
				articleUpdate(id: $id, article: $article) {
					article { id handle }
					userErrors { message }
				}
			}`,
			variables: { id: input.existing.articleId, article: articleInput }
		});
		article = data.articleUpdate?.article;
		if (!article) throw new ShopifyEventPostError(mutationError(data));
	} else {
		const blogId = await eventsBlogId({ storeDomain, accessToken: token, blogHandle });
		const data = await shopifyRequest<ShopifyArticlePayload>({
			storeDomain,
			accessToken: token,
			query: `mutation CreateEventArticle($article: ArticleCreateInput!) {
				articleCreate(article: $article) {
					article { id handle }
					userErrors { message }
				}
			}`,
			variables: {
				article: { ...articleInput, blogId, author: { name: author } }
			}
		});
		article = data.articleCreate?.article;
		if (!article) throw new ShopifyEventPostError(mutationError(data));
	}

	return {
		projectId: input.event.id,
		articleId: article.id,
		articleHandle: article.handle,
		blogHandle,
		publicUrl: publishedUrl(storefrontUrl, blogHandle, article.handle),
		createdByMemberId: input.existing?.createdByMemberId || input.memberId,
		createdAt: input.existing?.createdAt || now,
		updatedAt: now
	};
}
