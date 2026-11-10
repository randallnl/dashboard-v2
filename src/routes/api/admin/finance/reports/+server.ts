import { FinanceReportSnapshotRepository } from '$lib/server/db';
import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const snapshot = await new FinanceReportSnapshotRepository(env!.DB).latestSnapshot();
	return json(
		{
			inbox: 'finance-reports@nhsolidarityecosystem.com',
			snapshot
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
