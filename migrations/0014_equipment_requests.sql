CREATE TABLE IF NOT EXISTS equipment_requests (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL DEFAULT '',
	requestor TEXT NOT NULL DEFAULT '',
	estimated_cost TEXT NOT NULL DEFAULT '',
	product_url TEXT NOT NULL DEFAULT '',
	explanation TEXT NOT NULL DEFAULT '',
	additional_info TEXT NOT NULL DEFAULT '',
	submitted_at TEXT NOT NULL DEFAULT '',
	synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_equipment_requests_submitted
	ON equipment_requests(submitted_at DESC);
