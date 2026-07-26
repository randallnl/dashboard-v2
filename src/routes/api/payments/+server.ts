import { loadMemberContext } from '$lib/server/auth/member-context';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { paymentsForEmails, TransactionDirectory } from '$lib/server/monday/transactions';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const directory = new TransactionDirectory(
		new MondayClient(await mondayToken(env!.MONDAY_API_TOKEN))
	);
	const payments = paymentsForEmails(await directory.list(), [
		context.member.email,
		...context.member.otherEmails
	]);
	return json({ payments }, { headers: { 'cache-control': 'private, no-store' } });
};
