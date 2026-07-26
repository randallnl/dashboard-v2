import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { AuthRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as { memberId?: unknown } | null;
	const memberId = typeof body?.memberId === 'string' ? body.memberId.trim() : '';
	if (!memberId || memberId === context.viewer.id) {
		error(400, 'Choose another member to view.');
	}
	const target = await new MemberDirectory(
		new MondayClient(await mondayToken(env!.MONDAY_API_TOKEN))
	).findById(memberId);
	if (!target) error(404, 'Member not found.');
	const updated = await new AuthRepository(env!.DB).setViewedMember(
		locals.session!.sessionHash,
		target.id
	);
	if (!updated) error(409, 'Your session could not be updated.');
	return json({ ok: true, member: target }, { headers: { 'cache-control': 'private, no-store' } });
};

export const DELETE: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const updated = await new AuthRepository(env!.DB).setViewedMember(
		locals.session!.sessionHash,
		''
	);
	if (!updated) error(409, 'Your session could not be updated.');
	return json({ ok: true }, { headers: { 'cache-control': 'private, no-store' } });
};
