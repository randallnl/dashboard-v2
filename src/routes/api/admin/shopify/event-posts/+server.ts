import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { ProjectEventRepository, ShopifyEventPostRepository } from '$lib/server/db';
import {
	publishShopifyEventPost,
	ShopifyEventPostError
} from '$lib/server/shopify/event-posts';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireProjectManager(context);
	const body = (await request.json().catch(() => null)) as { projectId?: unknown } | null;
	const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
	if (!projectId) error(400, 'A project is required.');

	const db = platform!.env.DB;
	const project = await new ProjectEventRepository(db).findById('project', projectId);
	if (!project) error(404, 'Project not found.');

	const posts = new ShopifyEventPostRepository(db);
	try {
		const post = await publishShopifyEventPost({
			env: platform!.env,
			event: project,
			existing: await posts.findByProjectId(project.id),
			memberId: context.member!.id
		});
		await posts.save(post);
		return json({
			post,
			message: `Event post ${post.createdAt === post.updatedAt ? 'created' : 'updated'} in Shopify.`
		});
	} catch (cause) {
		if (cause instanceof ShopifyEventPostError) error(400, cause.message);
		throw cause;
	}
};
