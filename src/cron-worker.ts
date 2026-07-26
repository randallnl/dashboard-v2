import { syncShiftsFromMonday } from '$lib/server/shifts/sync';

export async function runScheduledShiftSync(
	env: Pick<Env, 'DB' | 'MONDAY_API_TOKEN'>,
	scheduledTime: number,
	cron: string
): Promise<void> {
	const startedAt = Date.now();
	try {
		const result = await syncShiftsFromMonday(env);
		console.log(
			JSON.stringify({
				event: 'scheduled_shift_sync_completed',
				cron,
				scheduledTime,
				count: result.count,
				syncedAt: result.syncedAt,
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
