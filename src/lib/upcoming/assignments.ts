import { normalizeEmail } from '$lib/server/monday/members';
import type { ProjectEventRecord, UpcomingProjectAssignment } from '$lib/types/domain';

export function upcomingAssignments(
	records: ProjectEventRecord[],
	memberEmails: Iterable<string>,
	hostKeys: Set<string>,
	volunteerKeys: Set<string>,
	memberNames: Iterable<string> = [],
	limit = Number.POSITIVE_INFINITY
): UpcomingProjectAssignment[] {
	const normalizedEmails = new Set(Array.from(memberEmails, normalizeEmail).filter(Boolean));
	const normalizedNames = new Set(Array.from(memberNames, normalizeName).filter(Boolean));
	return records
		.map((record) => {
			const key = `${record.source}:${record.id}`;
			const attendees = stringValue(record.record.attendees);
			const organizerEmail = stringValue(record.record.organizerEmail);
			const additionalOrganizers = stringValue(record.record.additionalOrganizers);
			const roles: UpcomingProjectAssignment['roles'] = [];
			if (
				hostKeys.has(key) ||
				matchesIdentity(record.owner, normalizedEmails, normalizedNames) ||
				matchesIdentity(organizerEmail, normalizedEmails, normalizedNames) ||
				matchesIdentity(additionalOrganizers, normalizedEmails, normalizedNames)
			) {
				roles.push('Host');
			}
			if (matchesIdentity(attendees, normalizedEmails, normalizedNames)) {
				roles.push('Attendee');
			}
			if (volunteerKeys.has(key)) roles.push('Volunteer');
			return { record, roles };
		})
		.filter((assignment) => assignment.roles.length)
		.slice(0, limit);
}

function stringValue(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function normalizeName(value: string): string {
	return value.trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}

function matchesIdentity(value: string, emails: Set<string>, names: Set<string>): boolean {
	if (!value.trim()) return false;
	const emailMatches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) ?? [];
	if (emailMatches.some((email) => emails.has(normalizeEmail(email)))) return true;
	return value
		.split(/[,;\n|]+/u)
		.map(normalizeName)
		.some((name) => names.has(name));
}
