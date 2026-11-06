import { QuickLinkRepository } from '$lib/server/db';
import type { PageServerLoad } from './$types';

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function httpUrl(value: unknown): string {
	const candidate = text(value);
	try {
		const url = new URL(candidate);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
	} catch {
		return '';
	}
}

export const load: PageServerLoad = async ({ platform }) => {
	const records = await new QuickLinkRepository(platform!.env.DB).listPublishedProjects();
	return {
		links: records
			.map((project) => ({
				id: project.id,
				title: project.title,
				description: text(project.record.description),
				image: httpUrl(project.record.posterUrl),
				url:
					[
						project.record.linkUrl,
						project.record.websiteUrl,
						project.record.registrationUrl,
						project.record.link,
						project.record.publicUrl,
						project.record.url
					]
						.map(httpUrl)
						.find(Boolean) ?? ''
			}))
			.filter((project) => project.url)
	};
};
