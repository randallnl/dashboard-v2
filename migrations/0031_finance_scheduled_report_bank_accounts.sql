CREATE TABLE IF NOT EXISTS finance_scheduled_report_bank_accounts (
	period_key TEXT NOT NULL REFERENCES finance_scheduled_report_snapshots(period_key) ON DELETE CASCADE,
	name TEXT NOT NULL,
	balance REAL NOT NULL,
	position INTEGER NOT NULL,
	PRIMARY KEY (period_key, position)
);

CREATE INDEX IF NOT EXISTS idx_finance_scheduled_report_bank_accounts_period
	ON finance_scheduled_report_bank_accounts (period_key, position);
