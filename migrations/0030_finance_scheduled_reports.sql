CREATE TABLE IF NOT EXISTS finance_scheduled_report_snapshots (
	period_key TEXT PRIMARY KEY,
	as_of_date TEXT NOT NULL,
	period_start_date TEXT NOT NULL,
	cash_total REAL NOT NULL DEFAULT 0,
	accounts_receivable REAL NOT NULL DEFAULT 0,
	accounts_payable REAL NOT NULL DEFAULT 0,
	total_assets REAL NOT NULL DEFAULT 0,
	total_liabilities REAL NOT NULL DEFAULT 0,
	total_equity REAL NOT NULL DEFAULT 0,
	month_income REAL NOT NULL DEFAULT 0,
	month_expenses REAL NOT NULL DEFAULT 0,
	month_net_income REAL NOT NULL DEFAULT 0,
	balance_sheet_received_at TEXT NOT NULL DEFAULT '',
	profit_loss_received_at TEXT NOT NULL DEFAULT '',
	balance_sheet_filename TEXT NOT NULL DEFAULT '',
	profit_loss_filename TEXT NOT NULL DEFAULT '',
	source_updated_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_finance_scheduled_report_snapshots_updated
	ON finance_scheduled_report_snapshots (source_updated_at DESC);

CREATE TABLE IF NOT EXISTS finance_scheduled_report_ingest (
	source_message_id TEXT PRIMARY KEY,
	source_sender TEXT NOT NULL,
	source_subject TEXT NOT NULL,
	received_at TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
	accepted_attachment_count INTEGER NOT NULL DEFAULT 0,
	completed_at TEXT NOT NULL DEFAULT '',
	last_error TEXT NOT NULL DEFAULT ''
);
