import { monthBounds } from '$lib/calendar/month';
import { loadMemberContext } from '$lib/server/auth/member-context';
import { ProjectEventRepository, ShiftRepository } from '$lib/server/db';
import type { CalendarEvent } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function recordString(record: Record<string, unknown>, key: string): string {
	return typeof record[key] === 'string' ? record[key] : '';
}

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const requestedMonth = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
	const bounds = monthBounds(requestedMonth);
	if (!bounds) error(400, 'Month must use YYYY-MM.');

	const [shifts, records] = await Promise.all([
		new ShiftRepository(env!.DB).listBetween(bounds.from, bounds.through),
		new ProjectEventRepository(env!.DB).listForCalendar(
			bounds.from,
			bounds.through,
			context.capabilities.isAdmin
		)
	]);

	const events: CalendarEvent[] = [
		...shifts
			.filter((shift) => shift.isCovered)
			.map((shift) => ({
				id: shift.id,
				source: 'shift' as const,
				title: shift.title,
				startDate: shift.dateValue,
				endDate: shift.dateValue,
				status: 'Covered',
				location: 'CoLab',
				details: `${shift.timeLabel}${shift.coveredBy ? ` · ${shift.coveredBy}` : ''}`,
				url: ''
			})),
		...records
			.filter((record) => !(context.capabilities.isRetailOnly && record.source === 'community'))
			.map((record) => ({
				id: record.id,
				source: record.source,
				title: record.title,
				startDate: record.dateValue,
				endDate: record.endDateValue || record.dateValue,
				status: record.status,
				location: record.location,
				details: recordString(record.record, 'description'),
				url: recordString(record.record, 'registrationUrl') || recordString(record.record, 'link')
			}))
	];

	return json(
		{ month: requestedMonth, events },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
