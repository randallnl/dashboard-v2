import { MemberRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';

export async function syncMembersFromMonday(env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>) {
	const members = await new MemberDirectory(
		new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))
	).list();
	const repository = new MemberRepository(env.DB);
	const syncedAt = new Date().toISOString();
	let count = 0;
	let failed = 0;
	for (const member of members) {
		try {
			await repository.upsert(member, syncedAt);
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
	const removed = await repository.removeMissing(members.map((member) => member.id));
	return { count, failed, removed, syncedAt };
}
