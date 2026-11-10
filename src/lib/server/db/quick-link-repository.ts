import type { ProjectEventRecord } from '$lib/types/domain';
import type { Database } from './types';
import { ProjectEventRepository } from './project-repository';

export class QuickLinkRepository {
	constructor(private readonly db: Database) {}

	async listProjectIds(): Promise<string[]> {
		const result = await this.db
			.prepare('SELECT project_id FROM project_quick_links ORDER BY position ASC, created_at ASC')
			.all<{ project_id: string }>();
		return result.results.map((row) => row.project_id);
	}

	async setProjectIncluded(projectId: string, included: boolean): Promise<void> {
		if (!included) {
			await this.db
				.prepare('DELETE FROM project_quick_links WHERE project_id = ?1')
				.bind(projectId)
				.run();
			return;
		}

		await this.db
			.prepare(
				`INSERT INTO project_quick_links (project_id, position, updated_at)
				 VALUES (?1, COALESCE((SELECT MAX(position) + 1 FROM project_quick_links), 0), CURRENT_TIMESTAMP)
				 ON CONFLICT(project_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`
			)
			.bind(projectId)
			.run();
	}

	async listPublishedProjects(): Promise<ProjectEventRecord[]> {
		const ids = await this.listProjectIds();
		const projects = new ProjectEventRepository(this.db);
		const records = await Promise.all(ids.map((id) => projects.findById('project', id)));
		// Inclusion on the public links page is an explicit publishing decision made
		// from the project details page. It must not be overridden by the internal
		// "admin only" flag used elsewhere in the project workspace.
		return records.filter((record): record is ProjectEventRecord => Boolean(record));
	}
}
