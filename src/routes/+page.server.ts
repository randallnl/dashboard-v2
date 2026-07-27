import {
	HostRepository,
	ProjectEventRepository,
	ShiftRepository,
	VolunteerRepository
} from '$lib/server/db';
import { upcomingAssignments } from '$lib/upcoming/assignments';
import type { UpcomingProjectAssignment } from '$lib/types/domain';
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

	const today = new Date().toISOString().slice(0, 10);
	const db = platform?.env.DB;
	const shifts =
		layout.capabilities.canViewShifts && db
			? await new ShiftRepository(db).listFromDate(today)
			: [];
	let upcomingProjects: UpcomingProjectAssignment[] = [];
	if (layout.capabilities.canViewCalendar && db) {
		const [records, hostKeys, volunteerKeys] = await Promise.all([
			new ProjectEventRepository(db).list({
				fromDate: today,
				includeAdminOnly:
					layout.viewerCapabilities.isAdmin || layout.viewerCapabilities.canManageProjects
			}),
			new HostRepository(db).listKeysForMember(layout.member.id),
			new VolunteerRepository(db).listKeysForMember(layout.member.id)
		]);
		upcomingProjects = upcomingAssignments(
			records.filter(
				(record) => !(layout.capabilities.isRetailOnly && record.source === 'community')
			),
			[layout.member.email, ...layout.member.otherEmails],
			hostKeys,
			volunteerKeys
		);
	}

	return {
		authenticated: true as const,
		viewer: layout.viewer,
		member: layout.member,
		capabilities: layout.capabilities,
		viewerCapabilities: layout.viewerCapabilities,
		isViewingAs: layout.isViewingAs,
		initialAvailableShifts: shifts.filter((shift) => !shift.isCovered),
		upcomingMemberShifts: shifts.filter((shift) => shift.memberId === layout.member.id).slice(0, 6),
		upcomingProjects
	};
};
