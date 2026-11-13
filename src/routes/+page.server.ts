import {
	FinanceReconciliationRepository,
	FinanceReportSnapshotRepository,
	HostRepository,
	ProjectActivityRepository,
	ProjectEventRepository,
	ShiftRepository,
	VolunteerRepository
} from '$lib/server/db';
import { upcomingAssignments } from '$lib/upcoming/assignments';
import type { DashboardActivity, ProjectEventRecord, UpcomingProjectAssignment } from '$lib/types/domain';
import type { PageServerLoad } from './$types';

type AdminOverview = {
	activeProjects: number;
	highPriorityProjects: number;
	upcomingEvents: number;
	openShifts: number;
	outstandingReconciliations: number;
	financeSnapshotUpdatedAt: string;
};

function isCompletedStatus(status: string): boolean {
	return /^(?:complete|completed|done|cancelled)$/iu.test(status.trim());
}

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
	const lockboxCode =
		layout.capabilities.canViewLockboxCode && platform?.env.LOCKBOX_CODE
			? await platform.env.LOCKBOX_CODE.get()
			: '';
	const shifts =
		layout.capabilities.canViewShifts && db
			? await new ShiftRepository(db).listFromDate(today)
			: [];
	let upcomingProjects: UpcomingProjectAssignment[] = [];
	let upcomingCoLabEvents: ProjectEventRecord[] = [];
	let adminOverview: AdminOverview | null = null;
	let adminActivity: DashboardActivity[] = [];
	if (layout.capabilities.canViewCalendar && db) {
		const [records, hostKeys, volunteerKeys, participantKeys] = await Promise.all([
			new ProjectEventRepository(db).list({
				fromDate: today,
				includeAdminOnly:
					layout.viewerCapabilities.isAdmin || layout.viewerCapabilities.canManageProjects
			}),
			new HostRepository(db).listKeysForMember(layout.member.id),
			new VolunteerRepository(db).listKeysForMember(layout.member.id),
			new VolunteerRepository(db).listParticipantKeysForMember(layout.member.id)
		]);
		upcomingProjects = upcomingAssignments(
			records.filter(
				(record) => !(layout.capabilities.isRetailOnly && record.source === 'community')
			),
			[layout.member.email, ...layout.member.otherEmails],
			hostKeys,
			volunteerKeys,
			[layout.member.preferredName],
			Number.POSITIVE_INFINITY,
			participantKeys
		);
		upcomingCoLabEvents = records.filter((record) => {
			const haystack = [
				record.location,
				record.title,
				typeof record.record.description === 'string' ? record.record.description : ''
			]
				.join(' ')
				.toLocaleLowerCase('en-US');
			return haystack.includes('colab');
		});

		if (layout.viewerCapabilities.isAdmin && !layout.isViewingAs) {
			const reconciliation = new FinanceReconciliationRepository(db);
			await reconciliation.ensureMonth(today.slice(0, 7));
			const [allRecords, financeTasks, financeSnapshot, recentActivity] = await Promise.all([
				new ProjectEventRepository(db).list({ includeAdminOnly: true }),
				reconciliation.list(today.slice(0, 7)),
				new FinanceReportSnapshotRepository(db).latestSnapshot(),
				new ProjectActivityRepository(db).listRecent()
			]);
			adminActivity = recentActivity;
			const activeProjects = allRecords.filter(
				(record) => record.source === 'project' && !isCompletedStatus(record.status)
			);
			adminOverview = {
				activeProjects: activeProjects.length,
				highPriorityProjects: activeProjects.filter((record) =>
					String(record.record.priority ?? '')
						.toLocaleLowerCase('en-US')
						.includes('high')
				).length,
				upcomingEvents: records.filter((record) => record.source === 'community').length,
				openShifts: shifts.filter((shift) => !shift.isCovered).length,
				outstandingReconciliations: financeTasks.filter((task) => task.status === 'outstanding')
					.length,
				financeSnapshotUpdatedAt: financeSnapshot?.sourceUpdatedAt ?? ''
			};
		}
	}

	return {
		authenticated: true as const,
		viewer: layout.viewer,
		member: layout.member,
		capabilities: layout.capabilities,
		viewerCapabilities: layout.viewerCapabilities,
		isViewingAs: layout.isViewingAs,
		dashboardDate: today,
		lockboxCode,
		initialAvailableShifts: shifts.filter((shift) => !shift.isCovered),
		upcomingMemberShifts: shifts.filter((shift) => shift.memberId === layout.member.id).slice(0, 6),
		upcomingProjects,
		upcomingCoLabEvents,
		adminOverview,
		adminActivity
	};
};
