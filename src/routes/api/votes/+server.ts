import { loadMemberContext, requireVoter } from '$lib/server/auth/member-context';
import {
	EquipmentRequestRepository,
	MemberRepository,
	ProjectEventRepository
} from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { voteLogForMember, voteLogsForMotion, VoteDirectory } from '$lib/server/monday/votes';
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
	const members = await new MemberRepository(env!.DB).search('', 100);
	const memberNames = new Map(members.map((member) => [member.id, member.preferredName]));
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
			recordedComment: recorded?.comment ?? '',
			submissions: voteLogsForMotion(logs, vote).map((entry) => ({
				id: entry.id,
				memberId: entry.memberId,
				memberName:
					memberNames.get(entry.memberId) || entry.voterLabel.split('|')[0]?.trim() || 'Member',
				response: entry.response,
				comment: entry.comment
			}))
		};
	});
	return json({ votes }, { headers: { 'cache-control': 'private, no-store' } });
};
