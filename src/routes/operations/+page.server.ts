import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const layout = await parent();
	if (!layout.session || !layout.member || !layout.viewerCapabilities) {
		error(401, 'Authentication required');
	}
	if (layout.isViewingAs || !layout.viewerCapabilities.isAdmin) {
		error(403, 'Operations access required');
	}

	return {
		member: layout.member,
		capabilities: layout.capabilities,
		viewerCapabilities: layout.viewerCapabilities
	};
};
