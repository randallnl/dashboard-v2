import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import {
	completeInstagramAuthorization,
	consumeInstagramAuthorizationState,
	instagramOAuthConfigured
} from '$lib/server/social/instagram-connection';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!instagramOAuthConfigured(env!)) {
		error(503, 'Instagram connection credentials have not been configured yet.');
	}
	if (url.searchParams.get('error')) {
		throw redirect(303, '/social?instagram=declined');
	}
	const code = url.searchParams.get('code')?.trim() ?? '';
	const state = url.searchParams.get('state')?.trim() ?? '';
	if (!code || !state)
		error(400, 'Meta did not return a complete Instagram authorization response.');
	const stateMemberId = await consumeInstagramAuthorizationState(env!, state);
	if (!stateMemberId || stateMemberId !== context.viewer.id) {
		error(400, 'That Instagram authorization request has expired or is invalid.');
	}
	const result = await completeInstagramAuthorization(env!, { code, memberId: context.viewer.id });
	throw redirect(
		303,
		result.connected ? '/social?instagram=connected' : '/social?instagram=choose'
	);
};
