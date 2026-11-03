import type { Shift } from '$lib/types/domain';

export const COLAB_TIME_ZONE = 'America/New_York';

export type WeekBounds = {
	from: string;
	through: string;
	label: string;
};

function datePartsInTimeZone(
	now: Date,
	timeZone: string
): { year: number; month: number; day: number } {
	const values = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(values.find((value) => value.type === type)?.value);

	return { year: part('year'), month: part('month'), day: part('day') };
}

function dateAtNoonUtc(value: string): Date {
	return new Date(`${value}T12:00:00.000Z`);
}

function isoDate(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function shortDate(value: string): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	}).format(dateAtNoonUtc(value));
}

/** Returns the Monday–Sunday week that contains `now` in CoLab's local time. */
export function currentWeekBounds(now = new Date()): WeekBounds {
	const { year, month, day } = datePartsInTimeZone(now, COLAB_TIME_ZONE);
	const today = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	const currentDate = dateAtNoonUtc(today);
	const daysSinceMonday = (currentDate.getUTCDay() + 6) % 7;
	const firstDay = new Date(currentDate);
	firstDay.setUTCDate(currentDate.getUTCDate() - daysSinceMonday);
	const lastDay = new Date(firstDay);
	lastDay.setUTCDate(firstDay.getUTCDate() + 6);
	const from = isoDate(firstDay);
	const through = isoDate(lastDay);

	return { from, through, label: `${shortDate(from)}–${shortDate(through)}` };
}

function dashboardShiftsUrl(dashboardUrl: string): string {
	return `${dashboardUrl.replace(/\/$/u, '')}/#shifts`;
}

/** Formats only staffed open-hour shifts; content is safe for a public Discord response. */
export function openHoursDiscordMessage(
	shifts: Shift[],
	week: WeekBounds,
	dashboardUrl: string
): string {
	const staffedShifts = shifts.filter((shift) => shift.isCovered);
	const heading = `**Staffed CoLab open hours — ${week.label}**`;
	if (!staffedShifts.length) {
		return `${heading}\nNo CoLab open hours are staffed this week yet.`;
	}

	const lines = staffedShifts.map(
		(shift) =>
			`• ${shortDate(shift.dateValue)} · ${shift.timeLabel.replace(/-/gu, '–')} — ${shift.title}`
	);
	return `${heading}\n${lines.join('\n')}\n\n[View the shift schedule](${dashboardShiftsUrl(dashboardUrl)})`;
}
