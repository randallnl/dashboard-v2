import type {
	MemberOnboardingProject,
	MemberOnboardingRepository
} from '$lib/server/db/member-onboarding-repository';
import type { EventDirectory } from '$lib/server/monday/events';
import type { Member } from '$lib/types/domain';

const PROCESSING_LEASE_MS = 10 * 60 * 1000;

export type OnboardingTask = {
	key: string;
	title: string;
	dueAfterDays: number;
};

export const ONBOARDING_TASKS: OnboardingTask[] = [
	{
		key: 'verify-intake',
		title: 'Confirm the new member form and preferred dashboard email',
		dueAfterDays: 0
	},
	{
		key: 'dashboard-access',
		title: 'Confirm member dashboard access has been created',
		dueAfterDays: 0
	},
	{
		key: 'access-message',
		title: 'Send dashboard login and access-confirmation message',
		dueAfterDays: 1
	},
	{
		key: 'first-visit',
		title: 'Review first-visit, lockbox, kiosk, key-return, and space-reset instructions',
		dueAfterDays: 2
	},
	{
		key: 'retail-setup',
		title: 'Confirm retail interest and send vendor portal setup when applicable',
		dueAfterDays: 3
	},
	{
		key: 'first-week-follow-up',
		title: 'Complete first-week follow-up and resolve access questions',
		dueAfterDays: 7
	}
];

type OnboardingDirectory = Pick<EventDirectory, 'createOnboardingProject' | 'createProjectTask'>;
type OnboardingStore = Pick<
	MemberOnboardingRepository,
	| 'reserve'
	| 'listPending'
	| 'claim'
	| 'setProject'
	| 'checkpointTask'
	| 'complete'
	| 'recordFailure'
>;

function dateAfter(startDate: string, days: number): string {
	const date = new Date(`${startDate}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function projectDescription(member: Member): string {
	return [
		`New CoLab member onboarding for ${member.preferredName}${member.email ? ` (${member.email})` : ''}.`,
		'',
		'Use this project to confirm dashboard and space access, first-visit readiness, retail interest, and the first-week follow-up.',
		'',
		'New member form: https://wkf.ms/4wzu218',
		'Member dashboard: https://dashboard.queerlective.com/',
		'Retail vendor portal: https://portal.queerlective.com/userAuth/v2/queerlective/vendor/vendor',
		'General support: team@queerlective.com',
		'Retail support: Randall@queerlective.com',
		'',
		'Use the dashboard as the source of truth for current hours, staffing, access guidance, and the lockbox code.'
	].join('\n');
}

async function processOnboarding(
	member: Member,
	checkpoint: MemberOnboardingProject,
	directory: OnboardingDirectory,
	store: OnboardingStore,
	now: Date
): Promise<'completed' | 'failed' | 'skipped'> {
	const updatedAt = now.toISOString();
	const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS).toISOString();
	if (!(await store.claim(member.id, updatedAt, staleBefore))) return 'skipped';

	try {
		const startDate = updatedAt.slice(0, 10);
		let projectId = checkpoint.projectId;
		if (!projectId) {
			const project = await directory.createOnboardingProject({
				memberName: member.preferredName,
				email: member.email,
				startDate,
				endDate: dateAfter(startDate, 7),
				description: projectDescription(member)
			});
			projectId = project.id;
			await store.setProject(member.id, projectId, new Date().toISOString());
		}

		const completed = new Set(checkpoint.completedTaskKeys);
		for (const task of ONBOARDING_TASKS) {
			if (completed.has(task.key)) continue;
			await directory.createProjectTask(projectId, {
				title: task.title,
				status: '',
				dueDate: dateAfter(startDate, task.dueAfterDays)
			});
			completed.add(task.key);
			await store.checkpointTask(member.id, [...completed], new Date().toISOString());
		}
		await store.complete(member.id, new Date().toISOString());
		return 'completed';
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Unknown onboarding error';
		await store.recordFailure(member.id, message, new Date().toISOString());
		console.error(
			JSON.stringify({ event: 'member_onboarding_failed', memberId: member.id, message })
		);
		return 'failed';
	}
}

export async function syncMemberOnboarding(input: {
	members: Member[];
	newMemberIds: Set<string>;
	directory: OnboardingDirectory;
	store: OnboardingStore;
	now?: Date;
}) {
	const now = input.now ?? new Date();
	for (const memberId of input.newMemberIds) {
		await input.store.reserve(memberId, now.toISOString());
	}

	const memberById = new Map(input.members.map((member) => [member.id, member]));
	const pending = await input.store.listPending();
	let completed = 0;
	let failed = 0;
	for (const checkpoint of pending) {
		const member = memberById.get(checkpoint.memberId);
		if (!member) continue;
		const outcome = await processOnboarding(member, checkpoint, input.directory, input.store, now);
		if (outcome === 'completed') {
			completed += 1;
		} else if (outcome === 'failed') {
			failed += 1;
		}
	}
	return { queued: input.newMemberIds.size, completed, failed };
}
