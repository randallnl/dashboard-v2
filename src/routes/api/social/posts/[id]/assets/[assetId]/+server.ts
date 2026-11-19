import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { SocialPostRepository } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!params.id || !params.assetId) error(400, 'Post and media IDs are required.');
	const repository = new SocialPostRepository(env!.DB);
	const post = await repository.find(params.id);
	if (!post) error(404, 'Social post not found.');
	if (post.channels.some((channel) => channel.status === 'published')) {
		error(409, 'Attachments cannot be changed after a channel is published.');
	}
	const asset = post.assets.find((candidate) => candidate.id === params.assetId);
	if (!asset) error(404, 'Media file not found on this post.');
	if (!(await repository.removeAsset(post.id, asset.id))) error(404, 'Media file not found on this post.');
	if (asset.storage === 'r2' && asset.objectKey.startsWith(`social/${post.id}/`)) {
		await env!.SOCIAL_MEDIA_ASSETS.delete(asset.objectKey);
	}
	return json({
		post: await repository.find(post.id),
		message: 'Attachment removed from this post.'
	});
};
