import { loadMemberContext } from '$lib/server/auth/member-context';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import { coveredByLabel } from '$lib/server/monday/shifts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const members = await new MemberDirectory(
		new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))
	).list();
	return json(
		{
			members: members
				.filter((member) => member.id !== context.member.id)
				.map((member) => ({ id: member.id, label: coveredByLabel(member.preferredName) }))
				.sort((left, right) => left.label.localeCompare(right.label))
		},
		{ headers: { 'cache-control': 'private, max-age=300' } }
	);
};
