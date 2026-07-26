import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { ProjectEventRepository, VoteRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { hasDuplicateVote, OBJECTION_RESPONSE, VoteDirectory } from '$lib/server/monday/votes';
import { communityConsentVotes } from '$lib/server/votes/eligibility';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const RESPONSES = new Set(['Approve', OBJECTION_RESPONSE, 'Abstain']);

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const voteId = typeof body?.voteId === 'string' ? body.voteId.trim() : '';
	const response = typeof body?.response === 'string' ? body.response.trim() : '';
	const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
	if (!voteId || !RESPONSES.has(response)) error(400, 'Choose a valid vote response.');
	if (response === OBJECTION_RESPONSE && !comment) {
		error(400, 'A comment is required when you do not approve.');
	}

	const token = await mondayToken(env!.MONDAY_API_TOKEN);
	const directory = new VoteDirectory(new MondayClient(token));
	const [motions, logs, community] = await Promise.all([
		directory.listMotions(),
		directory.listVoteLog(),
		new ProjectEventRepository(env!.DB).list({ source: 'community' })
	]);
	const vote = [...motions, ...communityConsentVotes(community)].find(
		(candidate) => candidate.id === voteId
	);
	if (!vote) error(404, 'This motion is no longer eligible for voting.');
	if (hasDuplicateVote(logs, context.viewer.id, vote)) {
		error(409, 'You have already voted on this motion.');
	}

	const repository = new VoteRepository(env!.DB);
	if (!(await repository.reserve(context.viewer.id, vote.id))) {
		error(409, 'You have already voted on this motion.');
	}
	try {
		const mondayItemId = await directory.recordVote(context.viewer, vote, response, comment);
		await repository.complete(context.viewer.id, vote.id, response, mondayItemId);
		return json({ ok: true, voteId: vote.id, response });
	} catch (cause) {
		await repository.release(context.viewer.id, vote.id);
		console.error(
			JSON.stringify({
				event: 'vote_submission_failed',
				memberId: context.viewer.id,
				voteId: vote.id,
				message: cause instanceof Error ? cause.message : 'Unknown error'
			})
		);
		error(502, 'Your vote could not be recorded. Please try again.');
	}
};
