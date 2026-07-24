CREATE TABLE IF NOT EXISTS magic_login_tokens (
	token_hash TEXT PRIMARY KEY,
	email TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	used_at TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_magic_login_tokens_email
	ON magic_login_tokens (email);

CREATE INDEX IF NOT EXISTS idx_magic_login_tokens_expires_at
	ON magic_login_tokens (expires_at);

CREATE TABLE IF NOT EXISTS magic_sessions (
	session_hash TEXT PRIMARY KEY,
	email TEXT NOT NULL,
	member_id TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_magic_sessions_email
	ON magic_sessions (email);

CREATE INDEX IF NOT EXISTS idx_magic_sessions_member_id
	ON magic_sessions (member_id);

CREATE INDEX IF NOT EXISTS idx_magic_sessions_expires_at
	ON magic_sessions (expires_at);

CREATE TABLE IF NOT EXISTS colab_shifts (
	id TEXT PRIMARY KEY,
	board_id TEXT NOT NULL DEFAULT '',
	parent_id TEXT NOT NULL DEFAULT '',
	month TEXT NOT NULL DEFAULT '',
	title TEXT NOT NULL DEFAULT '',
	date_label TEXT NOT NULL DEFAULT '',
	date_value TEXT NOT NULL DEFAULT '',
	time_label TEXT NOT NULL DEFAULT '',
	member_id TEXT NOT NULL DEFAULT '',
	person TEXT NOT NULL DEFAULT '',
	covered_by TEXT NOT NULL DEFAULT '',
	coverage_status TEXT NOT NULL DEFAULT 'Open',
	is_covered INTEGER NOT NULL DEFAULT 0 CHECK (is_covered IN (0, 1)),
	tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
	synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_colab_shifts_date_value
	ON colab_shifts (date_value);

CREATE INDEX IF NOT EXISTS idx_colab_shifts_member_id_date
	ON colab_shifts (member_id, date_value);

CREATE INDEX IF NOT EXISTS idx_colab_shifts_availability
	ON colab_shifts (is_covered, date_value);

CREATE TABLE IF NOT EXISTS project_event_records (
	id TEXT NOT NULL,
	source TEXT NOT NULL,
	title TEXT NOT NULL DEFAULT '',
	date_value TEXT NOT NULL DEFAULT '',
	end_date_value TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT '',
	location TEXT NOT NULL DEFAULT '',
	owner TEXT NOT NULL DEFAULT '',
	admin_only INTEGER NOT NULL DEFAULT 0 CHECK (admin_only IN (0, 1)),
	record_json TEXT NOT NULL CHECK (json_valid(record_json)),
	synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (source, id)
);

CREATE INDEX IF NOT EXISTS idx_project_event_records_date
	ON project_event_records (date_value);

CREATE INDEX IF NOT EXISTS idx_project_event_records_source_date
	ON project_event_records (source, date_value);

CREATE INDEX IF NOT EXISTS idx_project_event_records_status_date
	ON project_event_records (status, date_value);

CREATE INDEX IF NOT EXISTS idx_project_event_records_visibility_date
	ON project_event_records (admin_only, date_value);
