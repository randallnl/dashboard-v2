import { loadMemberContext, requireVoter } from '$lib/server/auth/member-context';
import { EquipmentRequestRepository, ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { voteLogForMember, VoteDirectory } from '$lib/server/monday/votes';
import { communityConsentVotes, equipmentConsentVotes } from '$lib/server/votes/eligibility';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireVoter(context);
	const token = await mondayToken(env!.MONDAY_API_TOKEN);
	const directory = new VoteDirectory(new MondayClient(token));
	const [motions, logs, community, equipment] = await Promise.all([
		directory.listMotions(),
		directory.listVoteLog(),
		new ProjectEventRepository(env!.DB).list({ source: 'community' }),
		new EquipmentRequestRepository(env!.DB).list()
	]);
	const votes = [
		...motions,
		...communityConsentVotes(community),
		...equipmentConsentVotes(equipment)
	].map((vote) => {
		const recorded = voteLogForMember(logs, context.member.id, vote);
		return {
			...vote,
			hasVoted: Boolean(recorded),
			recordedResponse: recorded?.response ?? '',
			recordedComment: recorded?.comment ?? ''
		};
	});
	return json({ votes }, { headers: { 'cache-control': 'private, no-store' } });
};
