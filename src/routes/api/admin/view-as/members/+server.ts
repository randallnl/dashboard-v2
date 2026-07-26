import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const members = await new MemberDirectory(
		new MondayClient(await mondayToken(env!.MONDAY_API_TOKEN))
	).list();
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
