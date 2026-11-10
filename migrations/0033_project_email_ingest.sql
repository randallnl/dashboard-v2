CREATE TABLE IF NOT EXISTS project_email_addresses (
	project_id TEXT PRIMARY KEY,
	inbox_token TEXT NOT NULL UNIQUE,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_email_ingest (
	source_message_id TEXT NOT NULL,
	project_id TEXT NOT NULL,
	source_sender TEXT NOT NULL,
	source_subject TEXT NOT NULL,
	comment_id TEXT NOT NULL,
	attachment_count INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
	received_at TEXT NOT NULL,
	completed_at TEXT,
	last_error TEXT NOT NULL DEFAULT '',
	PRIMARY KEY (source_message_id, project_id)
);

CREATE TABLE IF NOT EXISTS project_email_ingest_files (
	source_message_id TEXT NOT NULL,
	project_id TEXT NOT NULL,
	drive_file_id TEXT NOT NULL,
	filename TEXT NOT NULL,
	mime_type TEXT NOT NULL,
	byte_size INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (source_message_id, project_id, drive_file_id),
	FOREIGN KEY (source_message_id, project_id)
		REFERENCES project_email_ingest(source_message_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_email_ingest_project
	ON project_email_ingest (project_id, received_at DESC);
