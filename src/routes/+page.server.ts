import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const authStatus = url.searchParams.get('auth');
	const layout = await parent();
	if (!layout.session || !layout.member || !layout.capabilities) {
		return {
			authenticated: false as const,
			authStatus
		};
	}

	return {
		authenticated: true as const,
		member: layout.member,
		capabilities: layout.capabilities
	};
};
