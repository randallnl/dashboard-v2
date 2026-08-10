import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { notifyNewVotes, notifySpecificVote } from '$lib/server/discord/vote-notifier';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as { voteId?: unknown } | null;
	const voteId = typeof body?.voteId === 'string' ? body.voteId.trim() : '';
	if (body?.voteId !== undefined && !voteId) error(400, 'A motion is required.');
	if (voteId) {
		const vote = await notifySpecificVote(env!, voteId);
		return json(
			{
				posted: 1,
				failed: 0,
				message: `“${vote.question}” was sent to Discord, even if it was previously announced.`
			},
			{ headers: { 'cache-control': 'private, no-store' } }
		);
	}

	const result = await notifyNewVotes(env!, Date.now());
	const message = result.failed
		? `Sent ${result.posted} notification${result.posted === 1 ? '' : 's'}; ${result.failed} failed.`
		: result.posted
			? `Sent ${result.posted} new vote notification${result.posted === 1 ? '' : 's'} to Discord.`
			: 'No new vote notifications needed to be sent.';

	return json({ ...result, message }, { headers: { 'cache-control': 'private, no-store' } });
};
