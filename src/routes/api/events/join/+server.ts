import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { attendeeEmails, EventDirectory } from '$lib/server/monday/events';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	if (!context.capabilities.canViewCalendar) {
		error(403, 'Calendar access is not included with this membership.');
	}

	const body = (await request.json().catch(() => null)) as { eventId?: unknown } | null;
	const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
	if (!eventId) error(400, 'A project is required.');

	const projects = new ProjectEventRepository(env.DB);
	const record = await projects.findById('project', eventId);
	if (!record || record.adminOnly) error(404, 'This project is not available.');
	if (!context.viewer.email) error(400, 'Your member record needs an email before you can join.');

	const email = context.viewer.email.toLocaleLowerCase('en-US');
	const emails = [...new Set([...attendeeEmails(record.record.attendees), email])];
	await new EventDirectory(
		new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))
	).updateProjectAttendees(record.id, emails);
	await projects.upsert({
		...record,
		record: { ...record.record, attendees: emails.join(', ') },
		syncedAt: new Date().toISOString()
	});

	return json(
		{
			attendees: emails,
			attendee: {
				email: context.viewer.email,
				name: context.viewer.preferredName,
				memberId: context.viewer.id,
				role: 'attendee'
			},
			message: 'You were added to the project, and Monday confirmed the calendar update.'
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
