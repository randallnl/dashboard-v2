import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { SocialPlatformConnectionRepository } from '$lib/server/db';
import { instagramOAuthConfigured } from '$lib/server/social/instagram-connection';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const repository = new SocialPlatformConnectionRepository(env!.DB);
	const [connection, candidates] = await Promise.all([
		repository.connection(),
		repository.listInstagramCandidates(context.viewer.id, new Date().toISOString())
	]);
	return json(
		{
			configured: instagramOAuthConfigured(env!),
			connection: connection
				? {
						instagramUsername: connection.instagramUsername,
						connectionSourceName: connection.connectionSourceName,
						connectedAt: connection.connectedAt,
						updatedAt: connection.updatedAt,
						lastVerifiedAt: connection.lastVerifiedAt,
						lastError: connection.lastError
					}
				: null,
			candidates: candidates.map((candidate) => ({
				selectionId: candidate.selectionId,
				accountId: candidate.accountId,
				accountLabel: candidate.accountLabel,
				instagramUsername: candidate.instagramUsername
			}))
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
