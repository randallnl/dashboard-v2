import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseScheduledQuickBooksReport } from './parser';

function workbookBuffer(rows: unknown[][]): ArrayBuffer {
	const sheet = XLSX.utils.aoa_to_sheet(rows);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, sheet, 'Report');
	return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

describe('parseScheduledQuickBooksReport', () => {
	it('extracts a Balance Sheet snapshot', () => {
		const report = parseScheduledQuickBooksReport(
			workbookBuffer([
				['Balance Sheet'],
				['Queerlective'],
				['As of November 9, 2026'],
				['Total Bank Accounts', 12345.67],
				['Total Accounts Receivable', 480],
				['Total Accounts Payable', 270],
				['Total Assets', 15125.67],
				['Total Liabilities', 1270],
				['Total Equity', 13855.67]
			]),
			'2026-11-09T18:00:00.000Z'
		);
		expect(report).toMatchObject({
			type: 'balance-sheet',
			asOfDate: '2026-11-09',
			periodStartDate: '2026-11-01',
			cashTotal: 12345.67,
			accountsReceivable: 480,
			accountsPayable: 270,
			totalAssets: 15125.67,
			totalLiabilities: 1270,
			totalEquity: 13855.67
		});
	});

	it('extracts a Profit and Loss snapshot', () => {
		const report = parseScheduledQuickBooksReport(
			workbookBuffer([
				['Profit and Loss'],
				['Queerlective'],
				['November 1 - November 9, 2026'],
				['Total Income', 6200],
				['Total Expenses', 4100],
				['Net Income', 2100]
			]),
			'2026-11-09T18:00:00.000Z'
		);
		expect(report).toMatchObject({
			type: 'profit-loss',
			asOfDate: '2026-11-09',
			periodStartDate: '2026-11-01',
			monthIncome: 6200,
			monthExpenses: 4100,
			monthNetIncome: 2100
		});
	});

	it('extracts nonprofit-formatted Financial Position and Activity reports', () => {
		const financialPosition = parseScheduledQuickBooksReport(
			workbookBuffer([
				['Statement of Financial Position'],
				['Queerlective'],
				['As of November 10, 2026'],
				['Bank Accounts'],
				['Business Adv Fundamentals - 0976 - 1', 526.97],
				['PayPal Bank', 0],
				['ST M COMMUNITY CHECKING (0020) - 3', 18298.17],
				['Venmo (8531) - 4', 529.11],
				['Total', 'Bank Accounts', 19354.25],
				['Accounts Receivable'],
				['Total', 'Accounts Receivable', 13272.61],
				['Accounts Payable'],
				['Total', 'Accounts Payable', 120],
				['Total Assets', 19415],
				['Total Liabilities', 1325],
				['Total Equity', 18090]
			]),
			'2026-11-10T18:00:00.000Z'
		);
		const activity = parseScheduledQuickBooksReport(
			workbookBuffer([
				['Statement of Activity'],
				['Queerlective'],
				['November 1 - November 10, 2026'],
				['Total', 'Revenue', 6900],
				['Total', 'Expenses', 4300],
				['Change in', 'Net Assets', 2600]
			]),
			'2026-11-10T18:00:00.000Z'
		);

		expect(financialPosition).toMatchObject({
			type: 'balance-sheet',
			asOfDate: '2026-11-10',
			cashTotal: 19354.25,
			accountsReceivable: 13272.61,
			accountsPayable: 120,
			totalAssets: 19415,
			bankAccounts: [
				{ name: 'Business Adv Fundamentals - 0976 - 1', balance: 526.97 },
				{ name: 'PayPal Bank', balance: 0 },
				{ name: 'ST M COMMUNITY CHECKING (0020) - 3', balance: 18298.17 },
				{ name: 'Venmo (8531) - 4', balance: 529.11 }
			]
		});
		expect(activity).toMatchObject({
			type: 'profit-loss',
			asOfDate: '2026-11-10',
			monthIncome: 6900,
			monthExpenses: 4300,
			monthNetIncome: 2600
		});
	});
});
