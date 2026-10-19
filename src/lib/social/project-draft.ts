import type { EventAttachment, ProjectEventRecord, SocialPostAsset } from '$lib/types/domain';

type ProjectDraft = {
	title: string;
	body: string;
	assets: Array<
		Pick<SocialPostAsset, 'storage' | 'sourceUrl' | 'filename' | 'contentType' | 'byteSize'>
	>;
};

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function projectDate(value: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return '';
	const parsed = new Date(`${value}T12:00:00Z`);
	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(parsed);
}

function plainExcerpt(value: string): string {
	return value
		.replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
		.replace(/https?:\/\/\S+/gu, '')
		.replace(/\s+/gu, ' ')
		.trim()
		.slice(0, 420);
}

function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

export function socialDraftFromProject(record: ProjectEventRecord): ProjectDraft {
	const description = plainExcerpt(text(record.record.description));
	const date = projectDate(record.dateValue);
	const location = text(record.location);
	const details = [date && `on ${date}`, location && `at ${location}`].filter(Boolean).join(' ');
	const lines = [`${record.title}${details ? ` — ${details}.` : '.'}`];
	if (description) lines.push(description);
	lines.push('More details coming soon.');

	const attachments = Array.isArray(record.record.attachments)
		? (record.record.attachments as EventAttachment[])
		: [];
	const candidates = [
		{
			name: 'Project cover image',
			url: text(record.record.posterUrl),
			isImage: true
		},
		...attachments
	];
	const seen = new Set<string>();
	const assets = candidates
		.filter((attachment) => attachment.isImage && isHttpUrl(attachment.url))
		.filter((attachment) => {
			if (seen.has(attachment.url)) return false;
			seen.add(attachment.url);
			return true;
		})
		.map((attachment) => ({
			storage: 'source' as const,
			sourceUrl: attachment.url,
			filename: attachment.name || 'Project image',
			contentType: '',
			byteSize: 0
		}));

	return {
		title: record.title ? `${record.title} social post` : 'New social post',
		body: lines.filter(Boolean).join('\n\n'),
		assets
	};
}
