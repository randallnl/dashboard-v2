import { ShiftRepository } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, platform, url }) => {
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

	const shifts =
		layout.capabilities.canViewShifts && platform?.env.DB
			? await new ShiftRepository(platform.env.DB).listFromDate(
					new Date().toISOString().slice(0, 10)
				)
			: [];

	return {
		authenticated: true as const,
		viewer: layout.viewer,
		member: layout.member,
		capabilities: layout.capabilities,
		viewerCapabilities: layout.viewerCapabilities,
		isViewingAs: layout.isViewingAs,
		initialAvailableShifts: shifts.filter((shift) => !shift.isCovered)
	};
};
