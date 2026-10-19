import {
	SOCIAL_PLATFORMS,
	type SocialPlatform,
	type SocialPostChannel,
	type SocialPostReviewAction,
	type SocialPostStatus
} from '$lib/types/domain';
import { error } from '@sveltejs/kit';

const statuses = new Set<SocialPostStatus>(['draft', 'review', 'scheduled', 'published']);
const platforms = new Set<string>(SOCIAL_PLATFORMS);
const reviewActions = new Set<SocialPostReviewAction>([
	'submitted',
	'approved',
	'changes_requested',
	'commented'
]);

export type SocialPostInput = {
	title: string;
	copy: string;
	status: SocialPostStatus;
	scheduledAt: string;
	publishedAt: string;
	publishedUrl: string;
	channels: SocialPostChannel[];
};

function stringValue(value: unknown, maxLength: number): string {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function timestamp(value: unknown, label: string): string {
	const input = stringValue(value, 64);
	if (!input) return '';
	const parsed = new Date(input);
	if (Number.isNaN(parsed.getTime())) error(400, `${label} must be a valid date and time.`);
	return parsed.toISOString();
}

function optionalHttpUrl(value: unknown): string {
	const input = stringValue(value, 2000);
	if (!input) return '';
	try {
		const url = new URL(input);
		if (url.protocol !== 'https:' && url.protocol !== 'http:')
			throw new Error('Unsupported protocol');
		return url.href;
	} catch {
		error(400, 'Published URL must be an http or https URL.');
	}
}

function parseChannelCopies(
	value: unknown,
	selectedPlatforms: SocialPlatform[]
): Partial<Record<SocialPlatform, string>> {
	if (value === undefined || value === null) return {};
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		error(400, 'Channel-specific copy must be a list of platform versions.');
	}
	const copies: Partial<Record<SocialPlatform, string>> = {};
	for (const [platform, rawCopy] of Object.entries(value as Record<string, unknown>)) {
		if (!platforms.has(platform) || !selectedPlatforms.includes(platform as SocialPlatform)) {
			error(400, 'Channel-specific copy must match a selected platform.');
		}
		const channelCopy = stringValue(rawCopy, 10000);
		if (!channelCopy) error(400, 'Channel-specific copy cannot be empty.');
		copies[platform as SocialPlatform] = channelCopy;
	}
	return copies;
}

export function parseSocialPostInput(value: unknown): SocialPostInput {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		error(400, 'Post details are required.');
	const body = value as Record<string, unknown>;
	const title = stringValue(body.title, 160);
	const copy = stringValue(body.copy, 10000);
	const status = stringValue(body.status, 20) as SocialPostStatus;
	if (!title) error(400, 'Give this post a working title.');
	if (!copy) error(400, 'Add the post copy before saving.');
	if (!statuses.has(status)) error(400, 'Choose a valid workflow status.');
	const scheduledAt = timestamp(body.scheduledAt, 'Scheduled time');
	const publishedAt = timestamp(body.publishedAt, 'Published time');
	const publishedUrl = optionalHttpUrl(body.publishedUrl);
	if (status === 'scheduled' && !scheduledAt) {
		error(400, 'Choose a scheduled time before queuing this post.');
	}
	if (status === 'published' && !publishedAt) {
		error(400, 'Add the time this post was published.');
	}
	const requestedPlatforms = Array.isArray(body.platforms)
		? body.platforms.filter(
				(value): value is SocialPlatform => typeof value === 'string' && platforms.has(value)
			)
		: [];
	const uniquePlatforms = [...new Set(requestedPlatforms)];
	if (!uniquePlatforms.length) error(400, 'Select at least one social platform.');
	const channelCopies = parseChannelCopies(body.channelCopies, uniquePlatforms);

	const isScheduled = status === 'scheduled';
	const isPublished = status === 'published';
	return {
		title,
		copy,
		status,
		scheduledAt: isScheduled ? scheduledAt : '',
		publishedAt: isPublished ? publishedAt : '',
		publishedUrl: isPublished ? publishedUrl : '',
		channels: uniquePlatforms.map((platform) => ({
			platform,
			copy: channelCopies[platform] ?? copy,
			status,
			scheduledAt: isScheduled ? scheduledAt : '',
			publishedAt: isPublished ? publishedAt : '',
			publishedUrl: isPublished ? publishedUrl : ''
		}))
	};
}

export function parseSocialPostReview(value: unknown): {
	action: SocialPostReviewAction;
	note: string;
} {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		error(400, 'Review details are required.');
	}
	const body = value as Record<string, unknown>;
	const action = stringValue(body.action, 32) as SocialPostReviewAction;
	const note = stringValue(body.note, 2000);
	if (!reviewActions.has(action)) error(400, 'Choose a valid review action.');
	if ((action === 'changes_requested' || action === 'commented') && !note) {
		error(400, 'Add a note before sending that review action.');
	}
	return { action, note };
}

export function parseProjectReference(
	value: unknown
): { source: 'project' | 'community'; id: string } | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	const source = record.source;
	const id = stringValue(record.id, 100);
	if (!source && !id) return null;
	if ((source !== 'project' && source !== 'community') || !id) {
		error(400, 'Project source details are incomplete.');
	}
	return { source, id };
}

export function parseProjectAssetUrls(value: unknown): string[] | null {
	if (value === undefined || value === null) return null;
	if (!Array.isArray(value) || value.length > 30) {
		error(400, 'Project graphics must be a list of up to 30 images.');
	}
	const urls = value.map((item) => stringValue(item, 2000));
	if (urls.some((url) => !url)) error(400, 'Each selected project graphic must be valid.');
	return [...new Set(urls)];
}

export function parseLibraryAssetIds(value: unknown): string[] | null {
	if (value === undefined || value === null) return null;
	if (!Array.isArray(value) || value.length > 30) {
		error(400, 'Library assets must be a list of up to 30 files.');
	}
	const ids = value.map((item) => stringValue(item, 100));
	if (ids.some((id) => !id)) error(400, 'Each selected library asset must be valid.');
	return [...new Set(ids)];
}
