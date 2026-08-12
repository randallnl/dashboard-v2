CREATE TABLE IF NOT EXISTS work_trade_discounts (
	member_id TEXT NOT NULL,
	month TEXT NOT NULL,
	membership_type TEXT NOT NULL,
	membership_price REAL NOT NULL,
	activity_count INTEGER NOT NULL DEFAULT 0,
	activities_json TEXT NOT NULL DEFAULT '[]',
	work_summary TEXT NOT NULL DEFAULT '',
	eligible_discount REAL NOT NULL DEFAULT 0,
	approved_discount REAL NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'pending_review'
		CHECK (status IN ('pending_review', 'approved', 'opted_in', 'declined', 'shopify_updated')),
	reviewed_by TEXT NOT NULL DEFAULT '',
	reviewed_at TEXT NOT NULL DEFAULT '',
	member_opted_in_at TEXT NOT NULL DEFAULT '',
	shopify_updated_at TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (member_id, month)
);

CREATE INDEX IF NOT EXISTS idx_work_trade_discounts_month_status
	ON work_trade_discounts (month, status, updated_at);
