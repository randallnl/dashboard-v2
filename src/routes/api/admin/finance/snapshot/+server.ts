import { QuickBooksFinanceRepository } from '$lib/server/db';
import {
	quickBooksOAuthConfigured,
	syncQuickBooksFinanceSnapshot
} from '$lib/server/quickbooks/finance-sync';
import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function publicConnection(
	connection: Awaited<ReturnType<QuickBooksFinanceRepository['connection']>>
) {
	if (!connection) return null;
	return {
		companyName: connection.companyName,
		connectedAt: connection.connectedAt,
		lastSyncedAt: connection.lastSyncedAt,
		lastSyncStatus: connection.lastSyncStatus,
		lastSyncError: connection.lastSyncError
	};
}

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const repository = new QuickBooksFinanceRepository(env!.DB);
	const [connection, snapshot] = await Promise.all([
		repository.connection(),
		repository.latestSnapshot()
	]);
	return json(
		{
			configured: quickBooksOAuthConfigured(env!),
			connection: publicConnection(connection),
			snapshot
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	requireAdmin(context);
	if (!quickBooksOAuthConfigured(env!)) {
		error(503, 'QuickBooks OAuth credentials have not been configured yet.');
	}
	try {
		const snapshot = await syncQuickBooksFinanceSnapshot(env!);
		const connection = await new QuickBooksFinanceRepository(env!.DB).connection();
		return json({
			configured: true,
			connection: publicConnection(connection),
			snapshot,
			message: 'QuickBooks account snapshot refreshed.'
		});
	} catch (cause) {
		error(502, cause instanceof Error ? cause.message : 'QuickBooks snapshot refresh failed.');
	}
};
