CREATE TABLE IF NOT EXISTS member_onboarding_projects (
	member_id TEXT PRIMARY KEY,
	monday_project_id TEXT NOT NULL DEFAULT '',
	completed_tasks_json TEXT NOT NULL DEFAULT '[]',
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete')),
	last_error TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_member_onboarding_projects_status
	ON member_onboarding_projects (status, updated_at);
