import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { CommentRepository, MemberRepository, ProjectEventRepository } from '$lib/server/db';
import { coveredByLabel } from '$lib/server/monday/shifts';
import type { MemberContext } from '$lib/server/auth/member-context';
import type { ProjectEventRecord, ProjectEventSource } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function requestedRecord(
	env: Env,
	context: MemberContext,
	source: string,
	eventId: string
): Promise<ProjectEventRecord> {
	if ((source !== 'project' && source !== 'community') || !eventId) {
		error(400, 'A valid project or event is required.');
	}
	const record = await new ProjectEventRepository(env.DB).findById(
		source as ProjectEventSource,
		eventId
	);
	if (
		!record ||
		(record.adminOnly &&
			!context.viewerCapabilities.isAdmin &&
			!(record.source === 'project' && context.viewerCapabilities.canManageProjects))
	) {
		error(404, 'Project or event not found.');
	}
	if (context.capabilities.isRetailOnly && record.source === 'community') {
		error(403, 'This event is not included with this membership.');
	}
	return record;
}

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const record = await requestedRecord(
		env,
		context,
		url.searchParams.get('source') ?? '',
		url.searchParams.get('eventId')?.trim() ?? ''
	);
	const comments = await new CommentRepository(env.DB).list(record.source, record.id);
	return json({ comments }, { headers: { 'cache-control': 'private, no-store' } });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	const body = (await request.json().catch(() => null)) as {
		source?: unknown;
		eventId?: unknown;
		body?: unknown;
		mentionIds?: unknown;
	} | null;
	const source = typeof body?.source === 'string' ? body.source : '';
	const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
	const commentBody = typeof body?.body === 'string' ? body.body.trim() : '';
	if (!commentBody || commentBody.length > 2000) {
		error(400, 'Comment must be between 1 and 2,000 characters.');
	}
	const record = await requestedRecord(env, context, source, eventId);
	const requestedMentionIds = Array.isArray(body?.mentionIds)
		? body.mentionIds.filter((id): id is string => typeof id === 'string')
		: [];
	const members = requestedMentionIds.length
		? await new MemberRepository(env.DB).search('', 100)
		: [];
	const membersById = new Map(members.map((member) => [member.id, member]));
	const mentionLabels = [
		...new Set(
			requestedMentionIds
				.map((id) => membersById.get(id))
				.filter((member) => member !== undefined)
				.map((member) => coveredByLabel(member.preferredName))
		)
	];
	const comment = await new CommentRepository(env.DB).create({
		id: crypto.randomUUID(),
		source: record.source,
		eventId: record.id,
		memberId: context.viewer.id,
		authorLabel: coveredByLabel(context.viewer.preferredName),
		body: commentBody,
		mentionLabels,
		createdAt: new Date().toISOString()
	});
	return json({ comment }, { status: 201, headers: { 'cache-control': 'private, no-store' } });
};
