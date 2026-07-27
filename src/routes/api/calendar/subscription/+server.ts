import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { CalendarSubscriptionRepository } from '$lib/server/db';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function token(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replaceAll('=', '');
}

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	requireWritableMemberView(context);
	const repository = new CalendarSubscriptionRepository(platform!.env.DB);
	let value = await repository.findToken(context.member.id);
	if (!value) {
		value = token();
		await repository.save(context.member.id, value);
	}
	return json(
		{ url: `${url.origin}/api/calendar/feed/${value}.ics` },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
