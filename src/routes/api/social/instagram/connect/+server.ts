import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import {
	createInstagramAuthorizationUrl,
	instagramOAuthConfigured
} from '$lib/server/social/instagram-connection';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!instagramOAuthConfigured(env!)) {
		error(503, 'Instagram connection credentials have not been configured yet.');
	}
	throw redirect(302, await createInstagramAuthorizationUrl(env!, context.viewer.id));
};
