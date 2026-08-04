import { syncEquipmentRequestsFromMonday } from '$lib/server/equipment/sync';
import { syncEventsFromMonday } from '$lib/server/events/sync';
import { syncGivebutterFromMonday } from '$lib/server/givebutter/sync';
import { syncMembersFromMonday } from '$lib/server/members/sync';
import { syncShiftsFromMonday } from '$lib/server/shifts/sync';
import { MemberRepository, ShiftSwitchRepository } from '$lib/server/db';
import { sendShiftSwitchEmail } from '$lib/server/shifts/switch-email';

async function sendShiftSwitchReminders(env: CronEnv): Promise<number> {
	const today = new Date().toISOString().slice(0, 10);
	const throughDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	const repository = new ShiftSwitchRepository(env.DB);
	const members = new MemberRepository(env.DB);
	const requests = await repository.listDueReminders(today, throughDate);
	let sent = 0;
	for (const request of requests) {
		const [requester, replacement] = await Promise.all([
			members.findById(request.requesterMemberId),
			members.findById(request.replacementMemberId)
		]);
		for (const member of [requester, replacement]) {
			if (!member?.email) continue;
			try {
				await sendShiftSwitchEmail(
					env.EMAIL,
					env.LOGIN_FROM_EMAIL,
					env.LOGIN_FROM_NAME,
					member.email,
					request,
					'reminder'
				);
				sent += 1;
			} catch (cause) {
				console.error(
					JSON.stringify({
						event: 'shift_switch_reminder_failed',
						requestId: request.id,
						memberId: member.id,
						message: cause instanceof Error ? cause.message : 'Unknown email error'
					})
				);
			}
		}
		await repository.markReminded(request.id, new Date().toISOString());
	}
	return sent;
}

export async function runScheduledShiftSync(
	env: CronEnv,
	scheduledTime: number,
	cron: string
): Promise<void> {
	const startedAt = Date.now();
	try {
		const [shifts, events, members, givebutter, equipment, switchReminders] = await Promise.all([
			syncShiftsFromMonday(env),
			syncEventsFromMonday(env),
			syncMembersFromMonday(env),
			syncGivebutterFromMonday(env),
			syncEquipmentRequestsFromMonday(env),
			sendShiftSwitchReminders(env)
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
				equipmentCount: equipment.count,
				equipmentFailed: equipment.failed,
				equipmentRemoved: equipment.removed,
				switchReminders,
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
} satisfies ExportedHandler<CronEnv>;
