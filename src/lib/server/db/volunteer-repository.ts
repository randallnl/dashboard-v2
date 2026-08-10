import type { ProjectEventSource } from '$lib/types/domain';
import type { Database } from './types';

export type VolunteerSignup = {
	source: ProjectEventSource;
	eventId: string;
	memberId: string;
	status: string;
	createdAt: string;
};

export class VolunteerRepository {
	constructor(private readonly db: Database) {}

	async signup(source: ProjectEventSource, eventId: string, memberId: string): Promise<boolean> {
		const result = await this.db
			.prepare(
				`INSERT OR IGNORE INTO event_volunteer_signups (source, event_id, member_id)
				 VALUES (?1, ?2, ?3)`
			)
			.bind(source, eventId, memberId)
			.run();
		return result.meta.changes === 1;
	}

	async setVolunteer(
		source: ProjectEventSource,
		eventId: string,
		memberId: string,
		isVolunteer: boolean
	): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO event_volunteer_signups (source, event_id, member_id, status)
				 VALUES (?1, ?2, ?3, ?4)
				 ON CONFLICT(source, event_id, member_id) DO UPDATE SET status = excluded.status`
			)
			.bind(source, eventId, memberId, isVolunteer ? 'Signed up' : 'Attendee')
			.run();
	}

	async listParticipantsForEvent(
		source: ProjectEventSource,
		eventId: string
	): Promise<Map<string, 'attendee' | 'volunteer'>> {
		const result = await this.db
			.prepare(
				`SELECT member_id, status
				 FROM event_volunteer_signups
				 WHERE source = ?1 AND event_id = ?2 AND status IN ('Signed up', 'Attendee')`
			)
			.bind(source, eventId)
			.all<{ member_id: string; status: string }>();
		return new Map(
			result.results.map((row) => [
				row.member_id,
				row.status === 'Signed up' ? ('volunteer' as const) : ('attendee' as const)
			])
		);
	}

	async listParticipantKeysForMember(memberId: string): Promise<Set<string>> {
		const result = await this.db
			.prepare(
				`SELECT source, event_id
				 FROM event_volunteer_signups
				 WHERE member_id = ?1 AND status IN ('Signed up', 'Attendee')`
			)
			.bind(memberId)
			.all<{ source: ProjectEventSource; event_id: string }>();
		return new Set(result.results.map((row) => `${row.source}:${row.event_id}`));
	}

	async listMemberIdsForEvent(source: ProjectEventSource, eventId: string): Promise<Set<string>> {
		const result = await this.db
			.prepare(
				`SELECT member_id
				 FROM event_volunteer_signups
				 WHERE source = ?1 AND event_id = ?2 AND status = 'Signed up'`
			)
			.bind(source, eventId)
			.all<{ member_id: string }>();
		return new Set(result.results.map((row) => row.member_id));
	}

	async listKeysForMember(memberId: string): Promise<Set<string>> {
		const result = await this.db
			.prepare(
				`SELECT source, event_id
				 FROM event_volunteer_signups
				 WHERE member_id = ?1 AND status = 'Signed up'`
			)
			.bind(memberId)
			.all<{ source: ProjectEventSource; event_id: string }>();
		return new Set(result.results.map((row) => `${row.source}:${row.event_id}`));
	}
}
