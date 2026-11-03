import type { Shift } from '$lib/types/domain';

export type PublicColabShift = {
	id: string;
	title: string;
	date: string;
	time: string;
};

export type WeekBounds = {
	from: string;
	through: string;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: 'America/New_York',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: 'UTC',
	weekday: 'short',
	month: 'short',
	day: 'numeric'
});

/**
 * Returns a calendar date in the CoLab's local timezone without depending on the
 * Worker runtime's own timezone.
 */
export function newYorkDate(value = new Date()): string {
	const parts = Object.fromEntries(
		dateFormatter.formatToParts(value).map((part) => [part.type, part.value])
	);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

export function weekBounds(date: string): WeekBounds {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
		throw new Error('Expected a date in YYYY-MM-DD format.');
	}

	const current = new Date(`${date}T12:00:00.000Z`);
	if (Number.isNaN(current.getTime())) throw new Error('Expected a valid calendar date.');

	const weekday = current.getUTCDay();
	const daysSinceMonday = (weekday + 6) % 7;
	const monday = new Date(current);
	monday.setUTCDate(current.getUTCDate() - daysSinceMonday);
	const sunday = new Date(monday);
	sunday.setUTCDate(monday.getUTCDate() + 6);

	return {
		from: monday.toISOString().slice(0, 10),
		through: sunday.toISOString().slice(0, 10)
	};
}

export function publicStaffedHours(shifts: Shift[]): PublicColabShift[] {
	return shifts
		.filter((shift) => shift.isCovered && /^\d{4}-\d{2}-\d{2}$/u.test(shift.dateValue))
		.map((shift) => ({
			id: shift.id,
			title: shift.title || 'CoLab open hours',
			date: shift.dateValue,
			time: shift.timeLabel || 'Hours to be confirmed'
		}));
}

export function displayColabDate(date: string): string {
	return longDateFormatter.format(new Date(`${date}T12:00:00.000Z`));
}
