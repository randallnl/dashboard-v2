CREATE TABLE IF NOT EXISTS drive_documents (
	id TEXT PRIMARY KEY,
	parent_id TEXT NOT NULL DEFAULT '',
	root_section_id TEXT NOT NULL DEFAULT '',
	name TEXT NOT NULL,
	mime_type TEXT NOT NULL DEFAULT '',
	web_view_url TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT '',
	modified_at TEXT NOT NULL DEFAULT '',
	byte_size INTEGER NOT NULL DEFAULT 0,
	is_folder INTEGER NOT NULL DEFAULT 0 CHECK (is_folder IN (0, 1)),
	is_shortcut INTEGER NOT NULL DEFAULT 0 CHECK (is_shortcut IN (0, 1)),
	shortcut_target_id TEXT NOT NULL DEFAULT '',
	visibility TEXT NOT NULL DEFAULT 'admin' CHECK (visibility IN ('member', 'colab', 'admin')),
	sync_run_id TEXT NOT NULL,
	synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drive_documents_parent ON drive_documents (parent_id, name);
CREATE INDEX IF NOT EXISTS idx_drive_documents_visibility ON drive_documents (visibility, modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_documents_sync_run ON drive_documents (sync_run_id);

CREATE TABLE IF NOT EXISTS drive_sync_state (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
	started_at TEXT NOT NULL DEFAULT '',
	completed_at TEXT NOT NULL DEFAULT '',
	item_count INTEGER NOT NULL DEFAULT 0,
	error_message TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO drive_sync_state (id) VALUES (1);
