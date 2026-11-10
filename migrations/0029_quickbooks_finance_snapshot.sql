CREATE TABLE IF NOT EXISTS quickbooks_finance_connection (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	realm_id TEXT NOT NULL,
	company_name TEXT NOT NULL DEFAULT '',
	encrypted_refresh_token TEXT NOT NULL,
	connected_by TEXT NOT NULL,
	connected_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	last_synced_at TEXT NOT NULL DEFAULT '',
	last_sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (last_sync_status IN ('pending', 'complete', 'failed')),
	last_sync_error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quickbooks_finance_oauth_state (
	state_hash TEXT PRIMARY KEY,
	created_by TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quickbooks_finance_oauth_state_expires
	ON quickbooks_finance_oauth_state (expires_at);

CREATE TABLE IF NOT EXISTS finance_quickbooks_snapshots (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	as_of_date TEXT NOT NULL,
	period_start_date TEXT NOT NULL,
	accounting_method TEXT NOT NULL DEFAULT 'accrual',
	cash_total REAL NOT NULL DEFAULT 0,
	accounts_receivable REAL NOT NULL DEFAULT 0,
	accounts_payable REAL NOT NULL DEFAULT 0,
	total_assets REAL NOT NULL DEFAULT 0,
	total_liabilities REAL NOT NULL DEFAULT 0,
	total_equity REAL NOT NULL DEFAULT 0,
	month_income REAL NOT NULL DEFAULT 0,
	month_expenses REAL NOT NULL DEFAULT 0,
	month_net_income REAL NOT NULL DEFAULT 0,
	source_updated_at TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_finance_quickbooks_snapshots_created
	ON finance_quickbooks_snapshots (created_at DESC);

CREATE TABLE IF NOT EXISTS finance_quickbooks_snapshot_accounts (
	snapshot_id INTEGER NOT NULL,
	qbo_account_id TEXT NOT NULL,
	name TEXT NOT NULL,
	account_type TEXT NOT NULL,
	account_sub_type TEXT NOT NULL DEFAULT '',
	current_balance REAL NOT NULL DEFAULT 0,
	position INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (snapshot_id, qbo_account_id),
	FOREIGN KEY (snapshot_id) REFERENCES finance_quickbooks_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_finance_quickbooks_snapshot_accounts_snapshot
	ON finance_quickbooks_snapshot_accounts (snapshot_id, position);
