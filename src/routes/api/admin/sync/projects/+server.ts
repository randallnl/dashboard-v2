import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { syncEventsFromMonday } from '$lib/server/events/sync';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const result = await syncEventsFromMonday(env!);
	return json({ ok: true, ...result }, { headers: { 'cache-control': 'private, no-store' } });
};
