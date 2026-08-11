import type { Database } from './types';

export type MemberOnboardingProject = {
	memberId: string;
	projectId: string;
	completedTaskKeys: string[];
	status: 'pending' | 'processing' | 'complete';
};

type MemberOnboardingRow = {
	member_id: string;
	monday_project_id: string;
	completed_tasks_json: string;
	status: 'pending' | 'processing' | 'complete';
};

function mapRow(row: MemberOnboardingRow): MemberOnboardingProject {
	let completedTaskKeys: string[] = [];
	try {
		const parsed: unknown = JSON.parse(row.completed_tasks_json);
		if (Array.isArray(parsed)) {
			completedTaskKeys = parsed.filter((value): value is string => typeof value === 'string');
		}
	} catch {
		// An invalid task checkpoint is safely treated as incomplete.
	}
	return {
		memberId: row.member_id,
		projectId: row.monday_project_id,
		completedTaskKeys,
		status: row.status
	};
}

export class MemberOnboardingRepository {
	constructor(private readonly db: Database) {}

	async reserve(memberId: string, updatedAt: string): Promise<boolean> {
		const result = await this.db
			.prepare(
				`INSERT OR IGNORE INTO member_onboarding_projects (member_id, updated_at)
				 VALUES (?1, ?2)`
			)
			.bind(memberId, updatedAt)
			.run();
		return result.meta.changes === 1;
	}

	async listPending(): Promise<MemberOnboardingProject[]> {
		const result = await this.db
			.prepare(
				`SELECT member_id, monday_project_id, completed_tasks_json, status
				 FROM member_onboarding_projects
				 WHERE status IN ('pending', 'processing')
				 ORDER BY created_at ASC`
			)
			.all<MemberOnboardingRow>();
		return result.results.map(mapRow);
	}

	async claim(memberId: string, updatedAt: string, staleBefore: string): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE member_onboarding_projects
				 SET status = 'processing', updated_at = ?2
				 WHERE member_id = ?1
				   AND (status = 'pending' OR (status = 'processing' AND updated_at <= ?3))`
			)
			.bind(memberId, updatedAt, staleBefore)
			.run();
		return result.meta.changes === 1;
	}

	async setProject(memberId: string, projectId: string, updatedAt: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE member_onboarding_projects
				 SET monday_project_id = ?2, last_error = '', updated_at = ?3
				 WHERE member_id = ?1`
			)
			.bind(memberId, projectId, updatedAt)
			.run();
	}

	async checkpointTask(memberId: string, taskKeys: string[], updatedAt: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE member_onboarding_projects
				 SET completed_tasks_json = ?2, last_error = '', updated_at = ?3
				 WHERE member_id = ?1`
			)
			.bind(memberId, JSON.stringify(taskKeys), updatedAt)
			.run();
	}

	async complete(memberId: string, updatedAt: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE member_onboarding_projects
				 SET status = 'complete', last_error = '', updated_at = ?2
				 WHERE member_id = ?1`
			)
			.bind(memberId, updatedAt)
			.run();
	}

	async recordFailure(memberId: string, message: string, updatedAt: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE member_onboarding_projects
				 SET status = 'pending', last_error = ?2, updated_at = ?3
				 WHERE member_id = ?1`
			)
			.bind(memberId, message.slice(0, 500), updatedAt)
			.run();
	}
}
