import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { SocialPostRepository } from '$lib/server/db';
import { parseSocialPostInput } from '$lib/server/social/post-input';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!params.id) error(400, 'Post ID is required.');
	const body = await request.json().catch(() => null);
	const input = parseSocialPostInput(body);
	const repository = new SocialPostRepository(env!.DB);
	const previous = await repository.find(params.id);
	if (!previous) error(404, 'Social post not found.');
	const now = new Date().toISOString();
	const post = await repository.update(params.id, input, now);
	if (!post) error(404, 'Social post not found.');
	const reviewedPost =
		input.status === 'review' && previous.status !== 'review'
			? await repository.addReview(
					post.id,
					{ action: 'submitted', note: '', memberId: context.viewer.id },
					now
				)
			: post;
	return json({ post: reviewedPost ?? post, message: 'Social post updated.' });
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!params.id) error(400, 'Post ID is required.');
	const repository = new SocialPostRepository(env!.DB);
	const post = await repository.find(params.id);
	if (!post) error(404, 'Social post not found.');
	if (post.status !== 'draft') {
		error(409, 'Only drafts can be deleted.');
	}
	if (!(await repository.deleteDraft(post.id))) {
		error(409, 'This post is no longer a draft and cannot be deleted.');
	}
	const draftMediaKeys = post.assets
		.filter((asset) => asset.storage === 'r2' && asset.objectKey.startsWith(`social/${post.id}/`))
		.map((asset) => asset.objectKey);
	await Promise.all(draftMediaKeys.map((objectKey) => env!.SOCIAL_MEDIA_ASSETS.delete(objectKey)));
	return json({ message: 'Draft deleted.' });
};
