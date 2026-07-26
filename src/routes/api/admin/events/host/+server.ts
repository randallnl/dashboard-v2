import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { HostRepository, ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import { coveredByLabel } from '$lib/server/monday/shifts';
import type { ProjectEventSource } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const source = typeof body?.source === 'string' ? body.source : '';
	const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
	const memberId = typeof body?.memberId === 'string' ? body.memberId.trim() : '';
	if ((source !== 'project' && source !== 'community') || !eventId || !memberId) {
		error(400, 'A project or event and member are required.');
	}
	const record = await new ProjectEventRepository(env.DB).findById(
		source as ProjectEventSource,
		eventId
	);
	if (!record) error(404, 'Project or event not found.');
	const member = await new MemberDirectory(
		new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))
	).findById(memberId);
	if (!member) error(404, 'Member not found.');
	const host = await new HostRepository(env.DB).upsert(
		record.source,
		record.id,
		member.id,
		coveredByLabel(member.preferredName),
		context.viewer.id,
		new Date().toISOString()
	);
	return json({ host }, { headers: { 'cache-control': 'private, no-store' } });
};
