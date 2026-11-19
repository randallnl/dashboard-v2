import { SocialPostRepository } from '$lib/server/db';
import { verifyInstagramMediaUrl } from '$lib/server/social/instagram-publishing';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const env = platform?.env;
	if (!params.assetId) error(400, 'Media ID is required.');
	const permitted = await verifyInstagramMediaUrl(
		env!,
		params.assetId,
		url.searchParams.get('expires'),
		url.searchParams.get('signature')
	);
	if (!permitted) error(403, 'This media link is invalid or has expired.');
	const asset = await new SocialPostRepository(env!.DB).findAsset(params.assetId);
	if (!asset || asset.storage !== 'r2') error(404, 'Media file not found.');
	const object = await env!.SOCIAL_MEDIA_ASSETS.get(asset.objectKey);
	if (!object) error(404, 'Media file no longer exists.');
	const remainingSeconds = Math.max(
		0,
		Math.floor(Number(url.searchParams.get('expires')) - Date.now() / 1000)
	);
	return new Response(object.body, {
		headers: {
			'content-type': object.httpMetadata?.contentType || asset.contentType || 'application/octet-stream',
			'cache-control': `public, max-age=${remainingSeconds}`
		}
	});
};
