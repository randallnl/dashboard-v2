CREATE TABLE IF NOT EXISTS work_trade_generation_runs (
	month TEXT PRIMARY KEY,
	generated_at TEXT NOT NULL,
	generated_by TEXT NOT NULL DEFAULT '',
	summaries_generated INTEGER NOT NULL DEFAULT 0
);
