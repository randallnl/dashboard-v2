import type { ProjectEmailLink } from '$lib/types/domain';
import type { Database } from './types';

type ProjectEmailLinkRow = {
	project_id: string;
	url: string;
	label: string;
	source_message_id: string;
	source_subject: string;
	created_at: string;
};

function fromRow(row: ProjectEmailLinkRow): ProjectEmailLink {
	return {
		projectId: row.project_id,
		url: row.url,
		label: row.label,
		sourceMessageId: row.source_message_id,
		sourceSubject: row.source_subject,
		createdAt: row.created_at
	};
}

export class ProjectEmailLinkRepository {
	constructor(private readonly db: Database) {}

	async list(projectId: string): Promise<ProjectEmailLink[]> {
		const result = await this.db
			.prepare(
				`SELECT project_id, url, label, source_message_id, source_subject, created_at
				 FROM project_email_links
				 WHERE project_id = ?1 AND status = 'active'
				 ORDER BY created_at DESC, url COLLATE NOCASE`
			)
			.bind(projectId)
			.all<ProjectEmailLinkRow>();
		return result.results.map(fromRow);
	}

	async record(input: {
		projectId: string;
		sourceMessageId: string;
		sourceSubject: string;
		links: Array<{ url: string; label: string }>;
		now: string;
	}): Promise<void> {
		if (!input.links.length) return;
		for (let offset = 0; offset < input.links.length; offset += 75) {
			await this.db.batch(
				input.links.slice(offset, offset + 75).map((link) =>
					this.db
						.prepare(
							`INSERT INTO project_email_links (
								project_id, url, label, source_message_id, source_subject, created_at
							) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
							ON CONFLICT(project_id, url) DO NOTHING`
						)
						.bind(
							input.projectId,
							link.url,
							link.label,
							input.sourceMessageId,
							input.sourceSubject,
							input.now
						)
				)
			);
		}
	}

	async remove(projectId: string, url: string, now: string): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE project_email_links
				 SET status = 'removed', removed_at = ?3
				 WHERE project_id = ?1 AND url = ?2 AND status = 'active'`
			)
			.bind(projectId, url, now)
			.run();
		return result.meta.changes > 0;
	}
}
