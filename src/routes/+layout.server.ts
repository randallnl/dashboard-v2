import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const session = locals.session;

	return {
		session: session
			? {
					email: session.email,
					memberId: session.memberId,
					expiresAt: session.expiresAt
				}
			: null
	};
};
