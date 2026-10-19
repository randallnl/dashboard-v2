import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { SocialAssetLibraryRepository } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!params.assetId) error(400, 'Library asset ID is required.');
	const asset = await new SocialAssetLibraryRepository(env!.DB).find(params.assetId);
	if (!asset) error(404, 'Library asset not found.');
	const object = await env!.SOCIAL_MEDIA_ASSETS.get(asset.objectKey);
	if (!object) error(404, 'Library asset file no longer exists.');
	return new Response(object.body, {
		headers: {
			'content-type':
				object.httpMetadata?.contentType || asset.contentType || 'application/octet-stream',
			'cache-control': 'private, max-age=3600',
			'content-disposition': `inline; filename="${asset.filename.replace(/["\\]/gu, '_')}"`
		}
	});
};
