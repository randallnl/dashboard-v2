import { ShiftRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { ShiftDirectory } from '$lib/server/monday/shifts';
import type { Shift } from '$lib/types/domain';

type ShiftSource = {
	list(): Promise<Shift[]>;
};

type ShiftStore = {
	upsert(shift: Shift): Promise<void>;
};

export type ShiftSyncResult = {
	count: number;
	syncedAt: string;
};

export async function syncShifts(source: ShiftSource, store: ShiftStore): Promise<ShiftSyncResult> {
	const shifts = await source.list();
	for (const shift of shifts) {
		await store.upsert(shift);
	}

	return {
		count: shifts.length,
		syncedAt: shifts[0]?.syncedAt ?? new Date().toISOString()
	};
}

export async function syncShiftsFromMonday(
	env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>
): Promise<ShiftSyncResult> {
	const token = await mondayToken(env.MONDAY_API_TOKEN);
	return syncShifts(new ShiftDirectory(new MondayClient(token)), new ShiftRepository(env.DB));
}
