import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { MemberRepository, ShiftRepository, ShiftSwitchRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { coveredByLabel, shiftPersonValue, ShiftDirectory } from '$lib/server/monday/shifts';
import { sendShiftSwitchEmail } from '$lib/server/shifts/switch-email';
import type { ShiftSwitchRequest } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function fromSettings(env: Env) {
	return {
		email: env.LOGIN_FROM_EMAIL || 'dashboard@nhciviccommons.com',
		name: env.LOGIN_FROM_NAME || 'Queerlective CoLab'
	};
}

export const GET: RequestHandler = async ({ locals, platform }) => {
	const context = await loadMemberContext({ session: locals.session, env: platform?.env });
	const requests = await new ShiftSwitchRepository(platform!.env.DB).listForMember(
		context.member.id
	);
	return json({
		requests: requests.map((request) => ({
			...request,
			direction:
				request.replacementMemberId === context.member.id
					? ('incoming' as const)
					: ('outgoing' as const)
		}))
	});
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	const body = (await request.json().catch(() => null)) as {
		shiftId?: unknown;
		replacementMemberId?: unknown;
		release?: unknown;
	} | null;
	const shiftId = typeof body?.shiftId === 'string' ? body.shiftId.trim() : '';
	const replacementMemberId =
		typeof body?.replacementMemberId === 'string' ? body.replacementMemberId.trim() : '';
	const release = body?.release === true;
	if (!shiftId || (!release && !replacementMemberId)) {
		error(400, 'Choose a replacement or release the shift as open.');
	}
	const shifts = new ShiftRepository(env.DB);
	const shift = await shifts.findById(shiftId);
	if (!shift || shift.memberId !== context.member.id) {
		error(403, 'You can only request a switch for your own assigned shift.');
	}
	const switches = new ShiftSwitchRepository(env.DB);
	const now = new Date().toISOString();
	const base: ShiftSwitchRequest = {
		id: crypto.randomUUID(),
		shiftId,
		requesterMemberId: context.member.id,
		replacementMemberId: '',
		requestType: release ? 'release' : 'replacement',
		status: release ? 'completed' : 'pending',
		shiftTitle: shift.title,
		shiftDate: shift.dateValue,
		shiftTime: shift.timeLabel,
		requesterLabel: context.member.preferredName,
		replacementLabel: '',
		createdAt: now,
		respondedAt: release ? now : '',
		lastRemindedAt: ''
	};
	const directory = new ShiftDirectory(new MondayClient(await mondayToken(env.MONDAY_API_TOKEN)));
	if (release) {
		await directory.release(shift);
		await shifts.upsert({
			...shift,
			memberId: '',
			person: '',
			coveredBy: '',
			coverageStatus: 'Open',
			isCovered: false,
			syncedAt: now
		});
		await switches.create(base);
		return json({
			request: base,
			mondayConfirmed: true,
			message: 'The shift is open and the change was confirmed by Monday.'
		});
	}
	if (replacementMemberId === context.member.id) error(400, 'Choose another member.');
	const replacement = await new MemberRepository(env.DB).findById(replacementMemberId);
	if (!replacement?.email) error(404, 'The replacement member does not have an email address.');
	const pending = {
		...base,
		replacementMemberId,
		replacementLabel: replacement.preferredName
	};
	try {
		await switches.create(pending);
	} catch {
		error(409, 'This shift already has a pending switch request.');
	}
	const from = fromSettings(env);
	let notificationSent = true;
	try {
		await sendShiftSwitchEmail(
			env.EMAIL,
			from.email,
			from.name,
			replacement.email,
			pending,
			'requested'
		);
	} catch (cause) {
		notificationSent = false;
		console.error(
			JSON.stringify({
				event: 'shift_switch_notification_failed',
				requestId: pending.id,
				message: cause instanceof Error ? cause.message : 'Unknown email error'
			})
		);
	}
	return json({
		request: pending,
		mondayConfirmed: false,
		notificationSent,
		message: notificationSent
			? `Request sent to ${replacement.preferredName}. Monday will update after they accept.`
			: `Request saved for ${replacement.preferredName}, but the email notification could not be delivered.`
	});
};

export const PATCH: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	const body = (await request.json().catch(() => null)) as {
		requestId?: unknown;
		response?: unknown;
	} | null;
	const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
	const response = body?.response === 'accept' || body?.response === 'decline' ? body.response : '';
	if (!requestId || !response) error(400, 'Choose accept or decline.');
	const switches = new ShiftSwitchRepository(env.DB);
	const switchRequest = await switches.find(requestId);
	if (
		!switchRequest ||
		switchRequest.replacementMemberId !== context.member.id ||
		switchRequest.status !== 'pending'
	) {
		error(404, 'This switch request is no longer available.');
	}
	const now = new Date().toISOString();
	if (response === 'decline') {
		await switches.respond(requestId, context.member.id, 'declined', now);
		const requester = await new MemberRepository(env.DB).findById(switchRequest.requesterMemberId);
		if (requester?.email) {
			const from = fromSettings(env);
			await sendShiftSwitchEmail(
				env.EMAIL,
				from.email,
				from.name,
				requester.email,
				switchRequest,
				'declined'
			);
		}
		return json({ request: { ...switchRequest, status: 'declined' }, mondayConfirmed: false });
	}
	const shifts = new ShiftRepository(env.DB);
	const shift = await shifts.findById(switchRequest.shiftId);
	if (!shift || shift.memberId !== switchRequest.requesterMemberId) {
		error(409, 'The shift assignment changed before this request was accepted.');
	}
	const directory = new ShiftDirectory(new MondayClient(await mondayToken(env.MONDAY_API_TOKEN)));
	const person = shiftPersonValue(context.member);
	await directory.cover(shift, context.member.id, person);
	await shifts.upsert({
		...shift,
		memberId: context.member.id,
		person,
		coveredBy: coveredByLabel(context.member.preferredName),
		coverageStatus: 'Covered',
		isCovered: true,
		syncedAt: now
	});
	await switches.respond(requestId, context.member.id, 'accepted', now);
	const requester = await new MemberRepository(env.DB).findById(switchRequest.requesterMemberId);
	if (requester?.email) {
		const from = fromSettings(env);
		await sendShiftSwitchEmail(
			env.EMAIL,
			from.email,
			from.name,
			requester.email,
			switchRequest,
			'accepted'
		);
	}
	return json({
		request: { ...switchRequest, status: 'accepted', respondedAt: now },
		mondayConfirmed: true,
		message: 'Switch accepted and confirmed by Monday.'
	});
};
