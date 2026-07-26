import { syncEventsFromMonday } from '$lib/server/events/sync';
import { syncGivebutterFromMonday } from '$lib/server/givebutter/sync';
import { syncMembersFromMonday } from '$lib/server/members/sync';
import { syncShiftsFromMonday } from '$lib/server/shifts/sync';

export async function runScheduledShiftSync(
	env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>,
	scheduledTime: number,
	cron: string
): Promise<void> {
	const startedAt = Date.now();
	try {
		const [shifts, events, members, givebutter] = await Promise.all([
			syncShiftsFromMonday(env),
			syncEventsFromMonday(env),
			syncMembersFromMonday(env),
			syncGivebutterFromMonday(env)
		]);
		console.log(
			JSON.stringify({
				event: 'scheduled_shift_sync_completed',
				cron,
				scheduledTime,
				shiftCount: shifts.count,
				shiftFailed: shifts.failed,
				eventCount: events.count,
				eventFailed: events.failed,
				memberCount: members.count,
				memberFailed: members.failed,
				memberRemoved: members.removed,
				givebutterCount: givebutter.count,
				givebutterFailed: givebutter.failed,
				givebutterRemoved: givebutter.removed,
				syncedAt: shifts.syncedAt > events.syncedAt ? shifts.syncedAt : events.syncedAt,
				durationMs: Date.now() - startedAt
			})
		);
	} catch (cause) {
		console.error(
			JSON.stringify({
				event: 'scheduled_shift_sync_failed',
				cron,
				scheduledTime,
				durationMs: Date.now() - startedAt,
				message: cause instanceof Error ? cause.message : 'Unknown error'
			})
		);
		throw cause;
	}
}

export default {
	async scheduled(controller, env, ctx): Promise<void> {
		ctx.waitUntil(runScheduledShiftSync(env, controller.scheduledTime, controller.cron));
	}
} satisfies ExportedHandler<Env>;
