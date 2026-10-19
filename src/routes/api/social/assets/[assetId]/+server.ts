import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { SocialPostRepository } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const asset = await new SocialPostRepository(env!.DB).findAsset(params.assetId);
	if (!asset) error(404, 'Media file not found.');
	if (asset.storage !== 'r2') error(400, 'This media file is stored with its source project.');
	const object = await env!.SOCIAL_MEDIA_ASSETS.get(asset.objectKey);
	if (!object) error(404, 'Media file no longer exists.');
	return new Response(object.body, {
		headers: {
			'content-type':
				object.httpMetadata?.contentType || asset.contentType || 'application/octet-stream',
			'cache-control': 'private, max-age=3600',
			'content-disposition': `inline; filename="${asset.filename.replace(/["\\]/gu, '_')}"`
		}
	});
};
