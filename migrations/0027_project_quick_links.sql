CREATE TABLE IF NOT EXISTS project_quick_links (
	project_id TEXT PRIMARY KEY,
	position INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_quick_links_position
	ON project_quick_links (position, created_at);
