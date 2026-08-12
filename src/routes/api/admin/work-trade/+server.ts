import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { MemberRepository, WorkTradeRepository } from '$lib/server/db';
import { ActivityDirectory } from '$lib/server/monday/activity';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { summarizeWorkTrade } from '$lib/work-trade/scoring';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/u;

export const GET: RequestHandler = async ({ url, locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireAdmin(context);
	const month = url.searchParams.get('month') || '';
	if (!MONTH.test(month)) error(400, 'A valid month is required.');
	return json({ discounts: await new WorkTradeRepository(platform!.env.DB).list(month) });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const action = typeof body?.action === 'string' ? body.action : '';
	const month = typeof body?.month === 'string' ? body.month : '';
	const memberId = typeof body?.memberId === 'string' ? body.memberId : '';
	if (!MONTH.test(month)) error(400, 'A valid month is required.');
	const repository = new WorkTradeRepository(env.DB);
	const now = new Date().toISOString();

	if (action === 'generate') {
		const [members, activities] = await Promise.all([
			new MemberRepository(env.DB).search('', 500),
			new ActivityDirectory(new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))).list()
		]);
		const summaries = members
			.map((member) =>
				summarizeWorkTrade(
					member,
					month,
					activities.filter((activity) => activity.memberId === member.id)
				)
			)
			.filter((summary) => summary && summary.activityCount > 0);
		await Promise.all(summaries.map((summary) => repository.upsert(summary!, now)));
		return json({
			discounts: await repository.list(month),
			message: `Generated ${summaries.length} work-trade summaries from Monday.`
		});
	}
	if (!memberId) error(400, 'A member is required.');
	let changed = false;
	if (action === 'approve')
		changed = await repository.approve(memberId, month, context.viewer.id, now);
	else if (action === 'decline')
		changed = await repository.decline(memberId, month, context.viewer.id, now);
	else if (action === 'shopify_updated')
		changed = await repository.markShopifyUpdated(memberId, month, now);
	else error(400, 'Unknown work-trade action.');
	if (!changed) error(409, 'That work-trade record has already moved to another step.');
	return json({ discounts: await repository.list(month), message: 'Work-trade status updated.' });
};
