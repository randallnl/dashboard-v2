import { loadMemberContext } from '$lib/server/auth/member-context';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const context = await loadMemberContext({
		session: locals.session,
		env: platform?.env
	});

	return json({
		member: context.member,
		capabilities: context.capabilities,
		isViewingAs: context.isViewingAs
	});
};
