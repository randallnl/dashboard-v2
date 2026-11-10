import type { Database } from './types';

export type QuickBooksFinanceConnection = {
	realmId: string;
	companyName: string;
	encryptedRefreshToken: string;
	connectedBy: string;
	connectedAt: string;
	updatedAt: string;
	lastSyncedAt: string;
	lastSyncStatus: 'pending' | 'complete' | 'failed';
	lastSyncError: string;
};

export type FinanceQuickBooksAccount = {
	qboAccountId: string;
	name: string;
	accountType: string;
	accountSubType: string;
	currentBalance: number;
	position: number;
};

export type FinanceQuickBooksSnapshot = {
	id: number;
	asOfDate: string;
	periodStartDate: string;
	accountingMethod: 'accrual';
	cashTotal: number;
	accountsReceivable: number;
	accountsPayable: number;
	totalAssets: number;
	totalLiabilities: number;
	totalEquity: number;
	monthIncome: number;
	monthExpenses: number;
	monthNetIncome: number;
	sourceUpdatedAt: string;
	createdAt: string;
	accounts: FinanceQuickBooksAccount[];
};

type ConnectionRow = {
	realm_id: string;
	company_name: string;
	encrypted_refresh_token: string;
	connected_by: string;
	connected_at: string;
	updated_at: string;
	last_synced_at: string;
	last_sync_status: QuickBooksFinanceConnection['lastSyncStatus'];
	last_sync_error: string;
};

type SnapshotRow = {
	id: number;
	accounting_method: 'accrual';
	as_of_date: string;
	period_start_date: string;
	cash_total: number;
	accounts_receivable: number;
	accounts_payable: number;
	total_assets: number;
	total_liabilities: number;
	total_equity: number;
	month_income: number;
	month_expenses: number;
	month_net_income: number;
	source_updated_at: string;
	created_at: string;
};

type AccountRow = {
	snapshot_id: number;
	qbo_account_id: string;
	name: string;
	account_type: string;
	account_sub_type: string;
	current_balance: number;
	position: number;
};

function connectionFromRow(row: ConnectionRow): QuickBooksFinanceConnection {
	return {
		realmId: row.realm_id,
		companyName: row.company_name,
		encryptedRefreshToken: row.encrypted_refresh_token,
		connectedBy: row.connected_by,
		connectedAt: row.connected_at,
		updatedAt: row.updated_at,
		lastSyncedAt: row.last_synced_at,
		lastSyncStatus: row.last_sync_status,
		lastSyncError: row.last_sync_error
	};
}

function accountFromRow(row: AccountRow): FinanceQuickBooksAccount {
	return {
		qboAccountId: row.qbo_account_id,
		name: row.name,
		accountType: row.account_type,
		accountSubType: row.account_sub_type,
		currentBalance: Number(row.current_balance) || 0,
		position: Number(row.position) || 0
	};
}

function snapshotFromRow(
	row: SnapshotRow,
	accounts: FinanceQuickBooksAccount[]
): FinanceQuickBooksSnapshot {
	return {
		id: Number(row.id),
		asOfDate: row.as_of_date,
		periodStartDate: row.period_start_date,
		accountingMethod: row.accounting_method,
		cashTotal: Number(row.cash_total) || 0,
		accountsReceivable: Number(row.accounts_receivable) || 0,
		accountsPayable: Number(row.accounts_payable) || 0,
		totalAssets: Number(row.total_assets) || 0,
		totalLiabilities: Number(row.total_liabilities) || 0,
		totalEquity: Number(row.total_equity) || 0,
		monthIncome: Number(row.month_income) || 0,
		monthExpenses: Number(row.month_expenses) || 0,
		monthNetIncome: Number(row.month_net_income) || 0,
		sourceUpdatedAt: row.source_updated_at,
		createdAt: row.created_at,
		accounts
	};
}

export class QuickBooksFinanceRepository {
	constructor(private readonly db: Database) {}

