import {
	CalendarSubscriptionRepository,
	HostRepository,
	MemberRepository,
	ProjectEventRepository,
	ShiftRepository,
	VolunteerRepository
} from '$lib/server/db';
import { attendeeEmails } from '$lib/server/monday/events';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function compact(value: string): string {
	return value.replaceAll('-', '');
}

function exclusiveEnd(value: string): string {
	const date = new Date(`${value}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() + 1);
	return compact(date.toISOString().slice(0, 10));
}

function escapeIcs(value: string): string {
	return value
		.replaceAll('\\', '\\\\')
		.replaceAll('\n', '\\n')
		.replaceAll(',', '\\,')
		.replaceAll(';', '\\;');
}

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = platform!.env.DB;
	if (!/^[A-Za-z0-9_-]{24,64}$/u.test(params.token)) error(404, 'Calendar feed not found.');
	const memberId = await new CalendarSubscriptionRepository(db).findMemberId(params.token);
	if (!memberId) error(404, 'Calendar feed not found.');
	const member = await new MemberRepository(db).findById(memberId);
	if (!member) error(404, 'Member not found.');
	const from = new Date().toISOString().slice(0, 10);
	const end = new Date(`${from}T12:00:00Z`);
	end.setUTCFullYear(end.getUTCFullYear() + 1);
	const through = end.toISOString().slice(0, 10);
	const [shifts, records, hostKeys, participantKeys] = await Promise.all([
		new ShiftRepository(db).listBetween(from, through),
		new ProjectEventRepository(db).listForCalendar(from, through, true),
		new HostRepository(db).listKeysForMember(memberId),
		new VolunteerRepository(db).listParticipantKeysForMember(memberId)
	]);
	const emails = new Set(
		[member.email, ...member.otherEmails].map((email) => email.toLocaleLowerCase('en-US'))
	);
	const assignedRecords = records.filter(
		(record) =>
			hostKeys.has(`${record.source}:${record.id}`) ||
			participantKeys.has(`${record.source}:${record.id}`) ||
			attendeeEmails(record.record.attendees).some((email) => emails.has(email))
	);
	const eventLines = [
		...shifts
			.filter((shift) => shift.memberId === memberId)
			.map((shift) => ({
				id: `shift-${shift.id}`,
				title: shift.title,
				start: shift.dateValue,
				end: shift.dateValue,
				description: shift.timeLabel,
				location: 'CoLab'
			})),
		...assignedRecords.map((record) => ({
			id: `${record.source}-${record.id}`,
			title: record.title,
			start: record.dateValue,
			end: record.endDateValue || record.dateValue,
			description: typeof record.record.description === 'string' ? record.record.description : '',
			location: record.location
		}))
	].flatMap((event) => [
		'BEGIN:VEVENT',
		`UID:${event.id}@nhciviccommons.com`,
		`DTSTART;VALUE=DATE:${compact(event.start)}`,
		`DTEND;VALUE=DATE:${exclusiveEnd(event.end)}`,
		`SUMMARY:${escapeIcs(event.title)}`,
		`DESCRIPTION:${escapeIcs(event.description)}`,
		`LOCATION:${escapeIcs(event.location)}`,
		'END:VEVENT'
	]);
	const calendar = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Queerlective CoLab//Member Schedule//EN',
		'X-WR-CALNAME:My CoLab Schedule',
		'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
		'X-PUBLISHED-TTL:PT15M',
		...eventLines,
		'END:VCALENDAR'
	].join('\r\n');
	return new Response(calendar, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'cache-control': 'private, max-age=300',
			'content-disposition': 'inline; filename="my-colab-schedule.ics"'
		}
	});
};
