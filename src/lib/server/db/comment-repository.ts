import type { ProjectEventComment, ProjectEventSource } from '$lib/types/domain';
import type { Database } from './types';

type CommentRow = {
	id: string;
	source: ProjectEventSource;
	event_id: string;
	member_id: string;
	author_label: string;
	body: string;
	mentions_json: string;
	created_at: string;
};

function mentions(value: string): string[] {
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
	} catch {
		return [];
	}
}

function mapComment(row: CommentRow): ProjectEventComment {
	return {
		id: row.id,
		source: row.source,
		eventId: row.event_id,
		authorLabel: row.author_label,
		body: row.body,
		mentionLabels: mentions(row.mentions_json),
		createdAt: row.created_at
	};
}

export class CommentRepository {
	constructor(private readonly db: Database) {}

	async list(source: ProjectEventSource, eventId: string): Promise<ProjectEventComment[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM project_event_comments
				 WHERE source = ?1 AND event_id = ?2
				 ORDER BY created_at ASC, id ASC`
			)
			.bind(source, eventId)
			.all<CommentRow>();
		return result.results.map(mapComment);
	}

	async create(input: {
		id: string;
		source: ProjectEventSource;
		eventId: string;
		memberId: string;
		authorLabel: string;
		body: string;
		mentionLabels: string[];
		createdAt: string;
	}): Promise<ProjectEventComment> {
		await this.db
			.prepare(
				`INSERT INTO project_event_comments (
					id, source, event_id, member_id, author_label, body, mentions_json, created_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
			)
			.bind(
				input.id,
				input.source,
				input.eventId,
				input.memberId,
				input.authorLabel,
				input.body,
				JSON.stringify(input.mentionLabels),
				input.createdAt
			)
			.run();
		return {
			id: input.id,
			source: input.source,
			eventId: input.eventId,
			authorLabel: input.authorLabel,
			body: input.body,
			mentionLabels: input.mentionLabels,
			createdAt: input.createdAt
		};
	}

	async upsertMondayUpdate(input: {
		updateId: string;
		source: ProjectEventSource;
		eventId: string;
		creatorId: string;
		creatorName: string;
		body: string;
		createdAt: string;
	}): Promise<boolean> {
		const result = await this.db
			.prepare(
				`INSERT INTO project_event_comments (
					id, source, event_id, member_id, author_label, body, mentions_json, created_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', ?7)
				ON CONFLICT(id) DO UPDATE SET
					author_label = excluded.author_label,
					body = excluded.body,
					created_at = excluded.created_at
				WHERE project_event_comments.id LIKE 'monday:%'`
			)
			.bind(
				`monday:${input.updateId}`,
				input.source,
				input.eventId,
				`monday:${input.creatorId || 'unknown'}`,
				input.creatorName,
				input.body,
				input.createdAt
			)
			.run();
		return result.meta.changes > 0;
	}
}
