import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { ProjectEmailLinkRepository, ProjectEventRepository } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function removeRequest(value: unknown): { projectId: string; url: string } {
	if (!value || typeof value !== 'object') error(400, 'Choose a valid email link.');
	const input = value as { projectId?: unknown; url?: unknown };
	const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : '';
	const url = typeof input.url === 'string' ? input.url.trim() : '';
	if (!/^\d+$/u.test(projectId)) error(400, 'Choose a valid project.');
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Invalid URL');
	} catch {
		error(400, 'Choose a valid email link.');
	}
	return { projectId, url };
}

export const DELETE: RequestHandler = async ({ request, locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireProjectManager(context);
	const { projectId, url } = removeRequest(await request.json().catch(() => null));
	const project = await new ProjectEventRepository(platform!.env.DB).findById('project', projectId);
	if (!project) error(404, 'Project not found.');
	const removed = await new ProjectEmailLinkRepository(platform!.env.DB).remove(
		projectId,
		url,
		new Date().toISOString()
	);
	return json({
		removed,
		message: removed ? 'Email link removed.' : 'Email link was already removed.'
	});
};
