import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { ProjectEventRepository, VolunteerRepository } from '$lib/server/db';
import type { ProjectEventSource } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	if (!context.capabilities.canViewCalendar) {
		error(403, 'Calendar access is not included with this membership.');
	}

	const body = (await request.json().catch(() => null)) as {
		source?: unknown;
		eventId?: unknown;
	} | null;
	const source = body?.source;
	const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
	if ((source !== 'project' && source !== 'community') || !eventId) {
		error(400, 'A valid project or event is required.');
	}

	const record = await new ProjectEventRepository(env!.DB).findById(
		source as ProjectEventSource,
		eventId
	);
	if (!record || record.adminOnly) {
		error(404, 'This project or event is not available.');
	}
	if (context.capabilities.isRetailOnly && record.source === 'community') {
		error(403, 'This event is not included with this membership.');
	}

	const created = await new VolunteerRepository(env!.DB).signup(
		record.source,
		record.id,
		context.viewer.id
	);
	return json(
		{ ok: true, created, message: created ? 'Volunteer signup recorded.' : 'Already signed up.' },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
