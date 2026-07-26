import { loadMemberContext } from '$lib/server/auth/member-context';
import { ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { hasDuplicateVote, VoteDirectory } from '$lib/server/monday/votes';
import { communityConsentVotes } from '$lib/server/votes/eligibility';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const token = await mondayToken(env!.MONDAY_API_TOKEN);
	const directory = new VoteDirectory(new MondayClient(token));
	const [motions, logs, community] = await Promise.all([
		directory.listMotions(),
		directory.listVoteLog(),
		new ProjectEventRepository(env!.DB).list({ source: 'community' })
	]);
	const votes = [...motions, ...communityConsentVotes(community)].map((vote) => ({
		...vote,
		hasVoted: hasDuplicateVote(logs, context.viewer.id, vote)
	}));
	return json({ votes }, { headers: { 'cache-control': 'private, no-store' } });
};
