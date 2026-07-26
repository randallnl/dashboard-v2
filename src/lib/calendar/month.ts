export function monthBounds(month: string): { from: string; through: string } | null {
	const match = /^(\d{4})-(\d{2})$/u.exec(month);
	if (!match) return null;
	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	if (monthIndex < 0 || monthIndex > 11) return null;
	const from = new Date(Date.UTC(year, monthIndex, 1));
	const through = new Date(Date.UTC(year, monthIndex + 1, 0));
	return {
		from: from.toISOString().slice(0, 10),
		through: through.toISOString().slice(0, 10)
	};
}

export function datesInRange(start: string, end: string): string[] {
	const dates: string[] = [];
	const cursor = new Date(`${start}T12:00:00Z`);
	const last = new Date(`${end || start}T12:00:00Z`);
	while (cursor <= last && dates.length < 370) {
		dates.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return dates;
}
