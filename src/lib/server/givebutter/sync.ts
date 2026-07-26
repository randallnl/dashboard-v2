import { GivebutterRepository } from '$lib/server/db';
import { GivebutterDirectory } from '$lib/server/monday/givebutter';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import type { GivebutterSignup } from '$lib/types/domain';

type Source = { list(): Promise<GivebutterSignup[]> };
type Store = {
	upsert(signup: GivebutterSignup): Promise<void>;
	removeMissing(activeIds: string[]): Promise<number>;
};

export async function syncGivebutter(source: Source, store: Store) {
	const signups = await source.list();
	let count = 0;
	let failed = 0;
	for (const signup of signups) {
		try {
			await store.upsert(signup);
			count += 1;
		} catch (cause) {
			failed += 1;
			console.error(
				JSON.stringify({
					event: 'givebutter_signup_upsert_failed',
					itemId: signup.id,
					message: cause instanceof Error ? cause.message : 'Unknown error'
				})
			);
		}
	}
	const removed = await store.removeMissing(signups.map((signup) => signup.id));
	return { count, failed, removed, syncedAt: new Date().toISOString() };
}

export async function syncGivebutterFromMonday(env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>) {
	const token = await mondayToken(env.MONDAY_API_TOKEN);
	return syncGivebutter(
		new GivebutterDirectory(new MondayClient(token)),
		new GivebutterRepository(env.DB)
	);
}
