import type { Member } from '$lib/types/domain';
import { describe, expect, it, vi } from 'vitest';
import { ONBOARDING_TASKS, syncMemberOnboarding } from './onboarding';

const member: Member = {
	id: 'member-1',
	preferredName: 'Alex Morgan',
	membershipType: 'CoLab Member',
	email: 'alex@example.com',
	otherEmails: [],
	phone: '',
	businessName: '',
	website: '',
	socialMedia: '',
	creativeGroundUrl: '',
	artistDescription: '',
	artistPhotoUrl: '',
	artistBannerUrl: '',
	signUpDate: '2026-08-11'
};

describe('member onboarding automation', () => {
	it('creates one project and checkpoints every workflow task', async () => {
		const directory = {
			createOnboardingProject: vi
				.fn()
				.mockResolvedValue({ id: 'project-1', title: 'Onboarding: Alex Morgan' }),
			createProjectTask: vi.fn().mockResolvedValue({ id: 'task-1', title: 'Task' })
		};
		const store = {
			reserve: vi.fn().mockResolvedValue(true),
			listPending: vi.fn().mockResolvedValue([
				{
					memberId: member.id,
					projectId: '',
					completedTaskKeys: [],
					status: 'pending' as const
				}
			]),
			claim: vi.fn().mockResolvedValue(true),
			setProject: vi.fn().mockResolvedValue(undefined),
			checkpointTask: vi.fn().mockResolvedValue(undefined),
			complete: vi.fn().mockResolvedValue(undefined),
			recordFailure: vi.fn().mockResolvedValue(undefined)
		};

		await expect(
			syncMemberOnboarding({
				members: [member],
				newMemberIds: new Set([member.id]),
				directory,
				store,
				now: new Date('2026-08-11T14:00:00Z')
			})
		).resolves.toEqual({ queued: 1, completed: 1, failed: 0 });
		expect(directory.createOnboardingProject).toHaveBeenCalledOnce();
		expect(directory.createProjectTask).toHaveBeenCalledTimes(ONBOARDING_TASKS.length);
		expect(store.checkpointTask).toHaveBeenCalledTimes(ONBOARDING_TASKS.length);
		expect(store.complete).toHaveBeenCalledWith(member.id, expect.any(String));
	});

	it('resumes an existing project without recreating completed tasks', async () => {
		const directory = {
			createOnboardingProject: vi.fn(),
			createProjectTask: vi.fn().mockResolvedValue({ id: 'task-2', title: 'Task' })
		};
		const completedTaskKeys = ONBOARDING_TASKS.slice(0, 2).map((task) => task.key);
		const store = {
			reserve: vi.fn(),
			listPending: vi.fn().mockResolvedValue([
				{
					memberId: member.id,
					projectId: 'project-1',
					completedTaskKeys,
					status: 'pending' as const
				}
			]),
			claim: vi.fn().mockResolvedValue(true),
			setProject: vi.fn(),
			checkpointTask: vi.fn().mockResolvedValue(undefined),
			complete: vi.fn().mockResolvedValue(undefined),
			recordFailure: vi.fn()
		};

		await syncMemberOnboarding({
			members: [member],
			newMemberIds: new Set(),
			directory,
			store,
			now: new Date('2026-08-11T14:00:00Z')
		});

		expect(directory.createOnboardingProject).not.toHaveBeenCalled();
		expect(directory.createProjectTask).toHaveBeenCalledTimes(
			ONBOARDING_TASKS.length - completedTaskKeys.length
		);
	});
});
