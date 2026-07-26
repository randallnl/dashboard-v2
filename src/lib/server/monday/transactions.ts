import type { Order, Payment } from '$lib/types/domain';
import { normalizeEmail } from './members';
import { MondayClient } from './client';

export const TRANSACTION_BOARD_ID = '18410480642';
export const SHOPIFY_ADMIN_URL = 'https://admin.shopify.com/store/queerlective/orders';
export const SUBSCRIPTION_LABEL = 'CoLab Membership Subscription';

const COLUMNS = {
	amount: 'numeric_mm2fgrdz',
	details: 'text_mm2fb4c7',
	email: 'text_mm2f5770',
	fulfillmentStatus: 'color_mm4wf14k',
	orderDate: 'pulse_log_mm4jc9jv'
} as const;

type Column = { id: string; text: string | null; value: string | null };
type Item = { id: string; name: string; column_values: Column[] };
type Page = { cursor: string | null; items: Item[] };
export type Transaction = Payment & { fulfillmentStatus: string };

const INITIAL = `
	query TransactionBoard($boardId: ID!, $columnIds: [String!]!) {
		boards(ids: [$boardId]) {
			items_page(limit: 500) {
				cursor
				items { id name column_values(ids: $columnIds) { id text value } }
			}
		}
	}
`;
const NEXT = `
	query TransactionBoardNext($cursor: String!, $columnIds: [String!]!) {
		next_items_page(cursor: $cursor, limit: 500) {
			cursor
			items { id name column_values(ids: $columnIds) { id text value } }
		}
	}
`;

function values(item: Item): Map<string, Column> {
	return new Map(item.column_values.map((column) => [column.id, column]));
}

function text(columns: Map<string, Column>, id: string): string {
	return columns.get(id)?.text?.trim() ?? '';
}

function amount(value: string): number {
	const parsed = Number(value.replace(/[^0-9.-]/gu, ''));
	return Number.isFinite(parsed) ? parsed : 0;
}

export function mapTransaction(item: Item): Transaction {
	const columns = values(item);
	return {
		id: item.id,
		name: item.name,
		amount: amount(text(columns, COLUMNS.amount)),
		details: text(columns, COLUMNS.details),
		email: normalizeEmail(text(columns, COLUMNS.email)),
		orderDate: text(columns, COLUMNS.orderDate),
		fulfillmentStatus: text(columns, COLUMNS.fulfillmentStatus)
	};
}

function isSubscription(details: string): boolean {
	return details.toLocaleLowerCase('en-US').includes(SUBSCRIPTION_LABEL.toLocaleLowerCase('en-US'));
}

export function paymentsForEmail(
	transactions: Transaction[],
	email: string,
	limit = 50
): Payment[] {
	const normalized = normalizeEmail(email);
	return transactions
		.filter(
			(transaction) => transaction.email === normalized && isSubscription(transaction.details)
		)
		.sort((left, right) => right.orderDate.localeCompare(left.orderDate))
		.slice(0, limit)
		.map(({ id, name, amount, details, email: transactionEmail, orderDate }) => ({
			id,
			name,
			amount,
			details,
			email: transactionEmail,
			orderDate
		}));
}

export function openOrdersForEmail(
	transactions: Transaction[],
	email: string,
	limit = 50
): Order[] {
	const normalized = normalizeEmail(email);
	return transactions
		.filter(
			(transaction) =>
				transaction.email === normalized &&
				transaction.fulfillmentStatus.toLocaleLowerCase('en-US') === 'unfulfilled' &&
				!isSubscription(transaction.details)
		)
		.sort((left, right) => right.orderDate.localeCompare(left.orderDate))
		.slice(0, limit)
		.map(({ id, name, details, orderDate, fulfillmentStatus }) => ({
			id,
			name,
			details,
			orderDate,
			fulfillmentStatus
		}));
}

export class TransactionDirectory {
	constructor(private readonly monday: MondayClient) {}

	async list(): Promise<Transaction[]> {
		const initial = await this.monday.request<{ boards: Array<{ items_page: Page }> }>(INITIAL, {
			boardId: TRANSACTION_BOARD_ID,
			columnIds: Object.values(COLUMNS)
		});
		const first = initial.boards[0]?.items_page;
		if (!first) return [];
		const items = [...first.items];
		let cursor = first.cursor;
		while (cursor) {
			const page = await this.monday.request<{ next_items_page: Page }>(NEXT, {
				cursor,
				columnIds: Object.values(COLUMNS)
			});
			items.push(...page.next_items_page.items);
			cursor = page.next_items_page.cursor;
		}
		return items.map(mapTransaction);
	}
}
