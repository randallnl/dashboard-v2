import { FinanceReconciliationRepository, isFinanceAccountKey } from '$lib/server/db';
import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/u;

function validMonth(value: string): string {
	if (!MONTH.test(value)) error(400, 'Choose a valid reconciliation month.');
	return value;
}

function quickBooksConfigured(env: Env): boolean {
	return Boolean(env.QUICKBOOKS_RECEIPT_EMAIL?.trim());
}

export const GET: RequestHandler = async ({ url, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const month = validMonth(url.searchParams.get('month')?.trim() ?? '');
	const repository = new FinanceReconciliationRepository(env!.DB);
	await repository.ensureMonth(month);
	return json(
		{
			month,
			tasks: await repository.list(month),
			quickBooksConfigured: quickBooksConfigured(env!)
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const action = typeof body?.action === 'string' ? body.action : '';
	const month = validMonth(typeof body?.month === 'string' ? body.month.trim() : '');
	const accountKey = typeof body?.accountKey === 'string' ? body.accountKey.trim() : '';
	if (!isFinanceAccountKey(accountKey)) error(400, 'Choose a valid account.');

	const repository = new FinanceReconciliationRepository(env!.DB);
	await repository.ensureMonth(month);
	if (action === 'complete') {
		const completed = await repository.complete(
			month,
			accountKey,
			context.viewer.id,
			new Date().toISOString()
		);
		if (!completed) {
			error(
				409,
				'Upload the statement to Drive and forward it to QuickBooks before marking this reconciliation complete.'
			);
		}
	} else if (action === 'reopen') {
		await repository.reopen(month, accountKey);
	} else {
		error(400, 'Unknown finance action.');
	}

	return json({
		month,
		tasks: await repository.list(month),
		quickBooksConfigured: quickBooksConfigured(env!)
	});
};
