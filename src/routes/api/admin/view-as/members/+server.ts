import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { MemberRepository } from '$lib/server/db';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const members = await new MemberRepository(env!.DB).search('', 100);
	return json(
		{
			members: members
				.filter((member) => member.id !== context.viewer.id)
				.map(({ id, preferredName, membershipType }) => ({ id, preferredName, membershipType }))
				.sort((left, right) => left.preferredName.localeCompare(right.preferredName))
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
