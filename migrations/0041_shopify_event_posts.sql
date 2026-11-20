CREATE TABLE IF NOT EXISTS project_shopify_event_posts (
	project_id TEXT PRIMARY KEY,
	article_id TEXT NOT NULL,
	article_handle TEXT NOT NULL,
	blog_handle TEXT NOT NULL,
	public_url TEXT NOT NULL,
	created_by_member_id TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_shopify_event_posts_updated
	ON project_shopify_event_posts (updated_at DESC);
