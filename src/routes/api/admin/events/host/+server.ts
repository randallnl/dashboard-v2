import {
	loadMemberContext,
	requireAdmin,
	requireProjectManager
} from '$lib/server/auth/member-context';
import {
	HostRepository,
	MemberRepository,
	ProjectEventRepository,
	VolunteerRepository
} from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { attendeeEmails, EventDirectory } from '$lib/server/monday/events';
import { coveredByLabel } from '$lib/server/monday/shifts';
import type { ProjectEventSource } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const source = typeof body?.source === 'string' ? body.source : '';
	const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
	const memberId = typeof body?.memberId === 'string' ? body.memberId.trim() : '';
	if ((source !== 'project' && source !== 'community') || !eventId || !memberId) {
		error(400, 'A project or event and member are required.');
	}
	if (source === 'project') requireProjectManager(context);
	else requireAdmin(context);
	const projects = new ProjectEventRepository(env.DB);
	const record = await projects.findById(source as ProjectEventSource, eventId);
	if (!record) error(404, 'Project or event not found.');
	const member = await new MemberRepository(env.DB).findById(memberId);
	if (!member) error(404, 'Member not found.');
	const updatedAt = new Date().toISOString();

	if (record.source === 'project' && member.email) {
		const emails = [
			...new Set([
				...attendeeEmails(record.record.attendees),
				member.email.trim().toLocaleLowerCase('en-US')
			])
		];
		await new EventDirectory(
			new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))
		).updateProjectAttendees(record.id, emails);
		await Promise.all([
			projects.upsert({
				...record,
				record: { ...record.record, attendees: emails.join(', ') },
				syncedAt: updatedAt
			}),
			new VolunteerRepository(env.DB).signup('project', record.id, member.id)
		]);
	}

	const host = await new HostRepository(env.DB).upsert(
		record.source,
		record.id,
		member.id,
		coveredByLabel(member.preferredName),
		context.viewer.id,
		updatedAt
	);
	return json(
		{
			host,
			hostContact: {
				email: member.email,
				phone: member.phone,
				name: member.preferredName
			},
			attendee:
				record.source === 'project' && member.email
					? { email: member.email, name: member.preferredName, memberId: member.id }
					: null,
			message:
				record.source === 'project'
					? `${host.hostLabel} assigned as host, added to attendees, and confirmed by Monday.`
					: `${host.hostLabel} assigned as host. Monday confirmed the update.`
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
