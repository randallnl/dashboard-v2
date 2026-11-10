CREATE TABLE IF NOT EXISTS finance_reconciliation_tasks (
	month TEXT NOT NULL,
	account_key TEXT NOT NULL CHECK (account_key IN ('st-marys-bank', 'st-marys-credit-card', 'paypal', 'venmo')),
	status TEXT NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'complete')),
	statement_file_id TEXT NOT NULL DEFAULT '',
	statement_file_name TEXT NOT NULL DEFAULT '',
	statement_uploaded_at TEXT NOT NULL DEFAULT '',
	statement_uploaded_by TEXT NOT NULL DEFAULT '',
	quickbooks_forwarded_at TEXT NOT NULL DEFAULT '',
	completed_at TEXT NOT NULL DEFAULT '',
	completed_by TEXT NOT NULL DEFAULT '',
	PRIMARY KEY (month, account_key)
);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_tasks_month_status
	ON finance_reconciliation_tasks (month, status);
