CREATE TABLE IF NOT EXISTS project_event_comments (
	id TEXT PRIMARY KEY,
	source TEXT NOT NULL CHECK (source IN ('project', 'community')),
	event_id TEXT NOT NULL,
	member_id TEXT NOT NULL,
	author_label TEXT NOT NULL,
	body TEXT NOT NULL,
	mentions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(mentions_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_event_comments_item
	ON project_event_comments (source, event_id, created_at);
