import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { WorkTradeRepository } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function previousMonth(): string {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
		.toISOString()
		.slice(0, 7);
}

export const GET: RequestHandler = async ({ url, locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	const month = /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(url.searchParams.get('month') || '')
		? url.searchParams.get('month')!
		: previousMonth();
	const repository = new WorkTradeRepository(platform!.env.DB);
	const [discount, generation] = await Promise.all([
		repository.find(context.member.id, month),
		repository.findGeneration(month)
	]);
	return json(
		{ month, discount, generation },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireWritableMemberView(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const month = typeof body?.month === 'string' ? body.month : '';
	if (!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(month)) error(400, 'A valid month is required.');
	const repository = new WorkTradeRepository(platform!.env.DB);
	if (!(await repository.optIn(context.member.id, month, new Date().toISOString()))) {
		error(409, 'This discount is not currently approved for opt-in.');
	}
	return json({
		discount: await repository.find(context.member.id, month),
		message: 'You opted in. An admin can now update your Shopify subscription.'
	});
};
