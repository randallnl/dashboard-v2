CREATE TABLE IF NOT EXISTS social_library_assets (
	id TEXT PRIMARY KEY,
	object_key TEXT NOT NULL UNIQUE,
	filename TEXT NOT NULL DEFAULT '',
	content_type TEXT NOT NULL DEFAULT '',
	byte_size INTEGER NOT NULL DEFAULT 0,
	alt_text TEXT NOT NULL DEFAULT '',
	tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
	credit TEXT NOT NULL DEFAULT '',
	created_by_member_id TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_library_assets_created
	ON social_library_assets (created_at DESC);
