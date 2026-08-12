import { loadMemberContext } from '$lib/server/auth/member-context';
import { WorkTradeRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { paymentsForEmails, TransactionDirectory } from '$lib/server/monday/transactions';
import { json } from '@sveltejs/kit';
import { mergeMembershipTransactions } from '$lib/work-trade/payments';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const directory = new TransactionDirectory(
		new MondayClient(await mondayToken(env!.MONDAY_API_TOKEN))
	);
	const shopifyPayments = paymentsForEmails(await directory.list(), [
		context.member.email,
		...context.member.otherEmails
	]);
	const discounts = await new WorkTradeRepository(env!.DB).listOptedInForMember(context.member.id);
	const payments = mergeMembershipTransactions(shopifyPayments, discounts, context.member.email);
	return json({ payments }, { headers: { 'cache-control': 'private, no-store' } });
};
