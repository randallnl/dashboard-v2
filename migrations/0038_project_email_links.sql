CREATE TABLE IF NOT EXISTS project_email_links (
	project_id TEXT NOT NULL,
	url TEXT NOT NULL,
	label TEXT NOT NULL,
	source_message_id TEXT NOT NULL,
	source_subject TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
	removed_at TEXT NOT NULL DEFAULT '',
	PRIMARY KEY (project_id, url),
	FOREIGN KEY (source_message_id, project_id)
		REFERENCES project_email_ingest(source_message_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_email_links_active
	ON project_email_links (project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS project_email_ingest_shortcuts (
	source_message_id TEXT NOT NULL,
	project_id TEXT NOT NULL,
	target_file_id TEXT NOT NULL,
	drive_shortcut_id TEXT NOT NULL,
	PRIMARY KEY (source_message_id, project_id, target_file_id),
	FOREIGN KEY (source_message_id, project_id)
		REFERENCES project_email_ingest(source_message_id, project_id)
);
