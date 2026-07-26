import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { ProjectEventRepository } from '$lib/server/db';
import type { ProjectEventSource } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const source = url.searchParams.get('source')?.trim() ?? '';
	const id = url.searchParams.get('id')?.trim() ?? '';
	if ((source !== 'project' && source !== 'community') || !id) {
		error(400, 'A valid source and record ID are required.');
	}
	const record = await new ProjectEventRepository(env!.DB).findById(
		source as ProjectEventSource,
		id
	);
	if (!record) error(404, 'Project or event not found.');
	return json({ record }, { headers: { 'cache-control': 'private, no-store' } });
};
