import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.session) {
		return json({ authenticated: false });
	}

	return json({
		authenticated: true,
		memberId: locals.session.memberId,
		viewedMemberId: locals.session.viewedMemberId,
		email: locals.session.email,
		expiresAt: locals.session.expiresAt
	});
};
