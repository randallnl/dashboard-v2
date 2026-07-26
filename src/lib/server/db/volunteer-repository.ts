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
