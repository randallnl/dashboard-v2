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
	const body = (await request.json().catch(() => null)) as { key?: unknown; keys?: unknown } | null;
	const keys = Array.isArray(body?.keys)
		? body.keys.filter((key): key is string => typeof key === 'string').map((key) => key.trim())
		: typeof body?.key === 'string'
			? [body.key.trim()]
			: [];
	const validKey = /^(?:vote|shift|project|community|opportunity):[\w-]+$/u;
	if (keys.length === 0 || keys.length > 25 || keys.some((key) => !validKey.test(key))) {
		error(400, 'A valid notification is required.');
	}
	await new NotificationRepository(platform!.env.DB).markManyRead(context.member.id, keys);
	return json({ ok: true, keys }, { headers: { 'cache-control': 'private, no-store' } });
};
