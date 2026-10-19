CREATE TABLE IF NOT EXISTS social_posts (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL DEFAULT '',
	body TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'draft'
		CHECK (status IN ('draft', 'review', 'scheduled', 'published')),
	scheduled_at TEXT NOT NULL DEFAULT '',
	published_at TEXT NOT NULL DEFAULT '',
	published_url TEXT NOT NULL DEFAULT '',
	project_source TEXT NOT NULL DEFAULT ''
		CHECK (project_source IN ('', 'project', 'community')),
	project_id TEXT NOT NULL DEFAULT '',
	created_by_member_id TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_posts_schedule
	ON social_posts (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_social_posts_project
	ON social_posts (project_source, project_id);

CREATE TABLE IF NOT EXISTS social_post_channels (
	post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
	platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'bluesky', 'threads', 'youtube')),
	body TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'draft'
		CHECK (status IN ('draft', 'review', 'scheduled', 'published')),
	scheduled_at TEXT NOT NULL DEFAULT '',
	published_at TEXT NOT NULL DEFAULT '',
	published_url TEXT NOT NULL DEFAULT '',
	PRIMARY KEY (post_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_channels_schedule
	ON social_post_channels (status, scheduled_at);

CREATE TABLE IF NOT EXISTS social_post_assets (
	id TEXT PRIMARY KEY,
	post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
	storage TEXT NOT NULL CHECK (storage IN ('r2', 'source')),
	object_key TEXT NOT NULL DEFAULT '',
	source_url TEXT NOT NULL DEFAULT '',
	filename TEXT NOT NULL DEFAULT '',
	content_type TEXT NOT NULL DEFAULT '',
	byte_size INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_assets_post
	ON social_post_assets (post_id);
