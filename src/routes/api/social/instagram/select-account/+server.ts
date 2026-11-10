import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { selectInstagramConnectionCandidate } from '$lib/server/social/instagram-connection';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function field(value: unknown, maximum: number): string {
	return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const selectionId = field(body?.selectionId, 100);
	const facebookPageId = field(body?.facebookPageId, 100);
	if (!selectionId || !facebookPageId) error(400, 'Choose an Instagram account to connect.');
	if (
		!(await selectInstagramConnectionCandidate(env!, {
			selectionId,
			facebookPageId,
			memberId: context.viewer.id
		}))
	) {
		error(409, 'That account choice has expired. Connect Instagram again to continue.');
	}
	return json({ message: 'Instagram account connected.' });
};
