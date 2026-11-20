import { error, json } from '@sveltejs/kit';
import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { RetailRepository } from '$lib/server/db/retail-repository';
import { RETAIL_STEPS } from '$lib/retail/orders';
import type { RequestHandler } from './$types';

function httpUrl(value: unknown): string {
	if (typeof value !== 'string') return '';
	try {
		const url = new URL(value.trim());
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
	} catch {
		return '';
	}
}

async function payload(repository: RetailRepository) {
	const [orders, instructions] = await Promise.all([repository.list(), repository.listInstructions()]);
	return json({ orders, instructions }, { headers: { 'cache-control': 'private, no-store' } });
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
	if (body.action === 'create') {
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
	} else if (body.action === 'instruction') {
		const instructionId =
			typeof body.instructionId === 'number' && Number.isSafeInteger(body.instructionId)
				? body.instructionId
				: undefined;
		const stepId = typeof body.step === 'string' ? body.step : '';
		const requestedUrl = typeof body.url === 'string' ? body.url.trim() : '';
		const url = requestedUrl ? httpUrl(requestedUrl) : '';
		const label = typeof body.label === 'string' ? body.label.trim() : '';
		if (!RETAIL_STEPS.some((step) => step.id === stepId)) error(400, 'Invalid retail step.');
		if ((requestedUrl && !url) || url.length > 2000 || label.length > 120)
			error(400, 'Enter a valid instruction link and a label under 120 characters.');
		await repository.setInstruction({
			id: instructionId,
			stepId,
			url,
			label,
			updatedBy: context.viewer.id
		});
	} else if (body.action === 'delete') {
		if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/iu.test(body.id))
			error(400, 'Invalid retail order.');
		if (!(await repository.remove(body.id))) error(404, 'Retail order not found.');
	} else error(400, 'Unknown retail action.');
	return payload(repository);
};
