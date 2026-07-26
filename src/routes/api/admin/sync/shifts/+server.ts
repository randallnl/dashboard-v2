import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { ShiftRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { ShiftDirectory } from '$lib/server/monday/shifts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);

	const token = await mondayToken(env!.MONDAY_API_TOKEN);
	const shifts = await new ShiftDirectory(new MondayClient(token)).list();
	const repository = new ShiftRepository(env!.DB);
	for (const shift of shifts) {
		await repository.upsert(shift);
	}

	return json({
		ok: true,
		count: shifts.length,
		syncedAt: shifts[0]?.syncedAt ?? new Date().toISOString()
	});
};
