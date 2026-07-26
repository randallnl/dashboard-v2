import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { syncShiftsFromMonday } from '$lib/server/shifts/sync';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);

	const result = await syncShiftsFromMonday(env!);

	return json({
		ok: true,
		...result
	});
};
