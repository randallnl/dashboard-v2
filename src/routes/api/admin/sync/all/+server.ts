import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { syncEventsFromMonday } from '$lib/server/events/sync';
import { syncGivebutterFromMonday } from '$lib/server/givebutter/sync';
import { syncMembersFromMonday } from '$lib/server/members/sync';
import { syncShiftsFromMonday } from '$lib/server/shifts/sync';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);

	const jobs = await Promise.allSettled([
		syncMembersFromMonday(env!),
		syncShiftsFromMonday(env!),
		syncEventsFromMonday(env!),
		syncGivebutterFromMonday(env!)
	]);
	const names = ['members', 'shifts', 'projects', 'givebutter'] as const;
	const results: Record<string, unknown> = {};
	const failures: string[] = [];

	jobs.forEach((job, index) => {
		const name = names[index]!;
		if (job.status === 'fulfilled') {
			results[name] = job.value;
		} else {
			failures.push(name);
			results[name] = {
				error: job.reason instanceof Error ? job.reason.message : 'Sync failed'
			};
		}
	});

	return json(
		{
			ok: failures.length === 0,
			results,
			failures,
			message: failures.length
				? `Sync completed with errors in: ${failures.join(', ')}.`
				: 'D1 sync completed successfully.'
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
