import { loadMemberContext } from '$lib/server/auth/member-context';
import { ActivityDirectory, summarizeActivity } from '$lib/server/monday/activity';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const directory = new ActivityDirectory(
		new MondayClient(await mondayToken(env!.MONDAY_API_TOKEN))
	);
	const activities = await directory.listForMember(context.member.id);
	return json(
		{ summary: summarizeActivity(activities), activities },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
