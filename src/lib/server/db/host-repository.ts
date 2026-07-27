import type { ProjectEventSource } from '$lib/types/domain';
import type { Database } from './types';

export type ProjectEventHost = {
	source: ProjectEventSource;
	eventId: string;
	memberId: string;
	hostLabel: string;
	updatedAt: string;
};

type HostRow = {
	source: ProjectEventSource;
	event_id: string;
	member_id: string;
	host_label: string;
	updated_at: string;
};

function mapHost(row: HostRow): ProjectEventHost {
	return {
		source: row.source,
		eventId: row.event_id,
		memberId: row.member_id,
		hostLabel: row.host_label,
		updatedAt: row.updated_at
	};
}

export class HostRepository {
	constructor(private readonly db: Database) {}

	async find(source: ProjectEventSource, eventId: string): Promise<ProjectEventHost | null> {
		const row = await this.db
			.prepare(
				`SELECT source, event_id, member_id, host_label, updated_at
				 FROM project_event_hosts WHERE source = ?1 AND event_id = ?2`
			)
			.bind(source, eventId)
			.first<HostRow>();
		return row ? mapHost(row) : null;
	}

	async listKeysForMember(memberId: string): Promise<Set<string>> {
		const result = await this.db
			.prepare(
				`SELECT source, event_id
				 FROM project_event_hosts
				 WHERE member_id = ?1`
			)
			.bind(memberId)
			.all<{ source: ProjectEventSource; event_id: string }>();
		return new Set(result.results.map((row) => `${row.source}:${row.event_id}`));
	}

	async upsert(
		source: ProjectEventSource,
		eventId: string,
		memberId: string,
		hostLabel: string,
		updatedBy: string,
		updatedAt: string
	): Promise<ProjectEventHost> {
		await this.db
			.prepare(
				`INSERT INTO project_event_hosts (
					source, event_id, member_id, host_label, updated_by, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
				ON CONFLICT(source, event_id) DO UPDATE SET
					member_id = excluded.member_id,
					host_label = excluded.host_label,
					updated_by = excluded.updated_by,
					updated_at = excluded.updated_at`
			)
			.bind(source, eventId, memberId, hostLabel, updatedBy, updatedAt)
			.run();
		return { source, eventId, memberId, hostLabel, updatedAt };
	}
}
