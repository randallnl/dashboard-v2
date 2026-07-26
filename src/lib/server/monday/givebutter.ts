import type { GivebutterSignup } from '$lib/types/domain';
import { normalizeEmail } from './members';
import { MondayClient } from './client';

export const GIVEBUTTER_TRANSACTION_BOARD_ID = '18408976259';

const COLUMNS = {
	donorName: 'text_mm2fapmz',
	donorEmail: 'text_mm2f5770',
	campaignId: 'text_mm2fnp7s',
	eventTitle: 'text_mm2fb4c7',
	transactionDate: 'text_mm35qyja'
} as const;

type Column = { id: string; text: string | null; value: string | null };
type Item = { id: string; name: string; column_values: Column[] };
type Page = { cursor: string | null; items: Item[] };

const INITIAL = `
	query GivebutterTransactions($boardId: ID!, $columnIds: [String!]!) {
		boards(ids: [$boardId]) {
			items_page(limit: 500) {
				cursor
				items { id name column_values(ids: $columnIds) { id text value } }
			}
		}
	}
`;

const NEXT = `
	query GivebutterTransactionsNext($cursor: String!, $columnIds: [String!]!) {
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

export function mapGivebutterSignup(item: Item, syncedAt: string): GivebutterSignup {
	const columns = values(item);
	return {
		id: item.id,
		donorName: text(columns, COLUMNS.donorName) || item.name,
		donorEmail: normalizeEmail(text(columns, COLUMNS.donorEmail)),
		campaignId: text(columns, COLUMNS.campaignId),
		eventTitle: text(columns, COLUMNS.eventTitle),
		transactionDate: text(columns, COLUMNS.transactionDate),
		syncedAt
	};
}

export class GivebutterDirectory {
	constructor(private readonly monday: MondayClient) {}

	async list(): Promise<GivebutterSignup[]> {
		const initial = await this.monday.request<{ boards: Array<{ items_page: Page }> }>(INITIAL, {
			boardId: GIVEBUTTER_TRANSACTION_BOARD_ID,
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
		const syncedAt = new Date().toISOString();
		return items
			.map((item) => mapGivebutterSignup(item, syncedAt))
			.filter((signup) => signup.campaignId);
	}
}
