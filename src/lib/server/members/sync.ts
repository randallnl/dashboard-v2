import { MemberOnboardingRepository, MemberRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EventDirectory } from '$lib/server/monday/events';
import { MemberDirectory } from '$lib/server/monday/members';
import { syncMemberOnboarding } from './onboarding';

export async function syncMembersFromMonday(env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>) {
	const monday = new MondayClient(await mondayToken(env.MONDAY_API_TOKEN));
	const members = await new MemberDirectory(monday).list();
	const repository = new MemberRepository(env.DB);
	const existingIds = await repository.listIds();
	const syncedAt = new Date().toISOString();
	const newMemberIds = new Set<string>();
	let count = 0;
	let failed = 0;
	for (const member of members) {
		try {
			await repository.upsert(member, syncedAt);
			if (!existingIds.has(member.id)) newMemberIds.add(member.id);
			count += 1;
		} catch (cause) {
			failed += 1;
			console.error(
				JSON.stringify({
					event: 'member_upsert_failed',
					memberId: member.id,
					message: cause instanceof Error ? cause.message : 'Unknown error'
				})
			);
		}
	}
	const onboarding = await syncMemberOnboarding({
		members,
		newMemberIds,
		directory: new EventDirectory(monday),
		store: new MemberOnboardingRepository(env.DB)
	});
	const removed = await repository.removeMissing(members.map((member) => member.id));
	return { count, failed, removed, onboarding, syncedAt };
}
