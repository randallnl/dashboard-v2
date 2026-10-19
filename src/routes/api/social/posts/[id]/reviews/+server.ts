import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { SocialPostRepository } from '$lib/server/db';
import { parseSocialPostReview } from '$lib/server/social/post-input';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!params.id) error(400, 'Post ID is required.');
	const review = parseSocialPostReview(await request.json().catch(() => null));
	const repository = new SocialPostRepository(env!.DB);
	const now = new Date().toISOString();
	const post = await repository.addReview(
		params.id,
		{ ...review, memberId: context.viewer.id },
		now
	);
	if (!post) error(404, 'Social post not found.');

	const workflowStatus =
		review.action === 'submitted'
			? 'review'
			: review.action === 'changes_requested'
				? 'draft'
				: null;
	const updatedPost = workflowStatus
		? await repository.setWorkflowStatus(post.id, workflowStatus, now)
		: post;
	return json({ post: updatedPost ?? post, message: 'Review activity saved.' });
};
