import type { PageServerLoad } from './$types';

type WallStoryRow = {
	id: string;
	name: string;
	town: string;
	story: string;
	image_key: string;
	created_at: string;
};

const displayName = (name: string) => {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length < 2) return parts[0] || 'Community member';
	return `${parts[0]} ${parts.at(-1)?.[0]}.`;
};

const submittedDate = (value: string) =>
	new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'America/New_York'
	}).format(new Date(value));

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env.DB;
	if (!db) return { wallStories: [], shopifyCalendarUrl: platform?.env.SHOPIFY_CALENDAR_URL || '' };
	const result = await db
		.prepare(
			`SELECT id, name, town, story, image_key, created_at
			 FROM calendar_campaign_submissions
			 WHERE status = 'approved' AND public_display_consent = 1
			 ORDER BY created_at DESC LIMIT 12`
		)
		.all<WallStoryRow>();
	return {
		wallStories: result.results.map((story) => ({
			id: story.id,
			name: displayName(story.name),
			town: story.town,
			story: story.story,
			submittedAt: submittedDate(story.created_at),
			imageUrl: story.image_key ? `/api/calendar-campaign/images/${story.id}` : ''
		})),
		shopifyCalendarUrl: platform?.env.SHOPIFY_CALENDAR_URL || ''
	};
};
