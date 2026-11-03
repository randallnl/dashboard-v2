CREATE TABLE IF NOT EXISTS drive_document_interactions (
	member_id TEXT NOT NULL,
	document_id TEXT NOT NULL,
	is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
	favorited_at TEXT NOT NULL DEFAULT '',
	last_viewed_at TEXT NOT NULL DEFAULT '',
	view_count INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (member_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_document_interactions_favorites
	ON drive_document_interactions (member_id, is_favorite, favorited_at DESC);

CREATE INDEX IF NOT EXISTS idx_drive_document_interactions_recent
	ON drive_document_interactions (member_id, last_viewed_at DESC);
