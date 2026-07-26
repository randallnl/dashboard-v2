import { loadMemberContext } from '$lib/server/auth/member-context';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const session = locals.session;
	if (!session) {
		return {
			session: null,
			member: null,
			capabilities: null
		};
	}

	try {
		const context = await loadMemberContext({ session, env: platform?.env });
		return {
			session: {
				email: session.email,
				memberId: session.memberId,
				viewedMemberId: session.viewedMemberId,
				expiresAt: session.expiresAt
			},
			viewer: context.viewer,
			member: context.member,
			capabilities: context.capabilities,
			viewerCapabilities: context.viewerCapabilities,
			isViewingAs: context.isViewingAs
		};
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
		console.error(
			JSON.stringify({
				event: 'member_context_load_failed',
				message: cause instanceof Error ? cause.message : 'Unknown error'
			})
		);
		error(503, 'We could not load your membership right now. Please try again shortly.');
	}
};
