CREATE TABLE IF NOT EXISTS givebutter_signups (
	id TEXT PRIMARY KEY,
	donor_name TEXT NOT NULL DEFAULT '',
	donor_email TEXT NOT NULL DEFAULT '',
	campaign_id TEXT NOT NULL DEFAULT '',
	event_title TEXT NOT NULL DEFAULT '',
	transaction_date TEXT NOT NULL DEFAULT '',
	synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_givebutter_signups_campaign
	ON givebutter_signups(campaign_id, transaction_date DESC);
