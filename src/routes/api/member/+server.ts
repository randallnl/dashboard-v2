import { loadMemberContext } from '$lib/server/auth/member-context';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const context = await loadMemberContext({
		session: locals.session,
		env: platform?.env,
		requestedMemberId: url.searchParams.get('memberId')
	});

	return json({
		member: context.member,
		capabilities: context.capabilities,
		isViewingAs: context.isViewingAs
	});
};
