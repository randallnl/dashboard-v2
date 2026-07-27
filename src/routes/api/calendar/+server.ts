import { monthBounds } from '$lib/calendar/month';
import { loadMemberContext } from '$lib/server/auth/member-context';
import {
	HostRepository,
	ProjectEventRepository,
	ShiftRepository,
	VolunteerRepository
} from '$lib/server/db';
import { attendeeEmails } from '$lib/server/monday/events';
import { coveredByLabel } from '$lib/server/monday/shifts';
import type { CalendarEvent, EventAttachment } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function recordString(record: Record<string, unknown>, key: string): string {
	return typeof record[key] === 'string' ? record[key] : '';
}

function recordAttachments(record: Record<string, unknown>): EventAttachment[] {
	return Array.isArray(record.attachments)
		? record.attachments.filter((value): value is EventAttachment =>
				Boolean(
					value &&
					typeof value === 'object' &&
					'name' in value &&
					typeof value.name === 'string' &&
					'url' in value &&
					typeof value.url === 'string' &&
					'isImage' in value &&
					typeof value.isImage === 'boolean'
				)
			)
		: [];
}

function fieldLabel(key: string): string {
	return key
		.replace(/Url$/u, '')
		.replace(/([a-z])([A-Z])/gu, '$1 $2')
		.replace(/^./u, (character) => character.toUpperCase());
}

function recordFields(
	record: Record<string, unknown>,
	includeOperational: boolean
): Array<{ label: string; value: string; url: boolean }> {
	const hidden = new Set(['description', 'posterUrl']);
	if (!includeOperational) {
		for (const key of ['organizerEmail', 'mondayUrl', 'itemId', 'creationLog']) hidden.add(key);
	}
	return Object.entries(record)
		.filter(([key, value]) => !hidden.has(key) && typeof value === 'string' && value.trim())
		.map(([key, value]) => ({
			label: fieldLabel(key),
			value: value as string,
			url: /Url$/u.test(key) || key === 'link'
		}));
}

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const requestedMonth = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
	const bounds = monthBounds(requestedMonth);
	if (!bounds) error(400, 'Month must use YYYY-MM.');

	const [shifts, records, volunteerKeys, hostKeys] = await Promise.all([
		new ShiftRepository(env!.DB).listBetween(bounds.from, bounds.through),
		new ProjectEventRepository(env!.DB).listForCalendar(
			bounds.from,
			bounds.through,
			context.capabilities.isAdmin
		),
		new VolunteerRepository(env!.DB).listKeysForMember(context.member.id),
		new HostRepository(env!.DB).listKeysForMember(context.member.id)
	]);
	const memberEmails = new Set(
		[context.member.email, ...context.member.otherEmails].map((email) =>
			email.trim().toLocaleLowerCase('en-US')
		)
	);

	const events: CalendarEvent[] = [
		...(context.capabilities.canViewShifts ? shifts : []).map((shift) => ({
			id: shift.id,
			source: 'shift' as const,
			title: shift.title,
			startDate: shift.dateValue,
			endDate: shift.dateValue,
			status: shift.isCovered ? 'Covered' : 'Open',
			location: 'CoLab',
			details: `${shift.timeLabel}${shift.coveredBy ? ` · ${coveredByLabel(shift.coveredBy)}` : ''}`,
			url: '',
			canVolunteer: !shift.isCovered,
			isVolunteering: false,
			isMine: shift.memberId === context.member.id,
			isDeadline: false,
			fields: [],
			imageUrl: '',
			attachments: [],
			pageUrl: ''
		})),
		...records
			.filter((record) => !(context.capabilities.isRetailOnly && record.source === 'community'))
			.flatMap((record) => {
				const isMine =
					hostKeys.has(`${record.source}:${record.id}`) ||
					volunteerKeys.has(`${record.source}:${record.id}`) ||
					attendeeEmails(record.record.attendees).some((email) => memberEmails.has(email));
				const event: CalendarEvent = {
					id: record.id,
					source: record.source,
					title: record.title,
					startDate: record.dateValue,
					endDate: record.endDateValue || record.dateValue,
					status: record.status,
					location: record.location,
					details: recordString(record.record, 'description'),
					url:
						recordString(record.record, 'registrationUrl') || recordString(record.record, 'link'),
					canVolunteer: !record.adminOnly,
					isVolunteering: volunteerKeys.has(`${record.source}:${record.id}`),
					isMine,
					isDeadline: false,
					fields: recordFields(record.record, context.viewerCapabilities.isAdmin),
					imageUrl: recordString(record.record, 'posterUrl'),
					attachments: recordAttachments(record.record),
					pageUrl: `/items/${record.source}/${record.id}`
				};
				if (!record.endDateValue || record.endDateValue === record.dateValue) return [event];
				return [
					event,
					{
						...event,
						id: `${record.id}-deadline`,
						title: `${record.title} deadline`,
						startDate: record.endDateValue,
						endDate: record.endDateValue,
						status: 'Deadline',
						canVolunteer: false,
						isDeadline: true
					}
				];
			})
	];

	return json(
		{ month: requestedMonth, events },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
