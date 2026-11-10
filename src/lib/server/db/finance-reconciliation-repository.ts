import type { Database } from './types';

export const FINANCE_RECONCILIATION_ACCOUNTS = [
	{ key: 'st-marys-bank', label: 'St. Marys Bank' },
	{ key: 'st-marys-credit-card', label: 'St. Marys Credit Card' },
	{ key: 'paypal', label: 'PayPal' },
	{ key: 'venmo', label: 'Venmo' }
] as const;

export type FinanceAccountKey = (typeof FINANCE_RECONCILIATION_ACCOUNTS)[number]['key'];

export type FinanceReconciliationTask = {
	month: string;
	accountKey: FinanceAccountKey;
	accountLabel: string;
	status: 'outstanding' | 'complete';
	statementFileId: string;
	statementFileName: string;
	statementUploadedAt: string;
	statementUploadedBy: string;
	quickbooksForwardedAt: string;
	completedAt: string;
	completedBy: string;
};

type FinanceReconciliationTaskRow = {
	month: string;
	account_key: FinanceAccountKey;
	status: FinanceReconciliationTask['status'];
	statement_file_id: string;
	statement_file_name: string;
	statement_uploaded_at: string;
	statement_uploaded_by: string;
	quickbooks_forwarded_at: string;
	completed_at: string;
	completed_by: string;
};

const LABELS = new Map(
	FINANCE_RECONCILIATION_ACCOUNTS.map((account) => [account.key, account.label])
);

function recordFromRow(row: FinanceReconciliationTaskRow): FinanceReconciliationTask {
	return {
		month: row.month,
		accountKey: row.account_key,
		accountLabel: LABELS.get(row.account_key) ?? row.account_key,
		status: row.status,
		statementFileId: row.statement_file_id,
		statementFileName: row.statement_file_name,
		statementUploadedAt: row.statement_uploaded_at,
		statementUploadedBy: row.statement_uploaded_by,
		quickbooksForwardedAt: row.quickbooks_forwarded_at,
		completedAt: row.completed_at,
		completedBy: row.completed_by
	};
}

export function isFinanceAccountKey(value: string): value is FinanceAccountKey {
	return FINANCE_RECONCILIATION_ACCOUNTS.some((account) => account.key === value);
}

export class FinanceReconciliationRepository {
	constructor(private readonly db: Database) {}

	async ensureMonth(month: string): Promise<void> {
		await this.db.batch(
			FINANCE_RECONCILIATION_ACCOUNTS.map((account) =>
				this.db
					.prepare(
						`INSERT OR IGNORE INTO finance_reconciliation_tasks (month, account_key)
						 VALUES (?1, ?2)`
					)
					.bind(month, account.key)
			)
		);
	}

	async list(month: string): Promise<FinanceReconciliationTask[]> {
		const result = await this.db
			.prepare(
				`SELECT month, account_key, status, statement_file_id, statement_file_name,
					statement_uploaded_at, statement_uploaded_by, quickbooks_forwarded_at,
					completed_at, completed_by
				 FROM finance_reconciliation_tasks
				 WHERE month = ?1`
			)
			.bind(month)
			.all<FinanceReconciliationTaskRow>();
		const records = new Map(result.results.map((row) => [row.account_key, recordFromRow(row)]));
		return FINANCE_RECONCILIATION_ACCOUNTS.map((account) => records.get(account.key)).filter(
			(record): record is FinanceReconciliationTask => Boolean(record)
		);
	}

	async recordStatement(
		month: string,
		accountKey: FinanceAccountKey,
		input: {
			fileId: string;
			fileName: string;
			uploadedBy: string;
			quickbooksForwardedAt: string;
			now: string;
		}
	): Promise<void> {
		await this.db
			.prepare(
				`UPDATE finance_reconciliation_tasks
				 SET statement_file_id = ?3, statement_file_name = ?4, statement_uploaded_at = ?5,
					 statement_uploaded_by = ?6, quickbooks_forwarded_at = ?7,
					 status = 'outstanding', completed_at = '', completed_by = ''
				 WHERE month = ?1 AND account_key = ?2`
			)
			.bind(
				month,
				accountKey,
				input.fileId,
				input.fileName,
				input.now,
				input.uploadedBy,
				input.quickbooksForwardedAt
			)
			.run();
	}

	async complete(
		month: string,
		accountKey: FinanceAccountKey,
		completedBy: string,
		now: string
	): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE finance_reconciliation_tasks
				 SET status = 'complete', completed_at = ?3, completed_by = ?4
				 WHERE month = ?1 AND account_key = ?2
					AND statement_file_id <> '' AND quickbooks_forwarded_at <> ''`
			)
			.bind(month, accountKey, now, completedBy)
			.run();
		return result.meta.changes > 0;
	}

	async reopen(month: string, accountKey: FinanceAccountKey): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE finance_reconciliation_tasks
				 SET status = 'outstanding', completed_at = '', completed_by = ''
				 WHERE month = ?1 AND account_key = ?2`
			)
			.bind(month, accountKey)
			.run();
		return result.meta.changes > 0;
	}
}
