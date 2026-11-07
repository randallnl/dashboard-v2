CREATE TABLE IF NOT EXISTS receipt_ingest (
	source_message_id TEXT PRIMARY KEY,
	source_sender TEXT NOT NULL,
	source_subject TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
	received_at TEXT NOT NULL,
	completed_at TEXT,
	notification_message_id TEXT,
	last_error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS receipt_ingest_files (
	source_message_id TEXT NOT NULL,
	attachment_hash TEXT NOT NULL,
	filename TEXT NOT NULL,
	mime_type TEXT NOT NULL,
	drive_file_id TEXT,
	quickbooks_message_id TEXT,
	PRIMARY KEY (source_message_id, attachment_hash),
	FOREIGN KEY (source_message_id) REFERENCES receipt_ingest(source_message_id)
);
