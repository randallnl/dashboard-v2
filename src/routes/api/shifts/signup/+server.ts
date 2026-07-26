import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { ShiftRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { coveredByLabel, shiftPersonValue, ShiftDirectory } from '$lib/server/monday/shifts';
import type { Member, Shift } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function coveredShift(shift: Shift, member: Member, person: string, syncedAt: string): Shift {
	return {
		...shift,
		memberId: member.id,
		person,
		coveredBy: person,
		coverageStatus: 'Covered',
		isCovered: true,
		syncedAt
	};
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	if (!context.capabilities.canViewShifts) {
		error(403, 'Shift signup is not included with this membership.');
	}

	const body = (await request.json().catch(() => null)) as { shiftId?: unknown } | null;
	const shiftId = typeof body?.shiftId === 'string' ? body.shiftId.trim() : '';
	if (!shiftId) {
		error(400, 'A shift ID is required.');
	}

	const repository = new ShiftRepository(env!.DB);
	const cached = await repository.findById(shiftId);
	if (!cached) {
		error(404, 'Shift not found. Ask an admin to synchronize shifts.');
	}

	const person = shiftPersonValue(context.viewer);
	const reservedAt = new Date().toISOString();
	const reserved = await repository.claimIfOpen(shiftId, context.viewer.id, person, reservedAt);
	if (!reserved) {
		error(409, 'This shift has already been claimed.');
	}

	const token = await mondayToken(env!.MONDAY_API_TOKEN);
	const directory = new ShiftDirectory(new MondayClient(token));
	try {
		const live = await directory.findById(shiftId);
		if (!live) {
			await repository.releaseClaim(shiftId, context.viewer.id, new Date().toISOString());
			error(404, 'This shift no longer exists in Monday.');
		}
		if (live.isCovered) {
			await repository.upsert(live);
			error(409, 'This shift has already been claimed.');
		}

		await directory.cover(live, context.viewer.id, person);
		const canonical = coveredShift(live, context.viewer, person, new Date().toISOString());
		await repository.upsert(canonical);
		return json({
			ok: true,
			shift: { ...canonical, person: '', coveredBy: coveredByLabel(context.viewer.preferredName) }
		});
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
		await repository.releaseClaim(shiftId, context.viewer.id, new Date().toISOString());
		console.error(
			JSON.stringify({
				event: 'shift_signup_failed',
				shiftId,
				memberId: context.viewer.id,
				message: cause instanceof Error ? cause.message : 'Unknown error'
			})
		);
		error(502, 'We could not update Monday. The shift remains available.');
	}
};
