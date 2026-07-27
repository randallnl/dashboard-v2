import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { NotificationRepository } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	const readKeys = await new NotificationRepository(platform!.env.DB).listReadKeys(
		context.member.id
	);
	return json({ readKeys }, { headers: { 'cache-control': 'private, no-store' } });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireWritableMemberView(context);
	const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
	const key = typeof body?.key === 'string' ? body.key.trim() : '';
	if (!/^(?:vote|shift|project|community|opportunity):[\w-]+$/u.test(key)) {
		error(400, 'A valid notification is required.');
	}
	await new NotificationRepository(platform!.env.DB).markRead(context.member.id, key);
	return json({ ok: true, key }, { headers: { 'cache-control': 'private, no-store' } });
};
