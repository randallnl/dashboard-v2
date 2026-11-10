import type {
	ScheduledQuickBooksBankAccount,
	ScheduledQuickBooksReport
} from '$lib/server/finance-reports/parser';
import type { Database } from './types';

export type FinanceReportSnapshot = {
	periodKey: string;
	asOfDate: string;
	periodStartDate: string;
	cashTotal: number;
	accountsReceivable: number;
	accountsPayable: number;
	totalAssets: number;
	totalLiabilities: number;
	totalEquity: number;
	monthIncome: number;
	monthExpenses: number;
	monthNetIncome: number;
	bankAccounts: ScheduledQuickBooksBankAccount[];
	balanceSheetReceivedAt: string;
	profitLossReceivedAt: string;
	balanceSheetFilename: string;
	profitLossFilename: string;
	sourceUpdatedAt: string;
};

type SnapshotRow = {
	period_key: string;
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
	balance_sheet_received_at: string;
	profit_loss_received_at: string;
	balance_sheet_filename: string;
	profit_loss_filename: string;
	source_updated_at: string;
};

type IngestRow = {
	status: 'processing' | 'complete' | 'failed';
};

type BankAccountRow = {
	name: string;
	balance: number;
	position: number;
};

function number(value: number): number {
	return Number.isFinite(value) ? value : 0;
}

function snapshotFromRow(
	row: SnapshotRow,
	bankAccounts: ScheduledQuickBooksBankAccount[] = []
): FinanceReportSnapshot {
	return {
		periodKey: row.period_key,
		asOfDate: row.as_of_date,
		periodStartDate: row.period_start_date,
		cashTotal: number(row.cash_total),
		accountsReceivable: number(row.accounts_receivable),
		accountsPayable: number(row.accounts_payable),
		totalAssets: number(row.total_assets),
		totalLiabilities: number(row.total_liabilities),
		totalEquity: number(row.total_equity),
		monthIncome: number(row.month_income),
		monthExpenses: number(row.month_expenses),
		monthNetIncome: number(row.month_net_income),
		bankAccounts,
		balanceSheetReceivedAt: row.balance_sheet_received_at,
		profitLossReceivedAt: row.profit_loss_received_at,
		balanceSheetFilename: row.balance_sheet_filename,
		profitLossFilename: row.profit_loss_filename,
		sourceUpdatedAt: row.source_updated_at
	};
}

function emptySnapshot(report: ScheduledQuickBooksReport): FinanceReportSnapshot {
	return {
		periodKey: report.periodStartDate.slice(0, 7),
		asOfDate: report.asOfDate,
		periodStartDate: report.periodStartDate,
		cashTotal: 0,
		accountsReceivable: 0,
		accountsPayable: 0,
		totalAssets: 0,
		totalLiabilities: 0,
		totalEquity: 0,
		monthIncome: 0,
		monthExpenses: 0,
		monthNetIncome: 0,
		bankAccounts: [],
		balanceSheetReceivedAt: '',
		profitLossReceivedAt: '',
		balanceSheetFilename: '',
		profitLossFilename: '',
		sourceUpdatedAt: ''
	};
}

export class FinanceReportSnapshotRepository {
	constructor(private readonly db: Database) {}

	async startIngest(input: {
		sourceMessageId: string;
		sourceSender: string;
		sourceSubject: string;
		receivedAt: string;
	}): Promise<'new' | 'complete' | 'processing' | 'failed'> {
		const existing = await this.db
			.prepare('SELECT status FROM finance_scheduled_report_ingest WHERE source_message_id = ?1')
			.bind(input.sourceMessageId)
			.first<IngestRow>();
		if (existing) return existing.status;
		await this.db
			.prepare(
				`INSERT OR IGNORE INTO finance_scheduled_report_ingest (
					source_message_id, source_sender, source_subject, received_at
				) VALUES (?1, ?2, ?3, ?4)`
			)
			.bind(input.sourceMessageId, input.sourceSender, input.sourceSubject, input.receivedAt)
			.run();
		return 'new';
	}

