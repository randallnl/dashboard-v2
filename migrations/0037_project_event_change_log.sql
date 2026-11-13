CREATE TABLE IF NOT EXISTS project_event_change_log (
	id TEXT PRIMARY KEY,
	source TEXT NOT NULL CHECK (source IN ('project', 'community')),
	event_id TEXT NOT NULL,
	title TEXT NOT NULL DEFAULT '',
	summary TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_event_change_log_recent
	ON project_event_change_log (created_at DESC, source, event_id);
