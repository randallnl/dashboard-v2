import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { MemberRepository, ProjectEventRepository, VolunteerRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { attendeeEmails, EventDirectory } from '$lib/server/monday/events';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
	const memberId = typeof body?.memberId === 'string' ? body.memberId.trim() : '';
	const role = body?.role === 'volunteer' ? 'volunteer' : 'attendee';
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
		new VolunteerRepository(env.DB).setVolunteer(
			'project',
			record.id,
			member.id,
			role === 'volunteer'
		)
	]);

	return json(
		{
			attendees: emails,
			attendee: {
				email: member.email,
				name: member.preferredName,
				memberId: member.id,
				role
			},
			message: `${member.preferredName} was added as ${role === 'volunteer' ? 'a volunteer' : 'an attendee'}, and Monday confirmed the calendar update.`
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
