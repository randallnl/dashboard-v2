import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { MemberRepository, ShiftRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { coveredByLabel, shiftPersonValue, ShiftDirectory } from '$lib/server/monday/shifts';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as {
		shiftId?: unknown;
		memberId?: unknown;
	} | null;
	const shiftId = typeof body?.shiftId === 'string' ? body.shiftId.trim() : '';
	const memberId = typeof body?.memberId === 'string' ? body.memberId.trim() : '';
	if (!shiftId || !memberId) error(400, 'A shift and member are required.');

	const token = await mondayToken(env.MONDAY_API_TOKEN);
	const monday = new MondayClient(token);
	const [shift, member] = await Promise.all([
		new ShiftDirectory(monday).findById(shiftId),
		new MemberRepository(env.DB).findById(memberId)
	]);
	if (!shift) error(404, 'Shift not found.');
	if (!member) error(404, 'Member not found.');

	const person = shiftPersonValue(member);
	await new ShiftDirectory(monday).cover(shift, member.id, person);
	const updated = {
		...shift,
		memberId: member.id,
		person,
		coveredBy: coveredByLabel(member.preferredName),
		coverageStatus: 'Covered',
		isCovered: true,
		syncedAt: new Date().toISOString()
	};
	await new ShiftRepository(env.DB).upsert(updated);
	return json(
		{
			shift: updated,
			isMine: member.id === context.member.id,
			message: `Shift reassigned to ${updated.coveredBy}.`
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
