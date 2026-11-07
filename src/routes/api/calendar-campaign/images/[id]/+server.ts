import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const env = platform?.env;
	if (!env?.DB || !env.CALENDAR_CAMPAIGN_ASSETS) error(404, 'Image not found.');
	const row = await env.DB
		.prepare(`SELECT image_key, image_content_type FROM calendar_campaign_submissions WHERE id = ?1 AND status = 'approved' AND public_display_consent = 1`)
		.bind(params.id)
		.first<{ image_key: string; image_content_type: string }>();
	if (!row?.image_key) error(404, 'Image not found.');
	const object = await env.CALENDAR_CAMPAIGN_ASSETS.get(row.image_key);
	if (!object) error(404, 'Image not found.');
	return new Response(object.body, {
		headers: { 'content-type': row.image_content_type || 'image/jpeg', 'cache-control': 'public, max-age=3600' }
	});
};
