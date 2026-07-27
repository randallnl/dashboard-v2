import { normalizeEmail } from '$lib/server/monday/members';
import type { ProjectEventRecord, UpcomingProjectAssignment } from '$lib/types/domain';

export function upcomingAssignments(
	records: ProjectEventRecord[],
	memberEmails: Iterable<string>,
	hostKeys: Set<string>,
	volunteerKeys: Set<string>,
	limit = 6
): UpcomingProjectAssignment[] {
	const normalizedEmails = new Set(Array.from(memberEmails, normalizeEmail).filter(Boolean));
	return records
		.map((record) => {
			const key = `${record.source}:${record.id}`;
			const attendees =
				typeof record.record.attendees === 'string'
					? record.record.attendees.split(/[,;\n]+/u).map(normalizeEmail)
					: [];
			const roles: UpcomingProjectAssignment['roles'] = [];
			if (hostKeys.has(key)) {
				roles.push('Host');
			} else if (
				volunteerKeys.has(key) ||
				attendees.some((email) => email && normalizedEmails.has(email))
			) {
				roles.push('Attendee');
			}
			return { record, roles };
		})
		.filter((assignment) => assignment.roles.length)
		.slice(0, limit);
}
