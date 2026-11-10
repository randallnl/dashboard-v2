CREATE TABLE IF NOT EXISTS project_drive_folders (
	source TEXT NOT NULL,
	project_id TEXT NOT NULL,
	folder_id TEXT NOT NULL,
	folder_name TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (source, project_id)
);

CREATE TABLE IF NOT EXISTS project_drive_files (
	id TEXT PRIMARY KEY,
	source TEXT NOT NULL,
	project_id TEXT NOT NULL,
	folder_id TEXT NOT NULL,
	name TEXT NOT NULL,
	mime_type TEXT NOT NULL DEFAULT '',
	web_view_url TEXT NOT NULL DEFAULT '',
	byte_size INTEGER NOT NULL DEFAULT 0,
	uploaded_by_member_id TEXT NOT NULL DEFAULT '',
	uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_drive_files_project
	ON project_drive_files (source, project_id, uploaded_at DESC);