	async createOAuthState(
		stateHash: string,
		createdBy: string,
		expiresAt: string,
		createdAt: string
	): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO quickbooks_finance_oauth_state (state_hash, created_by, expires_at, created_at)
				 VALUES (?1, ?2, ?3, ?4)`
			)
			.bind(stateHash, createdBy, expiresAt, createdAt)
			.run();
	}

	async consumeOAuthState(stateHash: string, now: string): Promise<string | null> {
		const state = await this.db
			.prepare(
				`SELECT created_by, expires_at FROM quickbooks_finance_oauth_state
				 WHERE state_hash = ?1 LIMIT 1`
			)
			.bind(stateHash)
			.first<{ created_by: string; expires_at: string }>();
		await this.db
			.prepare('DELETE FROM quickbooks_finance_oauth_state WHERE state_hash = ?1')
			.bind(stateHash)
			.run();
		if (!state || state.expires_at < now) return null;
		return state.created_by;
	}

	async connection(): Promise<QuickBooksFinanceConnection | null> {
		const row = await this.db
			.prepare(
				`SELECT realm_id, company_name, encrypted_refresh_token, connected_by, connected_at,
					updated_at, last_synced_at, last_sync_status, last_sync_error
				 FROM quickbooks_finance_connection WHERE id = 1`
			)
			.first<ConnectionRow>();
		return row ? connectionFromRow(row) : null;
	}

	async saveConnection(input: {
		realmId: string;
		companyName: string;
		encryptedRefreshToken: string;
		connectedBy: string;
		now: string;
	}): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO quickbooks_finance_connection (
					id, realm_id, company_name, encrypted_refresh_token, connected_by, connected_at, updated_at
				) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?5)
				ON CONFLICT(id) DO UPDATE SET
				realm_id = excluded.realm_id, company_name = excluded.company_name,
				encrypted_refresh_token = excluded.encrypted_refresh_token,
				connected_by = excluded.connected_by, connected_at = excluded.connected_at,
				updated_at = excluded.updated_at, last_synced_at = '', last_sync_status = 'pending', last_sync_error = ''`
			)
			.bind(
				input.realmId,
				input.companyName,
				input.encryptedRefreshToken,
				input.connectedBy,
				input.now
			)
			.run();
	}

	async updateRefreshToken(encryptedRefreshToken: string, now: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE quickbooks_finance_connection
				 SET encrypted_refresh_token = ?1, updated_at = ?2 WHERE id = 1`
			)
			.bind(encryptedRefreshToken, now)
			.run();
	}

	async recordSyncFailure(message: string, now: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE quickbooks_finance_connection
				 SET last_synced_at = ?1, last_sync_status = 'failed', last_sync_error = ?2, updated_at = ?1
				 WHERE id = 1`
			)
			.bind(now, message.slice(0, 500))
			.run();
	}

	async saveSnapshot(
		input: Omit<FinanceQuickBooksSnapshot, 'id' | 'createdAt' | 'accounts'> & {
			accounts: Array<Omit<FinanceQuickBooksAccount, 'position'>>;
		}
	): Promise<FinanceQuickBooksSnapshot> {
		const createdAt = new Date().toISOString();
		const inserted = await this.db
			.prepare(
				`INSERT INTO finance_quickbooks_snapshots (
					as_of_date, period_start_date, accounting_method, cash_total, accounts_receivable,
					accounts_payable, total_assets, total_liabilities, total_equity, month_income,
					month_expenses, month_net_income, source_updated_at, created_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
			)
			.bind(
				input.asOfDate,
				input.periodStartDate,
				input.accountingMethod,
				input.cashTotal,
				input.accountsReceivable,
				input.accountsPayable,
				input.totalAssets,
				input.totalLiabilities,
				input.totalEquity,
				input.monthIncome,
				input.monthExpenses,
				input.monthNetIncome,
				input.sourceUpdatedAt,
				createdAt
			)
			.run();
		const snapshotId = Number(inserted.meta.last_row_id);
		if (!snapshotId) throw new Error('Could not record QuickBooks snapshot');
		await this.db.batch([
			...input.accounts.map((account, position) =>
				this.db
					.prepare(
						`INSERT INTO finance_quickbooks_snapshot_accounts (
							snapshot_id, qbo_account_id, name, account_type, account_sub_type, current_balance, position
						) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
					)
					.bind(
						snapshotId,
						account.qboAccountId,
						account.name,
						account.accountType,
						account.accountSubType,
						account.currentBalance,
						position
					)
			),
			this.db
				.prepare(
					`UPDATE quickbooks_finance_connection
					 SET last_synced_at = ?1, last_sync_status = 'complete', last_sync_error = '', updated_at = ?1
					 WHERE id = 1`
				)
				.bind(createdAt)
		]);
		return {
			...input,
			id: snapshotId,
			createdAt,
			accounts: input.accounts.map((account, position) => ({ ...account, position }))
		};
	}

	async latestSnapshot(): Promise<FinanceQuickBooksSnapshot | null> {
		const row = await this.db
			.prepare(
				`SELECT id, as_of_date, period_start_date, accounting_method, cash_total, accounts_receivable,
					accounts_payable, total_assets, total_liabilities, total_equity, month_income,
					month_expenses, month_net_income, source_updated_at, created_at
				 FROM finance_quickbooks_snapshots ORDER BY id DESC LIMIT 1`
			)
			.first<SnapshotRow>();
		if (!row) return null;
		const accounts = await this.db
			.prepare(
				`SELECT snapshot_id, qbo_account_id, name, account_type, account_sub_type, current_balance, position
				 FROM finance_quickbooks_snapshot_accounts WHERE snapshot_id = ?1 ORDER BY position ASC, name COLLATE NOCASE`
			)
			.bind(row.id)
			.all<AccountRow>();
		return snapshotFromRow(row, accounts.results.map(accountFromRow));
	}
}
