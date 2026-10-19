CREATE TABLE IF NOT EXISTS social_post_reviews (
	id TEXT PRIMARY KEY,
	post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
	action TEXT NOT NULL
		CHECK (action IN ('submitted', 'approved', 'changes_requested', 'commented')),
	note TEXT NOT NULL DEFAULT '',
	member_id TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_post_reviews_post_created
	ON social_post_reviews (post_id, created_at DESC);
