import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { SocialPlatformConnectionRepository, SocialPostRepository } from '$lib/server/db';
import {
	InstagramPublishError,
	isInstagramPublishableImage,
	publishInstagramImage
} from '$lib/server/social/instagram-publishing';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!params.id) error(400, 'Post ID is required.');
	const posts = new SocialPostRepository(env!.DB);
	const post = await posts.find(params.id);
	if (!post) error(404, 'Social post not found.');
	const instagram = post.channels.find((channel) => channel.platform === 'instagram');
	if (!instagram) error(400, 'Add Instagram as a channel before publishing this post.');
	if (instagram.status === 'published') error(409, 'This post has already been published to Instagram.');
	const body = (await request.json().catch(() => null)) as { assetId?: unknown } | null;
	const requestedAssetId =
		typeof body?.assetId === 'string' ? body.assetId.trim().slice(0, 100) : '';
	const asset = requestedAssetId
		? post.assets.find((candidate) => candidate.id === requestedAssetId)
		: post.assets.find(isInstagramPublishableImage);
	if (!asset || !isInstagramPublishableImage(asset)) {
		error(400, 'Choose a JPG visual before publishing to Instagram.');
	}
	const connection = await new SocialPlatformConnectionRepository(env!.DB).connection();
	if (!connection) error(409, 'Connect Instagram before publishing a post.');
	let result: { mediaId: string; permalink: string };
	try {
		result = await publishInstagramImage({
			env: env!,
			connection,
			asset,
			caption: instagram.copy
		});
	} catch (cause) {
		if (cause instanceof InstagramPublishError) error(502, cause.message);
		error(502, 'Instagram could not publish this post.');
	}
	const publishedAt = new Date().toISOString();
	const updatedPost = await posts.markChannelPublished({
		postId: post.id,
		platform: 'instagram',
		publishedAt,
		publishedUrl: result.permalink
	});
	if (!updatedPost) error(409, 'This post was changed before Instagram could be updated.');
	return json({
		post: updatedPost,
		message: `Published to Instagram${result.permalink ? ' and saved the live post link.' : '.'}`
	});
};
