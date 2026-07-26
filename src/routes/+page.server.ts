import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const authStatus = url.searchParams.get('auth');
	const layout = await parent();
	if (
		!layout.session ||
		!layout.viewer ||
		!layout.member ||
		!layout.capabilities ||
		!layout.viewerCapabilities
	) {
		return {
			authenticated: false as const,
			authStatus
		};
	}

	return {
		authenticated: true as const,
		viewer: layout.viewer,
		member: layout.member,
		capabilities: layout.capabilities,
		viewerCapabilities: layout.viewerCapabilities,
		isViewingAs: layout.isViewingAs
	};
};
