import { EquipmentRequestRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EquipmentRequestDirectory } from '$lib/server/monday/equipment';
import type { EquipmentRequest } from '$lib/types/domain';

type Source = { list(): Promise<EquipmentRequest[]> };
type Store = {
	upsert(request: EquipmentRequest): Promise<void>;
	removeMissing(activeIds: string[]): Promise<number>;
};

export async function syncEquipmentRequests(source: Source, store: Store) {
	const requests = await source.list();
	let count = 0;
	let failed = 0;
	for (const request of requests) {
		try {
			await store.upsert(request);
			count += 1;
		} catch (cause) {
			failed += 1;
			console.error(
				JSON.stringify({
					event: 'equipment_request_upsert_failed',
					itemId: request.id,
					message: cause instanceof Error ? cause.message : 'Unknown error'
				})
			);
		}
	}
	const removed = await store.removeMissing(requests.map((request) => request.id));
	return { count, failed, removed, syncedAt: new Date().toISOString() };
}

export async function syncEquipmentRequestsFromMonday(env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>) {
	const token = await mondayToken(env.MONDAY_API_TOKEN);
	return syncEquipmentRequests(
		new EquipmentRequestDirectory(new MondayClient(token)),
		new EquipmentRequestRepository(env.DB)
	);
}
