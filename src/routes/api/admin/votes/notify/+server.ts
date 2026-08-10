import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { notifyNewVotes } from '$lib/server/discord/vote-notifier';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	requireAdmin(context);

	const result = await notifyNewVotes(env!, Date.now());
	const message = result.failed
		? `Sent ${result.posted} notification${result.posted === 1 ? '' : 's'}; ${result.failed} failed.`
		: result.posted
			? `Sent ${result.posted} new vote notification${result.posted === 1 ? '' : 's'} to Discord.`
			: 'No new vote notifications needed to be sent.';

	return json({ ...result, message }, { headers: { 'cache-control': 'private, no-store' } });
};
