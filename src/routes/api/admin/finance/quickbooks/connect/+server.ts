import {
	createQuickBooksAuthorizationUrl,
	quickBooksOAuthConfigured
} from '$lib/server/quickbooks/finance-sync';
import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	requireAdmin(context);
	if (!quickBooksOAuthConfigured(env!)) {
		error(503, 'QuickBooks OAuth credentials have not been configured yet.');
	}
	throw redirect(302, await createQuickBooksAuthorizationUrl(env!, context.viewer.id));
};
