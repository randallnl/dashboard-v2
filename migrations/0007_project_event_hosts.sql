CREATE TABLE IF NOT EXISTS project_event_hosts (
	source TEXT NOT NULL CHECK (source IN ('project', 'community')),
	event_id TEXT NOT NULL,
	member_id TEXT NOT NULL,
	host_label TEXT NOT NULL,
	updated_by TEXT NOT NULL,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_project_event_hosts_member
	ON project_event_hosts (member_id, updated_at);
