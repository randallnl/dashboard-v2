import {
	loadMemberContext,
	requireAdmin,
	requireProjectManager
} from '$lib/server/auth/member-context';
import { ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EventDirectory, type ProjectEventUpdate } from '$lib/server/monday/events';
import type { ProjectEventSource } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const source = body?.source === 'project' || body?.source === 'community' ? body.source : null;
	const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
	if (!source || !eventId) error(400, 'A valid project or event is required.');
	if (source === 'project') requireProjectManager(context);
	else requireAdmin(context);

	const repository = new ProjectEventRepository(env.DB);
	const existing = await repository.findById(source, eventId);
	if (!existing) error(404, 'Project or event not found.');

	const update: ProjectEventUpdate = {
		title: typeof body?.title === 'string' ? body.title.trim() : '',
		dateValue: typeof body?.dateValue === 'string' ? body.dateValue.trim() : '',
		endDateValue: typeof body?.endDateValue === 'string' ? body.endDateValue.trim() : '',
		status: typeof body?.status === 'string' ? body.status.trim() : '',
		location: typeof body?.location === 'string' ? body.location.trim() : '',
		description: typeof body?.description === 'string' ? body.description.trim() : ''
	};
	if (
		!update.title ||
		update.title.length > 255 ||
		!DATE.test(update.dateValue) ||
		(update.endDateValue && !DATE.test(update.endDateValue)) ||
		update.description.length > 10_000
	) {
		error(400, 'Enter a title, valid dates, and a description under 10,000 characters.');
	}
	if (update.endDateValue && update.endDateValue < update.dateValue) {
		error(400, 'The end date cannot be before the start date.');
	}

	await new EventDirectory(new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))).update(
		source as ProjectEventSource,
		eventId,
		update
	);
	const record = {
		...existing,
		title: update.title,
		dateValue: update.dateValue,
		endDateValue: source === 'project' ? update.endDateValue : '',
		status: update.status,
		location: source === 'project' ? update.location : existing.location,
		record: { ...existing.record, description: update.description },
		syncedAt: new Date().toISOString()
	};
	await repository.upsert(record);
	return json(
		{ record, message: 'Project or event updated in Monday.' },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
