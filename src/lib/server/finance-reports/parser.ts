import * as XLSX from 'xlsx';

export type ScheduledQuickBooksBankAccount = {
	name: string;
	balance: number;
};

export type ScheduledQuickBooksReport =
	| {
			type: 'balance-sheet';
			asOfDate: string;
			periodStartDate: string;
			cashTotal: number;
			accountsReceivable: number;
			accountsPayable: number;
			totalAssets: number;
			totalLiabilities: number;
			totalEquity: number;
			bankAccounts: ScheduledQuickBooksBankAccount[];
	  }
	| {
			type: 'profit-loss';
			asOfDate: string;
			periodStartDate: string;
			monthIncome: number;
			monthExpenses: number;
			monthNetIncome: number;
	  };

type Row = unknown[];

function safeText(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (value instanceof Date && Number.isFinite(value.getTime()))
		return value.toISOString().slice(0, 10);
	return '';
}

function normalized(value: string): string {
	return value
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/gu, ' ')
		.trim();
}

function money(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value !== 'string') return null;
	const cleaned = value.replaceAll(/[$,\s]/gu, '');
	if (!cleaned) return null;
	if (/^\(.+\)$/u.test(cleaned)) {
		const amount = Number(cleaned.slice(1, -1));
		return Number.isFinite(amount) ? -amount : null;
	}
	const amount = Number(cleaned);
	return Number.isFinite(amount) ? amount : null;
}

function rowLabel(row: Row): string {
	const labels: string[] = [];
	for (const value of row) {
		if (typeof value === 'number' && Number.isFinite(value)) break;
		if (typeof value === 'string' && money(value) !== null) break;
		const text = safeText(value);
		if (text) labels.push(text);
	}
	return labels.join(' ');
}

function rowAmount(row: Row): number | null {
	for (const value of [...row].reverse()) {
		const amount = money(value);
		if (amount !== null) return amount;
	}
	return null;
}

function flattenedText(rows: Row[]): string[] {
	return rows.flatMap((row) => row.map(safeText).filter(Boolean));
}

function firstAmount(rows: Row[], labels: string[]): number {
	const targets = labels.map(normalized);
	for (const row of rows) {
		const label = normalized(rowLabel(row));
		if (!label) continue;
		if (targets.some((target) => label === target || label.startsWith(`${target} `))) {
			const amount = rowAmount(row);
			if (amount !== null) return amount;
		}
	}
	return 0;
}

function bankAccountBalances(rows: Row[]): ScheduledQuickBooksBankAccount[] {
	const accounts: ScheduledQuickBooksBankAccount[] = [];
	let inBankAccounts = false;
	for (const row of rows) {
		const name = rowLabel(row);
		const label = normalized(name);
		if (!inBankAccounts) {
			if (label === 'bank accounts') inBankAccounts = true;
			continue;
		}
		if (label === 'total bank accounts') break;
		const balance = rowAmount(row);
		if (!name || balance === null) continue;
		accounts.push({ name, balance });
	}
	return accounts;
}

function dateFromText(value: string, fallback: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
}

function monthStart(value: string): string {
	return `${value.slice(0, 7)}-01`;
}

function balanceSheetDates(
	text: string[],
	fallback: string
): { asOfDate: string; periodStartDate: string } {
	const asOf = text.find((value) => /^as of\b/iu.test(value));
	const asOfDate = asOf ? dateFromText(asOf.replace(/^as of\s*/iu, ''), fallback) : fallback;
	return { asOfDate, periodStartDate: monthStart(asOfDate) };
}

function profitLossDates(
	text: string[],
	fallback: string
): { asOfDate: string; periodStartDate: string } {
	const period = text.find((value) => /\b(?:to|-|–)\b/u.test(value));
	if (!period) return { asOfDate: fallback, periodStartDate: monthStart(fallback) };
	const parts = period.split(/\s+(?:to|-|–)\s+/iu);
	if (parts.length !== 2) return { asOfDate: fallback, periodStartDate: monthStart(fallback) };
	const asOfDate = dateFromText(parts[1], fallback);
	const year = /\b(\d{4})\b/u.exec(parts[1])?.[1];
	const periodStartDate = dateFromText(
		year && !/\b\d{4}\b/u.test(parts[0]) ? `${parts[0]}, ${year}` : parts[0],
		monthStart(fallback)
	);
	return { asOfDate, periodStartDate };
}

function workbookRows(content: ArrayBuffer): Row[] {
	const workbook = XLSX.read(content, { type: 'array', cellDates: true, raw: true });
	const sheetName = workbook.SheetNames.find((name) => Boolean(workbook.Sheets[name]));
	if (!sheetName) throw new Error('The report spreadsheet has no worksheet.');
	return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
		header: 1,
		defval: '',
		raw: true
	}) as Row[];
}

export function parseScheduledQuickBooksReport(
	content: ArrayBuffer,
	receivedAt: string
): ScheduledQuickBooksReport | null {
	const rows = workbookRows(content);
	const text = flattenedText(rows);
	const title = normalized(text.slice(0, 12).join(' '));
	const fallback = receivedAt.slice(0, 10);
	if (title.includes('balance sheet') || title.includes('statement of financial position')) {
		const { asOfDate, periodStartDate } = balanceSheetDates(text, fallback);
		return {
			type: 'balance-sheet',
			asOfDate,
			periodStartDate,
			cashTotal: firstAmount(rows, [
				'total bank accounts',
				'bank accounts',
				'total cash and cash equivalents',
				'cash and cash equivalents'
			]),
			accountsReceivable: firstAmount(rows, [
				'total accounts receivable',
				'accounts receivable a r',
				'accounts receivable'
			]),
			accountsPayable: firstAmount(rows, [
				'total accounts payable',
				'accounts payable a p',
				'accounts payable'
			]),
			totalAssets: firstAmount(rows, ['total assets']),
			totalLiabilities: firstAmount(rows, ['total liabilities']),
			totalEquity: firstAmount(rows, ['total equity']),
			bankAccounts: bankAccountBalances(rows)
		};
	}
	if (
		title.includes('profit and loss') ||
		title.includes('profit loss') ||
		title.includes('statement of activity')
	) {
		const { asOfDate, periodStartDate } = profitLossDates(text, fallback);
		return {
			type: 'profit-loss',
			asOfDate,
			periodStartDate,
			monthIncome: firstAmount(rows, ['total income', 'total revenue']),
			monthExpenses: firstAmount(rows, ['total expenses']),
			monthNetIncome: firstAmount(rows, ['net income', 'net revenue', 'change in net assets'])
		};
	}
	return null;
}