	async saveReport(input: {
		report: ScheduledQuickBooksReport;
		filename: string;
		receivedAt: string;
	}): Promise<void> {
		const periodKey = input.report.periodStartDate.slice(0, 7);
		const row = await this.db
			.prepare(
				`SELECT period_key, as_of_date, period_start_date, cash_total, accounts_receivable,
					accounts_payable, total_assets, total_liabilities, total_equity, month_income,
					month_expenses, month_net_income, balance_sheet_received_at, profit_loss_received_at,
					balance_sheet_filename, profit_loss_filename, source_updated_at
				 FROM finance_scheduled_report_snapshots WHERE period_key = ?1`
			)
			.bind(periodKey)
			.first<SnapshotRow>();
		const snapshot = row ? snapshotFromRow(row) : emptySnapshot(input.report);
		snapshot.asOfDate = input.report.asOfDate;
		snapshot.periodStartDate = input.report.periodStartDate;
		snapshot.sourceUpdatedAt = input.receivedAt;
		if (input.report.type === 'balance-sheet') {
			snapshot.cashTotal = input.report.cashTotal;
			snapshot.accountsReceivable = input.report.accountsReceivable;
			snapshot.accountsPayable = input.report.accountsPayable;
			snapshot.totalAssets = input.report.totalAssets;
			snapshot.totalLiabilities = input.report.totalLiabilities;
			snapshot.totalEquity = input.report.totalEquity;
			snapshot.balanceSheetReceivedAt = input.receivedAt;
			snapshot.balanceSheetFilename = input.filename;
		} else {
			snapshot.monthIncome = input.report.monthIncome;
			snapshot.monthExpenses = input.report.monthExpenses;
			snapshot.monthNetIncome = input.report.monthNetIncome;
			snapshot.profitLossReceivedAt = input.receivedAt;
			snapshot.profitLossFilename = input.filename;
		}

		const statements = [
			this.db
				.prepare(
					`INSERT INTO finance_scheduled_report_snapshots (
					period_key, as_of_date, period_start_date, cash_total, accounts_receivable,
					accounts_payable, total_assets, total_liabilities, total_equity, month_income,
					month_expenses, month_net_income, balance_sheet_received_at, profit_loss_received_at,
					balance_sheet_filename, profit_loss_filename, source_updated_at, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?18)
				ON CONFLICT(period_key) DO UPDATE SET
					as_of_date = excluded.as_of_date, period_start_date = excluded.period_start_date,
					cash_total = excluded.cash_total, accounts_receivable = excluded.accounts_receivable,
					accounts_payable = excluded.accounts_payable, total_assets = excluded.total_assets,
					total_liabilities = excluded.total_liabilities, total_equity = excluded.total_equity,
					month_income = excluded.month_income, month_expenses = excluded.month_expenses,
					month_net_income = excluded.month_net_income,
					balance_sheet_received_at = excluded.balance_sheet_received_at,
					profit_loss_received_at = excluded.profit_loss_received_at,
					balance_sheet_filename = excluded.balance_sheet_filename,
					profit_loss_filename = excluded.profit_loss_filename,
					source_updated_at = excluded.source_updated_at, updated_at = excluded.updated_at`
				)
				.bind(
					snapshot.periodKey,
					snapshot.asOfDate,
					snapshot.periodStartDate,
					snapshot.cashTotal,
					snapshot.accountsReceivable,
					snapshot.accountsPayable,
					snapshot.totalAssets,
					snapshot.totalLiabilities,
					snapshot.totalEquity,
					snapshot.monthIncome,
					snapshot.monthExpenses,
					snapshot.monthNetIncome,
					snapshot.balanceSheetReceivedAt,
					snapshot.profitLossReceivedAt,
					snapshot.balanceSheetFilename,
					snapshot.profitLossFilename,
					snapshot.sourceUpdatedAt,
					input.receivedAt
				)
		];
		if (input.report.type === 'balance-sheet') {
			statements.push(
				this.db
					.prepare('DELETE FROM finance_scheduled_report_bank_accounts WHERE period_key = ?1')
					.bind(periodKey),
				...input.report.bankAccounts.map((account, position) =>
					this.db
						.prepare(
							`INSERT INTO finance_scheduled_report_bank_accounts (
								period_key, name, balance, position
							) VALUES (?1, ?2, ?3, ?4)`
						)
						.bind(periodKey, account.name, account.balance, position)
				)
			);
		}
		await this.db.batch(statements);
	}

	async completeIngest(
		sourceMessageId: string,
		acceptedAttachmentCount: number,
		now: string
	): Promise<void> {
		await this.db
			.prepare(
				`UPDATE finance_scheduled_report_ingest
				 SET status = 'complete', accepted_attachment_count = ?2, completed_at = ?3, last_error = ''
				 WHERE source_message_id = ?1`
			)
			.bind(sourceMessageId, acceptedAttachmentCount, now)
			.run();
	}

	async failIngest(sourceMessageId: string, message: string, now: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE finance_scheduled_report_ingest
				 SET status = 'failed', completed_at = ?2, last_error = ?3 WHERE source_message_id = ?1`
			)
			.bind(sourceMessageId, now, message.slice(0, 500))
			.run();
	}

	async latestSnapshot(): Promise<FinanceReportSnapshot | null> {
		const row = await this.db
			.prepare(
				`SELECT period_key, as_of_date, period_start_date, cash_total, accounts_receivable,
					accounts_payable, total_assets, total_liabilities, total_equity, month_income,
					month_expenses, month_net_income, balance_sheet_received_at, profit_loss_received_at,
					balance_sheet_filename, profit_loss_filename, source_updated_at
				 FROM finance_scheduled_report_snapshots
				 ORDER BY source_updated_at DESC LIMIT 1`
			)
			.first<SnapshotRow>();
		if (!row) return null;
		const bankAccounts = await this.db
			.prepare(
				`SELECT name, balance, position FROM finance_scheduled_report_bank_accounts
				 WHERE period_key = ?1 ORDER BY position ASC, name COLLATE NOCASE`
			)
			.bind(row.period_key)
			.all<BankAccountRow>();
		return snapshotFromRow(
			row,
			bankAccounts.results.map((account) => ({
				name: account.name,
				balance: number(account.balance)
			}))
		);
	}
}
