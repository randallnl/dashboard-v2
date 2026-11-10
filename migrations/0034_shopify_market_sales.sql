CREATE TABLE IF NOT EXISTS shopify_market_sales_ingest (
	source_message_id TEXT PRIMARY KEY,
	source_sender TEXT NOT NULL,
	source_subject TEXT NOT NULL,
	received_at TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
	completed_at TEXT NOT NULL DEFAULT '',
	last_error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS shopify_market_sales (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	source_message_id TEXT NOT NULL UNIQUE REFERENCES shopify_market_sales_ingest(source_message_id) ON DELETE CASCADE,
	sale_date TEXT NOT NULL,
	total_sales REAL NOT NULL DEFAULT 0,
	cash_sales REAL NOT NULL DEFAULT 0,
	card_sales REAL NOT NULL DEFAULT 0,
	other_sales REAL NOT NULL DEFAULT 0,
	project_source TEXT NOT NULL DEFAULT '',
	project_id TEXT NOT NULL DEFAULT '',
	project_title TEXT NOT NULL DEFAULT '',
	cash_deposited_at TEXT NOT NULL DEFAULT '',
	cash_deposited_by TEXT NOT NULL DEFAULT '',
	source_subject TEXT NOT NULL,
	source_received_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shopify_market_sales_date
	ON shopify_market_sales (sale_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_shopify_market_sales_project
	ON shopify_market_sales (project_source, project_id);
