CREATE TABLE IF NOT EXISTS drive_document_annotations (
	document_id TEXT PRIMARY KEY,
	category TEXT NOT NULL DEFAULT '',
	summary TEXT NOT NULL DEFAULT '',
	keywords TEXT NOT NULL DEFAULT '',
	is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
	featured_at TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL,
	updated_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drive_document_annotations_featured
	ON drive_document_annotations (is_featured, featured_at DESC);

CREATE INDEX IF NOT EXISTS idx_drive_document_annotations_category
	ON drive_document_annotations (category);
