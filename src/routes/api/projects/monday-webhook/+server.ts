import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { PROJECT_BOARD_ID } from '$lib/server/monday/events';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const WEBHOOK_CALLBACK_ORIGIN = 'https://dashboard-v2.randall-d53.workers.dev';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);

	const secret = env?.MONDAY_PROJECT_WEBHOOK_SECRET;
	if (!secret) error(503, 'Monday project webhook is not configured.');

	const callbackUrl = new URL(
		`/api/webhooks/monday/projects/${encodeURIComponent(secret)}`,
		WEBHOOK_CALLBACK_ORIGIN
	);

	return json(
		{
			callbackUrl: callbackUrl.href,
			boardId: PROJECT_BOARD_ID,
			event: 'create_item',
			instructions:
				'In Monday, add a board webhook or automation for item creation and use callbackUrl as its destination.'
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
