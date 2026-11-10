CREATE TABLE IF NOT EXISTS social_platform_connections (
	platform TEXT PRIMARY KEY CHECK (platform IN ('instagram')),
	instagram_account_id TEXT NOT NULL,
	instagram_username TEXT NOT NULL DEFAULT '',
	facebook_page_id TEXT NOT NULL,
	facebook_page_name TEXT NOT NULL DEFAULT '',
	encrypted_page_access_token TEXT NOT NULL,
	connected_by_member_id TEXT NOT NULL,
	connected_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	last_verified_at TEXT NOT NULL DEFAULT '',
	last_error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS social_instagram_oauth_state (
	state_hash TEXT PRIMARY KEY,
	created_by_member_id TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_instagram_oauth_state_expires
	ON social_instagram_oauth_state (expires_at);

CREATE TABLE IF NOT EXISTS social_instagram_connection_candidates (
	selection_id TEXT NOT NULL,
	facebook_page_id TEXT NOT NULL,
	facebook_page_name TEXT NOT NULL DEFAULT '',
	instagram_account_id TEXT NOT NULL,
	instagram_username TEXT NOT NULL DEFAULT '',
	encrypted_page_access_token TEXT NOT NULL,
	created_by_member_id TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	PRIMARY KEY (selection_id, facebook_page_id)
);

CREATE INDEX IF NOT EXISTS idx_social_instagram_candidates_member_expires
	ON social_instagram_connection_candidates (created_by_member_id, expires_at);
