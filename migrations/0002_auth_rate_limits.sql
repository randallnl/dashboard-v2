CREATE TABLE IF NOT EXISTS auth_request_limits (
	key_hash TEXT PRIMARY KEY,
	window_start TEXT NOT NULL,
	request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_request_limits_updated_at
	ON auth_request_limits (updated_at);

