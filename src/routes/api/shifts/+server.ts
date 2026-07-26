import { loadMemberContext } from '$lib/server/auth/member-context';
import { ShiftRepository } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	if (!context.capabilities.canViewShifts) {
		error(403, 'Shift access is not included with this membership.');
	}

	const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(from)) {
		error(400, 'The from date must use YYYY-MM-DD.');
	}

	const shifts = await new ShiftRepository(platform!.env.DB).listFromDate(from);
	return json(
		{
			available: shifts.filter((shift) => !shift.isCovered),
			covered: shifts.filter((shift) => shift.isCovered),
			syncedAt: shifts.reduce(
				(latest, shift) => (shift.syncedAt > latest ? shift.syncedAt : latest),
				''
			)
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
