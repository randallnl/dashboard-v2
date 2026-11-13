import { error, json } from '@sveltejs/kit';
import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { RetailRepository } from '$lib/server/db/retail-repository';
import { RETAIL_INBOX, RETAIL_STEPS } from '$lib/retail/orders';
import type { RequestHandler } from './$types';

async function payload(repository: RetailRepository) {
	const [orders, token] = await Promise.all([repository.list(), repository.inbox()]);
	return json(
		{ orders, inbox: token ? RETAIL_INBOX.replace('@', `+${token}@`) : '' },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
}
export const GET: RequestHandler = async ({ locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireAdmin(context);
	requireWritableMemberView(context);
	return payload(new RetailRepository(platform!.env.DB));
};
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireAdmin(context);
	requireWritableMemberView(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object') error(400, 'Invalid request.');
	const repository = new RetailRepository(platform!.env.DB);
	if (body.action === 'inbox') await repository.enableInbox();
	else if (body.action === 'create') {
		const title = typeof body.title === 'string' ? body.title.trim() : '';
		const number =
			typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
		const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
		if (!title || title.length > 200 || !/^[A-Z0-9-]{1,80}$/u.test(number) || notes.length > 20000)
			error(400, 'Enter a title, valid Faire order number, and notes under 20,000 characters.');
		await repository.create({ title, orderNumber: number, notes });
	} else if (body.action === 'step') {
		if (
			typeof body.id !== 'string' ||
			typeof body.complete !== 'boolean' ||
			typeof body.step !== 'string' ||
			!RETAIL_STEPS.some((step) => step.id === body.step)
		)
			error(400, 'Invalid checklist update.');
		if (!(await repository.setStep(body.id, body.step, body.complete, context.viewer.id)))
			error(404, 'Order step not found.');
	} else error(400, 'Unknown retail action.');
	return payload(repository);
};
