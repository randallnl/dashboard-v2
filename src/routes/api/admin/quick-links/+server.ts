import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { ProjectEventRepository, QuickLinkRepository } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireProjectManager(context);
	return json({ projectIds: await new QuickLinkRepository(platform!.env.DB).listProjectIds() });
};

export const PATCH: RequestHandler = async ({ request, locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireProjectManager(context);
	const body = (await request.json().catch(() => null)) as {
		projectId?: unknown;
		included?: unknown;
	} | null;
	const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
	if (!projectId || typeof body?.included !== 'boolean') {
		error(400, 'A project and inclusion choice are required.');
	}
	const project = await new ProjectEventRepository(platform!.env.DB).findById('project', projectId);
	if (!project) error(404, 'Project not found.');
	await new QuickLinkRepository(platform!.env.DB).setProjectIncluded(projectId, body.included);
	return json({ projectId, included: body.included });
};
