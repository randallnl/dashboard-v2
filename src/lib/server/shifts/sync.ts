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
	failed: number;
	syncedAt: string;
};

export async function syncShifts(source: ShiftSource, store: ShiftStore): Promise<ShiftSyncResult> {
	const shifts = await source.list();
	let count = 0;
	let failed = 0;
	for (const shift of shifts) {
		try {
			await store.upsert(shift);
			count += 1;
		} catch (cause) {
			failed += 1;
			console.error(
				JSON.stringify({
					event: 'shift_upsert_failed',
					shiftId: shift.id,
					message: cause instanceof Error ? cause.message : 'Unknown error'
				})
			);
		}
	}

	return {
		count,
		failed,
		syncedAt: shifts[0]?.syncedAt ?? new Date().toISOString()
	};
}

export async function syncShiftsFromMonday(
	env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>
): Promise<ShiftSyncResult> {
	const token = await mondayToken(env.MONDAY_API_TOKEN);
	return syncShifts(new ShiftDirectory(new MondayClient(token)), new ShiftRepository(env.DB));
}
