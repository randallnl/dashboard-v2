import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	const authStatus = url.searchParams.get('auth');
	if (!locals.session) {
		return {
			authenticated: false as const,
			authStatus
		};
	}

	const env = platform?.env;
	if (!env) {
		error(503, 'The member service is not available.');
	}

	try {
		const token = await mondayToken(env.MONDAY_API_TOKEN);
		const member = await new MemberDirectory(new MondayClient(token)).findById(
			locals.session.memberId
		);

		if (!member) {
			error(403, 'Your CoLab membership could not be confirmed.');
		}

		return {
			authenticated: true as const,
			member
		};
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
		console.error(
			JSON.stringify({
				event: 'member_load_failed',
				message: cause instanceof Error ? cause.message : 'Unknown error'
			})
		);
		error(503, 'We could not load your membership right now. Please try again shortly.');
	}
};
