import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.session) {
		error(401, 'Authentication required');
	}

	const env = platform?.env;
	if (!env) {
		error(503, 'Member service unavailable');
	}

	const token = await mondayToken(env.MONDAY_API_TOKEN);
	const member = await new MemberDirectory(new MondayClient(token)).findById(
		locals.session.memberId
	);
	if (!member) {
		error(404, 'Member not found');
	}

	return json({ member });
};
