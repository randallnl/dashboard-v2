import type { DashboardActivity, DashboardActivityKind, ProjectEventSource } from '$lib/types/domain';
import type { Database } from './types';

type ActivityRow = {
	id: string;
	kind: DashboardActivityKind;
	source: ProjectEventSource;
	event_id: string;
	title: string;
	summary: string;
	author_label: string;
	created_at: string;
};

function mapActivity(row: ActivityRow): DashboardActivity {
	return {
		id: row.id,
		kind: row.kind,
		source: row.source,
		eventId: row.event_id,
		title: row.title,
		summary: row.summary,
		authorLabel: row.author_label,
		createdAt: row.created_at
	};
}

export class ProjectActivityRepository {
	constructor(private readonly db: Database) {}

	async listRecent(limit = 16): Promise<DashboardActivity[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM (
					SELECT
						'project-created:' || record.id AS id,
						'project_created' AS kind,
						record.source AS source,
						record.id AS event_id,
						record.title AS title,
						'Added to the project board.' AS summary,
						'' AS author_label,
						json_extract(record.record_json, '$.creationLog') AS created_at
					FROM project_event_records record
					WHERE record.source = 'project'
						AND trim(COALESCE(json_extract(record.record_json, '$.creationLog'), '')) <> ''

					UNION ALL

					SELECT
						'project-change:' || change_log.id AS id,
						'project_changed' AS kind,
						change_log.source AS source,
						change_log.event_id AS event_id,
						change_log.title AS title,
						change_log.summary AS summary,
						'' AS author_label,
						change_log.created_at AS created_at
					FROM project_event_change_log change_log

					UNION ALL

					SELECT
						'comment:' || comment.id AS id,
						CASE WHEN comment.id LIKE 'monday:%' THEN 'monday_update' ELSE 'comment' END AS kind,
						comment.source AS source,
						comment.event_id AS event_id,
						record.title AS title,
						substr(comment.body, 1, 280) AS summary,
						comment.author_label AS author_label,
						comment.created_at AS created_at
					FROM project_event_comments comment
					INNER JOIN project_event_records record
						ON record.source = comment.source AND record.id = comment.event_id
				)
				ORDER BY created_at DESC, id DESC
				LIMIT ?1`
			)
			.bind(Math.min(Math.max(limit, 1), 40))
			.all<ActivityRow>();
		return result.results.map(mapActivity);
	}
}
