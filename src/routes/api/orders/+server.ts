import { loadMemberContext } from '$lib/server/auth/member-context';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import {
	openOrders,
	SHOPIFY_ADMIN_URL,
	TransactionDirectory
} from '$lib/server/monday/transactions';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	if (!context.capabilities.canViewOpenOrders) {
		return json(
			{ orders: [], shopifyAdminUrl: '' },
			{ headers: { 'cache-control': 'private, no-store' } }
		);
	}
	const directory = new TransactionDirectory(
		new MondayClient(await mondayToken(env!.MONDAY_API_TOKEN))
	);
	const orders = openOrders(await directory.list());
	return json(
		{ orders, shopifyAdminUrl: SHOPIFY_ADMIN_URL },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
