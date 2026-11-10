import {
	completeQuickBooksAuthorization,
	consumeQuickBooksAuthorizationState,
	quickBooksOAuthConfigured
} from '$lib/server/quickbooks/finance-sync';
import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	requireAdmin(context);
	if (!quickBooksOAuthConfigured(env!)) {
		error(503, 'QuickBooks OAuth credentials have not been configured yet.');
	}
	if (url.searchParams.get('error')) {
		throw redirect(303, '/operations?quickbooks=declined');
	}
	const code = url.searchParams.get('code')?.trim() ?? '';
	const state = url.searchParams.get('state')?.trim() ?? '';
	const realmId = url.searchParams.get('realmId')?.trim() ?? '';
	if (!code || !state || !realmId)
		error(400, 'QuickBooks did not return a complete authorization response.');
	const stateMemberId = await consumeQuickBooksAuthorizationState(env!, state);
	if (!stateMemberId || stateMemberId !== context.viewer.id) {
		error(400, 'That QuickBooks authorization request has expired or is invalid.');
	}
	await completeQuickBooksAuthorization(env!, { code, realmId, memberId: context.viewer.id });
	throw redirect(303, '/operations?quickbooks=connected');
};
