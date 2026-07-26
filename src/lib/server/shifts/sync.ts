import { ShiftRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import { coveredByLabel, ShiftDirectory } from '$lib/server/monday/shifts';
import type { Member, Shift } from '$lib/types/domain';

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

export function resolveShiftCoverage(shift: Shift, members: Map<string, Member>): Shift {
	if (!shift.isCovered) {
		return { ...shift, coveredBy: '' };
	}

	const member = shift.memberId ? members.get(shift.memberId) : undefined;
	const sourceName = shift.person.trim() || member?.preferredName || '';
	return {
		...shift,
		coveredBy: coveredByLabel(sourceName)
	};
}

export async function syncShifts(
	source: ShiftSource,
	store: ShiftStore,
	members: Member[] = []
): Promise<ShiftSyncResult> {
	const shifts = await source.list();
	const membersById = new Map(members.map((member) => [member.id, member]));
	let count = 0;
	let failed = 0;
	for (const rawShift of shifts) {
		const shift = resolveShiftCoverage(rawShift, membersById);
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
	const monday = new MondayClient(token);
	const [shifts, members] = await Promise.all([
		new ShiftDirectory(monday).list(),
		new MemberDirectory(monday).list()
	]);
	return syncShifts({ list: async () => shifts }, new ShiftRepository(env.DB), members);
}
