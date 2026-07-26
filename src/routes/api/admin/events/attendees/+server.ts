import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { MemberRepository, ProjectEventRepository, VolunteerRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { attendeeEmails, EventDirectory } from '$lib/server/monday/events';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
	const memberId = typeof body?.memberId === 'string' ? body.memberId.trim() : '';
	if (!eventId || !memberId) error(400, 'A project and member are required.');

	const projects = new ProjectEventRepository(env.DB);
	const [record, member] = await Promise.all([
		projects.findById('project', eventId),
		new MemberRepository(env.DB).findById(memberId)
	]);
	if (!record) error(404, 'Project not found.');
	if (!member?.email) error(404, 'Member email not found.');

	const emails = [
		...new Set([...attendeeEmails(record.record.attendees), member.email.toLowerCase()])
	];
	await new EventDirectory(
		new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))
	).updateProjectAttendees(record.id, emails);

	await Promise.all([
		projects.upsert({
			...record,
			record: { ...record.record, attendees: emails.join(', ') },
			syncedAt: new Date().toISOString()
		}),
		new VolunteerRepository(env.DB).signup('project', record.id, member.id)
	]);

	return json(
		{
			attendees: emails,
			message: `${member.preferredName} added as an attendee.`
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
